CREATE TYPE "PlaceStatus" AS ENUM ('PROPOSED', 'SHORTLISTED', 'APPROVED', 'REJECTED');

ALTER TABLE "Place" ADD COLUMN "status" "PlaceStatus" NOT NULL DEFAULT 'PROPOSED';

CREATE INDEX "Place_tripId_status_idx" ON "Place"("tripId", "status");
