-- CreateTable
CREATE TABLE "AnonymousSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecoveryToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "RecoveryToken_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "anonymousSessionId" TEXT,
    "paidAt" DATETIME,
    "entitlementExpiresAt" DATETIME,
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
    "recheckCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Analysis_anonymousSessionId_fkey" FOREIGN KEY ("anonymousSessionId") REFERENCES "AnonymousSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Analysis" ("consent", "coverLetterJson", "createdAt", "cvChangePlanJson", "cvFileName", "cvMimeType", "cvMode", "cvSizeBytes", "cvText", "deletedAt", "expiresAt", "failReason", "id", "interviewPrepFailReason", "interviewPrepJson", "interviewPrepStatus", "outputLanguage", "procStage", "recheckCount", "recheckCvText", "recheckResultJson", "reportJson", "resultJson", "selfAttestedGapConfirmed", "selfAttestedGapDetails", "status", "vacancyCompany", "vacancyDomain", "vacancyFailReason", "vacancyLocation", "vacancySource", "vacancyStatus", "vacancyText", "vacancyTitle", "vacancyUrl") SELECT "consent", "coverLetterJson", "createdAt", "cvChangePlanJson", "cvFileName", "cvMimeType", "cvMode", "cvSizeBytes", "cvText", "deletedAt", "expiresAt", "failReason", "id", "interviewPrepFailReason", "interviewPrepJson", "interviewPrepStatus", "outputLanguage", "procStage", "recheckCount", "recheckCvText", "recheckResultJson", "reportJson", "resultJson", "selfAttestedGapConfirmed", "selfAttestedGapDetails", "status", "vacancyCompany", "vacancyDomain", "vacancyFailReason", "vacancyLocation", "vacancySource", "vacancyStatus", "vacancyText", "vacancyTitle", "vacancyUrl" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
CREATE INDEX "Analysis_expiresAt_idx" ON "Analysis"("expiresAt");
CREATE INDEX "Analysis_anonymousSessionId_idx" ON "Analysis"("anonymousSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousSession_tokenHash_key" ON "AnonymousSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AnonymousSession_expiresAt_idx" ON "AnonymousSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryToken_tokenHash_key" ON "RecoveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RecoveryToken_analysisId_idx" ON "RecoveryToken"("analysisId");
