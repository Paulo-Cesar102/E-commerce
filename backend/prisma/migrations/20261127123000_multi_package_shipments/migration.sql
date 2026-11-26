ALTER TABLE "Shipment"
  ADD COLUMN "packageNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "packageLabel" TEXT;

ALTER TABLE "Shipment"
  DROP CONSTRAINT "Shipment_orderId_key";

CREATE UNIQUE INDEX "Shipment_orderId_packageNumber_key"
  ON "Shipment"("orderId", "packageNumber");
