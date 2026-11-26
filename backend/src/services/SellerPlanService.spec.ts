import { SellerPlanService } from "./SellerPlanService.js";

describe("SellerPlanService", () => {
  it("limits free sellers to ten active products", async () => {
    const repository = {
      findByProfileId: jest.fn().mockResolvedValue({ plan: "FREE", planExpiresAt: null }),
      findLocalStoreDetails: jest.fn().mockResolvedValue({ whatsappPhone: "5511999999999", city: "Sao Paulo", state: "SP" }),
      countProducts: jest.fn().mockResolvedValue(10),
    };
    const service = new SellerPlanService(repository as never, {} as never);

    await expect(service.assertCanCreateProduct("seller-1")).rejects.toMatchObject({
      statusCode: 403,
      message: "O plano gratuito permite ate 10 produtos ativos. Conheca o Vitrine Pro.",
    });
  });

  it("allows Pro stores and rejects Free stores from marketplace checkout", async () => {
    const repository = {
      findSellersByIds: jest.fn((ids: string[]) => Promise.resolve([
        { id: "seller-pro", plan: "PRO", planExpiresAt: null },
        { id: "seller-free", plan: "FREE", planExpiresAt: null },
      ].filter((seller) => ids.includes(seller.id)))),
    };
    const service = new SellerPlanService(repository as never, {} as never);

    await expect(service.assertSellersCanCheckout(["seller-pro"])).resolves.toBeUndefined();
    await expect(service.assertSellersCanCheckout(["seller-free"])).rejects.toMatchObject({ statusCode: 403 });
  });

  it("activates Pro only after a signed Mercado Pago authorization notification", async () => {
    const repository = {
      findByExternalReference: jest.fn().mockResolvedValue({ id: "seller-1", mercadoPagoSubscriptionId: null }),
      updateById: jest.fn().mockResolvedValue(undefined),
    };
    const mercadoPago = {
      verifyWebhookSignature: jest.fn(),
      getProSubscription: jest.fn().mockResolvedValue({
        id: "mp-sub-1",
        status: "authorized",
        external_reference: "external-1",
        auto_recurring: { transaction_amount: 25 },
        next_payment_date: "2026-12-25T00:00:00.000Z",
      }),
    };
    const service = new SellerPlanService(repository as never, mercadoPago as never);

    await service.processMercadoPagoWebhook({
      body: { data: { id: "mp-sub-1" } },
      query: {},
      signature: "ts=123,v1=valid",
      requestId: "request-1",
    });

    expect(mercadoPago.verifyWebhookSignature).toHaveBeenCalled();
    expect(repository.updateById).toHaveBeenCalledWith("seller-1", expect.objectContaining({
      plan: "PRO",
      subscriptionStatus: "AUTHORIZED",
      mercadoPagoSubscriptionId: "mp-sub-1",
    }));
  });

  it("does not activate Pro when the authorization notification has no recurring price", async () => {
    const repository = {
      findByExternalReference: jest.fn().mockResolvedValue({ id: "seller-1", mercadoPagoSubscriptionId: null }),
      updateById: jest.fn(),
    };
    const mercadoPago = {
      verifyWebhookSignature: jest.fn(),
      getProSubscription: jest.fn().mockResolvedValue({
        id: "mp-sub-1",
        status: "authorized",
        external_reference: "external-1",
      }),
    };
    const service = new SellerPlanService(repository as never, mercadoPago as never);

    await expect(service.processMercadoPagoWebhook({
      body: { data: { id: "mp-sub-1" } },
      query: {},
      signature: "ts=123,v1=valid",
      requestId: "request-1",
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(repository.updateById).not.toHaveBeenCalled();
  });

  it("does not grant unlimited Pro access when the renewal date is missing", async () => {
    const repository = {
      findByExternalReference: jest.fn().mockResolvedValue({ id: "seller-1", mercadoPagoSubscriptionId: null }),
      updateById: jest.fn(),
    };
    const mercadoPago = {
      verifyWebhookSignature: jest.fn(),
      getProSubscription: jest.fn().mockResolvedValue({
        id: "mp-sub-1",
        status: "authorized",
        external_reference: "external-1",
        auto_recurring: { transaction_amount: 25 },
      }),
    };
    const service = new SellerPlanService(repository as never, mercadoPago as never);

    await expect(service.processMercadoPagoWebhook({
      body: { data: { id: "mp-sub-1" } },
      query: {},
      signature: "ts=123,v1=valid",
      requestId: "request-1",
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(repository.updateById).not.toHaveBeenCalled();
  });
});
