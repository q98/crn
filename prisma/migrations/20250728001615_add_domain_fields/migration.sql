-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainName" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "whoisData" JSONB,
    "registrantName" TEXT,
    "registrantEmail" TEXT,
    "registrantOrg" TEXT,
    "registrar" TEXT,
    "creationDate" DATETIME,
    "expirationDate" DATETIME,
    "lastUpdated" DATETIME,
    "nameservers" JSONB,
    "dnssec" BOOLEAN,
    "lastVerified" DATETIME,
    "nextVerificationDue" DATETIME,
    "verificationInterval" INTEGER NOT NULL DEFAULT 30,
    "autoVerify" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownershipChanged" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Domain_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DomainVerificationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "whoisData" JSONB,
    "registrantName" TEXT,
    "registrantEmail" TEXT,
    "registrar" TEXT,
    "expirationDate" DATETIME,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationMethod" TEXT NOT NULL,
    "errorMessage" TEXT,
    "changesDetected" JSONB,
    "verifiedBy" TEXT,
    "isAutomated" BOOLEAN NOT NULL DEFAULT true,
    "responseTime" INTEGER,
    "notes" TEXT,
    CONSTRAINT "DomainVerificationHistory_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_domainName_key" ON "Domain"("domainName");
