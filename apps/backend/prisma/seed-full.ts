/**
 * 完整的 seed 脚本 - 创建用户、班级、注册和作业
 * 用于开发测试环境
 */
import { PrismaClient, Role } from '@prisma/client';
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const USERS = [
  { account: 'admin', name: '管理员', password: '123456', role: Role.ADMIN },
  { account: 'teacher01', name: '张老师', password: '123456', role: Role.TEACHER },
  { account: 'student01', name: '李明', password: '123456', role: Role.STUDENT },
  { account: 'student02', name: '王芳', password: '123456', role: Role.STUDENT },
];

const CLASSES = [
  { name: '三年二班', grade: '三年级' },
  { name: '三年三班', grade: '三年级' },
];

const HOMEWORKS = [
  {
    title: '英语作文：My Dream',
    desc: '写一篇关于你的梦想的英语作文，不少于80词。',
    dueDays: 7, // 7天后截止
  },
  {
    title: '英语作文：My Weekend',
    desc: '写一篇描述你周末生活的英语作文，不少于60词。',
    dueDays: 3, // 3天后截止
  },
  {
    title: '英语作文：My Best Friend',
    desc: '写一篇关于你最好的朋友的英语作文。',
    dueDays: -1, // 已逾期
    allowLateSubmission: true,
  },
  {
    title: '英语作文：My School',
    desc: '写一篇描述你学校的英语作文，已截止。',
    dueDays: -5, // 5天前截止
    allowLateSubmission: false,
  },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function seedUsers() {
  console.log('🌱 Seeding users...');

  for (const user of USERS) {
    const existing = await prisma.user.findUnique({
      where: { account: user.account },
    });

    if (!existing) {
      const passwordHash = await hashPassword(user.password);
      await prisma.user.create({
        data: {
          account: user.account,
          name: user.name,
          role: user.role,
          passwordHash,
          isActive: true,
        },
      });
      console.log(`  ✅ Created user: ${user.account}`);
    } else {
      console.log(`  ⏭️  User exists: ${user.account}`);
    }
  }

  // 返回用户 ID
  const admin = await prisma.user.findUnique({ where: { account: 'admin' } });
  const teacher = await prisma.user.findUnique({ where: { account: 'teacher01' } });
  const student01 = await prisma.user.findUnique({ where: { account: 'student01' } });
  const student02 = await prisma.user.findUnique({ where: { account: 'student02' } });

  return { admin, teacher, student01, student02 };
}

async function seedClasses(teacherId: string) {
  console.log('🌱 Seeding classes...');

  const classes = [];

  for (const cls of CLASSES) {
    const existing = await prisma.class.findFirst({
      where: { name: cls.name },
    });

    if (!existing) {
      const created = await prisma.class.create({
        data: {
          name: cls.name,
          grade: cls.grade,
          teachers: {
            create: {
              teacherId: teacherId,
            },
          },
        },
      });
      classes.push(created);
      console.log(`  ✅ Created class: ${cls.name}`);
    } else {
      classes.push(existing);
      console.log(`  ⏭️  Class exists: ${cls.name}`);
    }
  }

  return classes;
}

async function seedEnrollments(classes: any[], students: any[]) {
  console.log('🌱 Seeding enrollments...');

  // 把两个学生都加入到第一个班级
  const targetClass = classes[0];

  for (const student of students) {
    if (!student) continue;

    const existing = await prisma.enrollment.findUnique({
      where: {
        classId_studentId: {
          classId: targetClass.id,
          studentId: student.id,
        },
      },
    });

    if (!existing) {
      await prisma.enrollment.create({
        data: {
          classId: targetClass.id,
          studentId: student.id,
        },
      });
      console.log(`  ✅ Enrolled ${student.account} to ${targetClass.name}`);
    } else {
      console.log(`  ⏭️  Enrollment exists: ${student.account} in ${targetClass.name}`);
    }
  }
}

async function seedHomeworks(classes: any[], teacherId: string) {
  console.log('🌱 Seeding homeworks...');

  const targetClass = classes[0];
  const now = new Date();

  for (const hw of HOMEWORKS) {
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + hw.dueDays);

    const existing = await prisma.homework.findFirst({
      where: { title: hw.title, classId: targetClass.id },
    });

    if (!existing) {
      await prisma.homework.create({
        data: {
          classId: targetClass.id,
          title: hw.title,
          desc: hw.desc,
          dueAt: hw.dueDays === 0 ? null : dueAt,
          allowLateSubmission: hw.allowLateSubmission ?? true,
        },
      });
      console.log(`  ✅ Created homework: ${hw.title}`);
    } else {
      console.log(`  ⏭️  Homework exists: ${hw.title}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting seed...\n');

  try {
    // 1. 创建用户
    const { admin, teacher, student01, student02 } = await seedUsers();

    if (!teacher || !student01 || !student02) {
      throw new Error('Failed to create users');
    }

    // 2. 创建班级
    const classes = await seedClasses(teacher.id);

    // 3. 注册学生到班级
    await seedEnrollments(classes, [student01, student02]);

    // 4. 创建作业
    await seedHomeworks(classes, teacher.id);

    console.log('\n✨ Seed completed successfully!');
    console.log('\n📝 Test accounts:');
    console.log('  Admin:   admin / 123456');
    console.log('  Teacher: teacher01 / 123456');
    console.log('  Student: student01 / 123456');
    console.log('  Student: student02 / 123456');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
