-- Payments to a promoter as the organizer records them (the money moves outside
-- NeoPass). New table: existing data is untouched.
CREATE TABLE "PromoterPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventStaffId" TEXT NOT NULL,
    "registeredById" TEXT NOT NULL,

    CONSTRAINT "PromoterPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_promoter_payment_amount" CHECK ("amount" > 0)
);

CREATE INDEX "PromoterPayment_eventStaffId_idx" ON "PromoterPayment"("eventStaffId");

ALTER TABLE "PromoterPayment" ADD CONSTRAINT "PromoterPayment_eventStaffId_fkey" FOREIGN KEY ("eventStaffId") REFERENCES "EventStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromoterPayment" ADD CONSTRAINT "PromoterPayment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
