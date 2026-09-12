CREATE TYPE "SellerApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','SUSPENDED');
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "SellerProfile" ADD COLUMN "approvalStatus" "SellerApprovalStatus" NOT NULL DEFAULT 'PENDING', ADD COLUMN "document" TEXT, ADD COLUMN "legalName" TEXT, ADD COLUMN "kycSubmittedAt" TIMESTAMP(3), ADD COLUMN "kycReviewedAt" TIMESTAMP(3), ADD COLUMN "kycReviewNote" TEXT;
CREATE TABLE "PasswordResetToken" ("id" TEXT PRIMARY KEY,"tokenHash" TEXT UNIQUE NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"usedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"userId" TEXT NOT NULL, CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE);
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId","expiresAt");
CREATE TABLE "EmailVerificationToken" ("id" TEXT PRIMARY KEY,"tokenHash" TEXT UNIQUE NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"usedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"userId" TEXT NOT NULL, CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE);
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId","expiresAt");
