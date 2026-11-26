import { OrderService } from "./OrderService.js";

describe("OrderService return requests", () => {
  function createService(hasDeniedRequest: boolean) {
    const tx = {};
    const orderRepository = {
      transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback(tx)),
      findCustomerOrderWithPayment: jest.fn().mockResolvedValue({
        id: "order-1",
        status: "DELIVERED",
        updatedAt: new Date(),
      }),
      hasDeniedReturnRequest: jest.fn().mockResolvedValue(hasDeniedRequest ? { id: "event-1" } : null),
      transitionOrder: jest.fn().mockResolvedValue({ id: "order-1", status: "RETURN_REQUESTED" }),
    };
    return {
      service: new OrderService({} as never, {} as never, {} as never, orderRepository as never, {} as never, {} as never),
      orderRepository,
    };
  }

  it("does not allow a new return request after an admin denial", async () => {
    const { service, orderRepository } = createService(true);

    await expect(service.requestReturn("customer-1", "order-1", "Produto não serviu")).rejects.toMatchObject({ statusCode: 409 });
    expect(orderRepository.transitionOrder).not.toHaveBeenCalled();
  });

  it("records a return request while the delivery window is open", async () => {
    const { service, orderRepository } = createService(false);

    await service.requestReturn("customer-1", "order-1", "Produto não serviu");

    expect(orderRepository.transitionOrder).toHaveBeenCalledWith(expect.anything(), {
      orderId: "order-1",
      fromStatus: "DELIVERED",
      toStatus: "RETURN_REQUESTED",
      userId: "customer-1",
      type: "RETURN_REQUESTED",
      metadata: { reason: "Produto não serviu" },
    });
  });

  it("keeps return decisions in the admin workflow instead of letting sellers mark them refunded", async () => {
    const mercadoPago = { refundPayment: jest.fn() };
    const orderRepository = {
      findSellerByUserId: jest.fn().mockResolvedValue({ id: "seller-profile-1" }),
      transaction: jest.fn((callback: (transaction: object) => Promise<unknown>) => callback({})),
      findSellerOrderWithItems: jest.fn().mockResolvedValue({
        id: "order-1",
        status: "RETURN_REQUESTED",
        payment: { status: "APPROVED", providerRef: "payment-1" },
      }),
    };
    const service = new OrderService(
      {} as never,
      mercadoPago as never,
      {} as never,
      orderRepository as never,
      {} as never,
      {} as never,
    );

    await expect(service.updateSellerOrder("seller-1", "order-1", "REFUNDED")).rejects.toMatchObject({ statusCode: 409 });
    expect(mercadoPago.refundPayment).not.toHaveBeenCalled();
  });
});
