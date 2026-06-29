import { env } from "../config/env.js";

type PreferenceInput = {
  orderId: string;
  items: { title: string; quantity: number; unitPrice: number }[];
};

export class MercadoPagoService {
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
}
