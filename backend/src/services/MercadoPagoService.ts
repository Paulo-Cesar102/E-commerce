import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

type PreferenceInput = {
  orderId: string;
  items: { title: string; quantity: number; unitPrice: number }[];
  shippingCost?: number;
  discount?: number;
  total: number;
};

type MercadoPagoPaymentStatus = "APPROVED" | "REJECTED" | "CANCELED" | "REFUNDED";

type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  external_reference?: string | null;
};

type MercadoPagoSubscription = {
  id: string;
  status?: string;
  external_reference?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
};

type MercadoPagoAuthorizedPayment = {
  id: string | number;
  preapproval_id?: string;
  currency_id?: string;
  transaction_amount?: string | number;
  payment?: { id?: string | number; status?: string };
};

export class MercadoPagoService {
  private parseSignature(signature: string) {
    return Object.fromEntries(
      signature.split(",").map((part) => {
        const [key, value] = part.split("=");
        return [key?.trim(), value?.trim()];
      }),
    ) as { ts?: string; v1?: string };
  }

  verifyWebhookSignature(input: { signature: string | undefined; requestId: string | undefined; dataId: string }) {
    if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
      throw new AppError(500, "MERCADO_PAGO_WEBHOOK_SECRET nao configurado");
    }

    if (!input.signature || !input.requestId) {
      throw new AppError(401, "Assinatura do Mercado Pago ausente");
    }

    const { ts, v1 } = this.parseSignature(input.signature);
    if (!ts || !v1) {
      throw new AppError(401, "Assinatura do Mercado Pago invalida");
    }

    const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
    const expected = crypto
      .createHmac("sha256", env.MERCADO_PAGO_WEBHOOK_SECRET)
      .update(manifest)
      .digest("hex");

    const receivedBuffer = Buffer.from(v1, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      throw new AppError(401, "Assinatura do Mercado Pago invalida");
    }
  }

  async createPreference(input: PreferenceInput) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "Pagamento indisponivel: configure o Mercado Pago");
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_reference: input.orderId,
        items: [{
          title: "Pedido na Vitrine",
          quantity: 1,
          unit_price: Number(input.total.toFixed(2)),
        }],
      }),
    });

    if (!response.ok) {
      throw new Error("Falha ao criar preferencia no Mercado Pago");
    }

    const data = (await response.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
    return {
      providerRef: data.id,
      initPoint: data.init_point ?? null,
      sandboxInitPoint: data.sandbox_init_point ?? null,
    };
  }

  async createProSubscription(input: { externalReference: string; payerEmail: string; amount: number }) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "Assinatura indisponivel: configure o Mercado Pago");
    }
    if (!env.API_PUBLIC_URL) {
      throw new AppError(503, "Assinatura indisponivel: configure API_PUBLIC_URL para receber confirmacoes");
    }

    const frontendUrl = (env.FRONTEND_URL ?? env.CORS_ORIGIN).split(",")[0]?.trim();
    if (!frontendUrl) throw new AppError(500, "FRONTEND_URL nao configurada");

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Vitrine Pro",
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        notification_url: `${env.API_PUBLIC_URL.replace(/\/$/, "")}/seller/subscription/mercado-pago/webhook`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: input.amount,
          currency_id: "BRL",
        },
        back_url: `${frontendUrl.replace(/\/$/, "")}/dashboard?tab=plan`,
        status: "pending",
      }),
    });

    if (!response.ok) throw new AppError(502, "Nao foi possivel iniciar a assinatura Pro");

    const subscription = (await response.json()) as MercadoPagoSubscription;
    if (!subscription.id || !subscription.init_point) {
      throw new AppError(502, "Mercado Pago retornou uma assinatura sem link de pagamento");
    }
    return {
      id: subscription.id,
      initPoint: subscription.init_point,
      status: subscription.status ?? "pending",
    };
  }

  async getProSubscription(subscriptionId: string) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "Assinatura indisponivel: configure o Mercado Pago");
    }

    const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` },
    });
    if (!response.ok) throw new AppError(502, "Nao foi possivel consultar a assinatura no Mercado Pago");
    return (await response.json()) as MercadoPagoSubscription;
  }

  async getAuthorizedPayment(paymentId: string) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "Assinatura indisponivel: configure o Mercado Pago");
    }

    const response = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` },
    });
    if (!response.ok) throw new AppError(502, "Nao foi possivel consultar a cobranca recorrente no Mercado Pago");

    const payment = (await response.json()) as MercadoPagoAuthorizedPayment;
    const amount = Number(payment.transaction_amount);
    if (!payment.id || !payment.preapproval_id || !Number.isFinite(amount) || amount <= 0 || !payment.currency_id) {
      throw new AppError(502, "Mercado Pago retornou uma cobranca recorrente incompleta");
    }

    const status: MercadoPagoPaymentStatus | "PENDING" = this.toInternalStatus(payment.payment?.status) ?? "PENDING";
    return {
      providerRef: String(payment.id),
      subscriptionId: payment.preapproval_id,
      amount,
      currency: payment.currency_id,
      status,
      rawPayload: payment,
    };
  }

  async cancelProSubscription(subscriptionId: string) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(503, "Assinatura indisponivel: configure o Mercado Pago");
    }
    const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!response.ok) throw new AppError(502, "Nao foi possivel cancelar a assinatura no Mercado Pago");
  }

  async refundPayment(paymentId: string, idempotencyKey?: string) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) throw new AppError(503, "Pagamento indisponivel: configure o Mercado Pago");
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
    });
    if (!response.ok) throw new AppError(502, "Nao foi possivel solicitar o estorno no Mercado Pago");
  }

  async getPayment(paymentId: string) {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError(500, "MERCADO_PAGO_ACCESS_TOKEN nao configurado");
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new AppError(400, "Nao foi possivel consultar o pagamento no Mercado Pago");
    }

    const payment = (await response.json()) as MercadoPagoPayment;
    return {
      providerRef: String(payment.id),
      orderId: payment.external_reference ?? null,
      status: this.toInternalStatus(payment.status),
      rawPayload: payment,
    };
  }

  private toInternalStatus(status?: string): MercadoPagoPaymentStatus | null {
    switch (status) {
      case "approved":
        return "APPROVED";
      case "rejected":
        return "REJECTED";
      case "cancelled":
        return "CANCELED";
      case "refunded":
      case "charged_back":
        return "REFUNDED";
      default:
        return null;
    }
  }
}
