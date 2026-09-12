ALTER TABLE "Withdrawal" ADD COLUMN "sellerId" TEXT;
CREATE INDEX "Withdrawal_sellerId_status_requestedAt_idx" ON "Withdrawal"("sellerId", "status", "requestedAt");
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;