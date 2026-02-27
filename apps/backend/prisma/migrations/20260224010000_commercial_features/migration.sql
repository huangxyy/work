-- AlterTable: Add profile fields to User
ALTER TABLE `User` ADD COLUMN `email` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `phone` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `avatarUrl` VARCHAR(191) NULL;

-- AlterTable: Add teacher feedback fields to Submission
ALTER TABLE `Submission` ADD COLUMN `teacherComment` TEXT NULL;
ALTER TABLE `Submission` ADD COLUMN `manualScore` DOUBLE NULL;
ALTER TABLE `Submission` ADD COLUMN `reviewedBy` VARCHAR(191) NULL;
ALTER TABLE `Submission` ADD COLUMN `reviewedAt` DATETIME(3) NULL;

-- CreateTable: Notification
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `linkTo` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
