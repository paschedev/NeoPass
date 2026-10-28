-- What Mercado Pago really charges each organizer (FEAT-43): the fee of every
-- paid order, as Mercado Pago reports it, and the organizer's latest rate and
-- release term. Past orders stay without it: Mercado Pago never reported it.
ALTER TABLE "User" ADD COLUMN "mercadoPagoFeeRate" DECIMAL(6,5),
ADD COLUMN "mercadoPagoReleaseDays" INTEGER,
ADD COLUMN "mercadoPagoFeeRateAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN "mercadoPagoFee" DECIMAL(10,2);

ALTER TABLE "PaymentPart" ADD COLUMN "mercadoPagoFee" DECIMAL(10,2);

ALTER TABLE "User" ADD CONSTRAINT "User_mercadoPagoFeeRate_range"
  CHECK ("mercadoPagoFeeRate" >= 0 AND "mercadoPagoFeeRate" < 1);
ALTER TABLE "User" ADD CONSTRAINT "User_mercadoPagoReleaseDays_range"
  CHECK ("mercadoPagoReleaseDays" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_mercadoPagoFee_range"
  CHECK ("mercadoPagoFee" >= 0);
ALTER TABLE "PaymentPart" ADD CONSTRAINT "PaymentPart_mercadoPagoFee_range"
  CHECK ("mercadoPagoFee" >= 0);
