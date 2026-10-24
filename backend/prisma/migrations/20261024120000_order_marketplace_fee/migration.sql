-- What NeoPass keeps of each order (Mercado Pago's marketplace_fee). Until now
-- it kept the whole service fee, so past orders get that amount.
ALTER TABLE "Order" ADD COLUMN "marketplaceFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Order" SET "marketplaceFee" = "serviceFee";

-- NeoPass's share comes out of the service fee: never more, never negative.
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketplaceFee_range"
  CHECK ("marketplaceFee" >= 0 AND "marketplaceFee" <= "serviceFee");
