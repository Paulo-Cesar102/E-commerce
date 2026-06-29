import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

type PreferenceInput = {
  orderId: string;
  items: { title: string; quantity: number; unitPrice: number }[];
};

type MercadoPagoPaymentStatus = "APPROVED" | "REJECTED" | "CANCELED" | "REFUNDED";

type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  external_reference?: string | null;
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
      return {
        providerRef: `local-${input.orderId}`,
        initPoint: null,
        sandboxInitPoint: null,
      };
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_reference: input.orderId,
        items: input.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
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
