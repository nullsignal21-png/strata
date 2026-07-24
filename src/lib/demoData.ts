import {
  JobStatus,
  Prisma,
  PrismaClient,
  TransactionDirection,
  TransactionSource,
  TransactionStatus,
} from "@prisma/client";
import { transactionFingerprint } from "./csv";
import { getEnv } from "./env";
import { logger } from "./logging";
import { getPrisma } from "./prisma";

const demoCompany = {
  slug: "triangle-hvac-plumbing",
  name: "Triangle HVAC & Plumbing",
  tradeType: "HVAC/plumbing",
};

const jobSeeds = [
  ["Cary HVAC Replacement - Patel Residence", "Patel Residence", "HVAC", "Cary", "114 Kildaire Farm Rd", JobStatus.active, 14200, 15500],
  ["Raleigh Water Heater Install - Johnson", "Johnson", "Plumbing", "Raleigh", "410 Glenwood Ave", JobStatus.completed, 3600, 3850],
  ["Apex Commercial Maintenance - Greenway Offices", "Greenway Offices", "HVAC", "Apex", "88 Greenway Park Dr", JobStatus.active, 18000, 17650],
  ["Morrisville Emergency Plumbing - Singh", "Singh", "Plumbing", "Morrisville", "22 Town Hall Dr", JobStatus.completed, 2500, 2650],
  ["Durham Mini Split Install - Lopez", "Lopez", "HVAC", "Durham", "907 Ninth St", JobStatus.planned, 8200, 7900],
] as const;

const categoryRules = [
  ["Home Depot", "Materials", TransactionDirection.expense],
  ["Lowe's", "Materials", TransactionDirection.expense],
  ["Lowes", "Materials", TransactionDirection.expense],
  ["Ferguson", "Materials", TransactionDirection.expense],
  ["Johnstone Supply", "Materials", TransactionDirection.expense],
  ["Grainger", "Tools & Equipment", TransactionDirection.expense],
  ["Shell", "Fuel & Vehicle", TransactionDirection.expense],
  ["BP", "Fuel & Vehicle", TransactionDirection.expense],
  ["Exxon", "Fuel & Vehicle", TransactionDirection.expense],
  ["U-Haul", "Fuel & Vehicle", TransactionDirection.expense],
  ["Waste Management", "Job Site / Disposal", TransactionDirection.expense],
  ["Office Depot", "Office/Admin", TransactionDirection.expense],
  ["QuickBooks", "Software", TransactionDirection.expense],
  ["Google Workspace", "Software", TransactionDirection.expense],
  ["Verizon", "Utilities", TransactionDirection.expense],
  ["Duke Energy", "Utilities", TransactionDirection.expense],
  ["Insurance", "Insurance", TransactionDirection.expense],
  ["Customer Payment", "Customer Payment", TransactionDirection.income],
  ["Refund", "Refund", TransactionDirection.income],
] as const;

const transactions = [
  ["Cary HVAC Replacement - Patel Residence", "2026-06-03", "Home Depot Cary - Patel HVAC condenser pad and line set", "Home Depot", null, 1840.22, TransactionDirection.expense, "Materials", 0.96, TransactionStatus.reviewed],
  ["Cary HVAC Replacement - Patel Residence", "2026-06-04", "Johnstone Supply Cary Patel Residence compressor parts", "Johnstone Supply", null, 2265.91, TransactionDirection.expense, "Materials", 0.94, TransactionStatus.categorized],
  ["Cary HVAC Replacement - Patel Residence", "2026-06-05", "Shell fuel for Cary install crew", "Shell", null, 91.42, TransactionDirection.expense, "Fuel & Vehicle", 0.9, TransactionStatus.categorized],
  ["Cary HVAC Replacement - Patel Residence", "2026-06-07", "U-Haul lift rental Cary HVAC replacement", "U-Haul", null, 276.0, TransactionDirection.expense, "Fuel & Vehicle", 0.81, TransactionStatus.categorized],
  ["Cary HVAC Replacement - Patel Residence", "2026-06-08", "Customer payment Patel Residence deposit", "ACH Credit", "invoice 1021", 8000.0, TransactionDirection.income, "Customer Payment", 0.91, TransactionStatus.reviewed],
  ["Cary HVAC Replacement - Patel Residence", "2026-06-20", "Customer payment Patel final balance", "ACH Credit", "invoice 1021", 7500.0, TransactionDirection.income, "Customer Payment", 0.91, TransactionStatus.reviewed],
  ["Raleigh Water Heater Install - Johnson", "2026-06-06", "Ferguson Raleigh Johnson water heater and fittings", "Ferguson", null, 1188.35, TransactionDirection.expense, "Materials", 0.95, TransactionStatus.reviewed],
  ["Raleigh Water Heater Install - Johnson", "2026-06-06", "Lowe's Raleigh Johnson permit supplies", "Lowe's", null, 164.72, TransactionDirection.expense, "Materials", 0.88, TransactionStatus.categorized],
  ["Raleigh Water Heater Install - Johnson", "2026-06-08", "BP fuel Raleigh water heater install", "BP", null, 47.86, TransactionDirection.expense, "Fuel & Vehicle", 0.89, TransactionStatus.categorized],
  ["Raleigh Water Heater Install - Johnson", "2026-06-10", "Customer payment Johnson water heater", "Customer Payment", "invoice 1032", 3850.0, TransactionDirection.income, "Customer Payment", 0.92, TransactionStatus.reviewed],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-09", "Grainger Apex Greenway Offices filters and belts", "Grainger", null, 1495.64, TransactionDirection.expense, "Tools & Equipment", 0.84, TransactionStatus.categorized],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-10", "Waste Management Apex commercial disposal bin", "Waste Management", null, 410.0, TransactionDirection.expense, "Job Site / Disposal", 0.86, TransactionStatus.categorized],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-12", "Amazon Business Greenway thermostat batch", "Amazon Business", null, 572.44, TransactionDirection.expense, "Materials", 0.68, TransactionStatus.needs_review],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-14", "Subcontractor invoice - controls wiring Greenway", "Triangle Controls LLC", null, 4200.0, TransactionDirection.expense, "Subcontractor", 0.77, TransactionStatus.categorized],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-16", "Johnstone Supply Apex rooftop unit coil", "Johnstone Supply", null, 6325.0, TransactionDirection.expense, "Materials", 0.94, TransactionStatus.categorized],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-18", "Permit office Apex commercial HVAC inspection", "Town of Apex", null, 275.0, TransactionDirection.expense, "Permits & Fees", 0.74, TransactionStatus.needs_review],
  ["Apex Commercial Maintenance - Greenway Offices", "2026-06-19", "Greenway Offices monthly maintenance payment", "ACH Credit", "contract 2044", 9000.0, TransactionDirection.income, "Customer Payment", 0.86, TransactionStatus.categorized],
  ["Morrisville Emergency Plumbing - Singh", "2026-06-11", "Ferguson Morrisville Singh emergency copper fittings", "Ferguson", null, 328.95, TransactionDirection.expense, "Materials", 0.93, TransactionStatus.reviewed],
  ["Morrisville Emergency Plumbing - Singh", "2026-06-11", "Shell emergency van fuel Morrisville", "Shell", null, 63.18, TransactionDirection.expense, "Fuel & Vehicle", 0.91, TransactionStatus.categorized],
  ["Morrisville Emergency Plumbing - Singh", "2026-06-12", "City permit counter Morrisville plumbing", "Town of Morrisville", null, 125.0, TransactionDirection.expense, "Permits & Fees", 0.72, TransactionStatus.needs_review],
  ["Morrisville Emergency Plumbing - Singh", "2026-06-13", "Customer payment Singh emergency plumbing", "Customer Payment", "invoice 1040", 2650.0, TransactionDirection.income, "Customer Payment", 0.91, TransactionStatus.reviewed],
  ["Durham Mini Split Install - Lopez", "2026-06-15", "Johnstone Supply Durham Lopez mini split equipment", "Johnstone Supply", null, 3390.8, TransactionDirection.expense, "Materials", 0.96, TransactionStatus.categorized],
  ["Durham Mini Split Install - Lopez", "2026-06-16", "Home Depot Durham line-hide and mounting hardware Lopez", "Home Depot", null, 442.29, TransactionDirection.expense, "Materials", 0.92, TransactionStatus.categorized],
  ["Durham Mini Split Install - Lopez", "2026-06-17", "Duke Energy temporary service coordination", "Duke Energy", null, 88.2, TransactionDirection.expense, "Utilities", 0.8, TransactionStatus.categorized],
  ["Durham Mini Split Install - Lopez", "2026-06-23", "Customer payment Lopez deposit", "ACH Credit", "invoice 1050", 3000.0, TransactionDirection.income, "Customer Payment", 0.86, TransactionStatus.categorized],
  [null, "2026-06-18", "QuickBooks monthly subscription", "QuickBooks", null, 95.0, TransactionDirection.expense, "Software", 0.94, TransactionStatus.categorized],
  [null, "2026-06-18", "Verizon fleet tablets", "Verizon", null, 214.37, TransactionDirection.expense, "Utilities", 0.89, TransactionStatus.categorized],
  [null, "2026-06-19", "Office Depot printer paper and folders", "Office Depot", null, 73.68, TransactionDirection.expense, "Office/Admin", 0.91, TransactionStatus.categorized],
  [null, "2026-06-21", "Unclear ACH debit 8372", "Unknown ACH", null, 642.17, TransactionDirection.expense, "Uncategorized", 0.31, TransactionStatus.needs_review],
  [null, "2026-06-22", "Insurance monthly premium", "Statewide Insurance", null, 721.0, TransactionDirection.expense, "Insurance", 0.84, TransactionStatus.categorized],
  [null, "2026-06-23", "Google Workspace business subscription", "Google Workspace", null, 72.0, TransactionDirection.expense, "Software", 0.88, TransactionStatus.categorized],
  [null, "2026-06-24", "Client refund duplicate material return", "Ferguson Refund", null, 188.12, TransactionDirection.income, "Refund", 0.86, TransactionStatus.needs_review],
] as const;

export async function ensureDemoDataWithClient(
  prisma: PrismaClient | Prisma.TransactionClient,
  slug = demoCompany.slug,
) {
  const company = await prisma.company.upsert({
    where: { slug },
    update: { name: demoCompany.name, tradeType: demoCompany.tradeType },
    create: { ...demoCompany, slug },
  });

  const jobs = new Map<string, string>();
  for (const [name, customerName, tradeType, city, address, status, estimatedRevenue, actualRevenue] of jobSeeds) {
    const job = await prisma.job.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: { customerName, tradeType, city, address, status, estimatedRevenue, actualRevenue },
      create: {
        companyId: company.id,
        name,
        customerName,
        tradeType,
        city,
        address,
        status,
        estimatedRevenue,
        actualRevenue,
        startDate: new Date(Date.UTC(2026, 5, 1 + jobs.size * 4)),
        endDate: status === JobStatus.completed ? new Date(Date.UTC(2026, 5, 8 + jobs.size * 4)) : null,
      },
    });
    jobs.set(name, job.id);
  }

  for (const [keyword, category, direction] of categoryRules) {
    await prisma.categoryRule.upsert({
      where: { companyId_direction_keyword: { companyId: company.id, direction, keyword } },
      update: { category, tradeType: company.tradeType },
      create: { companyId: company.id, keyword, category, direction, tradeType: company.tradeType },
    });
  }

  let batch = await prisma.uploadBatch.findFirst({
    where: { companyId: company.id, filename: "demo-transactions.csv" },
    orderBy: { createdAt: "asc" },
  });
  batch ??= await prisma.uploadBatch.create({
    data: {
      companyId: company.id,
      filename: "demo-transactions.csv",
      rowCount: transactions.length,
      importedCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
    },
  });

  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const [jobName, date, description, merchant, memo, amount, direction, aiCategory, confidence, status] of transactions) {
    const fingerprint = transactionFingerprint({
      companyId: company.id,
      date,
      merchant,
      description,
      direction,
      amount,
    });
    const jobId = jobName ? jobs.get(jobName) ?? null : null;

    await prisma.transaction.upsert({
      where: { companyId_fingerprint: { companyId: company.id, fingerprint } },
      update: {
        jobId,
        uploadBatchId: batch.id,
        date: new Date(`${date}T00:00:00.000Z`),
        description,
        merchant,
        memo,
        amount,
        direction,
        rawCategory: null,
        aiCategory,
        confidence,
        status,
        source: TransactionSource.demo,
      },
      create: {
        companyId: company.id,
        jobId,
        uploadBatchId: batch.id,
        date: new Date(`${date}T00:00:00.000Z`),
        description,
        merchant,
        memo,
        amount,
        direction,
        fingerprint,
        rawCategory: null,
        aiCategory,
        confidence,
        status,
        source: TransactionSource.demo,
      },
    });

    if (direction === TransactionDirection.income) incomeTotal += amount;
    if (direction === TransactionDirection.expense) expenseTotal += amount;
  }

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: {
      rowCount: transactions.length,
      importedCount: transactions.length,
      invalidCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      incomeTotal,
      expenseTotal,
    },
  });

  return company;
}

export async function ensureDemoData() {
  const env = getEnv();
  const company = await ensureDemoDataWithClient(getPrisma(), env.DEMO_COMPANY_SLUG);
  logger.info("demo_data_ensured", { companyId: company.id, slug: company.slug });
  return company;
}
