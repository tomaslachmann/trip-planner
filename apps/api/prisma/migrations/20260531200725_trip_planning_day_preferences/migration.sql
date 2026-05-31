-- AlterTable
ALTER TABLE "ItineraryDay" ADD COLUMN     "bufferMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "intensity" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "rainPlan" TEXT;
