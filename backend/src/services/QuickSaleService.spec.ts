import { QuickSaleService, calculateQuickSaleCommission } from "./QuickSaleService.js";

describe("QuickSaleService", () => {
  it("calculates a rounded five-percent commission on the item value", () => {
    expect(calculateQuickSaleCommission(100)).toBe(5);
    expect(calculateQuickSaleCommission(19.99)).toBe(1);
  });

  it("exposes one active listing for Free and unlimited listings for an account with Pro", async () => {
    const repository = {
      countActiveListings: jest.fn().mockResolvedValue(1),
      findMine: jest.fn().mockResolvedValue([]),
      findMySales: jest.fn().mockResolvedValue([]),
    };
    const sellerPlans = { hasProPlanForUser: jest.fn().mockResolvedValue(false) };
    const service = new QuickSaleService(repository as never, sellerPlans as never);

    await expect(service.getMine("free-user")).resolves.toMatchObject({
      hasPro: false,
      activeCount: 1,
      activeLimit: 1,
    });

    sellerPlans.hasProPlanForUser.mockResolvedValue(true);
    await expect(service.getMine("pro-user")).resolves.toMatchObject({
      hasPro: true,
      activeCount: 1,
      activeLimit: null,
    });
  });

  it("checks listing categories and passes the Pro entitlement to the atomic listing creation", async () => {
    const repository = {
      findActiveCategory: jest.fn().mockResolvedValue({ id: "category-1" }),
      createListing: jest.fn().mockResolvedValue({ id: "listing-1" }),
    };
    const sellerPlans = { hasProPlanForUser: jest.fn().mockResolvedValue(false) };
    const service = new QuickSaleService(repository as never, sellerPlans as never);

    await service.create("free-user", {
      categoryId: "category-1",
      name: "Console usado",
      description: "Console em bom estado, com controle e cabos.",
      price: 250,
      originPostalCode: "12345678",
      weightGrams: 1200,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
      images: [{ url: "https://images.test/console.webp" }],
    });

    expect(repository.createListing).toHaveBeenCalledWith(
      "free-user",
      expect.objectContaining({ name: "Console usado" }),
      false,
    );
  });

  it("requires one tracking code per package before marking a sale as shipped", async () => {
    const tx = {};
    const repository = {
      transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback(tx)),
      findOwnedSaleOrder: jest.fn().mockResolvedValue({
        id: "order-1",
        status: "PAID",
        payment: { status: "APPROVED" },
        shipments: [{ packageNumber: 1 }, { packageNumber: 2 }],
      }),
      transitionSaleOrder: jest.fn().mockResolvedValue({ id: "order-1" }),
    };
    const service = new QuickSaleService(repository as never, {} as never);

    await expect(service.updateSaleOrderStatus("seller-1", "order-1", "SHIPPED", ["TRACK001"]))
      .rejects.toMatchObject({ statusCode: 400 });
    await service.updateSaleOrderStatus("seller-1", "order-1", "SHIPPED", ["TRACK001", "TRACK002"]);

    expect(repository.transitionSaleOrder).toHaveBeenCalledWith(tx, expect.objectContaining({
      trackingCodes: ["TRACK001", "TRACK002"],
    }));
  });
});
