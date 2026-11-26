import { createQuickSaleSchema } from "./quickSale.schema.js";

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
});
