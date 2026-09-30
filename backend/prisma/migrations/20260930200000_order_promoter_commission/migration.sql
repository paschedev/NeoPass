-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "promoterCommission" DECIMAL(10,2);

-- Backfill: paid orders with a promoter get the commission they earned, with
-- the promoter's current settings (the same rule the payment used).
UPDATE "Order" AS o
SET "promoterCommission" = COALESCE(
  CASE s."commissionType"
    WHEN 'PERCENTAGE' THEN ROUND(o."ticketAmount" * s."commissionValue" / 100, 2)
    WHEN 'FIXED' THEN s."commissionValue" * (
      SELECT SUM(i."quantity") FROM "OrderItem" AS i WHERE i."orderId" = o."id"
    )
  END,
  0
)
FROM "EventStaff" AS s
WHERE s."id" = o."promoterId" AND o."status" = 'PAID';

-- "totalEarned" was never reduced when a sale was refunded: rebuild it from
-- the paid orders.
UPDATE "EventStaff" AS s
SET "totalEarned" = COALESCE(
  (
    SELECT SUM(o."promoterCommission")
    FROM "Order" AS o
    WHERE o."promoterId" = s."id" AND o."status" = 'PAID'
  ),
  0
)
WHERE s."role" = 'PROMOTER';
