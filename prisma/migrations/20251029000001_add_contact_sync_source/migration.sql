-- CreateEnum
CREATE TYPE "ContactSyncSource" AS ENUM ('contacts_api', 'chat_embedded', 'upgraded');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "sync_source" "ContactSyncSource" NOT NULL DEFAULT 'contacts_api';
ALTER TABLE "contacts" ADD COLUMN "needs_full_sync" BOOLEAN NOT NULL DEFAULT FALSE;

-- CreateIndex
CREATE INDEX "contacts_sync_source_idx" ON "contacts"("sync_source");

-- CreateIndex
CREATE INDEX "contacts_needs_full_sync_idx" ON "contacts"("needs_full_sync");

-- Backfill existing contacts with 'contacts_api' source and needsFullSync=false
UPDATE "contacts" SET "sync_source" = 'contacts_api', "needs_full_sync" = FALSE WHERE "sync_source" IS NULL;
