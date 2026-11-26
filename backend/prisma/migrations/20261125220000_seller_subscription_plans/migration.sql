CREATE TYPE "SellerPlan" AS ENUM ('FREE', 'PRO');
CREATE TYPE "SellerSubscriptionStatus" AS ENUM ('NONE', 'PENDING', 'AUTHORIZED', 'PAUSED', 'CANCELLED', 'REJECTED');

ALTER TABLE "SellerProfile"
  ADD COLUMN "plan" "SellerPlan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "subscriptionStatus" "SellerSubscriptionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "planExpiresAt" TIMESTAMP(3),
  ADD COLUMN "mercadoPagoSubscriptionId" TEXT,
  ADD COLUMN "subscriptionExternalReference" TEXT,
  ADD COLUMN "subscriptionCheckoutUrl" TEXT,
  ADD COLUMN "whatsappPhone" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT;

CREATE UNIQUE INDEX "SellerProfile_mercadoPagoSubscriptionId_key" ON "SellerProfile"("mercadoPagoSubscriptionId");
CREATE UNIQUE INDEX "SellerProfile_subscriptionExternalReference_key" ON "SellerProfile"("subscriptionExternalReference");
