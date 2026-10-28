-- FEAT-40: which version of each legal text an account accepted, and when.
-- Accounts created before the texts existed get no rows: there is no consent
-- to prove for them.
CREATE TYPE "LegalDocument" AS ENUM ('TERMS', 'PRIVACY', 'ORGANIZER_TERMS');

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document" "LegalDocument" NOT NULL,
    "version" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LegalAcceptance_version_range" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "LegalAcceptance_userId_document_version_key" ON "LegalAcceptance"("userId", "document", "version");

ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
