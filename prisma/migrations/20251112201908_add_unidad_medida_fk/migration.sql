/*
  Warnings:

  - You are about to drop the column `unidad_de_medida` on the `Actuador` table. All the data in the column will be lost.
  - You are about to drop the column `unidad_de_medida` on the `Sensor` table. All the data in the column will be lost.
  - Added the required column `unidad_medida_id` to the `Actuador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unidad_medida_id` to the `Sensor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Actuador` DROP COLUMN `unidad_de_medida`,
    ADD COLUMN `unidad_medida_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Sensor` DROP COLUMN `unidad_de_medida`,
    ADD COLUMN `unidad_medida_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `UnidadMedida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `simbolo` VARCHAR(191) NOT NULL,
    `categoria` ENUM('temperatura', 'presion', 'volumen', 'masa', 'tiempo', 'velocidad', 'concentracion', 'pH', 'flujo', 'frecuencia', 'porcentaje', 'otra') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UnidadMedida_simbolo_key`(`simbolo`),
    INDEX `UnidadMedida_activo_idx`(`activo`),
    INDEX `UnidadMedida_categoria_idx`(`categoria`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Actuador_unidad_medida_id_idx` ON `Actuador`(`unidad_medida_id`);

-- CreateIndex
CREATE INDEX `Sensor_unidad_medida_id_idx` ON `Sensor`(`unidad_medida_id`);

-- AddForeignKey
ALTER TABLE `Sensor` ADD CONSTRAINT `Sensor_unidad_medida_id_fkey` FOREIGN KEY (`unidad_medida_id`) REFERENCES `UnidadMedida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actuador` ADD CONSTRAINT `Actuador_unidad_medida_id_fkey` FOREIGN KEY (`unidad_medida_id`) REFERENCES `UnidadMedida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
