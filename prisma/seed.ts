import { PrismaClient } from "@prisma/client";
import { ensureDemoDataWithClient } from "../src/lib/demoData";

const prisma = new PrismaClient();

async function main() {
  const company = await ensureDemoDataWithClient(prisma);
  const [jobCount, transactionCount, ruleCount] = await Promise.all([
    prisma.job.count({ where: { companyId: company.id } }),
    prisma.transaction.count({ where: { companyId: company.id } }),
    prisma.categoryRule.count({ where: { companyId: company.id } }),
  ]);

  console.log(
    `Seeded ${company.name} (${company.slug}) with ${jobCount} jobs, ${ruleCount} rules, and ${transactionCount} transactions.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
