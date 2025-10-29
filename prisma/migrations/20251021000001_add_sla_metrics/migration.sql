-- Add SLA Metric Value columns (wall clock time, in seconds)
ALTER TABLE "chats"
ADD COLUMN "time_to_pickup" INTEGER,
ADD COLUMN "first_response_time" INTEGER,
ADD COLUMN "avg_response_time" DOUBLE PRECISION,
ADD COLUMN "resolution_time" INTEGER;

-- Add SLA Compliance Flag columns (wall clock time)
ALTER TABLE "chats"
ADD COLUMN "pickup_sla" BOOLEAN,
ADD COLUMN "first_response_sla" BOOLEAN,
ADD COLUMN "avg_response_sla" BOOLEAN,
ADD COLUMN "resolution_sla" BOOLEAN,
ADD COLUMN "overall_sla" BOOLEAN;

-- Add Business Hours SLA Metric Value columns (in seconds)
ALTER TABLE "chats"
ADD COLUMN "time_to_pickup_bh" INTEGER,
ADD COLUMN "first_response_time_bh" INTEGER,
ADD COLUMN "avg_response_time_bh" DOUBLE PRECISION,
ADD COLUMN "resolution_time_bh" INTEGER;

-- Add Business Hours SLA Compliance Flag columns
ALTER TABLE "chats"
ADD COLUMN "pickup_sla_bh" BOOLEAN,
ADD COLUMN "first_response_sla_bh" BOOLEAN,
ADD COLUMN "avg_response_sla_bh" BOOLEAN,
ADD COLUMN "resolution_sla_bh" BOOLEAN,
ADD COLUMN "overall_sla_bh" BOOLEAN;

-- Create indexes for SLA query optimization

-- Index on overall SLA compliance for quick filtering
CREATE INDEX "chats_overall_sla_idx" ON "chats"("overall_sla");
CREATE INDEX "chats_overall_sla_bh_idx" ON "chats"("overall_sla_bh");

-- Indexes on individual SLA metrics for filtering
CREATE INDEX "chats_pickup_sla_idx" ON "chats"("pickup_sla");
CREATE INDEX "chats_first_response_sla_idx" ON "chats"("first_response_sla");
CREATE INDEX "chats_avg_response_sla_idx" ON "chats"("avg_response_sla");
CREATE INDEX "chats_resolution_sla_idx" ON "chats"("resolution_sla");

-- Composite index for common queries (opened_at + SLA status)
CREATE INDEX "chats_opened_at_overall_sla_idx" ON "chats"("opened_at", "overall_sla");

-- Composite index for agent-based SLA filtering
CREATE INDEX "chats_agent_id_overall_sla_idx" ON "chats"("agent_id", "overall_sla");
