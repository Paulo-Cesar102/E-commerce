import { env } from "../config/env.js";
import { OrderService } from "./OrderService.js";

describe("OrderService quick-sale checkout", () => {
  it("charges exactly five percent on the item value and uses the existing payment flow", async () => {
    env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    const tx = {};
    const quickSaleItem = {
      id: "cart-item",
      productId: "product-1",
      variantId: null,
      quantity: 1,
      variant: null,
      product: {
        id: "product-1",
        sellerId: null,
        ownerUserId: "owner-1",
        listingType: "QUICK_SALE",
        originPostalCode: "12345678",
        stock: 1,
        price: 100,
        name: "Console usado",
        seller: null,
        images: [{ url: "https://images.test/console.webp" }],
      },
    };
    const createOrder = jest.fn().mockResolvedValue({ id: "order-1", total: 110 });
    const updateCheckoutPayment = jest.fn().mockResolvedValue([{ id: "order-1", mercadoPagoPreference: "https://pay.test" }]);
    const orderRepository = {
      findCheckoutCart: jest.fn().mockResolvedValue({ items: [quickSaleItem] }),
      transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback(tx)),
      createOrder,
      updateCheckoutPayment,
      deleteCartItems: jest.fn(),
    };
    const stockService = { reserve: jest.fn(), release: jest.fn() };
    const mercadoPago = { createPreference: jest.fn().mockResolvedValue({ providerRef: "payment-1", initPoint: "https://pay.test" }) };
    const correios = { quote: jest.fn().mockResolvedValue({ price: 10, service: "PAC", deliveryDays: 4, provider: "CORREIOS" }) };
    const addresses = { getOwned: jest.fn().mockResolvedValue({ postalCode: "87654321" }) };
    const sellerPlans = { assertSellersCanCheckout: jest.fn() };
    const service = new OrderService(
      stockService as never,
      mercadoPago as never,
      correios as never,
      orderRepository as never,
      addresses as never,
      sellerPlans as never,
    );

    await service.checkout("buyer-1", { addressId: "address-1", itemIds: ["cart-item"] });

    expect(createOrder).toHaveBeenCalledWith(tx, expect.objectContaining({
      directSellerUserId: "owner-1",
      quickSalePayout: true,
      subtotal: 100,
      shippingCost: 10,
      platformFee: 5,
      total: 110,
    }));
    expect(mercadoPago.createPreference).toHaveBeenCalledWith(expect.objectContaining({ total: 110 }));
    expect(sellerPlans.assertSellersCanCheckout).toHaveBeenCalledWith([]);
    expect(updateCheckoutPayment).toHaveBeenCalled();
  });

  it("prevents a user from purchasing their own quick-sale listing", async () => {
    const service = new OrderService(
      {} as never,
      {} as never,
      {} as never,
      {
        findCheckoutCart: jest.fn().mockResolvedValue({
          items: [{
            id: "cart-item",
            product: { listingType: "QUICK_SALE", ownerUserId: "user-1" },
          }],
        }),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(service.checkout("user-1", { addressId: "address-1" })).rejects.toMatchObject({ statusCode: 403 });
  });
});
