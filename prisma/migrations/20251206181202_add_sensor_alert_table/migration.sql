-- CreateTable
CREATE TABLE `SensorAlert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sensorId` INTEGER NOT NULL,
    `valor` DOUBLE NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SensorAlert_sensorId_idx`(`sensorId`),
    INDEX `SensorAlert_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SensorAlert` ADD CONSTRAINT `SensorAlert_sensorId_fkey` FOREIGN KEY (`sensorId`) REFERENCES `Sensor`(`sensor_id`) ON DELETE CASCADE ON UPDATE CASCADE;
