-- Add missing columns to chats table
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "alias" TEXT;
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';

-- Add missing column to contacts table
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS "chats_alias_idx" ON "chats"("alias");
CREATE INDEX IF NOT EXISTS "chats_tags_idx" ON "chats" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "contacts_phone_number_idx" ON "contacts"("phone_number");