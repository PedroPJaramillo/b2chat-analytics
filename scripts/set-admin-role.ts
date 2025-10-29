import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: tsx scripts/set-admin-role.ts <email>');
    console.log('Example: tsx scripts/set-admin-role.ts user@example.com');
    process.exit(1);
  }

  console.log(`Looking for user: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log(`❌ User not found: ${email}`);
    console.log('\nAvailable users:');
    const users = await prisma.user.findMany({
      select: { email: true, role: true },
    });
    console.table(users);
    process.exit(1);
  }

  console.log(`\nCurrent role: ${user.role}`);

  if (user.role === 'Admin') {
    console.log('✓ User is already an Admin');
    process.exit(0);
  }

  console.log('Updating role to Admin...');

  await prisma.user.update({
    where: { email },
    data: { role: 'Admin' },
  });

  console.log('✓ Successfully updated role to Admin');

  const updated = await prisma.user.findUnique({
    where: { email },
    select: { email: true, name: true, role: true },
  });

  console.log('\nUpdated user:');
  console.table(updated);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
