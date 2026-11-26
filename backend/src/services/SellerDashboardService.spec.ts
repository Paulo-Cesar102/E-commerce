import { AppError } from "../errors/AppError.js";
import { SellerDashboardService } from "./SellerDashboardService.js";

describe("SellerDashboardService.withdrawal", () => {
  it("bloqueia saque acima do saldo disponivel", async () => {
    const repository = {
      findSellerByUserId: jest.fn().mockResolvedValue({ id: "seller-1" }),
      reserveWithdrawal: jest.fn().mockResolvedValue({ available: 600, withdrawal: null }),
    };
    const service = new SellerDashboardService(repository as never);

    await expect(service.requestWithdrawal("user-1", 700, "pix-key-123")).rejects.toEqual(
      new AppError(409, "Saldo disponivel para saque: R$ 600.00"),
    );
    expect(repository.reserveWithdrawal).toHaveBeenCalledWith("seller-1", 700, "pix-key-123");
  });

  it("permite saque dentro do saldo liquido", async () => {
    const repository = {
      findSellerByUserId: jest.fn().mockResolvedValue({ id: "seller-1" }),
      reserveWithdrawal: jest.fn().mockResolvedValue({ available: 700, withdrawal: { id: "w-2", amount: 400 } }),
    };
    const service = new SellerDashboardService(repository as never);

    await expect(service.requestWithdrawal("user-1", 400, "chave-pix@example.com")).resolves.toEqual({
      id: "w-2",
      amount: 400,
    });
    expect(repository.reserveWithdrawal).toHaveBeenCalledWith("seller-1", 400, "chave-pix@example.com");
  });
});
