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
        weightGrams: 1200,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
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
    expect(correios.quote).toHaveBeenCalledWith({
      fromPostalCode: "12345678",
      toPostalCode: "87654321",
      items: [{ quantity: 1, unitPrice: 100, weightGrams: 1200, lengthCm: 30, widthCm: 20, heightCm: 10 }],
    });
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

  it("rejects checkout if an existing listing has no package measurements", async () => {
    const service = new OrderService(
      { reserve: jest.fn() } as never,
      {} as never,
      { quote: jest.fn() } as never,
      {
        findCheckoutCart: jest.fn().mockResolvedValue({
          items: [{
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
            },
          }],
        }),
        transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback({})),
      } as never,
      { getOwned: jest.fn().mockResolvedValue({ postalCode: "87654321" }) } as never,
      { assertSellersCanCheckout: jest.fn() } as never,
    );

    await expect(service.checkout("buyer-1", { addressId: "address-1" })).rejects.toMatchObject({ statusCode: 422 });
  });

  it("quotes each unit package and creates a separate shipment record", async () => {
    env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    const tx = {};
    const item = {
      id: "cart-item",
      productId: "product-1",
      variantId: null,
      quantity: 2,
      variant: null,
      product: {
        id: "product-1",
        sellerId: "seller-1",
        ownerUserId: null,
        listingType: "STORE",
        stock: 5,
        price: 50,
        name: "Livro",
        originPostalCode: null,
        weightGrams: 500,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 5,
        seller: { postalCode: "12345678" },
        images: [],
      },
    };
    const createOrder = jest.fn().mockResolvedValue({ id: "order-1", total: 110 });
    const orderRepository = {
      findCheckoutCart: jest.fn().mockResolvedValue({ items: [item] }),
      transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback(tx)),
      createOrder,
      updateCheckoutPayment: jest.fn().mockResolvedValue([{ id: "order-1" }]),
      deleteCartItems: jest.fn(),
    };
    const correios = { quote: jest.fn().mockResolvedValue({ price: 5, service: "PAC", deliveryDays: 3, provider: "CORREIOS" }) };
    const service = new OrderService(
      { reserve: jest.fn() } as never,
      { createPreference: jest.fn().mockResolvedValue({ providerRef: "payment-1", initPoint: "https://pay.test" }) } as never,
      correios as never,
      orderRepository as never,
      { getOwned: jest.fn().mockResolvedValue({ postalCode: "87654321" }) } as never,
      { assertSellersCanCheckout: jest.fn() } as never,
    );

    await service.checkout("buyer-1", { addressId: "address-1", itemIds: ["cart-item"] });

    expect(correios.quote).toHaveBeenCalledTimes(1);
    expect(correios.quote).toHaveBeenCalledWith({
      fromPostalCode: "12345678",
      toPostalCode: "87654321",
      items: [{ quantity: 1, unitPrice: 50, weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 5 }],
    });
    expect(createOrder).toHaveBeenCalledWith(tx, expect.objectContaining({
      shippingCost: 10,
      total: 110,
      shipments: [
        expect.objectContaining({ packageNumber: 1, service: "PAC" }),
        expect.objectContaining({ packageNumber: 2, service: "PAC" }),
      ],
    }));
  });
});
