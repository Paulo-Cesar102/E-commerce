import crypto from "node:crypto";
import { AppError } from "../errors/AppError.js";
import { SellerPlanRepository } from "../repository/SellerPlanRepository.js";
import { env } from "../config/env.js";
import { MercadoPagoService } from "./MercadoPagoService.js";

const FREE_ACTIVE_PRODUCT_LIMIT = 10;

function isPro(plan: string, expiresAt: Date | null) {
  return plan === "PRO" && (!expiresAt || expiresAt > new Date());
}

export class SellerPlanService {
  constructor(
    private readonly repository = new SellerPlanRepository(),
    private readonly mercadoPago = new MercadoPagoService(),
  ) {}

  async getPlan(userId: string) {
    const seller = await this.repository.findByUserId(userId);
    if (!seller) throw new AppError(403, "Vendedor nao encontrado");
    const pro = isPro(seller.plan, seller.planExpiresAt);
    const activeProducts = await this.repository.countProducts(seller.id, "ACTIVE");
    return {
      code: pro ? "PRO" : "FREE",
      status: seller.subscriptionStatus,
      price: env.PRO_MONTHLY_PRICE,
      currency: "BRL",
      activeProducts,
      productLimit: pro ? null : FREE_ACTIVE_PRODUCT_LIMIT,
      canSellOnline: pro,
      canShipNationwide: pro,
      whatsappPhone: seller.whatsappPhone,
      city: seller.city,
      state: seller.state,
      expiresAt: seller.planExpiresAt,
    };
  }

  async assertCanCreateProduct(sellerId: string) {
    const seller = await this.repository.findByProfileId(sellerId);
    if (!seller) throw new AppError(403, "Vendedor nao encontrado");
    if (isPro(seller.plan, seller.planExpiresAt)) return;
    const profile = await this.repository.findLocalStoreDetails(sellerId);
    if (!profile?.whatsappPhone || !profile.city || !profile.state) {
      throw new AppError(422, "Configure WhatsApp, cidade e estado da loja antes de publicar produtos no plano gratuito.");
    }
    const activeProducts = await this.repository.countProducts(sellerId, "ACTIVE");
    if (activeProducts >= FREE_ACTIVE_PRODUCT_LIMIT) {
      throw new AppError(403, `O plano gratuito permite ate ${FREE_ACTIVE_PRODUCT_LIMIT} produtos ativos. Conheca o Vitrine Pro.`);
    }
  }

  async isProSeller(sellerId: string) {
    const seller = await this.repository.findByProfileId(sellerId);
    return Boolean(seller && isPro(seller.plan, seller.planExpiresAt));
  }

  async hasProPlanForUser(userId: string) {
    const seller = await this.repository.findByUserId(userId);
    return Boolean(seller && isPro(seller.plan, seller.planExpiresAt));
  }

  async assertSellersCanCheckout(sellerIds: string[]) {
    const sellers = await this.repository.findSellersByIds([...new Set(sellerIds)]);
    if (sellers.length !== new Set(sellerIds).size) throw new AppError(404, "Loja nao encontrada");
    if (sellers.some((seller) => !isPro(seller.plan, seller.planExpiresAt))) {
      throw new AppError(403, "Algumas lojas aceitam pedidos pelo WhatsApp. O checkout e o envio pelo app estao disponiveis no Vitrine Pro.");
    }
  }

  async startProSubscription(userId: string) {
    const seller = await this.repository.findByUserId(userId);
    if (!seller) throw new AppError(403, "Vendedor nao encontrado");
    if (isPro(seller.plan, seller.planExpiresAt)) {
      throw new AppError(409, "Sua loja ja esta no plano Pro");
    }
    if (seller.subscriptionStatus === "PENDING" && seller.subscriptionCheckoutUrl) {
      return { checkoutUrl: seller.subscriptionCheckoutUrl };
    }

    const externalReference = crypto.randomUUID();
    await this.repository.updateById(seller.id, {
      subscriptionStatus: "PENDING",
      subscriptionExternalReference: externalReference,
      subscriptionCheckoutUrl: null,
      mercadoPagoSubscriptionId: null,
    });

    try {
      const subscription = await this.mercadoPago.createProSubscription({
        externalReference,
        payerEmail: seller.user.email,
        amount: env.PRO_MONTHLY_PRICE,
      });
      await this.repository.updateById(seller.id, {
        mercadoPagoSubscriptionId: subscription.id,
        subscriptionCheckoutUrl: subscription.initPoint,
      });
      return { checkoutUrl: subscription.initPoint };
    } catch (error) {
      await this.repository.updateById(seller.id, {
        subscriptionStatus: "REJECTED",
        subscriptionExternalReference: null,
        subscriptionCheckoutUrl: null,
      });
      throw error;
    }
  }

  async cancelProSubscription(userId: string) {
    const seller = await this.repository.findByUserId(userId);
    if (!seller) throw new AppError(403, "Vendedor nao encontrado");
    if (!seller.mercadoPagoSubscriptionId || seller.subscriptionStatus !== "AUTHORIZED") {
      throw new AppError(409, "Nao ha assinatura Pro ativa para cancelar");
    }
    await this.mercadoPago.cancelProSubscription(seller.mercadoPagoSubscriptionId);
    return { requested: true };
  }

  async processMercadoPagoWebhook(input: {
    body: { data?: { id?: string | number }; type?: string; [key: string]: unknown };
    query: Record<string, unknown>;
    signature: string | undefined;
    requestId: string | undefined;
  }) {
    const type = input.body.type ?? input.query.type ?? input.query.topic;
    if (type === "subscription_authorized_payment") {
      return this.processAuthorizedPaymentWebhook(input);
    }

    const dataId = input.query["data.id"] ?? input.query.id ?? input.body.data?.id;
    if (typeof dataId !== "string" && typeof dataId !== "number") {
      throw new AppError(400, "Assinatura nao informada no webhook");
    }
    const subscriptionId = String(dataId);
    this.mercadoPago.verifyWebhookSignature({
      dataId: subscriptionId,
      signature: input.signature,
      requestId: input.requestId,
    });
    const subscription = await this.mercadoPago.getProSubscription(subscriptionId);
    if (!subscription.external_reference) throw new AppError(400, "Assinatura sem referencia da loja");
    const seller = await this.repository.findByExternalReference(subscription.external_reference);
    if (!seller) return { received: true, ignored: true };
    if (seller.mercadoPagoSubscriptionId && seller.mercadoPagoSubscriptionId !== subscriptionId) {
      return { received: true, ignored: true };
    }

    const amount = subscription.auto_recurring?.transaction_amount;
    if (subscription.status?.toLowerCase() === "authorized" && amount === undefined) {
      throw new AppError(409, "Mercado Pago nao informou o valor da assinatura");
    }
    if (amount !== undefined && Number(amount.toFixed(2)) !== Number(env.PRO_MONTHLY_PRICE.toFixed(2))) {
      throw new AppError(409, "Valor da assinatura diferente do plano Pro");
    }
    const currency = subscription.auto_recurring?.currency_id;
    if (currency && currency !== "BRL") throw new AppError(409, "Moeda da assinatura diferente do plano Pro");

    const status = subscription.status?.toLowerCase();
    const nextPaymentDate = subscription.next_payment_date ? new Date(subscription.next_payment_date) : null;
    if (nextPaymentDate && Number.isNaN(nextPaymentDate.getTime())) {
      throw new AppError(502, "Data de renovacao invalida recebida do Mercado Pago");
    }

    if (status === "authorized") {
      if (!nextPaymentDate) throw new AppError(409, "Mercado Pago nao informou a renovacao da assinatura");
      await this.repository.updateById(seller.id, {
        plan: "PRO",
        subscriptionStatus: "AUTHORIZED",
        mercadoPagoSubscriptionId: subscriptionId,
        planExpiresAt: nextPaymentDate,
      });
    } else if (status === "cancelled" || status === "paused") {
      const retainUntil = nextPaymentDate && nextPaymentDate > new Date() ? nextPaymentDate : new Date();
      await this.repository.updateById(seller.id, {
        plan: retainUntil > new Date() ? "PRO" : "FREE",
        subscriptionStatus: status === "cancelled" ? "CANCELLED" : "PAUSED",
        mercadoPagoSubscriptionId: subscriptionId,
        planExpiresAt: retainUntil,
      });
    } else if (status === "rejected") {
      await this.repository.updateById(seller.id, {
        plan: "FREE",
        subscriptionStatus: "REJECTED",
        mercadoPagoSubscriptionId: subscriptionId,
        planExpiresAt: null,
      });
    }

    return { received: true };
  }

  private async processAuthorizedPaymentWebhook(input: {
    body: { data?: { id?: string | number }; type?: string; [key: string]: unknown };
    query: Record<string, unknown>;
    signature: string | undefined;
    requestId: string | undefined;
  }) {
    const dataId = input.query["data.id"] ?? input.query.id ?? input.body.data?.id;
    if (typeof dataId !== "string" && typeof dataId !== "number") {
      throw new AppError(400, "Cobranca recorrente nao informada no webhook");
    }
    const paymentId = String(dataId);
    this.mercadoPago.verifyWebhookSignature({
      dataId: paymentId,
      signature: input.signature,
      requestId: input.requestId,
    });

    const payment = await this.mercadoPago.getAuthorizedPayment(paymentId);
    if (payment.currency !== "BRL") throw new AppError(409, "Moeda da cobranca Pro diferente de BRL");

    const seller = await this.repository.findByMercadoPagoSubscriptionId(payment.subscriptionId);
    if (!seller) return { received: true, ignored: true };

    await this.repository.recordSubscriptionPayment({
      ...payment,
      sellerId: seller.id,
    });
    return { received: true };
  }
}
