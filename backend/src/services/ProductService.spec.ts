import { ProductRepository } from "../repository/ProductRepository.js";
import { ProductService } from "./ProductService.js";

describe("ProductService catalog filters", () => {
  const list = jest.fn().mockResolvedValue({ items: [], total: 0 });
  const service = new ProductService({ list } as unknown as ProductRepository);

  beforeEach(() => list.mockClear());

  it("limits local-only browsing to free store listings in the selected location", async () => {
    await service.list({
      localOnly: true,
      city: "Campinas",
      state: "SP",
      sort: "rating",
      page: 1,
      limit: 12,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        listingType: "STORE",
        seller: {
          is: expect.objectContaining({
            plan: "FREE",
            city: { equals: "Campinas", mode: "insensitive" },
            state: { equals: "SP", mode: "insensitive" },
          }),
        },
      }),
      expect.anything(),
      1,
      12,
    );
  });

  it("limits quick-sale browsing to available quick-sale listings", async () => {
    await service.list({
      listingType: "QUICK_SALE",
      sort: "rating",
      page: 1,
      limit: 12,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        listingType: "QUICK_SALE",
        stock: { gt: 0 },
      }),
      expect.anything(),
      1,
      12,
    );
  });

  it("shows only available used quick-sale listings in the cross-category collection", async () => {
    const categoryId = "4e4b4967-68ae-4a2d-bdef-a7a98fe0ea04";
    await service.list({
      condition: "USED",
      categoryId,
      sort: "rating",
      page: 1,
      limit: 12,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: "USED",
        listingType: "QUICK_SALE",
        stock: { gt: 0 },
        categoryId,
      }),
      expect.anything(),
      1,
      12,
    );
  });
});
