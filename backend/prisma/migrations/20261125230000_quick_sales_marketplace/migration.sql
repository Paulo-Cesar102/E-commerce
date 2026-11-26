CREATE TYPE "ProductListingType" AS ENUM ('STORE', 'QUICK_SALE');
CREATE TYPE "QuickSalePayoutStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PAID', 'VOIDED');

ALTER TABLE "Product"
  ALTER COLUMN "sellerId" DROP NOT NULL,
  ADD COLUMN "listingType" "ProductListingType" NOT NULL DEFAULT 'STORE',
  ADD COLUMN "originPostalCode" TEXT,
  ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Product_listing_owner_check"
    CHECK (
      ("listingType" = 'STORE' AND "sellerId" IS NOT NULL AND "ownerUserId" IS NULL)
      OR ("listingType" = 'QUICK_SALE' AND "sellerId" IS NULL AND "ownerUserId" IS NOT NULL)
    );

CREATE INDEX "Product_ownerUserId_status_idx" ON "Product"("ownerUserId", "status");

ALTER TABLE "Order"
  ALTER COLUMN "sellerId" DROP NOT NULL,
  ADD COLUMN "directSellerUserId" TEXT,
  ADD COLUMN "quickSalePayoutStatus" "QuickSalePayoutStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "quickSalePayoutReference" TEXT,
  ADD COLUMN "quickSalePayoutPaidAt" TIMESTAMP(3);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_directSellerUserId_fkey"
    FOREIGN KEY ("directSellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Order_seller_owner_check"
    CHECK (
      ("sellerId" IS NOT NULL AND "directSellerUserId" IS NULL)
      OR ("sellerId" IS NULL AND "directSellerUserId" IS NOT NULL)
    );

CREATE INDEX "Order_directSellerUserId_status_idx" ON "Order"("directSellerUserId", "status");

DROP INDEX "PaymentTransaction_providerRef_key";
CREATE INDEX "PaymentTransaction_providerRef_idx" ON "PaymentTransaction"("providerRef");
