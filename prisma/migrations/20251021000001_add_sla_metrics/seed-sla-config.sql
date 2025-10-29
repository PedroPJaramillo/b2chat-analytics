-- Seed SLA Target configurations (in seconds)
INSERT INTO "system_settings" (id, key, value, category, description, is_system_setting, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'sla.pickup_target', '120', 'sla', 'SLA target for pickup time in seconds (default: 2 minutes)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.first_response_target', '300', 'sla', 'SLA target for first response time in seconds (default: 5 minutes)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.avg_response_target', '300', 'sla', 'SLA target for average response time in seconds (default: 5 minutes)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.resolution_target', '7200', 'sla', 'SLA target for resolution time in seconds (default: 2 hours)', true, NOW(), NOW()),
  (gen_random_uuid(), 'sla.compliance_target', '95', 'sla', 'Overall SLA compliance target percentage (default: 95%)', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Seed Office hours configuration
INSERT INTO "system_settings" (id, key, value, category, description, is_system_setting, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'office_hours.start', '09:00', 'office_hours', 'Office hours start time (HH:mm format, 24-hour)', true, NOW(), NOW()),
  (gen_random_uuid(), 'office_hours.end', '17:00', 'office_hours', 'Office hours end time (HH:mm format, 24-hour)', true, NOW(), NOW()),
  (gen_random_uuid(), 'office_hours.working_days', '[1,2,3,4,5]', 'office_hours', 'Working days (1=Monday, 7=Sunday)', true, NOW(), NOW()),
  (gen_random_uuid(), 'office_hours.timezone', 'America/New_York', 'office_hours', 'Timezone for office hours', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
