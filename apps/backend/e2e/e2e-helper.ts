import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import * as request from 'supertest';

/**
 * E2E Test Helper
 *
 * Provides common utilities for end-to-end tests including:
 * - Application bootstrapping
 * - Database cleanup
 * - Authentication helpers
 * - Test data creation
 */

export interface E2EContext {
  app: INestApplication;
  prisma: PrismaService;
  api: request.SuperTest<request.Test>;
  accessToken: string;
  refreshToken: string;
  testUser: {
    id: string;
    username: string;
    role: string;
  };
}

export class E2EHelper {
  private static module: TestingModule;
  private static app: INestApplication;
  private static prisma: PrismaService;

  /**
   * Bootstrap the NestJS application for E2E testing
   */
  static async bootstrap(): Promise<INestApplication> {
    if (this.app) {
      return this.app;
    }

    this.module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.module.createNestApplication();
    await this.app.init();

    this.prisma = this.module.get<PrismaService>(PrismaService);

    return this.app;
  }

  /**
   * Clean up after tests
   */
  static async cleanup(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.module = null;
      this.prisma = null;
    }
  }

  /**
   * Get Prisma service for direct database access
   */
  static getPrisma(): PrismaService {
    if (!this.prisma) {
      throw new Error('Application not bootstrapped. Call bootstrap() first.');
    }
    return this.prisma;
  }

  /**
   * Clean database - remove test data
   * Be careful with production data!
   */
  static async cleanDatabase(): Promise<void> {
    const prisma = this.getPrisma();

    // Delete in correct order due to foreign key constraints
    await prisma.submissionImage.deleteMany({
      where: { submission: { user: { username: { contains: '_e2e_' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { username: { contains: '_e2e_' } } },
    });
    await prisma.announcement.deleteMany({
      where: { class: { teacher: { username: { contains: '_e2e_' } } } },
    });
    await prisma.enrollment.deleteMany({
      where: {
        OR: [
          { user: { username: { contains: '_e2e_' } } },
          { class: { teacher: { username: { contains: '_e2e_' } } } },
        ],
      },
    });
    await prisma.homework.deleteMany({
      where: { class: { teacher: { username: { contains: '_e2e_' } } } },
    });
    await prisma.class.deleteMany({
      where: { teacher: { username: { contains: '_e2e_' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { contains: '_e2e_' } },
    });
  }

  /**
   * Create a test user with authentication
   */
  static async createTestUser(
    role: 'STUDENT' | 'TEACHER' | 'ADMIN',
    overrides?: Partial<{ username: string; password: string; name: string }>,
  ): Promise<{ id: string; username: string; password: string; name: string; role: string }> {
    const prisma = this.getPrisma();
    const username = overrides?.username || `${role.toLowerCase()}_e2e_${Date.now()}`;
    const password = overrides?.password || 'TestPass123!';
    const name = overrides?.name || `E2E ${role}`;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return { id: existing.id, username, password, name: existing.name, role: existing.role };
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role,
      },
    });

    return { id: user.id, username, password, name, role };
  }

  /**
   * Login and get access token
   */
  static async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const response = await request(this.app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    return {
      accessToken: response.body.accessToken,
      refreshToken: response.body.refreshToken,
      user: response.body.user,
    };
  }

  /**
   * Create a complete E2E context with authenticated user
   */
  static async createContext(role: 'STUDENT' | 'TEACHER' | 'ADMIN'): Promise<E2EContext> {
    const app = await this.bootstrap();
    const prisma = this.getPrisma();
    const api = request(app.getHttpServer());

    const testUser = await this.createTestUser(role);
    const authResult = await this.login(testUser.username, testUser.password);

    return {
      app,
      prisma,
      api,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      testUser: {
        id: testUser.id,
        username: testUser.username,
        role: testUser.role,
      },
    };
  }

  /**
   * Create a test class with a teacher
   */
  static async createTestClass(teacherId: string, name?: string): Promise<any> {
    const prisma = this.getPrisma();
    return prisma.class.create({
      data: {
        name: name || `E2E Class ${Date.now()}`,
        grade: '1',
        teacherId,
      },
    });
  }

  /**
   * Create a test homework
   */
  static async createTestHomework(classId: string, overrides?: Partial<{ title: string; description: string }>): Promise<any> {
    const prisma = this.getPrisma();
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return prisma.homework.create({
      data: {
        title: overrides?.title || `E2E Homework ${Date.now()}`,
        description: overrides?.description || 'E2E test homework description',
        dueDate: nextWeek,
        classId,
      },
    });
  }

  /**
   * Wait for a condition to be true (useful for async operations like grading)
   */
  static async waitFor(
    condition: () => Promise<boolean>,
    timeout: number = 30000,
    interval: number = 500,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Poll submission status until it's DONE or FAILED
   */
  static async waitForGrading(submissionId: string, timeout: number = 60000): Promise<any> {
    const prisma = this.getPrisma();

    await this.waitFor(
      async () => {
        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
        });
        return submission?.status === 'DONE' || submission?.status === 'FAILED';
      },
      timeout,
      1000,
    );

    return prisma.submission.findUnique({
      where: { id: submissionId },
      include: { images: true },
    });
  }

  /**
   * Create a mock image buffer for testing
   */
  static createMockImageBuffer(): Buffer {
    // Minimal 1x1 PNG
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
  }

  /**
   * Create a mock ZIP buffer with multiple images
   */
  static createMockZipBuffer(imageCount: number = 3): Buffer {
    const admZip = require('adm-zip');
    const zip = new admZip();

    for (let i = 0; i < imageCount; i++) {
      zip.addFile(`student${i + 1}.jpg`, this.createMockImageBuffer());
    }

    return zip.toBuffer();
  }
}
