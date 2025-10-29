-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "CustomerIntent" AS ENUM ('PROJECT_INFO', 'PAYMENT', 'LEGAL', 'POST_PURCHASE', 'OTHER');

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('PROSPECT', 'ACTIVE_BUYER', 'POST_PURCHASE');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'FRICTION');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('RESPONSE_TIME', 'VOLUME', 'PEAK_TIME', 'CUSTOMER_INTENT', 'JOURNEY_STAGE', 'SENTIMENT', 'AGENT_QUALITY', 'CHANNEL_USAGE');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'CSV');

-- CreateTable
CREATE TABLE "customer_analyses" (
    "id" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "triggered_by" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "total_chats_analyzed" INTEGER NOT NULL DEFAULT 0,
    "total_messages_analyzed" INTEGER NOT NULL DEFAULT 0,
    "ai_analysis_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_categorizations" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "customer_intent" "CustomerIntent",
    "journey_stage" "JourneyStage",
    "sentiment" "Sentiment",
    "agent_quality_score" INTEGER,
    "reasoning_notes" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_categorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_kpis" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "metric_type" "MetricType" NOT NULL,
    "metric_name" TEXT NOT NULL,
    "numeric_value" DOUBLE PRECISION,
    "string_value" TEXT,
    "json_value" JSONB,
    "agent_id" TEXT,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_exports" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "file_name" TEXT NOT NULL,
    "blob_url" TEXT,
    "blob_key" TEXT,
    "generated_by" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_analyses_triggered_by_created_at_idx" ON "customer_analyses"("triggered_by", "created_at");

-- CreateIndex
CREATE INDEX "customer_analyses_status_created_at_idx" ON "customer_analyses"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_categorizations_analysis_id_chat_id_key" ON "customer_categorizations"("analysis_id", "chat_id");

-- CreateIndex
CREATE INDEX "customer_categorizations_analysis_id_customer_intent_idx" ON "customer_categorizations"("analysis_id", "customer_intent");

-- CreateIndex
CREATE INDEX "customer_categorizations_analysis_id_journey_stage_idx" ON "customer_categorizations"("analysis_id", "journey_stage");

-- CreateIndex
CREATE INDEX "customer_categorizations_analysis_id_sentiment_idx" ON "customer_categorizations"("analysis_id", "sentiment");

-- CreateIndex
CREATE INDEX "analysis_kpis_analysis_id_metric_type_idx" ON "analysis_kpis"("analysis_id", "metric_type");

-- CreateIndex
CREATE INDEX "analysis_kpis_category_idx" ON "analysis_kpis"("category");

-- CreateIndex
CREATE INDEX "analysis_kpis_agent_id_idx" ON "analysis_kpis"("agent_id");

-- CreateIndex
CREATE INDEX "analysis_exports_analysis_id_idx" ON "analysis_exports"("analysis_id");

-- CreateIndex
CREATE INDEX "analysis_exports_expires_at_idx" ON "analysis_exports"("expires_at");

-- AddForeignKey
ALTER TABLE "customer_analyses" ADD CONSTRAINT "customer_analyses_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_categorizations" ADD CONSTRAINT "customer_categorizations_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "customer_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_categorizations" ADD CONSTRAINT "customer_categorizations_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_kpis" ADD CONSTRAINT "analysis_kpis_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "customer_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_kpis" ADD CONSTRAINT "analysis_kpis_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_exports" ADD CONSTRAINT "analysis_exports_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "customer_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_exports" ADD CONSTRAINT "analysis_exports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "api_response_logs" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_params" JSONB,
    "raw_response" JSONB,
    "response_size" INTEGER NOT NULL,
    "record_count" INTEGER NOT NULL,
    "api_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_response_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error_code" TEXT,
    "stack_trace" TEXT,
    "user_id" TEXT,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "session_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "resource" TEXT,
    "action" TEXT,
    "details" JSONB,
    "metadata" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transform_logs" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "extract_sync_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "validation_warnings" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "user_id" TEXT,
    "changes_summary" JSONB,

    CONSTRAINT "transform_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_response_logs_sync_id_idx" ON "api_response_logs"("sync_id");

-- CreateIndex
CREATE INDEX "api_response_logs_api_timestamp_idx" ON "api_response_logs"("api_timestamp");

-- CreateIndex
CREATE INDEX "error_logs_level_idx" ON "error_logs"("level");

-- CreateIndex
CREATE INDEX "error_logs_source_idx" ON "error_logs"("source");

-- CreateIndex
CREATE INDEX "error_logs_timestamp_idx" ON "error_logs"("timestamp");

-- CreateIndex
CREATE INDEX "error_logs_created_at_idx" ON "error_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "transform_logs_extract_sync_id_idx" ON "transform_logs"("extract_sync_id");

-- CreateIndex
CREATE INDEX "transform_logs_entity_type_idx" ON "transform_logs"("entity_type");

-- CreateIndex
CREATE INDEX "transform_logs_status_idx" ON "transform_logs"("status");

-- CreateIndex
CREATE INDEX "transform_logs_started_at_idx" ON "transform_logs"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "transform_logs_sync_id_key" ON "transform_logs"("sync_id");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
