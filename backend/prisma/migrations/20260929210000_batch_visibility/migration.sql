-- A batch only stores whether it is visible. Whether it is on sale, upcoming,
-- sold out or ended is computed from publishAt, closeAt and the stock.
ALTER TABLE "TicketBatch" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT false;

-- Hidden (DRAFT) batches stay hidden; every other status was shown.
UPDATE "TicketBatch" SET "isVisible" = true WHERE "status" <> 'DRAFT';

-- Ended batches stay ended: their sale closes now at the latest, and a sale
-- start still in the future is dropped so the window stays valid.
-- Prisma stores DateTime as UTC in columns without time zone.
UPDATE "TicketBatch"
SET "closeAt" = LEAST(COALESCE("closeAt", NOW() AT TIME ZONE 'UTC'), NOW() AT TIME ZONE 'UTC'),
    "publishAt" = CASE WHEN "publishAt" > NOW() AT TIME ZONE 'UTC' THEN NULL ELSE "publishAt" END
WHERE "status" = 'ENDED';

-- A sale can't go on after its event ends (the checkout already stopped there).
UPDATE "TicketBatch" AS b
SET "closeAt" = e."endDate"
FROM "Event" AS e
WHERE b."eventId" = e."id" AND b."closeAt" > e."endDate";

ALTER TABLE "TicketBatch" DROP COLUMN "status";

DROP TYPE "BatchStatus";

-- The sale window lives only in the batch: these columns were copies of it.
ALTER TABLE "TicketType" DROP COLUMN "saleEnd",
DROP COLUMN "saleStart";
