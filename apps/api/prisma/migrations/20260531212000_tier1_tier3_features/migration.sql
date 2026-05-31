CREATE TYPE "WeatherSuitability" AS ENUM ('INDOOR', 'OUTDOOR', 'MIXED');
CREATE TYPE "BudgetPreference" AS ENUM ('BUDGET', 'NORMAL', 'PREMIUM');
CREATE TYPE "AttendanceStatus" AS ENUM ('GOING', 'MAYBE', 'NO');

ALTER TABLE "Place" ADD COLUMN "weatherSuitability" "WeatherSuitability" NOT NULL DEFAULT 'MIXED';
ALTER TABLE "TripMember" ADD COLUMN "budgetPreference" "BudgetPreference" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "TripMember" ADD COLUMN "budgetAmount" DECIMAL(65,30);
ALTER TABLE "ItineraryStopParticipant" ADD COLUMN "status" "AttendanceStatus" NOT NULL DEFAULT 'GOING';

CREATE TABLE "UserLiveLocation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" INTEGER,
    "sharedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLiveLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserLiveLocation_tripId_userId_key" ON "UserLiveLocation"("tripId", "userId");
CREATE INDEX "UserLiveLocation_tripId_updatedAt_idx" ON "UserLiveLocation"("tripId", "updatedAt");

ALTER TABLE "UserLiveLocation" ADD CONSTRAINT "UserLiveLocation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLiveLocation" ADD CONSTRAINT "UserLiveLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
