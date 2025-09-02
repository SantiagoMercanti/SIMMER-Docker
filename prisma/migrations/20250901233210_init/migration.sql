-- CreateTable
CREATE TABLE `UserMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `tipo` ENUM('operator', 'labManager', 'admin') NOT NULL DEFAULT 'operator',
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserMetadata_email_key`(`email`),
    INDEX `UserMetadata_tipo_idx`(`tipo`),
    INDEX `UserMetadata_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sensor` (
    `sensor_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `unidad_de_medida` VARCHAR(191) NOT NULL,
    `valor_max` DECIMAL(18, 6) NULL,
    `valor_min` DECIMAL(18, 6) NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `fuente_datos` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sensor_nombre_idx`(`nombre`),
    PRIMARY KEY (`sensor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Actuador` (
    `actuator_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `unidad_de_medida` VARCHAR(191) NOT NULL,
    `valor_max` DECIMAL(18, 6) NULL,
    `valor_min` DECIMAL(18, 6) NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `fuente_datos` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Actuador_nombre_idx`(`nombre`),
    PRIMARY KEY (`actuator_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proyecto` (
    `project_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Proyecto_nombre_idx`(`nombre`),
    PRIMARY KEY (`project_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProyectoSensor` (
    `proyectoId` INTEGER NOT NULL,
    `sensorId` INTEGER NOT NULL,

    INDEX `ProyectoSensor_sensorId_idx`(`sensorId`),
    PRIMARY KEY (`proyectoId`, `sensorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProyectoActuador` (
    `proyectoId` INTEGER NOT NULL,
    `actuadorId` INTEGER NOT NULL,

    INDEX `ProyectoActuador_actuadorId_idx`(`actuadorId`),
    PRIMARY KEY (`proyectoId`, `actuadorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MedicionSensor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sensorId` INTEGER NOT NULL,
    `valor` DECIMAL(18, 6) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MedicionSensor_sensorId_idx`(`sensorId`),
    INDEX `MedicionSensor_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistroActuador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actuadorId` INTEGER NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RegistroActuador_actuadorId_idx`(`actuadorId`),
    INDEX `RegistroActuador_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProyectoSensor` ADD CONSTRAINT `ProyectoSensor_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoSensor` ADD CONSTRAINT `ProyectoSensor_sensorId_fkey` FOREIGN KEY (`sensorId`) REFERENCES `Sensor`(`sensor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoActuador` ADD CONSTRAINT `ProyectoActuador_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoActuador` ADD CONSTRAINT `ProyectoActuador_actuadorId_fkey` FOREIGN KEY (`actuadorId`) REFERENCES `Actuador`(`actuator_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicionSensor` ADD CONSTRAINT `MedicionSensor_sensorId_fkey` FOREIGN KEY (`sensorId`) REFERENCES `Sensor`(`sensor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistroActuador` ADD CONSTRAINT `RegistroActuador_actuadorId_fkey` FOREIGN KEY (`actuadorId`) REFERENCES `Actuador`(`actuator_id`) ON DELETE CASCADE ON UPDATE CASCADE;
