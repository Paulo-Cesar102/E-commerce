import { createQuickSaleSchema, quickSaleVerificationSchema } from "./quickSale.schema.js";

describe("createQuickSaleSchema shipping package", () => {
  const listing = {
    categoryId: "4e4b4967-68ae-4a2d-bdef-a7a98fe0ea04",
    name: "Console usado",
    description: "Console em bom estado, com controle e cabos.",
    price: 250,
    originPostalCode: "12345-678",
    weightGrams: "1200",
    lengthCm: "30",
    widthCm: "20",
    heightCm: "10",
    images: [{ url: "https://images.test/console.webp" }],
  };

  it("normalizes the origin postal code and parses package measurements", () => {
    expect(createQuickSaleSchema.parse(listing)).toMatchObject({
      originPostalCode: "12345678",
      weightGrams: 1200,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    });
  });

  it("rejects missing and non-positive package measurements", () => {
    expect(createQuickSaleSchema.safeParse({ ...listing, heightCm: "0" }).success).toBe(false);
    const { weightGrams: _weight, ...withoutWeight } = listing;
    expect(createQuickSaleSchema.safeParse(withoutWeight).success).toBe(false);
  });

  it("normalizes and validates CPF check digits before accepting verification", () => {
    expect(quickSaleVerificationSchema.parse({
      legalName: "Pessoa Exemplo",
      cpf: "529.982.247-25",
      consent: true,
    })).toMatchObject({ cpf: "52998224725" });
    expect(quickSaleVerificationSchema.safeParse({
      legalName: "Pessoa Exemplo",
      cpf: "111.111.111-11",
      consent: true,
    }).success).toBe(false);
    expect(quickSaleVerificationSchema.safeParse({
      legalName: "Pessoa Exemplo",
      cpf: "529.982.247-25",
      consent: false,
    }).success).toBe(false);
  });
});
