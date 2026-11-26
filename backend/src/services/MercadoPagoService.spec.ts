import { env } from "../config/env.js";
import { MercadoPagoService } from "./MercadoPagoService.js";

describe("MercadoPagoService", () => {
  it("cobra o total agregado do checkout em uma unica preferencia", async () => {
    env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "pref-1", init_point: "https://payment.test/1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await new MercadoPagoService().createPreference({
      orderId: "checkout-1",
      items: [],
      shippingCost: 30,
      discount: 10,
      total: 120,
    });

    expect(result.providerRef).toBe("pref-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/checkout/preferences",
      expect.objectContaining({
        body: JSON.stringify({
          external_reference: "checkout-1",
          items: [{ title: "Pedido na Vitrine", quantity: 1, unit_price: 120 }],
        }),
      }),
    );
  });

  it("cria uma assinatura mensal Pro com preco e retorno configurados", async () => {
    env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    env.FRONTEND_URL = "https://vitrine.example";
    env.API_PUBLIC_URL = "https://api.vitrine.example/";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "sub-1", init_point: "https://payment.test/sub-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await new MercadoPagoService().createProSubscription({
      externalReference: "seller-subscription-1",
      payerEmail: "seller@example.com",
      amount: 25,
    });

    expect(result).toEqual({ id: "sub-1", initPoint: "https://payment.test/sub-1", status: "pending" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/preapproval",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reason: "Vitrine Pro",
          external_reference: "seller-subscription-1",
          payer_email: "seller@example.com",
          notification_url: "https://api.vitrine.example/seller/subscription/mercado-pago/webhook",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: 25,
            currency_id: "BRL",
          },
          back_url: "https://vitrine.example/dashboard?tab=plan",
          status: "pending",
        }),
      }),
    );
  });

  it("consulta a cobranca recorrente e identifica um pagamento aprovado", async () => {
    env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: 9123,
        preapproval_id: "sub-1",
        transaction_amount: "25.00",
        currency_id: "BRL",
        payment: { id: 456, status: "approved" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await expect(new MercadoPagoService().getAuthorizedPayment("9123")).resolves.toMatchObject({
      providerRef: "9123",
      subscriptionId: "sub-1",
      amount: 25,
      currency: "BRL",
      status: "APPROVED",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/authorized_payments/9123",
      { headers: { Authorization: "Bearer test-token" } },
    );
  });

  it("uses a stable idempotency key for refund requests", async () => {
    env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    await new MercadoPagoService().refundPayment("payment-1", "return-order-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/payment-1/refunds",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "X-Idempotency-Key": "return-order-1",
        },
      }),
    );
  });
});
