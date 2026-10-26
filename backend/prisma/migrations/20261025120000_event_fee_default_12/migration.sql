-- New events start with a 12 % service fee. Existing events keep theirs.
ALTER TABLE "Event" ALTER COLUMN "neoPassFeePercentage" SET DEFAULT 12.0;
