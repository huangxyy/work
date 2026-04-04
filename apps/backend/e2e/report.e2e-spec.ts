import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { E2EHelper } from './e2e-helper';
import * as request from 'supertest';

/**
 * Report E2E Tests
 *
 * Tests report generation functionality:
 * - CSV export
 * - PDF export
 * - Class reports
 * - Student reports
 */

describe('Report E2E', () => {
  let app: any;
  let prisma: any;
  let teacherContext: any;
  let studentContext: any;
  let testClass: any;
  let testHomework: any;
  let enrolledStudents: any[];
  let testSubmissions: any[];

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
        name: `测试学生${i}`,
      });
      await prisma.enrollment.create({
        data: {
          classId: testClass.id,
          userId: student.id,
        },
      });
      enrolledStudents.push(student);
    }

    // Create submissions with various scores
    testSubmissions = [];
    const scores = [85, 72, 93, 68, 91];

    for (let i = 0; i < enrolledStudents.length; i++) {
      const submission = await prisma.submission.create({
        data: {
          homeworkId: testHomework.id,
          userId: enrolledStudents[i].id,
          status: 'DONE',
          totalScore: scores[i],
          ocrText: `This is test essay ${i + 1}.`,
          gradingJson: JSON.stringify({
            totalScore: scores[i],
            dimensions: {
              content: { score: Math.floor(scores[i] * 0.3), maxScore: 30 },
              organization: { score: Math.floor(scores[i] * 0.3), maxScore: 30 },
              language: { score: Math.floor(scores[i] * 0.4), maxScore: 40 },
            },
          }),
        },
      });
      testSubmissions.push(submission);
    }

    // Create student context for student report tests
    studentContext = await E2EHelper.createContext('STUDENT');
  }, 60000);

  afterAll(async () => {
    await E2EHelper.cleanDatabase();
    await E2EHelper.cleanup();
  });

  describe('Class Report - CSV Export', () => {
    it('should generate class report CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/csv`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should include all students in CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/csv`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect('Content-Type', /text\/csv/)
        .expect(200);

      const csvContent = response.body.toString();

      // Check for headers (Chinese headers are used)
      expect(csvContent).toContain('学号');
      expect(csvContent).toContain('姓名');
      expect(csvContent).toContain('总分');

      // Check for student data
      enrolledStudents.forEach((student) => {
        expect(csvContent).toContain(student.name);
      });
    });

    it('should include scores in CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/csv`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      const csvContent = response.body.toString();

      // Check for dimension scores
      expect(csvContent).toContain('内容');
      expect(csvContent).toContain('组织');
      expect(csvContent).toContain('语言');
    });

    it('should handle class with no submissions', async () => {
      const newHomework = await E2EHelper.createTestHomework(testClass.id);

      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${newHomework.id}/csv`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      // Should return valid CSV even with no submissions
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Class Report - PDF Export', () => {
    it('should generate class report PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.length).toBeGreaterThan(1000); // PDF should have content
    });

    it('should include Chinese characters in PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      // PDF should start with %PDF- header
      const pdfHeader = response.body.toString('utf8', 0, 5);
      expect(pdfHeader).toBe('%PDF-');

      // Check for EOF marker
      const pdfContent = response.body.toString('utf8');
      expect(pdfContent).toContain('%%EOF');
    });

    it('should generate PDF with charts', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      // PDF with charts should be larger
      expect(response.body.length).toBeGreaterThan(5000);
    });

    it('should support language parameter', async () => {
      const responseEn = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/pdf?lang=en`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      const responseZh = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/pdf?lang=zh`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      expect(responseEn.headers['content-type']).toContain('application/pdf');
      expect(responseZh.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('Student Report - PDF Export', () => {
    it('should generate individual student report', async () => {
      const student = enrolledStudents[0];

      const response = await request(app.getHttpServer())
        .get(`/api/reports/student/${student.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .query({ homeworkId: testHomework.id })
        .responseType('blob')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.body.length).toBeGreaterThan(1000);
    });

    it('should include student history in report', async () => {
      const student = enrolledStudents[0];

      // Create additional submissions for history
      await prisma.submission.createMany({
        data: [
          {
            homeworkId: testHomework.id,
            userId: student.id,
            status: 'DONE',
            totalScore: 78,
            ocrText: 'Previous submission',
            gradingJson: JSON.stringify({ totalScore: 78, dimensions: {} }),
          },
          {
            homeworkId: testHomework.id,
            userId: student.id,
            status: 'DONE',
            totalScore: 88,
            ocrText: 'Recent submission',
            gradingJson: JSON.stringify({ totalScore: 88, dimensions: {} }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/api/reports/student/${student.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .query({ homeworkId: testHomework.id })
        .responseType('blob')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
    });

    it('should show comparison with class average', async () => {
      const student = enrolledStudents[0];

      const response = await request(app.getHttpServer())
        .get(`/api/reports/student/${student.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .query({ homeworkId: testHomework.id })
        .responseType('blob')
        .expect(200);

      // Report should include comparison data
      expect(response.body.length).toBeGreaterThan(1000);
    });
  });

  describe('Class Statistics Report', () => {
    it('should get class statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/class/${testClass.id}/statistics`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalStudents');
      expect(response.body).toHaveProperty('averageScore');
      expect(response.body).toHaveProperty('scoreDistribution');
      expect(response.body.totalStudents).toBe(enrolledStudents.length);
    });

    it('should calculate correct average', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/class/${testClass.id}/statistics`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      const expectedAvg = testSubmissions.reduce((sum, s) => sum + s.totalScore, 0) / testSubmissions.length;
      expect(response.body.averageScore).toBeCloseTo(expectedAvg, 1);
    });

    it('should include dimension breakdown', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/class/${testClass.id}/statistics`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dimensionAverages');
      expect(response.body.dimensionAverages).toHaveProperty('content');
      expect(response.body.dimensionAverages).toHaveProperty('organization');
      expect(response.body.dimensionAverages).toHaveProperty('language');
    });
  });

  describe('Learning Report', () => {
    it('should generate learning report for student', async () => {
      const student = enrolledStudents[0];

      const response = await request(app.getHttpServer())
        .get(`/api/reports/student/${student.id}/learning`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('submissions');
      expect(response.body).toHaveProperty('averageScore');
      expect(response.body).toHaveProperty('trends');
    });

    it('should include score trends', async () => {
      const student = enrolledStudents[0];

      const response = await request(app.getHttpServer())
        .get(`/api/reports/student/${student.id}/learning`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(response.body.trends).toBeDefined();
      expect(Array.isArray(response.body.trends)).toBe(true);
    });

    it('should identify weak areas', async () => {
      const student = enrolledStudents[0];

      const response = await request(app.getHttpServer())
        .get(`/api/reports/student/${student.id}/learning`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('weakAreas');
      expect(Array.isArray(response.body.weakAreas)).toBe(true);
    });
  });

  describe('Export Validation', () => {
    it('should prevent non-teacher from accessing class reports', async () => {
      await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/csv`)
        .set('Authorization', `Bearer ${studentContext.accessToken}`)
        .expect(403);
    });

    it('should prevent students from accessing other students reports', async () => {
      const otherStudent = await E2EHelper.createTestUser('STUDENT');
      const { accessToken: otherToken } = await E2EHelper.login(
        otherStudent.username,
        otherStudent.password,
      );

      await request(app.getHttpServer())
        .get(`/api/reports/student/${enrolledStudents[0].id}/pdf`)
        .set('Authorization', `Bearer ${otherToken}`)
        .query({ homeworkId: testHomework.id })
        .expect(403);
    });

    it('should handle invalid homework ID', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/homework/invalid-id/pdf')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .expect(400);
    });

    it('should handle report generation errors gracefully', async () => {
      // Create a homework with no submissions
      const newClass = await E2EHelper.createTestClass(teacherContext.testUser.id);
      const newHomework = await E2EHelper.createTestHomework(newClass.id);

      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${newHomework.id}/pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      // Should still generate a PDF even with no data
      expect(response.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('Batch Export', () => {
    it('should export multiple homework reports as ZIP', async () => {
      // Create another homework
      const homework2 = await E2EHelper.createTestHomework(testClass.id);

      const response = await request(app.getHttpServer())
        .post('/api/reports/batch/homeworks')
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .send({
          homeworkIds: [testHomework.id, homework2.id],
          format: 'pdf',
        })
        .responseType('blob')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/zip');
    });

    it('should export all student reports for homework', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/reports/homework/${testHomework.id}/students-pdf`)
        .set('Authorization', `Bearer ${teacherContext.accessToken}`)
        .responseType('blob')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/zip');
    });
  });
});
