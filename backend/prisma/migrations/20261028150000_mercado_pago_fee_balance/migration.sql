-- FEAT-43: what an organizer owes NeoPass for absorbing less than their third
-- of Mercado Pago's real fee, and how each order collects it.
ALTER TABLE "User" ADD COLUMN "mercadoPagoFeeBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN "feeAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "feeDeviation" DECIMAL(10,2);

ALTER TABLE "User" ADD CONSTRAINT "User_mercadoPagoFeeBalance_range"
  CHECK ("mercadoPagoFeeBalance" >= 0);

-- A sale collects at most 10 % of its tickets' value.
ALTER TABLE "Order" ADD CONSTRAINT "Order_feeAdjustment_range"
  CHECK ("feeAdjustment" >= 0 AND "feeAdjustment" * 10 <= "ticketAmount");

-- NeoPass's share now carries the adjustment on top of the service fee.
ALTER TABLE "Order" DROP CONSTRAINT "Order_marketplaceFee_range";
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketplaceFee_range"
  CHECK ("marketplaceFee" >= 0 AND "marketplaceFee" <= "serviceFee" + "feeAdjustment");
