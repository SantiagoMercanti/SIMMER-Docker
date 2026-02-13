-- CreateTable
CREATE TABLE `ImagenNota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notaId` INTEGER NOT NULL,
    `datos` LONGBLOB NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tamanio` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImagenNota_notaId_idx`(`notaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ImagenNota` ADD CONSTRAINT `ImagenNota_notaId_fkey` FOREIGN KEY (`notaId`) REFERENCES `NotaProyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
