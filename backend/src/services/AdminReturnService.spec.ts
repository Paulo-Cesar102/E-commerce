import { AdminReturnService } from "./AdminReturnService.js";

describe("AdminReturnService", () => {
  function createService() {
    const order = {
      id: "order-1",
      status: "RETURN_REQUESTED",
      customerId: "customer-1",
      directSellerUserId: "seller-1",
      payment: { status: "APPROVED", providerRef: "payment-1" },
    };
    const tx = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(order),
      },
      paymentTransaction: { update: jest.fn().mockResolvedValue({}) },
      orderEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const database = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const mercadoPago = { refundPayment: jest.fn().mockResolvedValue(undefined) };
    const stock = { release: jest.fn() };
    return {
      service: new AdminReturnService(database as never, mercadoPago as never, stock as never),
      tx,
      mercadoPago,
      stock,
    };
  }

  it("requests one idempotent full refund and voids a quick-sale payout after approval", async () => {
    const { service, tx, mercadoPago, stock } = createService();

    await service.resolve("order-1", "admin-1", { decision: "APPROVE", note: "Devolução conferida." });

    expect(mercadoPago.refundPayment).toHaveBeenCalledWith("payment-1", "return-order-1");
    expect(tx.order.updateMany).toHaveBeenLastCalledWith({
      where: { id: "order-1", status: "RETURN_REQUESTED" },
      data: { status: "REFUNDED", quickSalePayoutStatus: "VOIDED" },
    });
    expect(tx.paymentTransaction.update).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: "REFUNDED" },
    });
    expect(stock.release).not.toHaveBeenCalled();
  });

  it("records a denial without issuing a refund", async () => {
    const { service, tx, mercadoPago } = createService();

    await service.resolve("order-1", "admin-1", { decision: "DENY", note: "Critérios de devolução não atendidos." });

    expect(mercadoPago.refundPayment).not.toHaveBeenCalled();
    expect(tx.order.updateMany).toHaveBeenLastCalledWith({
      where: { id: "order-1", status: "RETURN_REQUESTED" },
      data: { status: "DELIVERED" },
    });
    expect(tx.orderEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "RETURN_DENIED", toStatus: "DELIVERED" }),
    }));
  });
});
