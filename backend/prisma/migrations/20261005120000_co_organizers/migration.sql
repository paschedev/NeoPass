-- CreateEnum
CREATE TYPE "EventPermission" AS ENUM ('EDIT_EVENT', 'MANAGE_BATCHES', 'VIEW_SALES', 'SEND_FREE_TICKETS', 'VIEW_ATTENDEES', 'MANAGE_STAFF');

-- CreateEnum
CREATE TYPE "EventActivityType" AS ENUM ('CO_ORGANIZER_INVITED', 'CO_ORGANIZER_UPDATED', 'CO_ORGANIZER_REMOVED', 'STAFF_INVITED', 'EVENT_UPDATED', 'BATCHES_UPDATED', 'BATCH_SALE_CHANGED', 'FREE_TICKETS_SENT', 'FREE_TICKETS_CANCELLED', 'FREE_TICKETS_RESENT', 'PROMOTER_PAYMENT_REGISTERED');

-- AlterTable
ALTER TABLE "EventStaff" ADD COLUMN     "freeTicketLimit" INTEGER,
ADD COLUMN     "permissions" "EventPermission"[] DEFAULT ARRAY[]::"EventPermission"[];

-- CreateTable
CREATE TABLE "EventActivity" (
    "id" TEXT NOT NULL,
    "type" "EventActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "EventActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventActivity_eventId_createdAt_idx" ON "EventActivity"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventActivity" ADD CONSTRAINT "EventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivity" ADD CONSTRAINT "EventActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A co-organizer's free ticket limit, when set, is at least one ticket.
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_freeTicketLimit_check" CHECK ("freeTicketLimit" IS NULL OR "freeTicketLimit" > 0);
