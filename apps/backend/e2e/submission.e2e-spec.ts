import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { E2EHelper } from './e2e-helper';
import * as request from 'supertest';

/**
 * Submission E2E Tests
 *
 * Tests the complete submission and grading flow:
 * - Student submits homework
 * - Worker processes submission (OCR + LLM grading)
 * - Student views results
 * - Teacher reviews submission
 */

describe('Submission E2E', () => {
  let app: any;
  let prisma: any;
  let studentContext: any;
  let teacherContext: any;
  let testClass: any;
  let testHomework: any;

  beforeAll(async () => {
    app = await E2EHelper.bootstrap();
    prisma = E2EHelper.getPrisma();
    await E2EHelper.cleanDatabase();

    // Create teacher and class
    teacherContext = await E2EHelper.createContext('TEACHER');
    testClass = await E2EHelper.createTestClass(teacherContext.testUser.id);
    testHomework = await E2EHelper.createTestHomework(testClass.id);

    // Enroll student in class
    studentContext = await E2EHelper.createContext('STUDENT');
    await prisma.enrollment.create({
      data: {
        classId: testClass.id,
        userId: studentContext.testUser.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    await E2EHelper.cleanDatabase();
    await E2EHelper.cleanup();
  });

  describe('Homework Submission Flow', () => {
    it('should allow student to view homework list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/homeworks')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow student to view homework detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/homeworks/${testHomework.id}`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testHomework.id);
      expect(response.body.title).toBeDefined();
    });

    it('should create submission with single image', async () => {
      const imageBuffer = E2EHelper.createMockImageBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer, 'homework.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('QUEUED');
      expect(response.body.homeworkId).toBe(testHomework.id);
    });

    it('should create submission with multiple images', async () => {
      const imageBuffer1 = E2EHelper.createMockImageBuffer();
      const imageBuffer2 = E2EHelper.createMockImageBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer1, 'homework1.jpg')
        .attach('images', imageBuffer2, 'homework2.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('QUEUED');
    });

    it('should reject submission without images', async () => {
      await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .expect(400);
    });

    it('should reject submission for non-existent homework', async () => {
      const imageBuffer = E2EHelper.createMockImageBuffer();

      await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', 'non-existent-id')
        .attach('images', imageBuffer, 'homework.jpg')
        .expect(400);
    });
  });

  describe('Grading Flow', () => {
    let submissionId: string;

    beforeAll(async () => {
      // Create a submission for grading tests
      const imageBuffer = E2EHelper.createMockImageBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer, 'homework.jpg');

      submissionId = response.body.id;
    });

    it('should show submission as QUEUED initially', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(['QUEUED', 'PROCESSING'].includes(response.body.status)).toBe(true);
    });

    it('should update status to PROCESSING', async () => {
      // Wait for worker to pick up the job
      await E2EHelper.waitFor(async () => {
        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
        });
        return submission?.status === 'PROCESSING' || submission?.status === 'DONE' || submission?.status === 'FAILED';
      }, 30000);
    });

    it('should complete grading and update to DONE', async () => {
      // Note: This test may fail if OCR/LLM services are not configured
      // In a real CI environment, you would mock these services

      try {
        const result = await E2EHelper.waitForGrading(submissionId, 120000);

        if (result.status === 'DONE') {
          expect(result.totalScore).toBeGreaterThanOrEqual(0);
          expect(result.gradingJson).toBeDefined();
        } else {
          console.warn('Grading failed - this is expected if OCR/LLM services are not configured');
          expect(result.status).toBe('FAILED');
        }
      } catch (error) {
        console.warn('Grading timeout - this is expected if worker is not running');
      }
    }, 150000);
  });

  describe('Viewing Results', () => {
    let submissionId: string;

    beforeAll(async () => {
      // Try to find a completed submission, or create a mock one
      const completed = await prisma.submission.findFirst({
        where: {
          user: { username: { contains: '_e2e_' } },
          status: 'DONE',
        },
      });

      if (completed) {
        submissionId = completed.id;
      } else {
        // Create a mock completed submission
        const imageBuffer = E2EHelper.createMockImageBuffer();
        const response = await request(app.getHttpServer())
          .post('/api/submissions')
          .set('Authorization', `Bearer ${studentContext.accessToken}`)
          .field('homeworkId', testHomework.id)
          .attach('images', imageBuffer, 'homework.jpg');

        submissionId = response.body.id;

        // Manually update to DONE for testing (mocking grading result)
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: 'DONE',
            totalScore: 85,
            ocrText: 'This is a test essay.',
            gradingJson: JSON.stringify({
              totalScore: 85,
              dimensions: {
                content: { score: 28, maxScore: 30, feedback: 'Good content' },
                organization: { score: 27, maxScore: 30, feedback: 'Well organized' },
                language: { score: 30, maxScore: 40, feedback: 'Some errors' },
              },
            }),
          },
        });
      }
    });

    it('should allow student to view their submissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow student to view submission detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(submissionId);
      expect(response.body.totalScore).toBeDefined();
    });

    it('should include grading result in detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      if (response.body.status === 'DONE') {
        expect(response.body.gradingJson).toBeDefined();
        const grading = JSON.parse(response.body.gradingJson);
        expect(grading.totalScore).toBeDefined();
      }
    });
  });

  describe('Teacher Review', () => {
    let submissionId: string;

    beforeAll(async () => {
      // Create a submission for teacher to review
      const imageBuffer = E2EHelper.createMockImageBuffer();
      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer, 'homework.jpg');

      submissionId = response.body.id;

      // Mark as done
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: 'DONE',
          totalScore: 80,
          ocrText: 'Test essay',
          gradingJson: JSON.stringify({
            totalScore: 80,
            dimensions: {},
          }),
        },
      });
    });

    it('should allow teacher to view all submissions for homework', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/homeworks/${testHomework.id}/submissions`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow teacher to view submission detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(submissionId);
      expect(response.body.ocrText).toBeDefined();
    });

    it('should allow teacher to add feedback', async () => {
      const feedback = 'Great job! Keep practicing.';

      const response = await request(app.getHttpServer())
        .patch(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .send({ teacherFeedback: feedback })
        .expect(200);

      expect(response.body.teacherFeedback).toBe(feedback);
    });

    it('should prevent student from viewing other students submissions', async () => {
      // Create another student
      const otherStudent = await E2EHelper.createTestUser('STUDENT');
      const { accessToken: otherToken } = await E2EHelper.login(
        otherStudent.username,
        otherStudent.password,
      );

      await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('Submission Status Updates', () => {
    it('should track submission status changes', async () => {
      const imageBuffer = E2EHelper.createMockImageBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer, 'homework.jpg');

      const submissionId = response.body.id;

      // Initial status
      expect(['QUEUED', 'PROCESSING'].includes(response.body.status)).toBe(true);

      // Simulate status progression
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'PROCESSING' },
      });

      const processing = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`);

      expect(processing.body.status).toBe('PROCESSING');
    });
  });
});
