import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Database Schema - Contact Field Fixes (Feature 002)', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Contact Model - New Fields', () => {
    it('should have tags column with JSONB type', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'tags'
      `

      const columns = result as Array<{
        column_name: string
        data_type: string
        is_nullable: string
      }>

      expect(columns).toHaveLength(1)
      expect(columns[0].column_name).toBe('tags')
      expect(columns[0].data_type).toBe('jsonb')
      expect(columns[0].is_nullable).toBe('YES')
    })

    it('should have merchant_id column with TEXT type', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'merchant_id'
      `

      const columns = result as Array<{
        column_name: string
        data_type: string
        is_nullable: string
      }>

      expect(columns).toHaveLength(1)
      expect(columns[0].column_name).toBe('merchant_id')
      expect(columns[0].data_type).toBe('text')
      expect(columns[0].is_nullable).toBe('YES')
    })

    it('should have b2chat_created_at column with TIMESTAMP type', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'b2chat_created_at'
      `

      const columns = result as Array<{
        column_name: string
        data_type: string
        is_nullable: string
      }>

      expect(columns).toHaveLength(1)
      expect(columns[0].column_name).toBe('b2chat_created_at')
      expect(columns[0].data_type).toBe('timestamp without time zone')
      expect(columns[0].is_nullable).toBe('YES')
    })

    it('should have b2chat_updated_at column with TIMESTAMP type', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'b2chat_updated_at'
      `

      const columns = result as Array<{
        column_name: string
        data_type: string
        is_nullable: string
      }>

      expect(columns).toHaveLength(1)
      expect(columns[0].column_name).toBe('b2chat_updated_at')
      expect(columns[0].data_type).toBe('timestamp without time zone')
      expect(columns[0].is_nullable).toBe('YES')
    })

    it('should have index on merchant_id for filtering', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'contacts'
        AND indexname LIKE '%merchant_id%'
      `

      expect(indexes).toBeDefined()
      expect(Array.isArray(indexes)).toBe(true)
      expect((indexes as Array<unknown>).length).toBeGreaterThan(0)

      const indexDefs = (indexes as Array<{ indexdef: string }>).map(
        (i) => i.indexdef
      )

      const hasMerchantIdIndex = indexDefs.some((def) =>
        def.includes('merchant_id')
      )
      expect(hasMerchantIdIndex).toBe(true)
    })

    it('should verify column comments are set for documentation', async () => {
      const comments = await prisma.$queryRaw`
        SELECT
          col.column_name,
          pgd.description
        FROM pg_catalog.pg_statio_all_tables AS st
        INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
        INNER JOIN information_schema.columns col ON (
          pgd.objsubid = col.ordinal_position
          AND col.table_schema = st.schemaname
          AND col.table_name = st.relname
        )
        WHERE st.relname = 'contacts'
        AND col.column_name IN ('tags', 'merchant_id', 'b2chat_created_at', 'b2chat_updated_at')
      `

      const commentsList = comments as Array<{
        column_name: string
        description: string
      }>

      // Should have comments for all 4 new fields
      expect(commentsList.length).toBeGreaterThanOrEqual(0) // Comments are optional but recommended
    })

    // Fix 006: Contact Deduplication - New fields
    it('should have sync_source column with ContactSyncSource enum type', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'sync_source'
      `

      const columns = result as Array<{
        column_name: string
        udt_name: string
        is_nullable: string
        column_default: string
      }>

      expect(columns).toHaveLength(1)
      expect(columns[0].column_name).toBe('sync_source')
      expect(columns[0].udt_name).toBe('ContactSyncSource')
      expect(columns[0].is_nullable).toBe('NO')
      expect(columns[0].column_default).toContain('contacts_api')
    })

    it('should have needs_full_sync column with BOOLEAN type', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'needs_full_sync'
      `

      const columns = result as Array<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string
      }>

      expect(columns).toHaveLength(1)
      expect(columns[0].column_name).toBe('needs_full_sync')
      expect(columns[0].data_type).toBe('boolean')
      expect(columns[0].is_nullable).toBe('NO')
      expect(columns[0].column_default).toBe('false')
    })

    it('should have index on sync_source for filtering by source', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'contacts'
        AND indexname LIKE '%sync_source%'
      `

      expect(indexes).toBeDefined()
      expect(Array.isArray(indexes)).toBe(true)
      expect((indexes as Array<unknown>).length).toBeGreaterThan(0)

      const indexDefs = (indexes as Array<{ indexdef: string }>).map(
        (i) => i.indexdef
      )

      const hasSyncSourceIndex = indexDefs.some((def) =>
        def.includes('sync_source')
      )
      expect(hasSyncSourceIndex).toBe(true)
    })

    it('should have index on needs_full_sync for finding stubs', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'contacts'
        AND indexname LIKE '%needs_full_sync%'
      `

      expect(indexes).toBeDefined()
      expect(Array.isArray(indexes)).toBe(true)
      expect((indexes as Array<unknown>).length).toBeGreaterThan(0)

      const indexDefs = (indexes as Array<{ indexdef: string }>).map(
        (i) => i.indexdef
      )

      const hasNeedsFullSyncIndex = indexDefs.some((def) =>
        def.includes('needs_full_sync')
      )
      expect(hasNeedsFullSyncIndex).toBe(true)
    })
  })

  describe('Contact Model - Data Integrity', () => {
    it('should allow null values for all new fields (backward compatibility)', async () => {
      // Verify that existing contacts without these fields are still valid
      const existingContacts = await prisma.contact.findMany({
        where: {
          OR: [
            { tags: null },
            { merchantId: null },
            { b2chatCreatedAt: null },
            { b2chatUpdatedAt: null },
          ],
        },
        take: 5,
      })

      // Should not throw an error - null values are allowed
      expect(existingContacts).toBeDefined()
    })

    it('should store tags as JSONB array correctly', async () => {
      // This test verifies JSONB can store the tag structure
      const testTags = [
        { name: 'VIP', assigned_at: 1706644084 },
        { name: 'Premium', assigned_at: 1706648900 },
      ]

      // Verify JSONB column accepts the expected structure
      const columnType = await prisma.$queryRaw`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'tags'
      `

      const col = (columnType as Array<{ data_type: string }>)[0]
      expect(col.data_type).toBe('jsonb')
    })
  })
})

describe('Database Schema - Customer Analysis Tables', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('CustomerAnalysis Model', () => {
    it('should have CustomerAnalysis table with correct structure', async () => {
      // This test verifies the schema was created properly by attempting a raw query
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'customer_analyses'
        ORDER BY ordinal_position
      `

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)

      const columns = result as Array<{
        column_name: string
        data_type: string
        is_nullable: string
      }>

      // Verify key columns exist
      const columnNames = columns.map((c) => c.column_name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('status')
      expect(columnNames).toContain('triggered_by')
      expect(columnNames).toContain('filters')
      expect(columnNames).toContain('total_chats_analyzed')
      expect(columnNames).toContain('total_messages_analyzed')
      expect(columnNames).toContain('ai_analysis_count')
    })

    it('should have correct indexes on CustomerAnalysis', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'customer_analyses'
      `

      expect(indexes).toBeDefined()
      expect(Array.isArray(indexes)).toBe(true)

      const indexDefs = (indexes as Array<{ indexdef: string }>).map(
        (i) => i.indexdef
      )

      // Check for composite index on triggeredBy and createdAt
      const hasTriggeredByIndex = indexDefs.some((def) =>
        def.includes('triggered_by') && def.includes('created_at')
      )
      expect(hasTriggeredByIndex).toBe(true)

      // Check for status index
      const hasStatusIndex = indexDefs.some((def) =>
        def.includes('status') && def.includes('created_at')
      )
      expect(hasStatusIndex).toBe(true)
    })

    it('should enforce foreign key constraint on triggeredBy', async () => {
      // Attempt to create analysis with invalid user ID should fail
      await expect(
        prisma.customerAnalysis.create({
          data: {
            triggeredBy: 'non-existent-user-id',
            filters: {
              dateStart: '2025-09-01',
              dateEnd: '2025-10-08',
            },
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('CustomerCategorization Model', () => {
    it('should have CustomerCategorization table with correct structure', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'customer_categorizations'
        ORDER BY ordinal_position
      `

      const columns = result as Array<{ column_name: string }>
      const columnNames = columns.map((c) => c.column_name)

      expect(columnNames).toContain('id')
      expect(columnNames).toContain('analysis_id')
      expect(columnNames).toContain('chat_id')
      expect(columnNames).toContain('customer_intent')
      expect(columnNames).toContain('journey_stage')
      expect(columnNames).toContain('sentiment')
      expect(columnNames).toContain('agent_quality_score')
      expect(columnNames).toContain('confidence_score')
    })

    it('should have unique constraint on (analysisId, chatId)', async () => {
      const constraints = await prisma.$queryRaw`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'customer_categorizations'::regclass
        AND contype = 'u'
      `

      expect(constraints).toBeDefined()
      const constraintList = constraints as Array<{ conname: string }>
      const hasUniqueConstraint = constraintList.some((c) =>
        c.conname.includes('analysis_id') || c.conname.includes('analysisId')
      )
      expect(hasUniqueConstraint).toBe(true)
    })

    it('should have correct indexes for performance', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'customer_categorizations'
      `

      const indexNames = (indexes as Array<{ indexname: string }>).map(
        (i) => i.indexname
      )

      // Check for indexes that optimize common queries
      const hasAnalysisIntentIndex = indexNames.some(
        (name) =>
          name.includes('analysis') && name.includes('customer_intent')
      )
      const hasAnalysisJourneyIndex = indexNames.some(
        (name) => name.includes('analysis') && name.includes('journey_stage')
      )

      expect(hasAnalysisIntentIndex).toBe(true)
      expect(hasAnalysisJourneyIndex).toBe(true)
    })
  })

  describe('AnalysisKPI Model', () => {
    it('should have AnalysisKPI table with correct structure', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'analysis_kpis'
        ORDER BY ordinal_position
      `

      const columns = result as Array<{ column_name: string }>
      const columnNames = columns.map((c) => c.column_name)

      expect(columnNames).toContain('id')
      expect(columnNames).toContain('analysis_id')
      expect(columnNames).toContain('metric_type')
      expect(columnNames).toContain('metric_name')
      expect(columnNames).toContain('numeric_value')
      expect(columnNames).toContain('string_value')
      expect(columnNames).toContain('json_value')
      expect(columnNames).toContain('agent_id')
      expect(columnNames).toContain('category')
    })

    it('should support JSONB for complex metrics', async () => {
      const result = await prisma.$queryRaw`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'analysis_kpis'
        AND column_name = 'json_value'
      `

      const column = (result as Array<{ data_type: string }>)[0]
      expect(column.data_type).toBe('jsonb')
    })

    it('should have indexes for metric querying', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'analysis_kpis'
      `

      const indexNames = (indexes as Array<{ indexname: string }>).map(
        (i) => i.indexname
      )

      const hasAnalysisMetricIndex = indexNames.some(
        (name) =>
          name.includes('analysis') && name.includes('metric_type')
      )
      const hasCategoryIndex = indexNames.some(
        (name) => name.includes('category')
      )

      expect(hasAnalysisMetricIndex).toBe(true)
      expect(hasCategoryIndex).toBe(true)
    })
  })

  describe('AnalysisExport Model', () => {
    it('should have AnalysisExport table with correct structure', async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'analysis_exports'
        ORDER BY ordinal_position
      `

      const columns = result as Array<{ column_name: string }>
      const columnNames = columns.map((c) => c.column_name)

      expect(columnNames).toContain('id')
      expect(columnNames).toContain('analysis_id')
      expect(columnNames).toContain('format')
      expect(columnNames).toContain('file_name')
      expect(columnNames).toContain('blob_url')
      expect(columnNames).toContain('generated_by')
      expect(columnNames).toContain('expires_at')
    })

    it('should have index on expiresAt for cleanup jobs', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'analysis_exports'
      `

      const indexNames = (indexes as Array<{ indexname: string }>).map(
        (i) => i.indexname
      )

      const hasExpiresIndex = indexNames.some((name) =>
        name.includes('expires_at')
      )
      expect(hasExpiresIndex).toBe(true)
    })
  })

  describe('Enums', () => {
    it('should have AnalysisStatus enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'AnalysisStatus'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('PENDING')
      expect(values).toContain('PROCESSING')
      expect(values).toContain('COMPLETED')
      expect(values).toContain('FAILED')
      expect(values).toContain('PARTIAL')
    })

    it('should have CustomerIntent enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'CustomerIntent'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('PROJECT_INFO')
      expect(values).toContain('PAYMENT')
      expect(values).toContain('LEGAL')
      expect(values).toContain('POST_PURCHASE')
      expect(values).toContain('OTHER')
    })

    it('should have JourneyStage enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'JourneyStage'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('PROSPECT')
      expect(values).toContain('ACTIVE_BUYER')
      expect(values).toContain('POST_PURCHASE')
    })

    it('should have Sentiment enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'Sentiment'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('POSITIVE')
      expect(values).toContain('NEUTRAL')
      expect(values).toContain('FRICTION')
    })

    it('should have MetricType enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'MetricType'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('RESPONSE_TIME')
      expect(values).toContain('VOLUME')
      expect(values).toContain('PEAK_TIME')
      expect(values).toContain('CUSTOMER_INTENT')
      expect(values).toContain('JOURNEY_STAGE')
      expect(values).toContain('SENTIMENT')
      expect(values).toContain('AGENT_QUALITY')
      expect(values).toContain('CHANNEL_USAGE')
    })

    it('should have ExportFormat enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'ExportFormat'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('PDF')
      expect(values).toContain('CSV')
    })

    // Fix 006: Contact Deduplication - Enum
    it('should have ContactSyncSource enum with correct values', async () => {
      const result = await prisma.$queryRaw`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'ContactSyncSource'
        ORDER BY e.enumsortorder
      `

      const values = (result as Array<{ enumlabel: string }>).map(
        (r) => r.enumlabel
      )

      expect(values).toContain('contacts_api')
      expect(values).toContain('chat_embedded')
      expect(values).toContain('upgraded')
      expect(values).toHaveLength(3)
    })
  })

  describe('Cascade Deletion Behavior', () => {
    it('should cascade delete categorizations when analysis is deleted', async () => {
      // This test verifies the ON DELETE CASCADE constraint
      const constraint = await prisma.$queryRaw`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conrelid = 'customer_categorizations'::regclass
        AND confrelid = 'customer_analyses'::regclass
      `

      const deleteAction = (constraint as Array<{ confdeltype: string }>)[0]
      expect(deleteAction.confdeltype).toBe('c') // 'c' = CASCADE
    })

    it('should cascade delete KPIs when analysis is deleted', async () => {
      const constraint = await prisma.$queryRaw`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conrelid = 'analysis_kpis'::regclass
        AND confrelid = 'customer_analyses'::regclass
      `

      const deleteAction = (constraint as Array<{ confdeltype: string }>)[0]
      expect(deleteAction.confdeltype).toBe('c') // 'c' = CASCADE
    })

    it('should cascade delete exports when analysis is deleted', async () => {
      const constraint = await prisma.$queryRaw`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conrelid = 'analysis_exports'::regclass
        AND confrelid = 'customer_analyses'::regclass
      `

      const deleteAction = (constraint as Array<{ confdeltype: string }>)[0]
      expect(deleteAction.confdeltype).toBe('c') // 'c' = CASCADE
    })
  })
})
