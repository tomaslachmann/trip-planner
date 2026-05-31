-- Collaboration planning: polls, checklist, day-level place votes and itinerary base locations.
CREATE TYPE "PollStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ChecklistScope" AS ENUM ('PERSONAL', 'SHARED', 'EVERYONE');

ALTER TABLE "ItineraryDay"
ADD COLUMN "basePlaceId" TEXT;

CREATE TABLE "PlaceDayVote" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "itineraryDayId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" "VoteValue" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceDayVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Poll" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "status" "PollStatus" NOT NULL DEFAULT 'OPEN',
  "multiChoice" BOOLEAN NOT NULL DEFAULT false,
  "contextDayId" TEXT,
  "contextPlaceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closesAt" TIMESTAMP(3),
  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollOption" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "placeId" TEXT,
  "itineraryDayId" TEXT,
  CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollVote" (
  "id" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChecklistItem" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "scope" "ChecklistScope" NOT NULL DEFAULT 'SHARED',
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChecklistAssignment" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ChecklistAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChecklistCompletion" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaceDayVote_placeId_itineraryDayId_userId_key"
ON "PlaceDayVote"("placeId", "itineraryDayId", "userId");

CREATE UNIQUE INDEX "PollOption_pollId_order_key"
ON "PollOption"("pollId", "order");

CREATE UNIQUE INDEX "PollVote_optionId_userId_key"
ON "PollVote"("optionId", "userId");

CREATE UNIQUE INDEX "ChecklistAssignment_itemId_userId_key"
ON "ChecklistAssignment"("itemId", "userId");

CREATE UNIQUE INDEX "ChecklistCompletion_itemId_userId_key"
ON "ChecklistCompletion"("itemId", "userId");

ALTER TABLE "ItineraryDay"
ADD CONSTRAINT "ItineraryDay_basePlaceId_fkey"
FOREIGN KEY ("basePlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlaceDayVote"
ADD CONSTRAINT "PlaceDayVote_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceDayVote"
ADD CONSTRAINT "PlaceDayVote_itineraryDayId_fkey"
FOREIGN KEY ("itineraryDayId") REFERENCES "ItineraryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceDayVote"
ADD CONSTRAINT "PlaceDayVote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Poll"
ADD CONSTRAINT "Poll_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Poll"
ADD CONSTRAINT "Poll_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PollOption"
ADD CONSTRAINT "PollOption_pollId_fkey"
FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PollVote"
ADD CONSTRAINT "PollVote_optionId_fkey"
FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PollVote"
ADD CONSTRAINT "PollVote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistItem"
ADD CONSTRAINT "ChecklistItem_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistItem"
ADD CONSTRAINT "ChecklistItem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChecklistAssignment"
ADD CONSTRAINT "ChecklistAssignment_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistAssignment"
ADD CONSTRAINT "ChecklistAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
ADD CONSTRAINT "ChecklistCompletion_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
ADD CONSTRAINT "ChecklistCompletion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
