-- AlterTable
ALTER TABLE "Analysis" RENAME COLUMN "tailoredCvJson" TO "cvChangePlanJson";
ALTER TABLE "Analysis" ADD COLUMN "selfAttestedGapDetails" TEXT;
ALTER TABLE "Analysis" ADD COLUMN "recheckCvText" TEXT;
ALTER TABLE "Analysis" ADD COLUMN "recheckResultJson" TEXT;
ALTER TABLE "Analysis" ADD COLUMN "recheckCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "analysisId" TEXT,
    "metadata" TEXT
);

-- CreateIndex
CREATE INDEX "Event_name_idx" ON "Event"("name");
