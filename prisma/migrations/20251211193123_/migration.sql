/*
  Warnings:

  - Added the required column `creadorId` to the `Actuador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creadorId` to the `Proyecto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creadorId` to the `Sensor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Actuador` ADD COLUMN `creadorId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Proyecto` ADD COLUMN `creadorId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Sensor` ADD COLUMN `creadorId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `Actuador_creadorId_idx` ON `Actuador`(`creadorId`);

-- CreateIndex
CREATE INDEX `Proyecto_creadorId_idx` ON `Proyecto`(`creadorId`);

-- CreateIndex
CREATE INDEX `Sensor_creadorId_idx` ON `Sensor`(`creadorId`);

-- AddForeignKey
ALTER TABLE `Sensor` ADD CONSTRAINT `Sensor_creadorId_fkey` FOREIGN KEY (`creadorId`) REFERENCES `UserMetadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actuador` ADD CONSTRAINT `Actuador_creadorId_fkey` FOREIGN KEY (`creadorId`) REFERENCES `UserMetadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Proyecto` ADD CONSTRAINT `Proyecto_creadorId_fkey` FOREIGN KEY (`creadorId`) REFERENCES `UserMetadata`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
