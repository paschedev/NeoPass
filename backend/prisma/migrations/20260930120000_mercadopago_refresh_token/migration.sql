-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mercadoPagoRefreshToken" TEXT,
ADD COLUMN     "mercadoPagoTokenExpiresAt" TIMESTAMP(3);
