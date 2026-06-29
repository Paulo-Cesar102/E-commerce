import { AppError } from "../errors/AppError.js";

export type StockTransaction = {
  product: {
    updateMany(args: {
      where: { id: string; stock: { gte: number }; status: "ACTIVE" };
      data: { stock: { decrement: number } };
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: { stock: { increment: number } };
    }): Promise<unknown>;
  };
};

export class StockService {
  async reserve(tx: StockTransaction, items: { productId: string; quantity: number }[]) {
    for (const item of items) {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          stock: { gte: item.quantity },
          status: "ACTIVE",
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count === 0) {
        throw new AppError(409, "Produto indisponivel: acabou de ser vendido");
      }
    }
  }

  async release(tx: StockTransaction, items: { productId: string; quantity: number }[]) {
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}
