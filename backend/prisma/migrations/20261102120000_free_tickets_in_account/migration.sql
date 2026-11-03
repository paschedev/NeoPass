-- Free tickets show in "Mis entradas" of the account whose email reaches the
-- mailbox they were sent to: each grant keeps the key of its email, computed
-- by the database as for accounts (email_key(), migration 20261006180000).
-- And a daily limit of wrong email codes per mailbox, across accounts.
-- Additive: the running version ignores the new column and table.

-- AlterTable
ALTER TABLE "FreeTicketGrant" ADD COLUMN "recipientEmailKey" TEXT NOT NULL DEFAULT '';

CREATE FUNCTION free_ticket_recipient_email_key() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."recipientEmailKey" := email_key(NEW."recipientEmail");
  RETURN NEW;
END
$$;

-- Existing grants.
UPDATE "FreeTicketGrant" SET "recipientEmailKey" = email_key("recipientEmail");

-- Also when someone writes the key directly: it always comes from the email.
CREATE TRIGGER "FreeTicketGrant_recipient_email_key"
BEFORE INSERT OR UPDATE OF "recipientEmail", "recipientEmailKey" ON "FreeTicketGrant"
FOR EACH ROW EXECUTE FUNCTION free_ticket_recipient_email_key();

-- CreateIndex
CREATE INDEX "FreeTicketGrant_recipientEmailKey_idx" ON "FreeTicketGrant"("recipientEmailKey");

-- CreateTable
CREATE TABLE "EmailCodeFailure" (
    "id" TEXT NOT NULL,
    "emailKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCodeFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailCodeFailure_emailKey_createdAt_idx" ON "EmailCodeFailure"("emailKey", "createdAt");
