-- AlterTable
ALTER TABLE "User" ADD COLUMN "hourlyRate" REAL;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "totalHours" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "billingPeriod" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "paidAt" DATETIME,
    "dueDate" DATETIME NOT NULL,
    "timeEntries" JSONB NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainName" TEXT NOT NULL,
    "cPanelUsername" TEXT,
    "diskUsage" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "registrar" TEXT,
    "notes" TEXT,
    "annualHourAllowance" REAL NOT NULL DEFAULT 2.0,
    "yearlyHoursUsed" REAL NOT NULL DEFAULT 0.0,
    "lastYearReset" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Client" ("cPanelUsername", "createdAt", "diskUsage", "domainName", "id", "notes", "registrar", "updatedAt", "verificationStatus") SELECT "cPanelUsername", "createdAt", "diskUsage", "domainName", "id", "notes", "registrar", "updatedAt", "verificationStatus" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_domainName_key" ON "Client"("domainName");
CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "isBilled" BOOLEAN NOT NULL DEFAULT false,
    "billingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "hourlyRate" REAL,
    "billableAmount" REAL,
    "developerAmount" REAL,
    "isWithinAllowance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "taskId" TEXT NOT NULL,
    "developerId" TEXT,
    CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimeEntry" ("createdAt", "description", "duration", "endTime", "id", "isBilled", "startTime", "taskId", "updatedAt") SELECT "createdAt", "description", "duration", "endTime", "id", "isBilled", "startTime", "taskId", "updatedAt" FROM "TimeEntry";
DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
