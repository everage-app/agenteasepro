/* eslint-disable no-console */

const { PrismaClient, AgentStatus } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const keepEmails = new Set(process.argv.slice(2).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean));
  const prefixes = ['bephomes+prodsmoke', 'bephomes+prodflow', 'bephomes+prodesign'];

  const candidates = await prisma.agent.findMany({
    where: {
      OR: prefixes.map((prefix) => ({ email: { startsWith: prefix } })),
    },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const toRevoke = candidates.filter((a) => !keepEmails.has(a.email.toLowerCase()) && a.status !== AgentStatus.REVOKED);

  for (const agent of toRevoke) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: AgentStatus.REVOKED },
    });
  }

  console.log(JSON.stringify({
    totalCandidates: candidates.length,
    kept: candidates.filter((a) => keepEmails.has(a.email.toLowerCase())).map((a) => a.email),
    revokedCount: toRevoke.length,
    revokedEmails: toRevoke.map((a) => a.email),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
