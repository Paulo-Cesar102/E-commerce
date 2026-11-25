import { AppError } from "../errors/AppError.js";
import { SellerDashboardService } from "./SellerDashboardService.js";

describe("SellerDashboardService.withdrawal", () => {
  it("bloqueia saque acima do saldo disponivel", async () => {
    const repository = {
      findSellerByUserId: jest.fn().mockResolvedValue({ id: "seller-1" }),
      financialData: jest.fn().mockResolvedValue([
        { _sum: { total: "1000", platformFee: "100" }, _count: { id: 10 } },
        [{ id: "w-1", amount: "300", status: "REQUESTED" }],
      ]),
      createWithdrawal: jest.fn(),
    };
    const service = new SellerDashboardService(repository as never);

    await expect(service.requestWithdrawal("user-1", 700)).rejects.toEqual(
      new AppError(409, "Saldo disponivel para saque: R$ 600.00"),
    );
    expect(repository.createWithdrawal).not.toHaveBeenCalled();
  });

  it("permite saque dentro do saldo liquido", async () => {
    const repository = {
      findSellerByUserId: jest.fn().mockResolvedValue({ id: "seller-1" }),
      financialData: jest.fn().mockResolvedValue([
        { _sum: { total: "1000", platformFee: "100" }, _count: { id: 10 } },
        [{ id: "w-1", amount: "200", status: "APPROVED" }],
      ]),
      createWithdrawal: jest.fn().mockResolvedValue({ id: "w-2", amount: 400 }),
    };
    const service = new SellerDashboardService(repository as never);

    await expect(service.requestWithdrawal("user-1", 400)).resolves.toEqual({
      id: "w-2",
      amount: 400,
    });
  });
});
