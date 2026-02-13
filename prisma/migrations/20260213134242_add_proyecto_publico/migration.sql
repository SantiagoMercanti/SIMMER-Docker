-- AlterTable
ALTER TABLE `Proyecto` ADD COLUMN `publico` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Proyecto_publico_idx` ON `Proyecto`(`publico`);
