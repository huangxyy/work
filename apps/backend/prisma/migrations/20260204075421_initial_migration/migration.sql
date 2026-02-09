-- CreateTable
CREATE TABLE `GradingPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NULL,
    `homeworkId` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NULL,
    `needRewrite` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GradingPolicy_classId_key`(`classId`),
    UNIQUE INDEX `GradingPolicy_homeworkId_key`(`homeworkId`),
    INDEX `GradingPolicy_classId_idx`(`classId`),
    INDEX `GradingPolicy_homeworkId_idx`(`homeworkId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GradingPolicy` ADD CONSTRAINT `GradingPolicy_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GradingPolicy` ADD CONSTRAINT `GradingPolicy_homeworkId_fkey` FOREIGN KEY (`homeworkId`) REFERENCES `Homework`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
