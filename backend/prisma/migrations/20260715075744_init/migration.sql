-- CreateTable
CREATE TABLE "Analysis" (
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
    "tailoredCvJson" TEXT,
    "coverLetterJson" TEXT,
    "interviewPrepJson" TEXT
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "analysisId" TEXT NOT NULL,
    "package" INTEGER NOT NULL,
    "amountUsd" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "Order_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Analysis_expiresAt_idx" ON "Analysis"("expiresAt");

-- CreateIndex
CREATE INDEX "Order_analysisId_idx" ON "Order"("analysisId");
