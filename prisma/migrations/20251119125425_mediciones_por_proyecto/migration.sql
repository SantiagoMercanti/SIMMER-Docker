-- CreateTable
CREATE TABLE `UserMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `tipo` ENUM('operator', 'labManager', 'admin') NOT NULL DEFAULT 'operator',
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserMetadata_tipo_idx`(`tipo`),
    INDEX `UserMetadata_createdAt_idx`(`createdAt`),
    INDEX `UserMetadata_activo_idx`(`activo`),
    UNIQUE INDEX `UserMetadata_email_activo_key`(`email`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UnidadMedida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `simbolo` VARCHAR(191) NOT NULL,
    `categoria` ENUM('temperatura', 'presion', 'volumen', 'masa', 'tiempo', 'velocidad', 'concentracion', 'pH', 'flujo', 'frecuencia', 'porcentaje', 'otra') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UnidadMedida_activo_idx`(`activo`),
    INDEX `UnidadMedida_categoria_idx`(`categoria`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sensor` (
    `sensor_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `unidad_medida_id` INTEGER NOT NULL,
    `valor_max` DOUBLE NOT NULL,
    `valor_min` DOUBLE NOT NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `fuente_datos` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sensor_nombre_idx`(`nombre`),
    INDEX `Sensor_activo_idx`(`activo`),
    INDEX `Sensor_unidad_medida_id_idx`(`unidad_medida_id`),
    PRIMARY KEY (`sensor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Actuador` (
    `actuator_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `unidad_medida_id` INTEGER NOT NULL,
    `valor_max` DOUBLE NOT NULL,
    `valor_min` DOUBLE NOT NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `fuente_datos` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Actuador_nombre_idx`(`nombre`),
    INDEX `Actuador_activo_idx`(`activo`),
    INDEX `Actuador_unidad_medida_id_idx`(`unidad_medida_id`),
    PRIMARY KEY (`actuator_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proyecto` (
    `project_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Proyecto_nombre_idx`(`nombre`),
    INDEX `Proyecto_activo_idx`(`activo`),
    PRIMARY KEY (`project_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProyectoSensor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoId` INTEGER NOT NULL,
    `sensorId` INTEGER NOT NULL,

    INDEX `ProyectoSensor_sensorId_idx`(`sensorId`),
    UNIQUE INDEX `ProyectoSensor_proyectoId_sensorId_key`(`proyectoId`, `sensorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProyectoActuador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoId` INTEGER NOT NULL,
    `actuadorId` INTEGER NOT NULL,

    INDEX `ProyectoActuador_actuadorId_idx`(`actuadorId`),
    UNIQUE INDEX `ProyectoActuador_proyectoId_actuadorId_key`(`proyectoId`, `actuadorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MedicionSensor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoSensorId` INTEGER NOT NULL,
    `valor` DOUBLE NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MedicionSensor_proyectoSensorId_idx`(`proyectoSensorId`),
    INDEX `MedicionSensor_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistroActuador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proyectoActuadorId` INTEGER NOT NULL,
    `valor` DOUBLE NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RegistroActuador_proyectoActuadorId_idx`(`proyectoActuadorId`),
    INDEX `RegistroActuador_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sensor` ADD CONSTRAINT `Sensor_unidad_medida_id_fkey` FOREIGN KEY (`unidad_medida_id`) REFERENCES `UnidadMedida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actuador` ADD CONSTRAINT `Actuador_unidad_medida_id_fkey` FOREIGN KEY (`unidad_medida_id`) REFERENCES `UnidadMedida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoSensor` ADD CONSTRAINT `ProyectoSensor_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoSensor` ADD CONSTRAINT `ProyectoSensor_sensorId_fkey` FOREIGN KEY (`sensorId`) REFERENCES `Sensor`(`sensor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoActuador` ADD CONSTRAINT `ProyectoActuador_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProyectoActuador` ADD CONSTRAINT `ProyectoActuador_actuadorId_fkey` FOREIGN KEY (`actuadorId`) REFERENCES `Actuador`(`actuator_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicionSensor` ADD CONSTRAINT `MedicionSensor_proyectoSensorId_fkey` FOREIGN KEY (`proyectoSensorId`) REFERENCES `ProyectoSensor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistroActuador` ADD CONSTRAINT `RegistroActuador_proyectoActuadorId_fkey` FOREIGN KEY (`proyectoActuadorId`) REFERENCES `ProyectoActuador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
