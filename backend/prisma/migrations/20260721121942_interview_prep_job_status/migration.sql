-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "cvMode" TEXT,
    "cvFileName" TEXT,
    "cvMimeType" TEXT,
    "cvSizeBytes" INTEGER,
    "cvText" TEXT,
    "vacancySource" TEXT,
    "vacancyUrl" TEXT,
    "vacancyStatus" TEXT NOT NULL DEFAULT 'idle',
    "vacancyFailReason" TEXT,
    "vacancyTitle" TEXT,
    "vacancyCompany" TEXT,
    "vacancyLocation" TEXT,
    "vacancyDomain" TEXT,
    "vacancyText" TEXT,
    "outputLanguage" TEXT NOT NULL DEFAULT 'az',
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "procStage" INTEGER NOT NULL DEFAULT 0,
    "failReason" TEXT,
    "resultJson" TEXT,
    "reportJson" TEXT,
    "cvChangePlanJson" TEXT,
    "interviewPrepJson" TEXT,
    "interviewPrepStatus" TEXT NOT NULL DEFAULT 'idle',
    "interviewPrepFailReason" TEXT,
    "deletedAt" DATETIME,
    "selfAttestedGapConfirmed" BOOLEAN,
    "selfAttestedGapDetails" TEXT,
    "coverLetterJson" TEXT,
    "recheckCvText" TEXT,
    "recheckResultJson" TEXT,
    "recheckCount" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Analysis" ("consent", "coverLetterJson", "createdAt", "cvChangePlanJson", "cvFileName", "cvMimeType", "cvMode", "cvSizeBytes", "cvText", "deletedAt", "expiresAt", "failReason", "id", "interviewPrepJson", "outputLanguage", "procStage", "recheckCount", "recheckCvText", "recheckResultJson", "reportJson", "resultJson", "selfAttestedGapConfirmed", "selfAttestedGapDetails", "status", "vacancyCompany", "vacancyDomain", "vacancyFailReason", "vacancyLocation", "vacancySource", "vacancyStatus", "vacancyText", "vacancyTitle", "vacancyUrl") SELECT "consent", "coverLetterJson", "createdAt", "cvChangePlanJson", "cvFileName", "cvMimeType", "cvMode", "cvSizeBytes", "cvText", "deletedAt", "expiresAt", "failReason", "id", "interviewPrepJson", "outputLanguage", "procStage", "recheckCount", "recheckCvText", "recheckResultJson", "reportJson", "resultJson", "selfAttestedGapConfirmed", "selfAttestedGapDetails", "status", "vacancyCompany", "vacancyDomain", "vacancyFailReason", "vacancyLocation", "vacancySource", "vacancyStatus", "vacancyText", "vacancyTitle", "vacancyUrl" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
CREATE INDEX "Analysis_expiresAt_idx" ON "Analysis"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
