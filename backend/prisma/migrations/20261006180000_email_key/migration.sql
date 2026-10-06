-- One account per mailbox: emails are stored without surrounding spaces and in
-- lowercase, and "emailKey" says which mailbox an email reaches (Gmail ignores
-- dots and anything after a "+" in the name, and googlemail.com is gmail.com).
-- The database applies the rule on every write, so every writer follows it,
-- including the previous version of the app while this one deploys.

-- The key of an email however it is typed. The app looks accounts up with it.
CREATE FUNCTION email_key(email TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN substring(e FROM '@([^@]*)$') IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(substring(e FROM '^(.*)@[^@]*$'), '+', 1), '.', '') || '@gmail.com'
    ELSE e
  END
  FROM (SELECT lower(btrim(email)) AS e) AS normalized
$$;

CREATE FUNCTION normalize_user_email() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."email" := lower(btrim(NEW."email"));
  NEW."emailKey" := email_key(NEW."email");
  RETURN NEW;
END
$$;

-- Existing accounts. Two emails that only differ in case, or two ways of
-- writing the same Gmail, make this fail and the deploy stops (checked in
-- production before releasing it).
UPDATE "User" SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailKey" TEXT NOT NULL DEFAULT '';

UPDATE "User" SET "emailKey" = email_key("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailKey_key" ON "User"("emailKey");

-- Also when someone writes "emailKey" directly: it always comes from the email.
CREATE TRIGGER "User_normalize_email"
BEFORE INSERT OR UPDATE OF "email", "emailKey" ON "User"
FOR EACH ROW EXECUTE FUNCTION normalize_user_email();
