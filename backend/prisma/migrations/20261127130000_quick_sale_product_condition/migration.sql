CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'USED');

ALTER TABLE "Product"
ADD COLUMN "condition" "ProductCondition" NOT NULL DEFAULT 'NEW';
