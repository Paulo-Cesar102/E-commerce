import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export type ShippingQuote = { provider: string; service: string; price: number; deliveryDays: number; rawPayload?: unknown };
type QuoteInput = { fromPostalCode: string; toPostalCode: string; items: { quantity: number; unitPrice: number }[] };

/** Adapter for the Correios contract/API gateway. It deliberately never invents a shipping price. */
export class CorreiosService {
  async quote(input: QuoteInput): Promise<ShippingQuote> {
    if (!env.CORREIOS_QUOTE_URL || !env.CORREIOS_API_TOKEN) {
      throw new AppError(503, "Cotacao de frete indisponivel: configure a integracao dos Correios");
    }
    const response = await fetch(env.CORREIOS_QUOTE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CORREIOS_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(input), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new AppError(503, "Nao foi possivel cotar o frete agora");
    const data = await response.json() as { service?: string; price?: number | string; deliveryDays?: number | string };
    const price = Number(data.price); const deliveryDays = Number(data.deliveryDays);
    if (!data.service || !Number.isFinite(price) || price < 0 || !Number.isInteger(deliveryDays) || deliveryDays < 1) throw new AppError(502, "Resposta de cotacao de frete invalida");
    return { provider: "CORREIOS", service: data.service, price, deliveryDays, rawPayload: data };
  }
}
