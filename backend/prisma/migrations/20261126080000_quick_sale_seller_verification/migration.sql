CREATE TYPE "QuickSaleVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "QuickSaleVerification" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "cpfHash" TEXT NOT NULL,
  "cpfLastFour" TEXT NOT NULL,
  "status" "QuickSaleVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "QuickSaleVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuickSaleVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuickSaleVerification_cpfHash_key" ON "QuickSaleVerification"("cpfHash");
CREATE UNIQUE INDEX "QuickSaleVerification_userId_key" ON "QuickSaleVerification"("userId");
CREATE INDEX "QuickSaleVerification_status_submittedAt_idx" ON "QuickSaleVerification"("status", "submittedAt");
