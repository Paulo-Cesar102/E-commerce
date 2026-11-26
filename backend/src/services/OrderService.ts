import crypto from "node:crypto";
import { AppError } from "../errors/AppError.js";
import { OrderRepository } from "../repository/OrderRepository.js";
import { CorreiosService } from "./CorreiosService.js";
import { MercadoPagoService } from "./MercadoPagoService.js";
import { StockService } from "./StockService.js";
import { AddressService } from "./AddressService.js";
import { env } from "../config/env.js";
import { SellerPlanService } from "./SellerPlanService.js";
import { calculateQuickSaleCommission } from "./QuickSaleService.js";

export class OrderService {
  constructor(
    private readonly stockService = new StockService(),
    private readonly mercadoPago = new MercadoPagoService(),
    private readonly correios = new CorreiosService(),
    private readonly orderRepository = new OrderRepository(),
    private readonly addresses = new AddressService(),
    private readonly sellerPlans = new SellerPlanService(),
  ) {}

  async listMine(userId: string) {
    return this.orderRepository.listMine(userId);
  }

  async checkout(userId: string, input: { addressId: string; itemIds?: string[]; couponCode?: string }) {
    const cart = await this.orderRepository.findCheckoutCart(userId, input.itemIds);

    if (!cart || cart.items.length === 0) {
      throw new AppError(400, "Carrinho vazio");
    }

    const quickSaleItems = cart.items.filter((item) => item.product.listingType === "QUICK_SALE");
    if (quickSaleItems.length) {
      const quickSaleOwners = new Set(quickSaleItems.map((item) => `${item.product.ownerUserId}:${item.product.originPostalCode}`));
      if (quickSaleItems.length !== cart.items.length || quickSaleOwners.size !== 1) {
        throw new AppError(400, "Finalize anuncios de Venda rapida de um mesmo anunciante e CEP em um checkout separado das lojas.");
      }
    }

    const checkoutGroups = new Map<string, {
      sellerId?: string;
      directSellerUserId?: string;
      items: typeof cart.items;
    }>();
    for (const item of cart.items) {
      if (item.product.listingType === "QUICK_SALE") {
        if (!item.product.ownerUserId) throw new AppError(409, "Anuncio rapido sem proprietario");
        if (item.product.ownerUserId === userId) throw new AppError(403, "Voce nao pode comprar o proprio anuncio");
        const key = `quick-sale:${item.product.ownerUserId}:${item.product.originPostalCode ?? ""}`;
        const group = checkoutGroups.get(key) ?? { directSellerUserId: item.product.ownerUserId, items: [] };
        group.items.push(item);
        checkoutGroups.set(key, group);
      } else {
        if (!item.product.sellerId) throw new AppError(409, "Produto de loja sem lojista");
        const key = `store:${item.product.sellerId}`;
        const group = checkoutGroups.get(key) ?? { sellerId: item.product.sellerId, items: [] };
        group.items.push(item);
        checkoutGroups.set(key, group);
      }
    }

    await this.sellerPlans.assertSellersCanCheckout(
      [...checkoutGroups.values()].flatMap((group) => group.sellerId ? [group.sellerId] : []),
    );
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) throw new AppError(503, "Pagamento indisponivel: configure o Mercado Pago");
    const address = await this.addresses.getOwned(userId, input.addressId);
    const cartItems = cart.items;
    const checkoutId = crypto.randomUUID();
    const createdOrders = await this.orderRepository.transaction(async (tx) => {
      const orders = [];
      const coupon = input.couponCode ? await this.orderRepository.findCouponForCheckout(tx, input.couponCode, userId) : null;
      if (input.couponCode && !coupon) throw new AppError(400, "Cupom invalido");
      if (coupon) {
        const now = new Date();
        if (!coupon.active || coupon.startsAt > now || (coupon.endsAt && coupon.endsAt < now)) throw new AppError(400, "Cupom fora da validade");
        if (coupon.redemptions.length || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) throw new AppError(400, "Cupom esgotado ou ja utilizado");
      }
      const subtotalTotal = cartItems.reduce((sum, item) => sum + Number(item.variant?.price ?? item.product.price) * item.quantity, 0);
      if (coupon?.minOrderValue && subtotalTotal < Number(coupon.minOrderValue)) throw new AppError(400, `Pedido minimo para o cupom: ${Number(coupon.minOrderValue).toFixed(2)}`);
      const discountTotal = coupon ? Math.min(coupon.type === "PERCENT" ? subtotalTotal * Number(coupon.value) / 100 : Number(coupon.value), subtotalTotal) : 0;
      let discountAllocated = 0;
      const sellerEntries = [...checkoutGroups.values()];

      for (const [sellerIndex, group] of sellerEntries.entries()) {
        const { sellerId, directSellerUserId, items } = group;
        await this.stockService.reserve(
          tx,
          items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
        );

        const origin = items[0]?.product.seller?.postalCode ?? items[0]?.product.originPostalCode;
        if (!origin) throw new AppError(422, "A loja ainda nao configurou o CEP de origem para entrega");
        const quote = await this.correios.quote({ fromPostalCode: origin, toPostalCode: address.postalCode, items: items.map((item) => ({ quantity: item.quantity, unitPrice: Number(item.variant?.price ?? item.product.price) })) });
        const subtotal = items.reduce((sum, item) => sum + Number(item.variant?.price ?? item.product.price) * item.quantity, 0);
        const discount = sellerIndex === sellerEntries.length - 1 ? discountTotal - discountAllocated : Math.round(discountTotal * subtotal / subtotalTotal * 100) / 100;
        discountAllocated += discount;
        const platformFee = directSellerUserId
          ? calculateQuickSaleCommission(subtotal - discount)
          : Math.round((subtotal - discount) * env.PLATFORM_FEE_PERCENT) / 100;
        const total = subtotal + quote.price - discount;
        const deliveryEstimateDate = new Date(); deliveryEstimateDate.setDate(deliveryEstimateDate.getDate() + quote.deliveryDays);
        const createdOrder = await this.orderRepository.createOrder(tx, {
          checkoutId,
          customerId: userId,
          ...(sellerId ? { sellerId } : {}),
          ...(directSellerUserId ? { directSellerUserId, quickSalePayout: true } : {}),
          subtotal, shippingCost: quote.price, discount, platformFee,
          total,
          shippingMethod: quote.service,
          shippingAddress: { recipient: address.recipient, document: address.document, postalCode: address.postalCode, street: address.street, number: address.number, complement: address.complement, district: address.district, city: address.city, state: address.state },
          shipment: { provider: quote.provider, service: quote.service, quotedDays: quote.deliveryDays, ...(quote.rawPayload === undefined ? {} : { rawPayload: quote.rawPayload as object }) },
          deliveryEstimateDate,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variant?.price ?? item.product.price,
            productName: item.product.name,
            ...(item.variant?.sku ? { productSku: item.variant.sku } : {}),
            ...(item.product.images[0]?.url ? { imageUrl: item.product.images[0].url } : {}),
          })),
        });

        orders.push(createdOrder);
      }

      if (coupon) {
        const firstOrder = orders[0];
        if (!firstOrder) throw new AppError(400, "Nao foi possivel criar o pedido");
        const result = await this.orderRepository.reserveCoupon(tx, coupon.id, userId, firstOrder.id, coupon.maxUses);
        if (result.count !== 1) throw new AppError(409, "Cupom esgotado, tente novamente");
      }

      return orders;
    });

    const orders = [];

    try {
      const checkoutTotal = createdOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const preference = await this.mercadoPago.createPreference({
        orderId: checkoutId,
        items: [],
        total: checkoutTotal,
      });

      orders.push(
        ...(await this.orderRepository.updateCheckoutPayment(checkoutId, {
          mercadoPagoPreference: preference.initPoint ?? preference.sandboxInitPoint,
          providerRef: preference.providerRef,
        })),
      );
    } catch (error) {
      await this.orderRepository.transaction(async (tx) => {
        await this.stockService.release(
          tx,
          cartItems.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
        );
        await this.orderRepository.cancelOrders(tx, createdOrders.map((order) => order.id));
        await this.orderRepository.releaseCouponReservations(tx, createdOrders.map((order) => order.id));
      });

      throw error instanceof AppError ? error : new AppError(502, "Nao foi possivel iniciar o pagamento");
    }

    await this.orderRepository.transaction(async (tx) => {
      await this.orderRepository.deleteCartItems(tx, cartItems.map((item) => item.id));
    });

    return orders;
  }

  async applyPaymentWebhook(input: { orderId: string; providerRef: string; status: "APPROVED" | "REJECTED" | "CANCELED" | "REFUNDED"; rawPayload?: unknown }) {
    return this.orderRepository.transaction(async (tx) => {
      const checkoutOrders = await this.orderRepository.findCheckoutWithItemsAndPayment(tx, input.orderId);
      const orders = [...checkoutOrders];

      if (!orders.length) {
        const legacyOrder = await this.orderRepository.findOrderWithItemsAndPayment(tx, input.orderId);
        if (legacyOrder) orders.push(legacyOrder);
      }
      if (!orders.length) throw new AppError(404, "Pedido ou checkout nao encontrado");

      const registrations = [];
      for (const order of orders) {
        if (!order.payment) throw new AppError(409, "Transacao de pagamento ausente");
        const eventId = `${input.providerRef}:${order.id}`;
        const registered = await this.orderRepository.registerWebhookEvent(tx, order.payment.id, eventId, (input.rawPayload ?? {}) as object);
        registrations.push(registered);

        if (registered) {
          if (["REJECTED", "CANCELED", "REFUNDED"].includes(input.status) && ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED"].includes(order.status)) {
            await this.stockService.release(
              tx,
              order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
            );
          }

          await this.orderRepository.updatePaymentFromWebhook(tx, {
            orderId: order.id,
            orderStatus: input.status === "APPROVED" ? "PAID" : input.status === "REFUNDED" ? "REFUNDED" : "CANCELED",
            paymentStatus: input.status,
            ...(input.providerRef ? { providerRef: input.providerRef } : {}),
            ...(input.rawPayload === undefined ? {} : { rawPayload: input.rawPayload }),
          });
          if (input.status === "APPROVED") {
            await this.orderRepository.markQuickSaleProductsSold(tx, order.id);
          } else if (order.directSellerUserId) {
            await this.orderRepository.voidQuickSalePayout(tx, order.id);
          }
          await this.orderRepository.markWebhookProcessed(tx, "MERCADO_PAGO", eventId);
        }
      }

      if (!registrations.some(Boolean)) return { received: true, duplicate: true };
      return orders;
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

      const allowed: Record<string, string[]> = { PAID: ["PREPARING", "CANCELED"], PREPARING: ["SHIPPED", "CANCELED"], SHIPPED: ["DELIVERED"] };
      if (!(allowed[order.status] ?? []).includes(status)) throw new AppError(409, `Transicao invalida de ${order.status} para ${status}`);
      if (status === "SHIPPED" && !correiosTrackingCode) throw new AppError(400, "Codigo de rastreio e obrigatorio ao enviar o pedido");
      if (status === "CANCELED" && order.status !== "PAID") throw new AppError(409, "Cancelamento pelo vendedor so e permitido antes do preparo");
      if (status === "CANCELED") {
        if (!order.payment?.providerRef) throw new AppError(409, "Pagamento ainda nao esta pronto para estorno");
        await this.mercadoPago.refundPayment(order.payment.providerRef);
        await this.stockService.release(
          tx,
          order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
        );
      }

      const target = status === "CANCELED" ? "REFUNDED" : status;
      return this.orderRepository.transitionOrder(tx, { orderId, fromStatus: order.status, toStatus: target, userId, type: "SELLER_STATUS_CHANGE", ...(correiosTrackingCode ? { trackingCode: correiosTrackingCode } : {}) });
    });
  }

  async cancelByCustomer(userId: string, orderId: string, reason: string) {
    return this.orderRepository.transaction(async (tx) => {
      const order = await this.orderRepository.findCustomerOrderWithPayment(tx, userId, orderId);
      if (!order) throw new AppError(404, "Pedido nao encontrado");
      if (order.status === "PENDING_PAYMENT") {
        await this.stockService.release(tx, order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })));
        await this.orderRepository.releaseCouponReservations(tx, [order.id]);
        if (order.directSellerUserId) await this.orderRepository.voidQuickSalePayout(tx, order.id);
        return this.orderRepository.transitionOrder(tx, { orderId, fromStatus: "PENDING_PAYMENT", toStatus: "CANCELED", userId, type: "CUSTOMER_CANCEL", metadata: { reason } });
      }
      if (order.status !== "PAID" || !order.payment?.providerRef) throw new AppError(409, "Este pedido nao pode mais ser cancelado; solicite devolucao apos a entrega");
      await this.mercadoPago.refundPayment(order.payment.providerRef);
      await this.stockService.release(tx, order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })));
      if (order.directSellerUserId) await this.orderRepository.voidQuickSalePayout(tx, order.id);
      return this.orderRepository.transitionOrder(tx, { orderId, fromStatus: "PAID", toStatus: "REFUNDED", userId, type: "CUSTOMER_CANCEL_REFUND", metadata: { reason } });
    });
  }

  async requestReturn(userId: string, orderId: string, reason: string) {
    return this.orderRepository.transaction(async (tx) => {
      const order = await this.orderRepository.findCustomerOrderWithPayment(tx, userId, orderId);
      if (!order) throw new AppError(404, "Pedido nao encontrado");
      if (order.status !== "DELIVERED") throw new AppError(409, "Devolucao so pode ser solicitada para pedido entregue");
      if (await this.orderRepository.hasDeniedReturnRequest(tx, order.id)) {
        throw new AppError(409, "A solicitacao de devolucao deste pedido ja foi analisada");
      }
      const limit = new Date(order.updatedAt); limit.setDate(limit.getDate() + 7);
      if (limit < new Date()) throw new AppError(409, "Prazo de 7 dias para devolucao expirou");
      return this.orderRepository.transitionOrder(tx, { orderId, fromStatus: "DELIVERED", toStatus: "RETURN_REQUESTED", userId, type: "RETURN_REQUESTED", metadata: { reason } });
    });
  }

  async expirePendingPayments() {
    const before = new Date(Date.now() - env.CHECKOUT_HOLD_MINUTES * 60_000);
    const expired = await this.orderRepository.findExpiredPendingPayments(before);
    for (const { id } of expired) {
      await this.orderRepository.transaction(async (tx) => {
        const order = await this.orderRepository.findOrderWithItemsAndPayment(tx, id);
        if (!order || order.status !== "PENDING_PAYMENT") return;
        await this.stockService.release(tx, order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })));
        await this.orderRepository.releaseCouponReservations(tx, [id]);
        if (order.directSellerUserId) await this.orderRepository.voidQuickSalePayout(tx, order.id);
        await this.orderRepository.transitionOrder(tx, { orderId: id, fromStatus: "PENDING_PAYMENT", toStatus: "CANCELED", type: "PAYMENT_EXPIRED" });
      });
    }
    return expired.length;
  }
}
