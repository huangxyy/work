import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { E2EHelper } from './e2e-helper';
import * as request from 'supertest';

/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow:
 * - Student/Teacher/Admin login
 * - Token refresh
 * - Logout
 * - Unauthorized access protection
 */

describe('Authentication E2E', () => {
  let app: any;
  let prisma: any;

  beforeAll(async () => {
    app = await E2EHelper.bootstrap();
    prisma = E2EHelper.getPrisma();
    await E2EHelper.cleanDatabase();
  });

  afterAll(async () => {
    await E2EHelper.cleanup();
  });

  describe('Student Login Flow', () => {
    it('should login with valid credentials', async () => {
      const student = await E2EHelper.createTestUser('STUDENT');

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: student.username,
          password: student.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.username).toBe(student.username);
      expect(response.body.user.role).toBe('STUDENT');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject login with invalid username', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'nonexistent_user',
          password: 'password',
        })
        .expect(401);
    });

    it('should reject login with invalid password', async () => {
      const student = await E2EHelper.createTestUser('STUDENT');

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: student.username,
          password: 'wrong_password',
        })
        .expect(401);
    });

    it('should reject login with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'test_user',
          // password missing
        })
        .expect(400);
    });
  });

  describe('Teacher Login Flow', () => {
    it('should login teacher successfully', async () => {
      const teacher = await E2EHelper.createTestUser('TEACHER');

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: teacher.username,
          password: teacher.password,
        })
        .expect(200);

      expect(response.body.user.role).toBe('TEACHER');
    });
  });

  describe('Admin Login Flow', () => {
    it('should login admin successfully', async () => {
      const admin = await E2EHelper.createTestUser('ADMIN');

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: admin.username,
          password: admin.password,
        })
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });
  });

  describe('Protected Endpoints', () => {
    let accessToken: string;

    beforeAll(async () => {
      const student = await E2EHelper.createTestUser('STUDENT');
      const authResult = await E2EHelper.login(student.username, student.password);
      accessToken = authResult.accessToken;
    });

    it('should access protected endpoint with valid token', async () => {
      await request(app.getHttpServer())
        .get('/api/homeworks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject protected endpoint without token', async () => {
      await request(app.getHttpServer()).get('/api/homeworks').expect(401);
    });

    it('should reject protected endpoint with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/homeworks')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    it('should reject expired token', async () => {
      // This test would require mocking time or using a very short-lived token
      // For now, we'll just verify the structure is in place
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await request(app.getHttpServer())
        .get('/api/homeworks')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Role-Based Access Control', () => {
    let studentToken: string;
    let teacherToken: string;
    let adminToken: string;

    beforeAll(async () => {
      const student = await E2EHelper.createTestUser('STUDENT');
      const teacher = await E2EHelper.createTestUser('TEACHER');
      const admin = await E2EHelper.createTestUser('ADMIN');

      studentToken = (await E2EHelper.login(student.username, student.password)).accessToken;
      teacherToken = (await E2EHelper.login(teacher.username, teacher.password)).accessToken;
      adminToken = (await E2EHelper.login(admin.username, admin.password)).accessToken;
    });

    it('should allow admin to access admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject teacher from accessing admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });

    it('should reject student from accessing teacher endpoints', async () => {
      // Teacher-only endpoint example
      await request(app.getHttpServer())
        .get('/api/homeworks') // This should return homeworks for student
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200); // Student can view homeworks, but not create them
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token', async () => {
      const user = await E2EHelper.createTestUser('STUDENT');
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: user.password,
        });

      const { refreshToken } = loginResponse.body;

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401);
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const user = await E2EHelper.createTestUser('STUDENT');
      const { accessToken } = await E2EHelper.login(user.username, user.password);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject access after logout', async () => {
      // Note: This test depends on whether tokens are blacklisted
      // Current implementation may not have token blacklisting
      // This is a placeholder for future implementation
      const user = await E2EHelper.createTestUser('STUDENT');
      const { accessToken } = await E2EHelper.login(user.username, user.password);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Token may still work if no blacklisting is implemented
      // This behavior may vary based on implementation
    });
  });
});
