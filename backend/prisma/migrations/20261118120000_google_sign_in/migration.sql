-- Sign in with Google: the linked Google account, and accounts that only enter
-- with Google (no password). Additive: no account loses its password, and
-- without GOOGLE_CLIENT_ID nothing writes the new column.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
