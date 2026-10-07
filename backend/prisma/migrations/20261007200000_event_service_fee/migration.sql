-- The service fee moves to "neoPassFeePercentage" (the old column kept the
-- WePass name). "wePassFeePercentage" stays until the next deploy so the
-- previous version keeps working while this one deploys.
ALTER TABLE "Event" ADD COLUMN "neoPassFeePercentage" DECIMAL(5,2) NOT NULL DEFAULT 15.0;

UPDATE "Event" SET "neoPassFeePercentage" = "wePassFeePercentage";

-- A typo can't charge more than the ticket itself, not even from SQL.
ALTER TABLE "Event" ADD CONSTRAINT "Event_neoPassFeePercentage_range"
  CHECK ("neoPassFeePercentage" >= 0 AND "neoPassFeePercentage" <= 100);
