CREATE TYPE "InventoryMovementType" AS ENUM ('RESTOCK', 'RESERVE', 'RELEASE', 'SALE', 'ADJUSTMENT', 'RETURN');

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL, "sku" TEXT NOT NULL, "attributes" JSONB NOT NULL,
  "price" DECIMAL(12,2), "stock" INTEGER NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_sku_key" UNIQUE ("sku"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductVariant_productId_active_idx" ON "ProductVariant"("productId", "active");

ALTER TABLE "CartItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT, ADD COLUMN "productName" TEXT, ADD COLUMN "productSku" TEXT, ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL, "type" "InventoryMovementType" NOT NULL, "quantity" INTEGER NOT NULL,
  "reference" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "productId" TEXT NOT NULL, "variantId" TEXT,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");

CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalRef" TEXT, "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL, "payload" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "paymentTransactionId" TEXT NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"), CONSTRAINT "PaymentAttempt_externalRef_key" UNIQUE ("externalRef"),
  CONSTRAINT "PaymentAttempt_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "eventId" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paymentTransactionId" TEXT,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id"), CONSTRAINT "PaymentWebhookEvent_provider_eventId_key" UNIQUE ("provider", "eventId"),
  CONSTRAINT "PaymentWebhookEvent_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
