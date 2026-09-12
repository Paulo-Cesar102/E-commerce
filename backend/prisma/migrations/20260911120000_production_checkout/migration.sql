ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED';

ALTER TABLE "SellerProfile" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shippingMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingAddress" JSONB;

UPDATE "Order" SET "subtotal" = "total", "shippingMethod" = 'LEGACY', "shippingAddress" = '{}'::jsonb
WHERE "subtotal" IS NULL OR "shippingMethod" IS NULL OR "shippingAddress" IS NULL;

ALTER TABLE "Order"
  ALTER COLUMN "subtotal" SET NOT NULL,
  ALTER COLUMN "shippingMethod" SET NOT NULL,
  ALTER COLUMN "shippingAddress" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "Address" (
  "id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "document" TEXT,
  "postalCode" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT,
  "district" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON "Address"("userId");

CREATE TABLE IF NOT EXISTS "Shipment" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "trackingCode" TEXT,
  "labelUrl" TEXT,
  "quotedDays" INTEGER,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "orderId" TEXT NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Shipment_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "Shipment_trackingCode_key" UNIQUE ("trackingCode"),
  CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "OrderEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fromStatus" "OrderStatus",
  "toStatus" "OrderStatus",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId" TEXT NOT NULL,
  "userId" TEXT,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
