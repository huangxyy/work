-- CreateTable: Announcement
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Announcement_classId_createdAt_idx`(`classId`, `createdAt`),
    INDEX `Announcement_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: HomeworkTemplate
CREATE TABLE `HomeworkTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `desc` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HomeworkTemplate_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `HomeworkTemplate` ADD CONSTRAINT `HomeworkTemplate_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
