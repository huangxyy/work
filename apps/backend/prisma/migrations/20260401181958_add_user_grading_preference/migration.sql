-- AlterTable
ALTER TABLE `User` ADD COLUMN `gradingPreference` JSON NULL;

-- CreateIndex
CREATE INDEX `Enrollment_classId_idx` ON `Enrollment`(`classId`);

-- CreateIndex
CREATE INDEX `Submission_createdAt_idx` ON `Submission`(`createdAt`);

-- CreateIndex
CREATE INDEX `Submission_homeworkId_status_idx` ON `Submission`(`homeworkId`, `status`);

-- CreateIndex
CREATE INDEX `Submission_homeworkId_studentId_status_idx` ON `Submission`(`homeworkId`, `studentId`, `status`);

-- RenameIndex
ALTER TABLE `Enrollment` RENAME INDEX `Enrollment_studentId_fkey` TO `Enrollment_studentId_idx`;

-- RenameIndex
ALTER TABLE `Homework` RENAME INDEX `Homework_classId_fkey` TO `Homework_classId_idx`;

-- RenameIndex
ALTER TABLE `SubmissionImage` RENAME INDEX `SubmissionImage_submissionId_fkey` TO `SubmissionImage_submissionId_idx`;
