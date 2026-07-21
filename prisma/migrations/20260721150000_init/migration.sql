-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('planned', 'active', 'completed');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('imported', 'categorized', 'needs_review', 'reviewed');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('csv', 'quickbooks', 'demo');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('quickbooks');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "status" "JobStatus" NOT NULL,
    "estimatedRevenue" DECIMAL(12,2) NOT NULL,
    "actualRevenue" DECIMAL(12,2) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "uploadBatchId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "memo" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "rawCategory" TEXT,
    "aiCategory" TEXT NOT NULL DEFAULT 'Uncategorized',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suggestedJobId" TEXT,
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchReason" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'imported',
    "source" "TransactionSource" NOT NULL DEFAULT 'csv',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "incomeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expenseTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "direction" "TransactionDirection" NOT NULL DEFAULT 'expense',
    "tradeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "realmId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Job_companyId_status_idx" ON "Job"("companyId", "status");

-- CreateIndex
CREATE INDEX "Job_companyId_createdAt_idx" ON "Job"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_companyId_name_key" ON "Job"("companyId", "name");

-- CreateIndex
CREATE INDEX "Transaction_companyId_date_idx" ON "Transaction"("companyId", "date");

-- CreateIndex
CREATE INDEX "Transaction_companyId_direction_date_idx" ON "Transaction"("companyId", "direction", "date");

-- CreateIndex
CREATE INDEX "Transaction_companyId_status_idx" ON "Transaction"("companyId", "status");

-- CreateIndex
CREATE INDEX "Transaction_jobId_idx" ON "Transaction"("jobId");

-- CreateIndex
CREATE INDEX "Transaction_uploadBatchId_idx" ON "Transaction"("uploadBatchId");

-- CreateIndex
CREATE INDEX "Transaction_suggestedJobId_idx" ON "Transaction"("suggestedJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_companyId_fingerprint_key" ON "Transaction"("companyId", "fingerprint");

-- CreateIndex
CREATE INDEX "UploadBatch_companyId_createdAt_idx" ON "UploadBatch"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CategoryRule_companyId_direction_idx" ON "CategoryRule"("companyId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_companyId_direction_keyword_key" ON "CategoryRule"("companyId", "direction", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_companyId_provider_key" ON "IntegrationConnection"("companyId", "provider");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
