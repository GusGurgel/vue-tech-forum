require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Admin seed skipped. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create an administrator.');
    return;
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');
  }

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'admin', blocked: false, passwordHash },
    });
    console.log(`Administrator account updated: ${email}`);
  } else {
    const usernameInUse = await prisma.user.findUnique({ where: { username } });
    const safeUsername = usernameInUse ? `${username}-admin` : username;
    await prisma.user.create({
      data: { username: safeUsername, email, passwordHash, role: 'admin' },
    });
    console.log(`Administrator account created: ${email} (username: ${safeUsername})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
