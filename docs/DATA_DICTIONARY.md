# B2Chat Analytics - Data Dictionary

**Version:** 1.0
**Last Updated:** October 2, 2025
**Database:** PostgreSQL 15+
**ORM:** Prisma 6.16.2

---

## Table of Contents

- [Core Entities](#core-entities)
  - [User](#user)
  - [Department](#department)
  - [Agent](#agent)
  - [Contact](#contact)
  - [Chat](#chat)
  - [Message](#message)
- [Synchronization Tables](#synchronization-tables)
  - [SyncLog](#synclog)
  - [SyncState](#syncstate)
  - [SyncCheckpoint](#synccheckpoint)
  - [ApiResponseLog](#apiresponselog)
- [System Tables](#system-tables)
  - [SystemSetting](#systemsetting)
  - [Notification](#notification)
  - [ExportLog](#exportlog)
- [Analysis Tables](#analysis-tables)
  - [EffectivenessAnalysis](#effectivenessanalysis)
- [Logging Tables](#logging-tables)
  - [ErrorLog](#errorlog)
  - [AuditLog](#auditlog)
- [Enumerations](#enumerations)
- [Indexes](#indexes)
- [Relationships](#relationships)

---

## Core Entities

### User

**Purpose:** System users synchronized from Clerk authentication provider

**Table Name:** `users`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique user identifier from Clerk |
| `email` | String | No | - | User email address (unique) |
| `name` | String | Yes | - | User display name |
| `role` | UserRole | No | - | User role (Manager or Admin) |
| `created_at` | DateTime | No | now() | Timestamp when user was created |
| `updated_at` | DateTime | No | now() | Timestamp when user was last updated |

**Relationships:**
- Has many: SyncLog, SystemSetting, Notification, ExportLog, EffectivenessAnalysis

**Indexes:**
- Primary key: `id`
- Unique: `email`

**Business Rules:**
- Email must be unique across all users
- Role determines access permissions (Manager = read-only, Admin = full access)
- Users are automatically synced from Clerk via webhook

---

### Department

**Purpose:** Hierarchical department structure from B2Chat for organizational grouping

**Table Name:** `departments`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique department identifier |
| `b2chat_code` | String | No | - | Unique department code from B2Chat (unique) |
| `name` | String | No | - | Department name |
| `parent_id` | String | Yes | - | Foreign key to parent department (self-referential) |
| `is_leaf` | Boolean | No | false | Whether department is a leaf node (has no children) |
| `is_active` | Boolean | No | true | Whether department is currently active |
| `path` | String | Yes | - | Materialized path for hierarchy (e.g., "/sales/enterprise/") |
| `level` | Int | No | 0 | Depth level in hierarchy (root = 0) |
| `last_sync_at` | DateTime | Yes | - | Timestamp of last sync from B2Chat |
| `created_at` | DateTime | No | now() | Timestamp when department was created |

**Relationships:**
- Self-referential: parent (one) → children (many)
- Has many: Agent, Chat

**Indexes:**
- Primary key: `id`
- Unique: `b2chat_code`
- Indexed: `parent_id`, `path`, (`is_active`, `is_leaf`)

**Business Rules:**
- Departments form a tree structure via `parent_id`
- Materialized path enables efficient ancestor/descendant queries
- Level indicates depth in hierarchy (0 = root departments)
- Leaf departments cannot have child departments

---

### Agent

**Purpose:** Customer service agents from B2Chat with performance tracking

**Table Name:** `agents`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique agent identifier |
| `b2chat_id` | String | No | - | Unique agent ID from B2Chat (unique) |
| `name` | String | No | - | Agent full name |
| `email` | String | Yes | - | Agent email address |
| `username` | String | Yes | - | Agent username (unique if provided) |
| `department_id` | String | Yes | - | Foreign key to Department |
| `is_active` | Boolean | No | true | Whether agent is currently active |
| `is_deleted` | Boolean | No | false | Soft delete flag |
| `deleted_at` | DateTime | Yes | - | Timestamp when agent was soft-deleted |
| `deletion_reason` | String | Yes | - | Reason for soft deletion |
| `last_sync_at` | DateTime | Yes | - | Timestamp of last sync from B2Chat |
| `created_at` | DateTime | No | now() | Timestamp when agent was created |
| `updated_at` | DateTime | No | now() | Timestamp when agent was last updated |

**Relationships:**
- Belongs to: Department (optional)
- Has many: Chat

**Indexes:**
- Primary key: `id`
- Unique: `b2chat_id`, `username`
- Indexed: `department_id`, `is_active`, `is_deleted`

**Business Rules:**
- B2Chat ID must be unique
- Username must be unique if provided (nullable for legacy data)
- Soft deletion preserves historical data
- Active agents can be assigned to new chats

---

### Contact

**Purpose:** Customer contact information synchronized from B2Chat

**Table Name:** `contacts`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique contact identifier |
| `b2chat_id` | String | No | - | Unique contact ID from B2Chat (unique) |
| `full_name` | String | No | - | Contact full name |
| `mobile` | String | Yes | - | Mobile phone number |
| `phone_number` | String | Yes | - | Landline phone number (separate from mobile) |
| `email` | String | Yes | - | Email address |
| `identification` | String | Yes | - | National ID, passport, or other identifier |
| `address` | String | Yes | - | Street address |
| `city` | String | Yes | - | City |
| `country` | String | Yes | - | Country |
| `company` | String | Yes | - | Company name |
| `custom_attributes` | Json | Yes | - | Additional custom fields from B2Chat |
| `is_deleted` | Boolean | No | false | Soft delete flag |
| `deleted_at` | DateTime | Yes | - | Timestamp when contact was soft-deleted |
| `deletion_reason` | String | Yes | - | Reason for soft deletion |
| `last_sync_at` | DateTime | Yes | - | Timestamp of last sync from B2Chat |
| `created_at` | DateTime | No | now() | Timestamp when contact was created |
| `updated_at` | DateTime | No | now() | Timestamp when contact was last updated |

**Relationships:**
- Has many: Chat

**Indexes:**
- Primary key: `id`
- Unique: `b2chat_id`
- Indexed: `email`, `mobile`, `phone_number`, `is_deleted`

**Business Rules:**
- B2Chat ID must be unique
- Mobile and phone_number are separate fields (mobile = cell, phone_number = landline)
- Custom attributes stored as JSON for flexibility
- Soft deletion preserves contact history

---

### Chat

**Purpose:** Main conversation records from B2Chat with timing and status tracking

**Table Name:** `chats`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique chat identifier |
| `b2chat_id` | String | No | - | Unique chat ID from B2Chat (unique) |
| `agent_id` | String | Yes | - | Foreign key to Agent (nullable for unassigned chats) |
| `contact_id` | String | Yes | - | Foreign key to Contact |
| `department_id` | String | Yes | - | Foreign key to Department |
| `provider` | ChatProvider | No | - | Communication channel (whatsapp, facebook, etc.) |
| `status` | ChatStatus | No | - | Current chat status (open, closed, pending) |
| `is_agent_available` | Boolean | Yes | - | Whether agent was available when chat started |
| `alias` | String | Yes | - | Account alias from B2Chat for multi-brand support |
| `tags` | String[] | No | [] | Chat tags for categorization |
| `priority` | ChatPriority | No | normal | Priority level (urgent, high, normal, low) |
| `topic` | String | Yes | - | Chat topic/subject for categorization |
| `unread_count` | Int | No | 0 | Count of unread customer messages |
| `resolution_note` | String | Yes | - | Notes when chat is resolved |
| `created_at` | DateTime | No | - | Timestamp when chat was created in B2Chat |
| `opened_at` | DateTime | Yes | - | Timestamp when chat was opened by system |
| `picked_up_at` | DateTime | Yes | - | Timestamp when agent picked up the chat |
| `response_at` | DateTime | Yes | - | Timestamp of first agent response |
| `closed_at` | DateTime | Yes | - | Timestamp when chat was closed |
| `duration` | Int | Yes | - | Total chat duration in seconds |
| `is_deleted` | Boolean | No | false | Soft delete flag |
| `deleted_at` | DateTime | Yes | - | Timestamp when chat was soft-deleted |
| `deletion_reason` | String | Yes | - | Reason for soft deletion |
| `last_modified_at` | DateTime | Yes | - | Timestamp of last modification in B2Chat |
| `last_sync_at` | DateTime | Yes | - | Timestamp of last sync from B2Chat |
| `sync_version` | Int | No | 1 | Version number for sync tracking |

**Relationships:**
- Belongs to: Agent (optional), Contact (optional), Department (optional)
- Has many: Message, EffectivenessAnalysis

**Indexes:**
- Primary key: `id`
- Unique: `b2chat_id`
- Composite indexes for performance:
  - (`agent_id`, `created_at`)
  - (`contact_id`, `created_at`)
  - (`department_id`, `created_at`)
  - (`provider`, `created_at`)
  - (`status`, `priority`, `last_modified_at`)
  - (`agent_id`, `status`, `created_at`)
- Single indexes: `is_deleted`, `last_modified_at`, `alias`, `tags`, `priority`, `topic`, `unread_count`

**Business Rules:**
- Response time calculated as: `response_at - created_at`
- First response time: `response_at - opened_at`
- Resolution time: `closed_at - created_at`
- Duration auto-calculated if both created_at and closed_at exist
- Tags stored as array for multi-tag support
- Priority affects chat queue ordering

**Key Timestamps Explanation:**
- `created_at`: Chat initiated by customer
- `opened_at`: Chat entered the system queue
- `picked_up_at`: Agent claimed the chat
- `response_at`: First agent message sent
- `closed_at`: Chat marked as resolved/closed

---

### Message

**Purpose:** Individual messages within chats, supporting text and multimedia

**Table Name:** `messages`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique message identifier |
| `chat_id` | String | No | - | Foreign key to Chat |
| `b2chat_message_id` | String | Yes | - | Unique message ID from B2Chat (unique if provided) |
| `text` | String | Yes | - | Message text content |
| `type` | MessageType | No | - | Message type (text, image, file) |
| `incoming` | Boolean | No | - | Direction: true = from customer, false = from agent |
| `image_url` | String | Yes | - | URL to image if type=image |
| `file_url` | String | Yes | - | URL to file if type=file |
| `caption` | String | Yes | - | Caption for image/file messages |
| `local_image_path` | String | Yes | - | Local backup path for images |
| `local_file_path` | String | Yes | - | Local backup path for files |
| `media_backed_up` | Boolean | No | false | Whether media has been backed up locally |
| `media_size` | Int | Yes | - | Media file size in bytes |
| `media_mime_type` | String | Yes | - | MIME type of media file |
| `timestamp` | DateTime | No | - | Timestamp when message was sent |
| `last_sync_at` | DateTime | Yes | - | Timestamp of last sync from B2Chat |

**Relationships:**
- Belongs to: Chat (cascade delete)

**Indexes:**
- Primary key: `id`
- Unique: `b2chat_message_id`
- Composite indexes:
  - (`chat_id`, `timestamp`) - primary query pattern
  - (`chat_id`, `type`) - filter by message type
  - (`chat_id`, `incoming`) - filter by direction
- Single indexes: `type`, `media_backed_up`

**Business Rules:**
- Messages cascade delete when parent chat is deleted
- Text messages: `type=text`, `text` field populated
- Image messages: `type=image`, `image_url` and optional `caption`
- File messages: `type=file`, `file_url` and optional `caption`
- `incoming=true` indicates customer message, `false` indicates agent message
- Media backup tracks local storage of attachments

---

## Synchronization Tables

### SyncLog

**Purpose:** Track all synchronization operations with B2Chat API

**Table Name:** `sync_logs`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique log identifier |
| `user_id` | String | No | - | Foreign key to User who triggered sync |
| `entity_type` | String | No | - | Type of entity synced (chats, contacts, agents, departments) |
| `operation` | String | No | - | Sync operation type (full, incremental, manual) |
| `record_count` | Int | No | - | Total number of records processed |
| `status` | String | No | - | Sync status (success, error, partial) |
| `started_at` | DateTime | No | - | Timestamp when sync started |
| `completed_at` | DateTime | Yes | - | Timestamp when sync completed |
| `error_message` | String | Yes | - | Error message if sync failed |
| `metadata` | Json | Yes | - | Additional sync metadata |

**Relationships:**
- Belongs to: User

**Indexes:**
- Primary key: `id`
- Indexed: `user_id`, `entity_type`, `status`

**Business Rules:**
- Every sync operation creates a log entry
- Status values: 'success', 'error', 'partial', 'in_progress'
- Duration calculated as: `completed_at - started_at`
- Metadata stores additional context (date ranges, filters, etc.)

---

### SyncState

**Purpose:** Maintain current synchronization state for each entity type

**Table Name:** `sync_states`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique state identifier |
| `entity_type` | String | No | - | Type of entity (chats, contacts, agents, departments) - unique |
| `last_sync_timestamp` | DateTime | Yes | - | Timestamp of last successful sync |
| `last_synced_id` | String | Yes | - | Last synced record ID for cursor-based pagination |
| `last_sync_offset` | Int | Yes | - | Last sync offset for offset-based pagination |
| `sync_status` | String | No | - | Current sync status (idle, running, error) |
| `total_records` | Int | No | 0 | Total records in last sync |
| `successful_records` | Int | No | 0 | Successfully synced records |
| `failed_records` | Int | No | 0 | Failed record count |
| `sync_duration` | Int | Yes | - | Last sync duration in milliseconds |
| `created_at` | DateTime | No | now() | Timestamp when state was created |
| `updated_at` | DateTime | No | now() | Timestamp when state was last updated |

**Relationships:**
- None (standalone state table)

**Indexes:**
- Primary key: `id`
- Unique: `entity_type`

**Business Rules:**
- One record per entity type
- Updated after each sync operation
- Enables incremental sync by tracking last sync point
- Status values: 'idle', 'running', 'error', 'paused'

---

### SyncCheckpoint

**Purpose:** Track progress during long-running sync operations with recovery capability

**Table Name:** `sync_checkpoints`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | - | Primary key, unique checkpoint identifier |
| `sync_id` | String | No | - | Reference to parent sync operation |
| `entity_type` | String | No | - | Type of entity being synced |
| `total_records` | Int | Yes | - | Total records to process |
| `processed_records` | Int | No | 0 | Records processed so far |
| `successful_records` | Int | No | 0 | Successfully processed records |
| `failed_records` | Int | No | 0 | Failed record count |
| `failure_details` | Json | Yes | - | Details of failures (IDs, errors) |
| `checkpoint` | String | Yes | - | Checkpoint marker (cursor, offset, timestamp) |
| `status` | String | No | - | Checkpoint status (active, completed, failed) |
| `created_at` | DateTime | No | now() | Timestamp when checkpoint was created |
| `updated_at` | DateTime | No | now() | Timestamp when checkpoint was last updated |
| `completed_at` | DateTime | Yes | - | Timestamp when checkpoint completed |

**Relationships:**
- None (linked via sync_id to SyncLog)

**Indexes:**
- Primary key: `id`
- Indexed: `sync_id`, `entity_type`

**Business Rules:**
- Multiple checkpoints per sync operation
- Enables sync resumption after failures
- Updated periodically during sync (e.g., every 100 records)
- Failure details track specific records that failed

---

### ApiResponseLog

**Purpose:** Store raw API responses for debugging and audit trail

**Table Name:** `api_response_logs`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique log identifier |
| `sync_id` | String | No | - | Reference to sync operation |
| `endpoint` | String | No | - | API endpoint called (e.g., '/chats/export') |
| `request_params` | Json | No | - | Query parameters sent to API |
| `raw_response` | Json | No | - | Full API response body |
| `response_size` | Int | No | - | Response size in bytes |
| `record_count` | Int | No | - | Number of records in response |
| `api_timestamp` | DateTime | No | - | Timestamp when API was called |
| `created_at` | DateTime | No | now() | Timestamp when log was created |

**Relationships:**
- None (linked via sync_id to SyncLog)

**Indexes:**
- Primary key: `id`
- Indexed: `sync_id`, `endpoint`, `created_at`

**Business Rules:**
- Stores complete API responses for debugging
- Useful for troubleshooting data mapping issues
- Consider retention policy (e.g., keep 30 days)
- Large responses may impact database size

---

## System Tables

### SystemSetting

**Purpose:** Store application configuration and user preferences

**Table Name:** `system_settings`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique setting identifier |
| `key` | String | No | - | Setting key (unique) |
| `value` | String | No | - | Setting value (stored as string) |
| `category` | String | No | - | Setting category (b2chat, claude, app, user) |
| `description` | String | Yes | - | Human-readable description |
| `is_system_setting` | Boolean | No | false | Whether setting is system-wide or user-specific |
| `user_id` | String | Yes | - | Foreign key to User (null for system settings) |
| `created_at` | DateTime | No | now() | Timestamp when setting was created |
| `updated_at` | DateTime | No | now() | Timestamp when setting was last updated |

**Relationships:**
- Belongs to: User (optional, null for system settings)

**Indexes:**
- Primary key: `id`
- Unique: `key`
- Indexed: `category`

**Business Rules:**
- System settings have `user_id=null` and `is_system_setting=true`
- User preferences have `user_id` set and `is_system_setting=false`
- Key must be unique across all settings
- Categories: 'b2chat', 'claude', 'app', 'user', 'notification'

**Example Settings:**
```
key: "B2CHAT_API_URL", value: "https://api.b2chat.io", category: "b2chat"
key: "SYNC_INTERVAL_HOURS", value: "6", category: "app"
key: "SLA_THRESHOLD_MINUTES", value: "5", category: "app"
```

---

### Notification

**Purpose:** In-app notifications for users (sync status, alerts, etc.)

**Table Name:** `notifications`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique notification identifier |
| `user_id` | String | No | - | Foreign key to User |
| `title` | String | No | - | Notification title |
| `message` | String | No | - | Notification message body |
| `type` | String | No | - | Notification type (info, warning, error, success) |
| `is_read` | Boolean | No | false | Whether notification has been read |
| `metadata` | Json | Yes | - | Additional notification data |
| `created_at` | DateTime | No | now() | Timestamp when notification was created |

**Relationships:**
- Belongs to: User

**Indexes:**
- Primary key: `id`
- Indexed: `user_id`, `is_read`

**Business Rules:**
- Type values: 'info', 'warning', 'error', 'success'
- Metadata stores contextual data (sync_id, entity_type, etc.)
- Read status allows marking as read without deletion
- Consider retention policy (e.g., auto-delete after 30 days)

---

### ExportLog

**Purpose:** Track data export operations and generated files

**Table Name:** `export_logs`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique export identifier |
| `user_id` | String | No | - | Foreign key to User who initiated export |
| `export_type` | String | No | - | Type of export (agents, contacts, chats, reports) |
| `file_name` | String | No | - | Generated file name |
| `file_url` | String | Yes | - | URL to download file (Vercel Blob storage) |
| `record_count` | Int | No | - | Number of records exported |
| `status` | String | No | - | Export status (pending, completed, failed) |
| `created_at` | DateTime | No | now() | Timestamp when export was requested |
| `completed_at` | DateTime | Yes | - | Timestamp when export completed |
| `expires_at` | DateTime | Yes | - | Timestamp when download link expires |

**Relationships:**
- Belongs to: User

**Indexes:**
- Primary key: `id`
- Indexed: `user_id`, `status`

**Business Rules:**
- Status values: 'pending', 'processing', 'completed', 'failed', 'expired'
- Export types: 'agents', 'contacts', 'chats', 'custom_report', 'pdf'
- Files expire after configurable period (default: 24 hours)
- Large exports processed asynchronously

---

## Analysis Tables

### EffectivenessAnalysis

**Purpose:** Store AI-powered conversation quality analysis results

**Table Name:** `effectiveness_analysis`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique analysis identifier |
| `chat_id` | String | No | - | Foreign key to Chat |
| `user_id` | String | No | - | Foreign key to User who triggered analysis |
| `effectiveness_score` | Float | No | - | Overall effectiveness score (0-100) |
| `response_time_score` | Float | No | - | Response time component score (0-100) |
| `resolution_score` | Float | No | - | Problem resolution score (0-100, 60% weight) |
| `customer_satisfaction` | Float | Yes | - | Customer sentiment score (0-100, 40% weight) |
| `analysis_data` | Json | No | - | Complete AI analysis response |
| `created_at` | DateTime | No | now() | Timestamp when analysis was performed |

**Relationships:**
- Belongs to: Chat, User

**Indexes:**
- Primary key: `id`
- Indexed: `chat_id`, `user_id`, `effectiveness_score`

**Business Rules:**
- Effectiveness score = (resolution_score * 0.6) + (customer_satisfaction * 0.4)
- Analysis cached for 30 days to reduce API costs
- Analysis data stores complete Claude API response
- Multiple analyses per chat allowed (for comparison over time)

**Analysis Data Structure (JSON):**
```json
{
  "model": "claude-sonnet-4-20250514",
  "prompt_version": "v1.2",
  "resolution_details": { ... },
  "sentiment_analysis": { ... },
  "recommendations": [ ... ],
  "analyzed_messages": 15
}
```

---

## Logging Tables

### ErrorLog

**Purpose:** Centralized error logging for debugging and monitoring

**Table Name:** `error_logs`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique error log identifier |
| `timestamp` | DateTime | No | now() | Timestamp when error occurred |
| `level` | String | No | - | Error level (error, warn, fatal) |
| `message` | String | No | - | Error message |
| `error_code` | String | Yes | - | Application-specific error code |
| `stack_trace` | String | Yes | - | Full stack trace |
| `user_id` | String | Yes | - | User ID if error associated with user action |
| `request_id` | String | Yes | - | Request ID for tracing across systems |
| `correlation_id` | String | Yes | - | Correlation ID for distributed tracing |
| `source` | String | No | - | Error source (api, sync, cron, auth, etc.) |
| `metadata` | Json | Yes | - | Additional error context |
| `created_at` | DateTime | No | now() | Timestamp when log was created |

**Relationships:**
- None (user_id is reference only, not foreign key)

**Indexes:**
- Primary key: `id`
- Indexed: `timestamp DESC`, `level`, `user_id`, `request_id`, `correlation_id`, `source`

**Business Rules:**
- Level values: 'error', 'warn', 'fatal', 'critical'
- Source values: 'api', 'sync', 'cron', 'auth', 'analysis', 'export'
- Consider data retention (e.g., keep 90 days)
- Critical errors trigger alerts

---

### AuditLog

**Purpose:** Comprehensive audit trail for security and compliance

**Table Name:** `audit_logs`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | String | No | cuid() | Primary key, unique audit log identifier |
| `timestamp` | DateTime | No | now() | Timestamp when event occurred |
| `user_id` | String | Yes | - | User ID who performed action |
| `user_email` | String | Yes | - | User email (denormalized for audit) |
| `session_id` | String | Yes | - | Session identifier |
| `ip_address` | String | Yes | - | IP address of request |
| `user_agent` | String | Yes | - | Browser user agent |
| `event_type` | String | No | - | Type of event (see business rules) |
| `severity` | String | No | - | Event severity (low, medium, high, critical) |
| `resource` | String | Yes | - | Resource affected (e.g., 'chat:123', 'agent:456') |
| `action` | String | Yes | - | Action performed (create, read, update, delete, export) |
| `details` | Json | Yes | - | Event-specific details |
| `metadata` | Json | Yes | - | Additional context |
| `success` | Boolean | No | true | Whether action was successful |
| `error_message` | String | Yes | - | Error message if action failed |
| `request_id` | String | Yes | - | Request ID for tracing |
| `correlation_id` | String | Yes | - | Correlation ID for distributed tracing |
| `created_at` | DateTime | No | now() | Timestamp when log was created |

**Relationships:**
- None (user_id is reference only, not foreign key)

**Indexes:**
- Primary key: `id`
- Indexed: `timestamp DESC`, `user_id`, `event_type`, `severity`, `request_id`, `correlation_id`, `created_at DESC`

**Business Rules:**
- Event types:
  - Authentication: 'auth.login', 'auth.logout', 'auth.failed_login'
  - Data access: 'data.read', 'data.export', 'data.search'
  - Data modification: 'data.create', 'data.update', 'data.delete'
  - System: 'sync.start', 'sync.complete', 'settings.update'
  - Security: 'permission.denied', 'unauthorized.access'
- Severity values: 'low', 'medium', 'high', 'critical'
- Immutable logs (no updates after creation)
- Consider long-term retention (e.g., 7 years for compliance)

---

## Enumerations

### UserRole

**Values:**
- `Manager` - Read-only access to dashboards and reports
- `Admin` - Full access including system configuration

**Usage:** User.role

---

### ChatProvider

**Values:**
- `whatsapp` - WhatsApp Business API
- `facebook` - Facebook Messenger
- `telegram` - Telegram Bot API
- `livechat` - Live Chat widget
- `b2cbotapi` - B2Chat Bot API

**Usage:** Chat.provider

---

### ChatStatus

**Values:**
- `open` - Active conversation in progress
- `closed` - Conversation completed/resolved
- `pending` - Waiting for agent assignment or customer response

**Usage:** Chat.status

---

### ChatPriority

**Values:**
- `urgent` - Requires immediate attention
- `high` - High priority, address soon
- `normal` - Standard priority (default)
- `low` - Can be addressed when time permits

**Usage:** Chat.priority

---

### MessageType

**Values:**
- `text` - Text message
- `image` - Image/photo message
- `file` - Document/file attachment

**Usage:** Message.type

---

## Indexes

### Performance Indexes

**Critical for Query Performance:**

1. **Chat Response Time Queries:**
   - `chats(agent_id, created_at)` - Agent-filtered queries
   - `chats(agent_id, status, created_at)` - Agent + status filtering
   - `chats(department_id, created_at)` - Department-filtered queries
   - `chats(provider, created_at)` - Channel-filtered queries
   - `chats(status, priority, last_modified_at)` - Queue management

2. **Message Retrieval:**
   - `messages(chat_id, timestamp)` - Chronological message display
   - `messages(chat_id, type)` - Filter by message type
   - `messages(chat_id, incoming)` - Separate customer/agent messages

3. **Sync Operations:**
   - `chats(last_modified_at)` - Incremental sync
   - `sync_logs(entity_type)` - Sync history by type
   - `api_response_logs(sync_id)` - Debugging specific syncs

4. **Search and Filtering:**
   - `contacts(email)` - Email lookup
   - `contacts(mobile)` - Phone lookup
   - `agents(username)` - Agent search
   - `departments(path)` - Hierarchy queries

### Index Maintenance

- All timestamps indexed in descending order for recent-first queries
- Composite indexes cover common query patterns to avoid table scans
- Soft-delete flags indexed to exclude deleted records efficiently
- Foreign keys automatically indexed for join performance

---

## Relationships

### Entity Relationship Diagram

```
User (1) ─────< SyncLog (many)
User (1) ─────< SystemSetting (many)
User (1) ─────< Notification (many)
User (1) ─────< ExportLog (many)
User (1) ─────< EffectivenessAnalysis (many)

Department (self) ─< Department (children)
Department (1) ────< Agent (many)
Department (1) ────< Chat (many)

Agent (1) ─────< Chat (many)
Contact (1) ───< Chat (many)

Chat (1) ──────< Message (many) [CASCADE DELETE]
Chat (1) ──────< EffectivenessAnalysis (many)
```

### Cascade Behaviors

**CASCADE DELETE:**
- `Chat` deleted → All `Message` records deleted automatically

**NO ACTION (Preserve Data):**
- All other relationships preserve historical data
- Use soft deletion (is_deleted flag) for data integrity

---

## Data Retention Policies

### Recommended Retention

| Table | Retention Period | Rationale |
|-------|------------------|-----------|
| Chat, Message | Indefinite | Core business data |
| Contact, Agent | Indefinite | Customer/employee records |
| SyncLog | 90 days | Operational debugging |
| ApiResponseLog | 30 days | Debugging recent issues |
| ErrorLog | 90 days | Error trend analysis |
| AuditLog | 7 years | Compliance requirements |
| Notification | 30 days | User convenience |
| ExportLog | 90 days | Recent export history |
| EffectivenessAnalysis | Indefinite | Historical quality trends |

### Archival Strategy

1. **Hot Data** (Active database): Last 90 days of operational data
2. **Warm Data** (Compressed storage): 90 days - 2 years
3. **Cold Data** (Long-term archive): 2+ years, compliance data

---

## Data Size Estimates

### Growth Projections

**Assumptions:**
- 1,000 chats/day
- Average 20 messages per chat
- 5-year projection

| Table | Records/Day | Annual Growth | 5-Year Total |
|-------|-------------|---------------|--------------|
| Chat | 1,000 | 365,000 | 1.8M |
| Message | 20,000 | 7.3M | 36.5M |
| SyncLog | 10 | 3,650 | 18,250 |
| ErrorLog | 50 | 18,250 | 91,250 |
| AuditLog | 5,000 | 1.8M | 9M |

**Estimated Database Size (5 years):** 50-100 GB

---

## Migration History

### Schema Version: 1.0 (Current)

**Initial schema includes:**
- 15 core tables
- Soft deletion support
- Comprehensive indexing
- JSON fields for flexibility
- Audit and error logging

**Recent Additions (Comments in schema):**
- Chat: `alias`, `tags`, `priority`, `topic`, `unread_count`, `resolution_note`
- Contact: `phone_number` (separate from mobile)
- Message: Additional indexes for type and direction filtering
- Performance indexes: Composite indexes for common query patterns

---

## Data Access Patterns

### Common Queries

1. **Dashboard Metrics:**
```sql
-- Average response time by agent (last 30 days)
SELECT agent_id, AVG(EXTRACT(EPOCH FROM (response_at - created_at)))
FROM chats
WHERE created_at > NOW() - INTERVAL '30 days'
  AND response_at IS NOT NULL
GROUP BY agent_id;
```

2. **Chat History:**
```sql
-- Get chat with messages
SELECT c.*, m.*
FROM chats c
LEFT JOIN messages m ON c.id = m.chat_id
WHERE c.id = 'chat_id'
ORDER BY m.timestamp ASC;
```

3. **Sync Status:**
```sql
-- Latest sync status by entity
SELECT * FROM sync_states ORDER BY updated_at DESC;
```

---

## Security Considerations

### Sensitive Data

**PII (Personally Identifiable Information):**
- Contact: full_name, email, mobile, phone_number, identification, address
- User: email, name
- Message: text (may contain customer info)

**Data Protection Measures:**
- Database encryption at rest
- SSL/TLS for data in transit
- Role-based access control via Clerk
- Audit logging for all data access
- Soft deletion to prevent data loss

### Compliance

**GDPR/Privacy Considerations:**
- Right to access: Query Contact and Chat data by user ID
- Right to erasure: Soft delete + scheduled hard delete
- Right to portability: Export functionality in place
- Audit trail: Complete action history in AuditLog

---

## Appendix

### Database Connection

**Connection Pooling:**
- Prisma default: 10 connections
- Production recommended: 20-50 connections
- Use `POSTGRES_URL_NON_POOLING` for migrations

### Backup Strategy

**Recommended Schedule:**
- Full backup: Daily at 2 AM UTC
- Incremental backup: Every 6 hours
- Transaction log backup: Every hour
- Retention: 30 days local, 90 days remote

### Monitoring Queries

**Check Table Sizes:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Index Usage:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

**Document Version:** 1.0
**Last Updated:** October 2, 2025
**Next Review:** January 2026
**Maintained By:** Development Team
