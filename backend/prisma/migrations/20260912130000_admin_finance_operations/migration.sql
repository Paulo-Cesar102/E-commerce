CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID');

CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "providerRef" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Withdrawal_status_requestedAt_idx" ON "Withdrawal"("status", "requestedAt");