-- CreateTable
CREATE TABLE "SuperadminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordAlgo" TEXT NOT NULL DEFAULT 'bcrypt',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME
);

-- CreateTable
CREATE TABLE "SuperadminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "superadminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfSecret" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" DATETIME NOT NULL,
    "absoluteExpiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "userAgentSummary" TEXT,
    "requestIdHash" TEXT,
    CONSTRAINT "SuperadminSession_superadminUserId_fkey" FOREIGN KEY ("superadminUserId") REFERENCES "SuperadminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" TEXT,
    "requestIdHash" TEXT
);

-- CreateTable
CREATE TABLE "MetricRollup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "granularity" TEXT NOT NULL,
    "bucketStart" DATETIME NOT NULL,
    "metricKey" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "value" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "analysisId" TEXT,
    "metadata" TEXT,
    "eventId" TEXT,
    "visitorRef" TEXT,
    "webSessionRef" TEXT,
    "packageCode" TEXT,
    "language" TEXT,
    "deviceCategory" TEXT,
    "path" TEXT,
    "referrerDomain" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "source" TEXT NOT NULL DEFAULT 'client'
);
INSERT INTO "new_Event" ("analysisId", "createdAt", "id", "metadata", "name") SELECT "analysisId", "createdAt", "id", "metadata", "name" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_eventId_key" ON "Event"("eventId");
CREATE INDEX "Event_name_idx" ON "Event"("name");
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");
CREATE INDEX "Event_visitorRef_idx" ON "Event"("visitorRef");
CREATE INDEX "Event_webSessionRef_idx" ON "Event"("webSessionRef");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "analysisId" TEXT NOT NULL,
    "package" INTEGER NOT NULL,
    "amountUsd" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "publicReference" TEXT,
    "provider" TEXT,
    "providerTransactionRef" TEXT,
    "providerFeeAmount" REAL,
    "checkoutStartedAt" DATETIME,
    "failedAt" DATETIME,
    "refundedAt" DATETIME,
    "refundAmountUsd" REAL NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    CONSTRAINT "Order_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("amountUsd", "analysisId", "createdAt", "id", "package", "paidAt", "status") SELECT "amountUsd", "analysisId", "createdAt", "id", "package", "paidAt", "status" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_publicReference_key" ON "Order"("publicReference");
CREATE INDEX "Order_analysisId_idx" ON "Order"("analysisId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_provider_idx" ON "Order"("provider");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SuperadminUser_email_key" ON "SuperadminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SuperadminSession_tokenHash_key" ON "SuperadminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "SuperadminSession_superadminUserId_idx" ON "SuperadminSession"("superadminUserId");

-- CreateIndex
CREATE INDEX "SuperadminSession_idleExpiresAt_idx" ON "SuperadminSession"("idleExpiresAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "MetricRollup_bucketStart_idx" ON "MetricRollup"("bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "MetricRollup_granularity_bucketStart_metricKey_dimension_key" ON "MetricRollup"("granularity", "bucketStart", "metricKey", "dimension");
