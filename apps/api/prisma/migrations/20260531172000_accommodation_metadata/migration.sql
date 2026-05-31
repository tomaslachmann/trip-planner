-- Add structured metadata for saved accommodation options.
ALTER TABLE "Place"
ADD COLUMN "accommodationProvider" TEXT,
ADD COLUMN "accommodationExternalId" TEXT,
ADD COLUMN "accommodationRating" DOUBLE PRECISION,
ADD COLUMN "accommodationReviewScore" DOUBLE PRECISION,
ADD COLUMN "accommodationReviewCount" INTEGER,
ADD COLUMN "accommodationCurrency" TEXT,
ADD COLUMN "accommodationDeepLinkUrl" TEXT,
ADD COLUMN "accommodationStatus" TEXT;

CREATE UNIQUE INDEX "Place_tripId_accommodationProvider_accommodationExternalId_key"
ON "Place"("tripId", "accommodationProvider", "accommodationExternalId");
