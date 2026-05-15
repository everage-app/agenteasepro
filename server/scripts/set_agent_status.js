const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2];
  const status = process.argv[3] || 'ACTIVE';

  if (!email) {
    console.error('Usage: node scripts/set_agent_status.js <email> [ACTIVE|SUSPENDED|REVOKED]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const before = await prisma.agent.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, subscriptionStatus: true },
    });

    console.log('BEFORE', before);

    const updated = await prisma.agent.updateMany({
      where: { email },
      data: { status },
    });

    console.log('UPDATED_COUNT', updated.count);

    const after = await prisma.agent.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, subscriptionStatus: true },
    });

    console.log('AFTER', after);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
