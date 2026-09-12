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
  inventoryMovement?: {
    create(args: { data: { productId: string; quantity: number; type: "RESERVE" | "RELEASE" } }): Promise<unknown>;
  };
  productVariant?: {
    updateMany(args: { where: { id: string; stock: { gte: number }; active: boolean }; data: { stock: { decrement: number } } }): Promise<{ count: number }>;
    update(args: { where: { id: string }; data: { stock: { increment: number } } }): Promise<unknown>;
  };
};

export class StockService {
  async reserve(tx: StockTransaction, items: { productId: string; variantId?: string | null; quantity: number }[]) {
    for (const item of items) {
      if (item.variantId) {
        const result = await tx.productVariant?.updateMany({ where: { id: item.variantId, stock: { gte: item.quantity }, active: true }, data: { stock: { decrement: item.quantity } } });
        if (!result?.count) throw new AppError(409, "Variacao indisponivel: acabou de ser vendida");
        await tx.inventoryMovement?.create({ data: { productId: item.productId, quantity: -item.quantity, type: "RESERVE" } });
        continue;
      }
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
      await tx.inventoryMovement?.create({ data: { productId: item.productId, quantity: -item.quantity, type: "RESERVE" } });
    }
  }

  async release(tx: StockTransaction, items: { productId: string; variantId?: string | null; quantity: number }[]) {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant?.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        await tx.inventoryMovement?.create({ data: { productId: item.productId, quantity: item.quantity, type: "RELEASE" } });
        continue;
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
      await tx.inventoryMovement?.create({ data: { productId: item.productId, quantity: item.quantity, type: "RELEASE" } });
    }
  }
}
