-- CreateEnum
CREATE TYPE "ChatDirection" AS ENUM ('incoming', 'outgoing', 'outgoing_broadcast');

-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "direction" "ChatDirection" NOT NULL DEFAULT 'incoming',
ADD COLUMN     "original_direction" "ChatDirection";

-- CreateIndex
CREATE INDEX "chats_direction_idx" ON "chats"("direction");

-- CreateIndex
CREATE INDEX "chats_direction_status_created_at_idx" ON "chats"("direction", "status", "created_at");

-- Backfill existing chats with 'incoming' as originalDirection
UPDATE "chats" SET "original_direction" = 'incoming' WHERE "original_direction" IS NULL;
