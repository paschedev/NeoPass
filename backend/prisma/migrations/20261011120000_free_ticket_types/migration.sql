-- AlterTable
ALTER TABLE "EventStaff" ADD COLUMN     "freeTicketTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Whoever can send free tickets today keeps every ticket type their event has
-- now; a type created later has to be ticked by the owner.
UPDATE "EventStaff" es
SET "freeTicketTypes" = names.list
FROM (
  SELECT "eventId", array_agg(DISTINCT name ORDER BY name) AS list
  FROM "TicketType"
  GROUP BY "eventId"
) names
WHERE names."eventId" = es."eventId"
  AND 'SEND_FREE_TICKETS' = ANY (es.permissions);
