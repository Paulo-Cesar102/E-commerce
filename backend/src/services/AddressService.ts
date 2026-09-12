import prisma from "../../prisma/prisma.js";
import { AppError } from "../errors/AppError.js";

export type AddressInput = {
  recipient: string; document?: string; postalCode: string; street: string; number: string;
  complement?: string; district: string; city: string; state: string; isDefault?: boolean;
};

export class AddressService {
  list(userId: string) { return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }); }
  async create(userId: string, input: AddressInput) {
    return prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      if (input.isDefault || count === 0) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...input, isDefault: input.isDefault || count === 0, userId } });
    });
  }
  async update(userId: string, id: string, input: Partial<AddressInput>) {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new AppError(404, "Endereco nao encontrado");
    return prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: input });
    });
  }
  async remove(userId: string, id: string) {
    const result = await prisma.address.deleteMany({ where: { id, userId } });
    if (!result.count) throw new AppError(404, "Endereco nao encontrado");
  }
  async getOwned(userId: string, id: string) {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new AppError(400, "Endereco de entrega invalido");
    return address;
  }
}
