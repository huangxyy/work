import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

type SeedUser = {
  account: string;
  name: string;
  password: string;
  role: Role;
};

const prisma = new PrismaClient();

const readEnv = (key: string, fallback = '') => process.env[key] || fallback;

const buildSeedUsers = (): SeedUser[] => {
  const defaultPassword = readEnv('SEED_PASSWORD', 'Test1234');

  const adminAccount = readEnv('SEED_ADMIN_ACCOUNT', 'admin');
  const adminName = readEnv('SEED_ADMIN_NAME', 'Admin');
  const adminPassword = readEnv('SEED_ADMIN_PASSWORD', defaultPassword);

  const teacherAccount = readEnv('SEED_TEACHER_ACCOUNT', 'teacher01');
  const teacherName = readEnv('SEED_TEACHER_NAME', 'Teacher 01');
  const teacherPassword = readEnv('SEED_TEACHER_PASSWORD', defaultPassword);

  const studentAccount = readEnv('SEED_STUDENT_ACCOUNT', 'student01');
  const studentName = readEnv('SEED_STUDENT_NAME', 'Student 01');
  const studentPassword = readEnv('SEED_STUDENT_PASSWORD', defaultPassword);

  return [
    { account: adminAccount, name: adminName, password: adminPassword, role: Role.ADMIN },
    { account: teacherAccount, name: teacherName, password: teacherPassword, role: Role.TEACHER },
    { account: studentAccount, name: studentName, password: studentPassword, role: Role.STUDENT },
  ].filter((user) => user.account && user.name && user.password);
};

const seedUsers = async () => {
  const enabled = readEnv('SEED_USERS', 'false') === 'true';
  if (!enabled) {
    console.log('Seed skipped: set SEED_USERS=true to enable.');
    return;
  }

  const users = buildSeedUsers();
  if (!users.length) {
    console.log('Seed skipped: no seed users configured.');
    return;
  }

  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { account: user.account } });
    if (existing) {
      console.log(`Seed skip: ${user.account} already exists.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        account: user.account,
        name: user.name,
        role: user.role,
        passwordHash,
        isActive: true,
      },
    });

    console.log(`Seed created: ${user.role} ${user.account}`);
  }
};

const main = async () => {
  try {
    await seedUsers();
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
