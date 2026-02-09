-- CreateTable
CREATE TABLE `LlmCallLog` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NULL,
    `providerName` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `latencyMs` INTEGER NULL,
    `promptTokens` INTEGER NULL,
    `completionTokens` INTEGER NULL,
    `totalTokens` INTEGER NULL,
    `cost` DOUBLE NULL,
    `prompt` TEXT NULL,
    `systemPrompt` TEXT NULL,
    `response` TEXT NULL,
    `error` TEXT NULL,
    `userId` VARCHAR(191) NULL,
    `submissionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `meta` JSON NULL,

    INDEX `LlmCallLog_createdAt_idx`(`createdAt`),
    INDEX `LlmCallLog_source_idx`(`source`),
    INDEX `LlmCallLog_providerId_idx`(`providerId`),
    INDEX `LlmCallLog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
