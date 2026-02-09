-- AlterTable
ALTER TABLE `Submission` ADD COLUMN `batchId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `BatchUpload` (
    `id` VARCHAR(191) NOT NULL,
    `homeworkId` VARCHAR(191) NOT NULL,
    `uploaderId` VARCHAR(191) NOT NULL,
    `totalImages` INTEGER NOT NULL,
    `matchedImages` INTEGER NOT NULL,
    `unmatchedCount` INTEGER NOT NULL,
    `createdSubmissions` INTEGER NOT NULL,
    `skipped` JSON NULL,
    `mode` VARCHAR(191) NULL,
    `needRewrite` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BatchUpload_homeworkId_idx`(`homeworkId`),
    INDEX `BatchUpload_uploaderId_idx`(`uploaderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Submission_batchId_idx` ON `Submission`(`batchId`);

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `BatchUpload`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchUpload` ADD CONSTRAINT `BatchUpload_homeworkId_fkey` FOREIGN KEY (`homeworkId`) REFERENCES `Homework`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchUpload` ADD CONSTRAINT `BatchUpload_uploaderId_fkey` FOREIGN KEY (`uploaderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
