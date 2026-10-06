-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_SALES';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "activityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "openGroupKey" TEXT;

-- Existing notices keep their order: their last news is when they were created.
UPDATE "Notification" SET "activityAt" = "createdAt";

-- Existing notices get the links new ones carry: invitations open the staff
-- page and payments that need review open the event's detail.
UPDATE "Notification" SET "actionUrl" = '/panel/staff'
WHERE "type" = 'STAFF_INVITE' AND "actionUrl" IS NULL;

UPDATE "Notification" SET "actionUrl" = '/panel/eventos/' || "eventId"
WHERE "type" = 'SYSTEM'
  AND "actionUrl" IS NULL
  AND "eventId" IS NOT NULL
  AND "metadata"->>'reason' IS NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_userId_activityAt_idx" ON "Notification"("userId", "activityAt");

-- CreateIndex
-- Existing notices have no group key (NULL), so they never collide.
CREATE UNIQUE INDEX "Notification_userId_openGroupKey_key" ON "Notification"("userId", "openGroupKey");
