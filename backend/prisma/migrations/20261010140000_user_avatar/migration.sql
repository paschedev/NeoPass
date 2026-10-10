-- Profile photo. Additive: existing accounts have none and the running
-- version ignores the column.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;
