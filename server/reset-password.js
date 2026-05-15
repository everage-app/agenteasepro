const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || process.env.RESET_EMAIL || '').trim();
  const password = (process.argv[3] || process.env.RESET_PASSWORD || '').trim();

  if (!email || !password) {
    console.error('Usage: node server/reset-password.js <email> <newPassword>');
    console.error('Or set env vars RESET_EMAIL and RESET_PASSWORD.');
    process.exitCode = 1;
    return;
  }
  
  console.log(`Setting password for ${email}...`);
  
  const passwordHash = await bcrypt.hash(password, 10);
  const normalizedEmail = email.toLowerCase();
  
  const existing = await prisma.agent.findUnique({
    where: { email: normalizedEmail }
  });

  if (existing) {
    await prisma.agent.update({
      where: { email: normalizedEmail },
      data: { passwordHash }
    });
    console.log('SUCCESS: Updated password for existing agent:', normalizedEmail);
  } else {
    // Determine a valid role if needed, defaulting to standard fields
    // Based on schema, we need just email, name, passwordHash usually
    const agent = await prisma.agent.create({
      data: {
        email: normalizedEmail,
        name: 'Brysen',
        passwordHash
      }
    });
    console.log('SUCCESS: Created new agent:', agent.id, normalizedEmail);
  }
}

main()
  .catch(e => {
    console.error('ERROR:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
