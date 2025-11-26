-- AlterTable
ALTER TABLE `RegistroActuador` ADD COLUMN `usuarioId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `RegistroActuador_usuarioId_idx` ON `RegistroActuador`(`usuarioId`);

-- AddForeignKey
ALTER TABLE `RegistroActuador` ADD CONSTRAINT `RegistroActuador_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `UserMetadata`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
