-- Add performance indexes for frequently queried fields

-- Optimize chat queries
CREATE INDEX IF NOT EXISTS "idx_chats_status_created_at" ON "chats" ("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chats_is_deleted_created_at" ON "chats" ("is_deleted", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chats_agent_created_at" ON "chats" ("agent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chats_contact_created_at" ON "chats" ("contact_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chats_response_times" ON "chats" ("opened_at", "picked_up_at") WHERE "opened_at" IS NOT NULL AND "picked_up_at" IS NOT NULL;

-- Optimize agent queries
CREATE INDEX IF NOT EXISTS "idx_agents_active_deleted" ON "agents" ("is_active", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_agents_created_deleted" ON "agents" ("created_at", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_agents_department_active" ON "agents" ("department_id", "is_active", "is_deleted");

-- Optimize contact queries
CREATE INDEX IF NOT EXISTS "idx_contacts_deleted_created" ON "contacts" ("is_deleted", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_contacts_fullname_search" ON "contacts" USING GIN (to_tsvector('english', "full_name"));
CREATE INDEX IF NOT EXISTS "idx_contacts_email_mobile" ON "contacts" ("email", "mobile") WHERE "is_deleted" = false;

-- Optimize message queries
CREATE INDEX IF NOT EXISTS "idx_messages_chat_timestamp" ON "messages" ("chat_id", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_messages_type_timestamp" ON "messages" ("type", "timestamp" DESC);

-- Optimize sync queries
CREATE INDEX IF NOT EXISTS "idx_sync_logs_user_entity" ON "sync_logs" ("user_id", "entity_type", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_sync_states_entity_status" ON "sync_states" ("entity_type", "sync_status", "updated_at" DESC);

-- Optimize system settings queries
CREATE INDEX IF NOT EXISTS "idx_system_settings_category_key" ON "system_settings" ("category", "key");
CREATE INDEX IF NOT EXISTS "idx_system_settings_user_category" ON "system_settings" ("user_id", "category") WHERE "user_id" IS NOT NULL;

-- Optimize notification queries
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications" ("user_id", "is_read", "created_at" DESC);

-- Optimize export logs
CREATE INDEX IF NOT EXISTS "idx_export_logs_user_status" ON "export_logs" ("user_id", "status", "created_at" DESC);

-- Optimize effectiveness analysis
CREATE INDEX IF NOT EXISTS "idx_effectiveness_chat_score" ON "effectiveness_analysis" ("chat_id", "effectiveness_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_effectiveness_user_created" ON "effectiveness_analysis" ("user_id", "created_at" DESC);

-- Add composite indexes for common dashboard queries
CREATE INDEX IF NOT EXISTS "idx_chats_dashboard_stats" ON "chats" ("is_deleted", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_agents_dashboard_stats" ON "agents" ("is_deleted", "is_active", "created_at" DESC);