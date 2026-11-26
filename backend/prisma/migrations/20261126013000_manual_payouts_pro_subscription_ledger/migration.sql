ALTER TABLE "Withdrawal" ADD COLUMN "pixKey" TEXT;

CREATE TABLE "ProSubscriptionPayment" (
    "id" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT,
    CONSTRAINT "ProSubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProSubscriptionPayment_providerRef_key" ON "ProSubscriptionPayment"("providerRef");
CREATE INDEX "ProSubscriptionPayment_sellerId_status_createdAt_idx" ON "ProSubscriptionPayment"("sellerId", "status", "createdAt");
CREATE INDEX "ProSubscriptionPayment_subscriptionId_createdAt_idx" ON "ProSubscriptionPayment"("subscriptionId", "createdAt");

ALTER TABLE "ProSubscriptionPayment"
ADD CONSTRAINT "ProSubscriptionPayment_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
