import { createProductSchema, productQuerySchema } from "./product.schema.js";

describe("createProductSchema shipping package", () => {
  const product = {
    categoryId: "4e4b4967-68ae-4a2d-bdef-a7a98fe0ea04",
    name: "Produto de teste",
    description: "Descricao valida para produto de teste",
    price: 10,
    stock: 1,
    weightGrams: "1200",
    lengthCm: "30",
    widthCm: "20",
    heightCm: "10",
  };

  it("parses package measurements as positive integers", () => {
    expect(createProductSchema.parse(product)).toMatchObject({
      weightGrams: 1200,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    });
  });

  it("rejects missing or non-positive package measurements", () => {
    expect(createProductSchema.safeParse({ ...product, weightGrams: 0 }).success).toBe(false);
    const { weightGrams: _weight, ...withoutWeight } = product;
    expect(createProductSchema.safeParse(withoutWeight).success).toBe(false);
  });
});

describe("productQuerySchema pagination", () => {
  it("uses a bounded default page and result size", () => {
    expect(productQuerySchema.parse({})).toMatchObject({ page: 1, limit: 12 });
    expect(productQuerySchema.parse({ page: 1000, limit: 30 })).toMatchObject({ page: 1000, limit: 30 });
  });

  it("rejects page numbers and result sizes above the configured caps", () => {
    expect(productQuerySchema.safeParse({ page: 1001 }).success).toBe(false);
    expect(productQuerySchema.safeParse({ limit: 31 }).success).toBe(false);
  });

  it("accepts quick-sale and local-only catalog filters", () => {
    expect(productQuerySchema.parse({ listingType: "QUICK_SALE", localOnly: "true" })).toMatchObject({
      listingType: "QUICK_SALE",
      localOnly: true,
    });
    expect(productQuerySchema.safeParse({ listingType: "OTHER" }).success).toBe(false);
  });

  it("accepts the cross-category used-items filter", () => {
    expect(productQuerySchema.parse({ condition: "USED" }).condition).toBe("USED");
    expect(productQuerySchema.safeParse({ condition: "DAMAGED" }).success).toBe(false);
  });
});
