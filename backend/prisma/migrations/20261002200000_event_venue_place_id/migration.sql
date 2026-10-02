-- Google place picked for the venue: lets Google Maps show the venue by name
-- instead of by coordinates. Nullable, so existing events are untouched.
ALTER TABLE "Event" ADD COLUMN "venuePlaceId" TEXT;
