/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `agents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ChatPriority" AS ENUM ('urgent', 'high', 'normal', 'low');

-- AlterEnum
ALTER TYPE "ChatStatus" ADD VALUE 'CLOSED';

-- DropForeignKey
ALTER TABLE "public"."customer_analyses" DROP CONSTRAINT "customer_analyses_triggered_by_fkey";

-- DropIndex
DROP INDEX "public"."idx_agents_active_deleted";

-- DropIndex
DROP INDEX "public"."idx_agents_created_deleted";

-- DropIndex
DROP INDEX "public"."idx_agents_dashboard_stats";

-- DropIndex
DROP INDEX "public"."idx_agents_department_active";

-- DropIndex
DROP INDEX "public"."chats_tags_idx";

-- DropIndex
DROP INDEX "public"."idx_chats_agent_created_at";

-- DropIndex
DROP INDEX "public"."idx_chats_contact_created_at";

-- DropIndex
DROP INDEX "public"."idx_chats_dashboard_stats";

-- DropIndex
DROP INDEX "public"."idx_chats_is_deleted_created_at";

-- DropIndex
DROP INDEX "public"."idx_chats_status_created_at";

-- DropIndex
DROP INDEX "public"."idx_contacts_deleted_created";

-- DropIndex
DROP INDEX "public"."idx_effectiveness_chat_score";

-- DropIndex
DROP INDEX "public"."idx_effectiveness_user_created";

-- DropIndex
DROP INDEX "public"."idx_export_logs_user_status";

-- DropIndex
DROP INDEX "public"."idx_messages_chat_timestamp";

-- DropIndex
DROP INDEX "public"."idx_messages_type_timestamp";

-- DropIndex
DROP INDEX "public"."idx_notifications_user_read";

-- DropIndex
DROP INDEX "public"."idx_sync_logs_user_entity";

-- DropIndex
DROP INDEX "public"."idx_sync_states_entity_status";

-- DropIndex
DROP INDEX "public"."idx_system_settings_category_key";

-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "priority" "ChatPriority" NOT NULL DEFAULT 'normal',
ADD COLUMN     "resolution_note" TEXT,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "unread_count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "poll_started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "poll_completed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "poll_abandoned_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "raw_contacts" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "b2chat_contact_id" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "api_page" INTEGER NOT NULL,
    "api_offset" INTEGER NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_status" TEXT NOT NULL DEFAULT 'pending',
    "processing_error" TEXT,
    "processing_attempt" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "raw_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_chats" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "b2chat_chat_id" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "api_page" INTEGER NOT NULL,
    "api_offset" INTEGER NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_status" TEXT NOT NULL DEFAULT 'pending',
    "processing_error" TEXT,
    "processing_attempt" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "raw_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extract_logs" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "api_call_count" INTEGER NOT NULL DEFAULT 0,
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER,
    "current_page" INTEGER,
    "error_message" TEXT,
    "date_range_from" TIMESTAMP(3),
    "date_range_to" TIMESTAMP(3),
    "time_range_preset" TEXT,
    "user_id" TEXT,
    "estimated_total" INTEGER,
    "batch_size" INTEGER NOT NULL DEFAULT 100,
    "contact_filter_mobile" TEXT,
    "metadata" JSONB,

    CONSTRAINT "extract_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_status_history" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "previous_status" "ChatStatus" NOT NULL,
    "new_status" "ChatStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,
    "sync_id" TEXT,
    "transform_id" TEXT,

    CONSTRAINT "chat_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_validation_results" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "transform_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "validation_name" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affected_records" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_contacts_sync_id_idx" ON "raw_contacts"("sync_id");

-- CreateIndex
CREATE INDEX "raw_contacts_b2chat_contact_id_idx" ON "raw_contacts"("b2chat_contact_id");

-- CreateIndex
CREATE INDEX "raw_contacts_processing_status_idx" ON "raw_contacts"("processing_status");

-- CreateIndex
CREATE INDEX "raw_contacts_fetched_at_idx" ON "raw_contacts"("fetched_at");

-- CreateIndex
CREATE INDEX "raw_contacts_sync_id_processing_status_idx" ON "raw_contacts"("sync_id", "processing_status");

-- CreateIndex
CREATE INDEX "raw_chats_sync_id_idx" ON "raw_chats"("sync_id");

-- CreateIndex
CREATE INDEX "raw_chats_b2chat_chat_id_idx" ON "raw_chats"("b2chat_chat_id");

-- CreateIndex
CREATE INDEX "raw_chats_processing_status_idx" ON "raw_chats"("processing_status");

-- CreateIndex
CREATE INDEX "raw_chats_fetched_at_idx" ON "raw_chats"("fetched_at");

-- CreateIndex
CREATE INDEX "raw_chats_sync_id_processing_status_idx" ON "raw_chats"("sync_id", "processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "extract_logs_sync_id_key" ON "extract_logs"("sync_id");

-- CreateIndex
CREATE INDEX "extract_logs_entity_type_idx" ON "extract_logs"("entity_type");

-- CreateIndex
CREATE INDEX "extract_logs_status_idx" ON "extract_logs"("status");

-- CreateIndex
CREATE INDEX "extract_logs_started_at_idx" ON "extract_logs"("started_at");

-- CreateIndex
CREATE INDEX "extract_logs_sync_id_idx" ON "extract_logs"("sync_id");

-- CreateIndex
CREATE INDEX "chat_status_history_chat_id_changed_at_idx" ON "chat_status_history"("chat_id", "changed_at");

-- CreateIndex
CREATE INDEX "chat_status_history_sync_id_idx" ON "chat_status_history"("sync_id");

-- CreateIndex
CREATE INDEX "sync_validation_results_sync_id_idx" ON "sync_validation_results"("sync_id");

-- CreateIndex
CREATE INDEX "sync_validation_results_transform_id_idx" ON "sync_validation_results"("transform_id");

-- CreateIndex
CREATE INDEX "sync_validation_results_severity_idx" ON "sync_validation_results"("severity");

-- CreateIndex
CREATE INDEX "sync_validation_results_validation_name_idx" ON "sync_validation_results"("validation_name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_username_key" ON "agents"("username");

-- CreateIndex
CREATE INDEX "agents_username_idx" ON "agents"("username");

-- CreateIndex
CREATE INDEX "chats_tags_idx" ON "chats"("tags");

-- CreateIndex
CREATE INDEX "chats_priority_status_idx" ON "chats"("priority", "status");

-- CreateIndex
CREATE INDEX "chats_topic_idx" ON "chats"("topic");

-- CreateIndex
CREATE INDEX "chats_unread_count_idx" ON "chats"("unread_count");

-- CreateIndex
CREATE INDEX "chats_status_priority_last_modified_at_idx" ON "chats"("status", "priority", "last_modified_at");

-- CreateIndex
CREATE INDEX "chats_agent_id_status_created_at_idx" ON "chats"("agent_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "chats_status_poll_started_at_idx" ON "chats"("status", "poll_started_at");

-- AddForeignKey
ALTER TABLE "customer_analyses" ADD CONSTRAINT "customer_analyses_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
