-- AlterTable
ALTER TABLE "sync_states" ADD COLUMN     "failed_records" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "successful_records" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sync_duration" INTEGER,
ADD COLUMN     "total_records" INTEGER NOT NULL DEFAULT 0;
