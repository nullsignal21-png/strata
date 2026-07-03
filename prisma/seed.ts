import { PrismaClient, JobStatus, TransactionSource, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  "Materials",
  "Tools & Equipment",
  "Fuel & Vehicle",
  "Subcontractor",
  "Permits & Fees",
  "Office/Admin",
  "Software",
  "Utilities",
  "Insurance",
  "Job Site / Disposal",
  "Uncategorized",
];

async function main() {
  await prisma.integrationConnection.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.uploadBatch.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.job.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: "Triangle HVAC & Plumbing",
      tradeType: "HVAC/plumbing",
    },
  });

  const jobSeeds = [
    ["Cary HVAC Replacement - Patel Residence", "Patel Residence", "HVAC", JobStatus.active, 14200, 15500],
    ["Raleigh Water Heater Install - Johnson", "Johnson", "Plumbing", JobStatus.completed, 3600, 3850],
    ["Apex Commercial Maintenance - Greenway Offices", "Greenway Offices", "HVAC", JobStatus.active, 18000, 17650],
    ["Morrisville Emergency Plumbing - Singh", "Singh", "Plumbing", JobStatus.completed, 2500, 2650],
    ["Durham Mini Split Install - Lopez", "Lopez", "HVAC", JobStatus.planned, 8200, 7900],
  ] as const;

  const jobs = await Promise.all(
    jobSeeds.map(([name, customerName, tradeType, status, estimatedRevenue, actualRevenue], index) =>
      prisma.job.create({
        data: {
          companyId: company.id,
          name,
          customerName,
          tradeType,
          status,
          estimatedRevenue,
          actualRevenue,
          startDate: new Date(Date.UTC(2026, 5, 1 + index * 4)),
          endDate: status === JobStatus.completed ? new Date(Date.UTC(2026, 5, 8 + index * 4)) : null,
        },
      }),
    ),
  );

  const rules = [
    ["Home Depot", "Materials"],
    ["Lowe's", "Materials"],
    ["Lowes", "Materials"],
    ["Ferguson", "Materials"],
    ["Johnstone Supply", "Materials"],
    ["Grainger", "Tools & Equipment"],
    ["Shell", "Fuel & Vehicle"],
    ["BP", "Fuel & Vehicle"],
    ["Exxon", "Fuel & Vehicle"],
    ["U-Haul", "Fuel & Vehicle"],
    ["Waste Management", "Job Site / Disposal"],
    ["Office Depot", "Office/Admin"],
    ["QuickBooks", "Software"],
    ["Stripe", "Software"],
    ["Google Workspace", "Software"],
    ["Verizon", "Utilities"],
    ["Duke Energy", "Utilities"],
    ["Insurance", "Insurance"],
  ];

  await prisma.categoryRule.createMany({
    data: rules.map(([keyword, category]) => ({
      companyId: company.id,
      keyword,
      category,
      tradeType: company.tradeType,
    })),
  });

  const batch = await prisma.uploadBatch.create({
    data: {
      companyId: company.id,
      filename: "demo-transactions.csv",
      rowCount: 21,
      importedCount: 21,
    },
  });

  const tx = [
    [jobs[0].id, "2026-06-03", "Home Depot Cary - Patel HVAC condenser pad and line set", "Home Depot", 1840.22, "Materials", 0.96, TransactionStatus.reviewed],
    [jobs[0].id, "2026-06-04", "Johnstone Supply Cary Patel Residence compressor parts", "Johnstone Supply", 2265.91, "Materials", 0.94, TransactionStatus.categorized],
    [jobs[0].id, "2026-06-05", "Shell fuel for Cary install crew", "Shell", 91.42, "Fuel & Vehicle", 0.9, TransactionStatus.categorized],
    [jobs[0].id, "2026-06-07", "U-Haul lift rental Cary HVAC replacement", "U-Haul", 276.0, "Fuel & Vehicle", 0.81, TransactionStatus.categorized],
    [jobs[1].id, "2026-06-06", "Ferguson Raleigh Johnson water heater and fittings", "Ferguson", 1188.35, "Materials", 0.95, TransactionStatus.reviewed],
    [jobs[1].id, "2026-06-06", "Lowe's Raleigh Johnson permit supplies", "Lowe's", 164.72, "Materials", 0.88, TransactionStatus.categorized],
    [jobs[1].id, "2026-06-08", "BP fuel Raleigh water heater install", "BP", 47.86, "Fuel & Vehicle", 0.89, TransactionStatus.categorized],
    [jobs[2].id, "2026-06-09", "Grainger Apex Greenway Offices filters and belts", "Grainger", 1495.64, "Tools & Equipment", 0.84, TransactionStatus.categorized],
    [jobs[2].id, "2026-06-10", "Waste Management Apex commercial disposal bin", "Waste Management", 410.0, "Job Site / Disposal", 0.86, TransactionStatus.categorized],
    [jobs[2].id, "2026-06-12", "Amazon Business Greenway thermostat batch", "Amazon Business", 572.44, "Materials", 0.68, TransactionStatus.needs_review],
    [jobs[2].id, "2026-06-14", "Subcontractor invoice - controls wiring Greenway", "Triangle Controls LLC", 4200.0, "Subcontractor", 0.77, TransactionStatus.categorized],
    [jobs[3].id, "2026-06-11", "Ferguson Morrisville Singh emergency copper fittings", "Ferguson", 328.95, "Materials", 0.93, TransactionStatus.reviewed],
    [jobs[3].id, "2026-06-11", "Shell emergency van fuel Morrisville", "Shell", 63.18, "Fuel & Vehicle", 0.91, TransactionStatus.categorized],
    [jobs[3].id, "2026-06-12", "City permit counter Morrisville plumbing", "Town of Morrisville", 125.0, "Permits & Fees", 0.72, TransactionStatus.needs_review],
    [jobs[4].id, "2026-06-15", "Johnstone Supply Durham Lopez mini split equipment", "Johnstone Supply", 3390.8, "Materials", 0.96, TransactionStatus.categorized],
    [jobs[4].id, "2026-06-16", "Home Depot Durham line-hide and mounting hardware Lopez", "Home Depot", 442.29, "Materials", 0.92, TransactionStatus.categorized],
    [jobs[4].id, "2026-06-17", "Duke Energy temporary service coordination", "Duke Energy", 88.2, "Utilities", 0.8, TransactionStatus.categorized],
    [null, "2026-06-18", "QuickBooks monthly subscription", "QuickBooks", 95.0, "Software", 0.94, TransactionStatus.categorized],
    [null, "2026-06-18", "Verizon fleet tablets", "Verizon", 214.37, "Utilities", 0.89, TransactionStatus.categorized],
    [null, "2026-06-19", "Office Depot printer paper and folders", "Office Depot", 73.68, "Office/Admin", 0.91, TransactionStatus.categorized],
    [null, "2026-06-21", "Unclear ACH debit 8372", "Unknown ACH", 642.17, "Uncategorized", 0.31, TransactionStatus.needs_review],
  ] as const;

  await prisma.transaction.createMany({
    data: tx.map(([jobId, date, description, merchant, amount, aiCategory, confidence, status]) => ({
      companyId: company.id,
      jobId,
      uploadBatchId: batch.id,
      date: new Date(`${date}T00:00:00.000Z`),
      description,
      merchant,
      amount,
      rawCategory: null,
      aiCategory,
      confidence,
      status,
      source: TransactionSource.demo,
    })),
  });

  console.log(`Seeded ${company.name} with ${jobs.length} jobs, ${categories.length} categories, and ${tx.length} transactions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
