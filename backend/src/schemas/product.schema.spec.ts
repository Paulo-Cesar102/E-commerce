import { productQuerySchema } from "./product.schema.js";

describe("productQuerySchema pagination", () => {
  it("uses a bounded default page and result size", () => {
    expect(productQuerySchema.parse({})).toMatchObject({ page: 1, limit: 12 });
    expect(productQuerySchema.parse({ page: 1000, limit: 30 })).toMatchObject({ page: 1000, limit: 30 });
  });

  it("rejects page numbers and result sizes above the configured caps", () => {
    expect(productQuerySchema.safeParse({ page: 1001 }).success).toBe(false);
    expect(productQuerySchema.safeParse({ limit: 31 }).success).toBe(false);
  });
});
