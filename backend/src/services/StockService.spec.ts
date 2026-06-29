import { AppError } from "../errors/AppError.js";
import { StockService, type StockTransaction } from "./StockService.js";

describe("StockService", () => {
  it("reserva estoque com decremento atomico", async () => {
    const tx: StockTransaction = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
    };

    await new StockService().reserve(tx, [{ productId: "product-1", quantity: 2 }]);

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "product-1", stock: { gte: 2 }, status: "ACTIVE" },
      data: { stock: { decrement: 2 } },
    });
  });

  it("bloqueia compra quando outro comprador acabou com o estoque", async () => {
    const tx: StockTransaction = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    };

    await expect(new StockService().reserve(tx, [{ productId: "product-1", quantity: 1 }])).rejects.toEqual(
      new AppError(409, "Produto indisponivel: acabou de ser vendido"),
    );
  });
});
