import type { PrismaClient } from "../../generated/prisma/index.js";
import { AppError } from "../errors/AppError.js";
import prisma from "../../prisma/prisma.js";
import { MercadoPagoService } from "./MercadoPagoService.js";
import { StockService } from "./StockService.js";

type ReturnDecision = "APPROVE" | "DENY";

export class AdminReturnService {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly mercadoPago = new MercadoPagoService(),
    private readonly stock = new StockService(),
  ) {}

  async listPending() {
    const orders = await this.database.order.findMany({
      where: { status: "RETURN_REQUESTED" },
      include: {
        customer: { select: { name: true, email: true } },
        seller: { select: { storeName: true } },
        directSeller: { select: { name: true } },
        items: { select: { productName: true, quantity: true, unitPrice: true } },
        payment: { select: { status: true } },
        events: {
          where: { type: "RETURN_REQUESTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, metadata: true },
        },
      },
      orderBy: { updatedAt: "asc" },
    });

    return orders.map((order) => {
      const request = order.events[0];
      const metadata = request?.metadata;
      const reason = metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata.reason
        : undefined;
      return {
        ...order,
        returnReason: typeof reason === "string" ? reason : "Motivo não informado",
        returnRequestedAt: request?.createdAt ?? order.updatedAt,
      };
    });
  }

  resolve(orderId: string, adminId: string, input: { decision: ReturnDecision; note: string }) {
    return this.database.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: "RETURN_REQUESTED" },
        data: { updatedAt: new Date() },
      });
      if (claimed.count !== 1) {
        const existing = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
        if (!existing) throw new AppError(404, "Pedido não encontrado");
        throw new AppError(409, "A solicitação já foi resolvida ou não está mais disponível");
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
      });
      if (!order) throw new AppError(404, "Pedido não encontrado");

      if (input.decision === "APPROVE") {
        if (order.payment?.status !== "APPROVED" || !order.payment.providerRef) {
          throw new AppError(409, "Não há pagamento aprovado disponível para estorno");
        }
        await this.mercadoPago.refundPayment(order.payment.providerRef, `return-${order.id}`);
      }

      const toStatus = input.decision === "APPROVE" ? "REFUNDED" : "DELIVERED";
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "RETURN_REQUESTED" },
        data: {
          status: toStatus,
          ...(input.decision === "APPROVE" && order.directSellerUserId
            ? { quickSalePayoutStatus: "VOIDED" as const }
            : {}),
        },
      });
      if (updated.count !== 1) {
        throw new AppError(409, "A solicitação foi atualizada por outra ação");
      }

      if (input.decision === "APPROVE") {
        await tx.paymentTransaction.update({
          where: { orderId: order.id },
          data: { status: "REFUNDED" },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          userId: adminId,
          type: input.decision === "APPROVE" ? "RETURN_REFUND_APPROVED" : "RETURN_DENIED",
          fromStatus: "RETURN_REQUESTED",
          toStatus,
          metadata: { note: input.note },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: input.decision === "APPROVE" ? "RETURN_REFUND_APPROVED" : "RETURN_DENIED",
          entityType: "Order",
          entityId: order.id,
          metadata: { note: input.note },
        },
      });
      await tx.notification.create({
        data: {
          userId: order.customerId,
          type: "ORDER_UPDATE",
          title: input.decision === "APPROVE" ? "Devolução aprovada" : "Solicitação de devolução analisada",
          body: input.decision === "APPROVE"
            ? "A devolução foi aprovada e o estorno integral foi solicitado ao Mercado Pago."
            : `A solicitação de devolução foi negada. Motivo: ${input.note}`,
          data: { orderId: order.id, status: toStatus },
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: { payment: true, items: true },
      });
    }, { timeout: 30_000 });
  }
}
