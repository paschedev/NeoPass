-- FEAT-44: new events start with a 10 % service fee. Existing events keep theirs.
ALTER TABLE "Event" ALTER COLUMN "neoPassFeePercentage" SET DEFAULT 10.0;
