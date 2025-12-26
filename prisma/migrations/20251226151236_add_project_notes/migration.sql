-- CreateTable
CREATE TABLE `NotaProyecto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoId` INTEGER NOT NULL,
    `contenido` TEXT NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotaProyecto_proyectoId_idx`(`proyectoId`),
    INDEX `NotaProyecto_usuarioId_idx`(`usuarioId`),
    INDEX `NotaProyecto_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NotaProyecto` ADD CONSTRAINT `NotaProyecto_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotaProyecto` ADD CONSTRAINT `NotaProyecto_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `UserMetadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
