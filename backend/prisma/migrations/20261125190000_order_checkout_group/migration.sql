ALTER TABLE "Order" ADD COLUMN "checkoutId" TEXT;
CREATE INDEX "Order_checkoutId_idx" ON "Order"("checkoutId");
