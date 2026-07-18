-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Analysis" ADD COLUMN "selfAttestedGapConfirmed" BOOLEAN;

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL
);
