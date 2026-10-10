-- The service fee's old column, from when the app was called WePass. Its
-- values were copied to "neoPassFeePercentage" (20261007200000) and the
-- running version no longer reads it (@ignore since #138).

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "wePassFeePercentage";
