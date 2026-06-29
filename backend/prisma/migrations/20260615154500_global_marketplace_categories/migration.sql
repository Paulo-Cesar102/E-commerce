-- Categories are shared by every seller and buyer.
DROP INDEX "Category_sellerId_slug_key";

ALTER TABLE "Category"
DROP CONSTRAINT "Category_sellerId_fkey";

ALTER TABLE "Category"
DROP COLUMN "sellerId";

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
