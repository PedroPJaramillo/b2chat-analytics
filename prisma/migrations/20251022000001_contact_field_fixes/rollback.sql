-- Rollback script for Feature 002: Contact Field Mapping Fixes
-- WARNING: This will remove the new columns. All data in these columns will be lost.

-- Drop indexes
DROP INDEX IF EXISTS "contacts_merchant_id_idx";

-- Drop columns
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "b2chat_updated_at";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "b2chat_created_at";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "merchant_id";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "tags";
