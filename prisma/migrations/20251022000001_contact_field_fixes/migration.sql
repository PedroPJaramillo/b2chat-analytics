-- Feature 002: Contact Field Mapping Fixes
-- Add new fields to contacts table for complete B2Chat data capture

-- Add new columns
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tags" JSONB;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "merchant_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "b2chat_created_at" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "b2chat_updated_at" TIMESTAMP(3);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "contacts_merchant_id_idx" ON "contacts"("merchant_id");

-- Add comments for documentation
COMMENT ON COLUMN "contacts"."tags" IS 'B2Chat tags with assignment timestamps - JSON array: [{"name": "VIP", "assigned_at": 1706644084}]';
COMMENT ON COLUMN "contacts"."merchant_id" IS 'B2Chat merchant identifier for multi-tenant support';
COMMENT ON COLUMN "contacts"."b2chat_created_at" IS 'Original creation timestamp from B2Chat (not our sync time)';
COMMENT ON COLUMN "contacts"."b2chat_updated_at" IS 'Original last update timestamp from B2Chat';
