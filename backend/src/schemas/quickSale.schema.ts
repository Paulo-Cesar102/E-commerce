import { z } from "zod";

export function isValidBrazilianCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

export const quickSaleVerificationSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  cpf: z.string().transform((value) => value.replace(/\D/g, "")).refine(isValidBrazilianCpf, "Informe um CPF válido"),
  consent: z.literal(true),
});

export const createQuickSaleSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(4000),
  price: z.coerce.number().positive(),
  originPostalCode: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{8}$/)),
  weightGrams: z.coerce.number().int().positive(),
  lengthCm: z.coerce.number().int().positive(),
  widthCm: z.coerce.number().int().positive(),
  heightCm: z.coerce.number().int().positive(),
  images: z.array(z.object({ url: z.url(), alt: z.string().max(200).optional() })).min(1).max(6),
});

export const quickSaleListingStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const quickSaleOrderStatusSchema = z.object({
  status: z.enum(["SHIPPED", "DELIVERED"]),
  trackingCodes: z.array(z.string().trim().min(5).max(40)).min(1).optional(),
}).superRefine((value, context) => {
  if (value.status === "SHIPPED" && !value.trackingCodes?.length) {
    context.addIssue({ code: "custom", path: ["trackingCodes"], message: "Informe o codigo de rastreio de cada pacote" });
  }
  if (value.trackingCodes && new Set(value.trackingCodes).size !== value.trackingCodes.length) {
    context.addIssue({ code: "custom", path: ["trackingCodes"], message: "Os codigos de rastreio devem ser diferentes" });
  }
});
