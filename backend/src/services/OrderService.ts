import { AppError } from "../errors/AppError.js";
import { OrderRepository } from "../repository/OrderRepository.js";
import { CorreiosService } from "./CorreiosService.js";
import { MercadoPagoService } from "./MercadoPagoService.js";
import { StockService } from "./StockService.js";

export class OrderService {
  constructor(
    private readonly stockService = new StockService(),
    private readonly mercadoPago = new MercadoPagoService(),
    private readonly correios = new CorreiosService(),
    private readonly orderRepository = new OrderRepository(),
  ) {}

  async listMine(userId: string) {
    return this.orderRepository.listMine(userId);
  }

  async checkout(userId: string, input: { zipCode?: string; itemIds?: string[] }) {
    const cart = await this.orderRepository.findCheckoutCart(userId, input.itemIds);

    if (!cart || cart.items.length === 0) {
      throw new AppError(400, "Carrinho vazio");
    }

    const itemsBySeller = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const list = itemsBySeller.get(item.product.sellerId) ?? [];
      list.push(item);
      itemsBySeller.set(item.product.sellerId, list);
    }

    const deliveryEstimateDate = await this.correios.estimateDeliveryDate(input.zipCode);
    const cartItems = cart.items;
    const createdOrders = await this.orderRepository.transaction(async (tx) => {
      const orders = [];

      for (const [sellerId, items] of itemsBySeller) {
        await this.stockService.reserve(
          tx,
          items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );

        const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
        const createdOrder = await this.orderRepository.createOrder(tx, {
          customerId: userId,
          sellerId,
          total,
          deliveryEstimateDate,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price,
          })),
        });

        orders.push(createdOrder);
      }

      return orders;
    });

    const orders = [];

    try {
      for (const order of createdOrders) {
      const preference = await this.mercadoPago.createPreference({
        orderId: order.id,
        items: order.items.map((item) => ({
          title: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
      });

      orders.push(
        await this.orderRepository.updateOrderPayment(order.id, {
          mercadoPagoPreference: preference.initPoint ?? preference.sandboxInitPoint,
          providerRef: preference.providerRef,
        }),
      );
    }
    } catch (error) {
      await this.orderRepository.transaction(async (tx) => {
        await this.stockService.release(
          tx,
          cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );
        await this.orderRepository.cancelOrders(tx, createdOrders.map((order) => order.id));
      });

      throw error instanceof AppError ? error : new AppError(502, "Nao foi possivel iniciar o pagamento");
    }

    await this.orderRepository.transaction(async (tx) => {
      await this.orderRepository.deleteCartItems(tx, cartItems.map((item) => item.id));
    });

    return orders;
  }

  async applyPaymentWebhook(input: { orderId: string; providerRef?: string; status: "APPROVED" | "REJECTED" | "CANCELED" | "REFUNDED"; rawPayload?: unknown }) {
    return this.orderRepository.transaction(async (tx) => {
      const order = await this.orderRepository.findOrderWithItemsAndPayment(tx, input.orderId);

      if (!order) {
        throw new AppError(404, "Pedido nao encontrado");
      }

      if (["REJECTED", "CANCELED", "REFUNDED"].includes(input.status) && order.status === "PENDING_PAYMENT") {
        await this.stockService.release(
          tx,
          order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );
      }

      return this.orderRepository.updatePaymentFromWebhook(tx, {
        orderId: order.id,
        orderStatus: input.status === "APPROVED" ? "PAID" : input.status === "REFUNDED" ? "REFUNDED" : "CANCELED",
        paymentStatus: input.status,
        ...(input.providerRef ? { providerRef: input.providerRef } : {}),
        ...(input.rawPayload === undefined ? {} : { rawPayload: input.rawPayload }),
      });
    });
  }

  async processMercadoPagoWebhook(input: {
    body: { data?: { id?: string | number }; [key: string]: unknown };
    query: Record<string, unknown>;
    signature: string | undefined;
    requestId: string | undefined;
  }) {
    const paymentId = this.extractPaymentId(input.body, input.query);
    if (!paymentId) {
      throw new AppError(400, "Pagamento nao informado no webhook");
    }

    this.mercadoPago.verifyWebhookSignature({
      dataId: paymentId,
      signature: input.signature,
      requestId: input.requestId,
    });

    const payment = await this.mercadoPago.getPayment(paymentId);
    if (!payment.orderId) {
      throw new AppError(400, "Pagamento sem pedido vinculado");
    }

    if (!payment.status) {
      return { received: true, ignored: true };
    }

    return this.applyPaymentWebhook({
      orderId: payment.orderId,
      providerRef: payment.providerRef,
      status: payment.status,
      rawPayload: payment.rawPayload,
    });
  }

  private extractPaymentId(body: { data?: { id?: string | number } }, query: Record<string, unknown>) {
    const queryDataId = query["data.id"];
    const queryId = query.id;
    const bodyId = body.data?.id;
    const paymentId = queryDataId ?? queryId ?? bodyId;

    return typeof paymentId === "string" || typeof paymentId === "number" ? String(paymentId) : null;
  }

  async updateSellerOrder(userId: string, orderId: string, status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED", correiosTrackingCode?: string) {
    const seller = await this.orderRepository.findSellerByUserId(userId);
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    return this.orderRepository.transaction(async (tx) => {
      const order = await this.orderRepository.findSellerOrderWithItems(tx, seller.id, orderId);

      if (!order) {
        throw new AppError(404, "Pedido nao encontrado");
      }

      if (["CANCELED", "REFUNDED"].includes(status) && !["CANCELED", "REFUNDED"].includes(order.status)) {
        await this.stockService.release(
          tx,
          order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );
      }

      return this.orderRepository.updateSellerOrderStatus(tx, orderId, {
        status,
        ...(correiosTrackingCode ? { correiosTrackingCode } : {}),
      });
    });
  }
}
