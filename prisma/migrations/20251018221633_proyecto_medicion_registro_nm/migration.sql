/*
  Warnings:

  - A unique constraint covering the columns `[id,sensorId]` on the table `MedicionSensor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,actuadorId]` on the table `RegistroActuador` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,activo]` on the table `UserMetadata` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `UserMetadata_email_key` ON `UserMetadata`;

-- AlterTable
ALTER TABLE `Actuador` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Proyecto` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `estado` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Sensor` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `UserMetadata` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `ProyectoMedicion` (
    `proyectoId` INTEGER NOT NULL,
    `sensorId` INTEGER NOT NULL,
    `medicionId` INTEGER NOT NULL,

    INDEX `ProyectoMedicion_sensorId_idx`(`sensorId`),
    INDEX `ProyectoMedicion_medicionId_idx`(`medicionId`),
    PRIMARY KEY (`proyectoId`, `medicionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProyectoRegistro` (
    `proyectoId` INTEGER NOT NULL,
    `actuadorId` INTEGER NOT NULL,
    `registroId` INTEGER NOT NULL,

    INDEX `ProyectoRegistro_actuadorId_idx`(`actuadorId`),
    INDEX `ProyectoRegistro_registroId_idx`(`registroId`),
    PRIMARY KEY (`proyectoId`, `registroId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Actuador_activo_idx` ON `Actuador`(`activo`);

-- CreateIndex
CREATE UNIQUE INDEX `MedicionSensor_id_sensorId_key` ON `MedicionSensor`(`id`, `sensorId`);

-- CreateIndex
CREATE INDEX `Proyecto_activo_idx` ON `Proyecto`(`activo`);

-- CreateIndex
CREATE UNIQUE INDEX `RegistroActuador_id_actuadorId_key` ON `RegistroActuador`(`id`, `actuadorId`);

-- CreateIndex
CREATE INDEX `Sensor_activo_idx` ON `Sensor`(`activo`);

-- CreateIndex
CREATE INDEX `UserMetadata_activo_idx` ON `UserMetadata`(`activo`);

-- CreateIndex
CREATE UNIQUE INDEX `UserMetadata_email_activo_key` ON `UserMetadata`(`email`, `activo`);

-- AddForeignKey
ALTER TABLE `ProyectoMedicion` ADD CONSTRAINT `ProyectoMedicion_proyectoId_sensorId_fkey` FOREIGN KEY (`proyectoId`, `sensorId`) REFERENCES `ProyectoSensor`(`proyectoId`, `sensorId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoMedicion` ADD CONSTRAINT `ProyectoMedicion_medicionId_sensorId_fkey` FOREIGN KEY (`medicionId`, `sensorId`) REFERENCES `MedicionSensor`(`id`, `sensorId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoRegistro` ADD CONSTRAINT `ProyectoRegistro_proyectoId_actuadorId_fkey` FOREIGN KEY (`proyectoId`, `actuadorId`) REFERENCES `ProyectoActuador`(`proyectoId`, `actuadorId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoRegistro` ADD CONSTRAINT `ProyectoRegistro_registroId_actuadorId_fkey` FOREIGN KEY (`registroId`, `actuadorId`) REFERENCES `RegistroActuador`(`id`, `actuadorId`) ON DELETE CASCADE ON UPDATE CASCADE;
