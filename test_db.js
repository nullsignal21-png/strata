const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('Connecting to db...');
  try {
    await prisma.$connect();
    console.log('Connected!');
    const count = await prisma.company.count();
    console.log('Company count:', count);
  } catch (e) {
    console.error('Error connecting:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
