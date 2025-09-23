-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Manager', 'Admin');

-- CreateEnum
CREATE TYPE "ChatProvider" AS ENUM ('whatsapp', 'facebook', 'telegram', 'livechat', 'b2cbotapi');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('open', 'closed', 'pending');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'file');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "b2chat_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_leaf" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "path" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "b2chat_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "department_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "b2chat_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "identification" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "company" TEXT,
    "custom_attributes" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "b2chat_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "contact_id" TEXT,
    "department_id" TEXT,
    "provider" "ChatProvider" NOT NULL,
    "status" "ChatStatus" NOT NULL,
    "is_agent_available" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL,
    "opened_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "response_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "duration" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "last_modified_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "sync_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "b2chat_message_id" TEXT,
    "text" TEXT,
    "type" "MessageType" NOT NULL,
    "incoming" BOOLEAN NOT NULL,
    "image_url" TEXT,
    "file_url" TEXT,
    "caption" TEXT,
    "local_image_path" TEXT,
    "local_file_path" TEXT,
    "media_backed_up" BOOLEAN NOT NULL DEFAULT false,
    "media_size" INTEGER,
    "media_mime_type" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "last_sync_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "last_sync_timestamp" TIMESTAMP(3),
    "last_synced_id" TEXT,
    "last_sync_offset" INTEGER,
    "sync_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_checkpoints" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "total_records" INTEGER,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "successful_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "failure_details" JSONB,
    "checkpoint" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "is_system_setting" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT,
    "record_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "effectiveness_analysis" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "effectiveness_score" DOUBLE PRECISION NOT NULL,
    "response_time_score" DOUBLE PRECISION NOT NULL,
    "resolution_score" DOUBLE PRECISION NOT NULL,
    "customer_satisfaction" DOUBLE PRECISION,
    "analysis_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "effectiveness_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_b2chat_code_key" ON "departments"("b2chat_code");

-- CreateIndex
CREATE INDEX "departments_b2chat_code_idx" ON "departments"("b2chat_code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "departments_path_idx" ON "departments"("path");

-- CreateIndex
CREATE INDEX "departments_is_active_is_leaf_idx" ON "departments"("is_active", "is_leaf");

-- CreateIndex
CREATE UNIQUE INDEX "agents_b2chat_id_key" ON "agents"("b2chat_id");

-- CreateIndex
CREATE INDEX "agents_b2chat_id_idx" ON "agents"("b2chat_id");

-- CreateIndex
CREATE INDEX "agents_department_id_idx" ON "agents"("department_id");

-- CreateIndex
CREATE INDEX "agents_is_active_idx" ON "agents"("is_active");

-- CreateIndex
CREATE INDEX "agents_is_deleted_idx" ON "agents"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_b2chat_id_key" ON "contacts"("b2chat_id");

-- CreateIndex
CREATE INDEX "contacts_b2chat_id_idx" ON "contacts"("b2chat_id");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_mobile_idx" ON "contacts"("mobile");

-- CreateIndex
CREATE INDEX "contacts_is_deleted_idx" ON "contacts"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "chats_b2chat_id_key" ON "chats"("b2chat_id");

-- CreateIndex
CREATE INDEX "chats_b2chat_id_idx" ON "chats"("b2chat_id");

-- CreateIndex
CREATE INDEX "chats_agent_id_created_at_idx" ON "chats"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "chats_contact_id_created_at_idx" ON "chats"("contact_id", "created_at");

-- CreateIndex
CREATE INDEX "chats_department_id_created_at_idx" ON "chats"("department_id", "created_at");

-- CreateIndex
CREATE INDEX "chats_provider_created_at_idx" ON "chats"("provider", "created_at");

-- CreateIndex
CREATE INDEX "chats_is_deleted_idx" ON "chats"("is_deleted");

-- CreateIndex
CREATE INDEX "chats_last_modified_at_idx" ON "chats"("last_modified_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_b2chat_message_id_key" ON "messages"("b2chat_message_id");

-- CreateIndex
CREATE INDEX "messages_chat_id_timestamp_idx" ON "messages"("chat_id", "timestamp");

-- CreateIndex
CREATE INDEX "messages_type_idx" ON "messages"("type");

-- CreateIndex
CREATE INDEX "messages_media_backed_up_idx" ON "messages"("media_backed_up");

-- CreateIndex
CREATE INDEX "sync_logs_user_id_idx" ON "sync_logs"("user_id");

-- CreateIndex
CREATE INDEX "sync_logs_entity_type_idx" ON "sync_logs"("entity_type");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sync_states_entity_type_key" ON "sync_states"("entity_type");

-- CreateIndex
CREATE INDEX "sync_checkpoints_sync_id_idx" ON "sync_checkpoints"("sync_id");

-- CreateIndex
CREATE INDEX "sync_checkpoints_entity_type_idx" ON "sync_checkpoints"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "export_logs_user_id_idx" ON "export_logs"("user_id");

-- CreateIndex
CREATE INDEX "export_logs_status_idx" ON "export_logs"("status");

-- CreateIndex
CREATE INDEX "effectiveness_analysis_chat_id_idx" ON "effectiveness_analysis"("chat_id");

-- CreateIndex
CREATE INDEX "effectiveness_analysis_user_id_idx" ON "effectiveness_analysis"("user_id");

-- CreateIndex
CREATE INDEX "effectiveness_analysis_effectiveness_score_idx" ON "effectiveness_analysis"("effectiveness_score");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "effectiveness_analysis" ADD CONSTRAINT "effectiveness_analysis_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "effectiveness_analysis" ADD CONSTRAINT "effectiveness_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
