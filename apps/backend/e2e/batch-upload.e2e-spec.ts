import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { E2EHelper } from './e2e-helper';
import * as request from 'supertest';

/**
 * Batch Upload E2E Tests
 *
 * Tests the batch upload functionality:
 * - Upload multiple single images
 * - Upload ZIP file with multiple images
 * - Student name assignment
 * - Memory efficiency (no OOM on large files)
 */

describe('Batch Upload E2E', () => {
  let app: any;
  let prisma: any;
  let teacherContext: any;
  let testClass: any;
  let testHomework: any;
  let enrolledStudents: any[];

  beforeAll(async () => {
    app = await E2EHelper.bootstrap();
    prisma = E2EHelper.getPrisma();
    await E2EHelper.cleanDatabase();

    // Create teacher and class
    teacherContext = await E2EHelper.createContext('TEACHER');
    testClass = await E2EHelper.createTestClass(teacherContext.testUser.id);
    testHomework = await E2EHelper.createTestHomework(testClass.id);

    // Create and enroll students
    enrolledStudents = [];
    for (let i = 1; i <= 5; i++) {
      const student = await E2EHelper.createTestUser('STUDENT', {
        username: `student_e2e_${Date.now()}_${i}`,
        name: `Test Student ${i}`,
      });
      await prisma.enrollment.create({
        data: {
          classId: testClass.id,
          userId: student.id,
        },
      });
      enrolledStudents.push(student);
    }
  }, 60000);

  afterAll(async () => {
    await E2EHelper.cleanDatabase();
    await E2EHelper.cleanup();
  });

  describe('Single Image Batch Upload', () => {
    it('should create batch upload with multiple single images', async () => {
      const images = [
        E2EHelper.createMockImageBuffer(),
        E2EHelper.createMockImageBuffer(),
        E2EHelper.createMockImageBuffer(),
      ];

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', images[0], 'student1.jpg')
        .attach('images', images[1], 'student2.jpg')
        .attach('images', images[2], 'student3.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.totalCount).toBe(3);
    });

    it('should allow teacher to assign student names to images', async () => {
      // First create a batch upload
      const imageBuffer = E2EHelper.createMockImageBuffer();

      const batchResponse = await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer, 'unknown.jpg')
        .expect(201);

      const batchUploadId = batchResponse.body.id;

      // Get batch upload details
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/batch-upload/${batchUploadId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(detailResponse.body.images).toBeDefined();
      expect(Array.isArray(detailResponse.body.images)).toBe(true);
    });

    it('should finalize batch upload and create submissions', async () => {
      // Create batch upload
      const images = [E2EHelper.createMockImageBuffer(), E2EHelper.createMockImageBuffer()];

      const batchResponse = await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', images[0], 'image1.jpg')
        .attach('images', images[1], 'image2.jpg')
        .expect(201);

      const batchUploadId = batchResponse.body.id;

      // Finalize with student assignments
      const finalizeResponse = await request(app.getHttpServer())
        .post(`/api/batch-upload/${batchUploadId}/finalize`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .send({
          assignments: [
            { imageId: 1, studentId: enrolledStudents[0].id },
            { imageId: 2, studentId: enrolledStudents[1].id },
          ],
        })
        .expect(200);

      expect(finalizeResponse.body.submissionsCreated).toBeGreaterThan(0);

      // Verify submissions were created
      const submissions = await prisma.submission.findMany({
        where: {
          homeworkId: testHomework.id,
          userId: { in: [enrolledStudents[0].id, enrolledStudents[1].id] },
        },
      });

      expect(submissions.length).toBeGreaterThan(0);
    });
  });

  describe('ZIP File Batch Upload', () => {
    it('should accept and extract ZIP file', async () => {
      const zipBuffer = E2EHelper.createMockZipBuffer(3);

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', zipBuffer, 'homeworks.zip')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.totalCount).toBe(3);
    });

    it('should auto-detect student names from filenames', async () => {
      // Create a custom ZIP with student-specific filenames
      const admZip = require('adm-zip');
      const zip = new admZip();

      // Use student names in filenames
      enrolledStudents.slice(0, 3).forEach((student, index) => {
        zip.addFile(`${student.username}.jpg`, E2EHelper.createMockImageBuffer());
      });

      const zipBuffer = zip.toBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', zipBuffer, 'homeworks.zip')
        .expect(201);

      expect(response.body.totalCount).toBe(3);

      // Check if students were auto-matched
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/batch-upload/${response.body.id}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      // Count matched students
      const matchedCount = detailResponse.body.images?.filter(
        (img: any) => img.matchedStudentId,
      ).length;

      expect(matchedCount).toBeGreaterThan(0);
    });

    it('should reject malformed ZIP file', async () => {
      const invalidZip = Buffer.from('not a valid zip file');

      await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', invalidZip, 'invalid.zip')
        .expect(400);
    });

    it('should handle ZIP with non-image files', async () => {
      const admZip = require('adm-zip');
      const zip = new admZip();

      zip.addFile('readme.txt', Buffer.from('This is a text file'));
      zip.addFile('student1.jpg', E2EHelper.createMockImageBuffer());

      const zipBuffer = zip.toBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', zipBuffer, 'mixed.zip')
        .expect(201);

      // Should only process the image file
      expect(response.body.totalCount).toBe(1);
    });
  });

  describe('Large File Handling', () => {
    it('should handle large ZIP without OOM', async () => {
      // Create a ZIP with many images
      const admZip = require('adm-zip');
      const zip = new admZip();

      // Add 50 small images
      for (let i = 0; i < 50; i++) {
        zip.addFile(`student${i}.jpg`, E2EHelper.createMockImageBuffer());
      }

      const zipBuffer = zip.toBuffer();

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', zipBuffer, 'large.zip')
        .expect(201);

      expect(response.body.totalCount).toBe(50);
    });

    it('should enforce file size limits', async () => {
      // Create a buffer larger than typical limits
      const largeBuffer = Buffer.alloc(200 * 1024 * 1024); // 200MB

      await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', largeBuffer, 'huge.zip')
        .expect(413); // Payload Too Large
    });
  });

  describe('Batch Upload Status and Management', () => {
    let batchUploadId: string;

    beforeAll(async () => {
      const zipBuffer = E2EHelper.createMockZipBuffer(2);

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', zipBuffer, 'test.zip');

      batchUploadId = response.body.id;
    });

    it('should list batch uploads for homework', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/homeworks/${testHomework.id}/batch-uploads`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get batch upload detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/batch-upload/${batchUploadId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(batchUploadId);
      expect(response.body.images).toBeDefined();
    });

    it('should allow deleting batch upload', async () => {
      // Create a temporary batch upload
      const zipBuffer = E2EHelper.createMockZipBuffer(1);

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch-upload/zip')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('file', zipBuffer, 'temp.zip');

      const tempId = createResponse.body.id;

      // Delete it
      await request(app.getHttpServer())
        .delete(`/api/batch-upload/${tempId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/api/batch-upload/${tempId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(404);
    });
  });

  describe('Draft Saving', () => {
    it('should save batch upload as draft', async () => {
      const images = [
        E2EHelper.createMockImageBuffer(),
        E2EHelper.createMockImageBuffer(),
      ];

      const response = await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .field('saveAsDraft', 'true')
        .attach('images', images[0], 'image1.jpg')
        .attach('images', images[1], 'image2.jpg')
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
    });

    it('should resume draft batch upload', async () => {
      // Create a draft
      const imageBuffer = E2EHelper.createMockImageBuffer();

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .field('saveAsDraft', 'true')
        .attach('images', imageBuffer, 'image1.jpg')
        .expect(201);

      const draftId = createResponse.body.id;

      // Get the draft
      const response = await request(app.getHttpServer())
        .get(`/api/batch-upload/${draftId}`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('DRAFT');

      // Add more images and finalize
      const additionalImage = E2EHelper.createMockImageBuffer();

      await request(app.getHttpServer())
        .post(`/api/batch-upload/${draftId}/finalize`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .attach('additionalImages', additionalImage, 'image2.jpg')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing homework gracefully', async () => {
      const imageBuffer = E2EHelper.createMockImageBuffer();

      await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', 'non-existent-id')
        .attach('images', imageBuffer, 'image.jpg')
        .expect(400);
    });

    it('should prevent non-teacher from batch upload', async () => {
      const studentContext = await E2EHelper.createContext('STUDENT');
      const imageBuffer = E2EHelper.createMockImageBuffer();

      await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', imageBuffer, 'image.jpg')
        .expect(403);
    });

    it('should validate file types', async () => {
      const textFile = Buffer.from('This is not an image');

      await request(app.getHttpServer())
        .post('/api/batch-upload')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .field('homeworkId', testHomework.id)
        .attach('images', textFile, 'document.txt')
        .expect(400);
    });
  });
});
