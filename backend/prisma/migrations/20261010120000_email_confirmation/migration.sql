-- Email confirmation with a 6-digit code (sent to the account's email, or to
-- the new one when changing it). Additive: existing accounts stay unconfirmed
-- and the running version ignores the new column and table.

-- CreateEnum
CREATE TYPE "EmailCodePurpose" AS ENUM ('VERIFY', 'CHANGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailCode" (
    "userId" TEXT NOT NULL,
    "purpose" "EmailCodePurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "sentInWindow" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "EmailCode_counters_check" CHECK ("attempts" >= 0 AND "sentInWindow" >= 1)
);

-- AddForeignKey
ALTER TABLE "EmailCode" ADD CONSTRAINT "EmailCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
