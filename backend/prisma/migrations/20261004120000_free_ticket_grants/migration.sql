-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "freeTicketGrantId" TEXT;

-- CreateTable
CREATE TABLE "FreeTicketGrant" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,

    CONSTRAINT "FreeTicketGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeTicketGrant_eventId_idx" ON "FreeTicketGrant"("eventId");

-- CreateIndex
CREATE INDEX "FreeTicketGrant_ticketTypeId_idx" ON "FreeTicketGrant"("ticketTypeId");

-- CreateIndex
CREATE INDEX "FreeTicketGrant_issuedById_createdAt_idx" ON "FreeTicketGrant"("issuedById", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_freeTicketGrantId_idx" ON "Ticket"("freeTicketGrantId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_freeTicketGrantId_fkey" FOREIGN KEY ("freeTicketGrantId") REFERENCES "FreeTicketGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTicketGrant" ADD CONSTRAINT "FreeTicketGrant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTicketGrant" ADD CONSTRAINT "FreeTicketGrant_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTicketGrant" ADD CONSTRAINT "FreeTicketGrant_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

