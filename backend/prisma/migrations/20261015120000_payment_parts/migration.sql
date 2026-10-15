-- CreateTable
CREATE TABLE "PaymentPart" (
    "id" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "PaymentPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPart_providerPaymentId_key" ON "PaymentPart"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentPart_orderId_idx" ON "PaymentPart"("orderId");

-- AddForeignKey
ALTER TABLE "PaymentPart" ADD CONSTRAINT "PaymentPart_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

