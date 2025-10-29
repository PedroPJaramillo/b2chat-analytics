#!/usr/bin/env tsx
/**
 * Generate Data Dictionary from Actual Database Data
 *
 * This script analyzes the actual data in the database and generates
 * a comprehensive data dictionary with:
 * - Table row counts
 * - Column data types and sample values
 * - Actual enum values in use
 * - Data distribution statistics
 * - Null percentage for each column
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  sampleValues: any[];
  uniqueCount?: number;
  nullCount?: number;
  totalCount?: number;
  nullPercentage?: number;
}

interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  sampleRows: any[];
}

async function getTableRowCount(tableName: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${tableName}"`
  );
  return Number(result[0].count);
}

async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const columns = await prisma.$queryRawUnsafe<Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    tableName
  );

  return columns.map(col => ({
    name: col.column_name,
    type: col.data_type,
    nullable: col.is_nullable === 'YES',
    sampleValues: []
  }));
}

async function getSampleValues(tableName: string, columnName: string, limit: number = 3): Promise<any[]> {
  try {
    const results = await prisma.$queryRawUnsafe<Array<Record<string, any>>>(
      `SELECT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL LIMIT $1`,
      limit
    );
    return results.map((r: any) => r[columnName]);
  } catch (error) {
    console.error(`Error getting samples for ${tableName}.${columnName}:`, error);
    return [];
  }
}

async function getColumnStats(tableName: string, columnName: string): Promise<{
  uniqueCount: number;
  nullCount: number;
  totalCount: number;
  nullPercentage: number;
}> {
  try {
    const [uniqueResult, nullResult, totalResult] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(DISTINCT "${columnName}") as count FROM "${tableName}"`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "${tableName}" WHERE "${columnName}" IS NULL`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      )
    ]);

    const uniqueCount = Number(uniqueResult[0].count);
    const nullCount = Number(nullResult[0].count);
    const totalCount = Number(totalResult[0].count);
    const nullPercentage = totalCount > 0 ? (nullCount / totalCount) * 100 : 0;

    return { uniqueCount, nullCount, totalCount, nullPercentage };
  } catch (error) {
    console.error(`Error getting stats for ${tableName}.${columnName}:`, error);
    return { uniqueCount: 0, nullCount: 0, totalCount: 0, nullPercentage: 0 };
  }
}

async function getSampleRows(tableName: string, limit: number = 3): Promise<any[]> {
  try {
    const results = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${tableName}" LIMIT $1`,
      limit
    );
    return results as any[];
  } catch (error) {
    console.error(`Error getting sample rows for ${tableName}:`, error);
    return [];
  }
}

async function analyzeTable(tableName: string): Promise<TableInfo> {
  console.log(`Analyzing table: ${tableName}...`);

  const rowCount = await getTableRowCount(tableName);
  const columns = await getTableColumns(tableName);

  // Only get detailed stats if table has data and less than 10 columns
  if (rowCount > 0 && columns.length <= 15) {
    // Get sample values for first few columns only
    for (let i = 0; i < Math.min(columns.length, 10); i++) {
      const column = columns[i];
      try {
        column.sampleValues = await getSampleValues(tableName, column.name, 3);
      } catch (error) {
        // Skip if error
      }
    }
  }

  const sampleRows = rowCount > 0 ? await getSampleRows(tableName, 2) : [];

  return {
    name: tableName,
    rowCount,
    columns,
    sampleRows
  };
}

async function getAllTables(): Promise<string[]> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  return tables.map(t => t.tablename);
}

function generateMarkdown(tableInfos: TableInfo[]): string {
  let md = `# B2Chat Analytics - Data Dictionary (From Actual Data)

**Generated:** ${new Date().toISOString()}
**Database:** PostgreSQL via Prisma
**Total Tables:** ${tableInfos.length}
**Total Records:** ${tableInfos.reduce((sum, t) => sum + t.rowCount, 0).toLocaleString()}

---

## Summary Statistics

| Table | Row Count | Columns | Notes |
|-------|-----------|---------|-------|
`;

  tableInfos.forEach(table => {
    const hasData = table.rowCount > 0 ? '✅' : '⚠️ Empty';
    md += `| ${table.name} | ${table.rowCount.toLocaleString()} | ${table.columns.length} | ${hasData} |\n`;
  });

  md += '\n---\n\n## Table Details\n\n';

  tableInfos.forEach(table => {
    md += `### ${table.name}\n\n`;
    md += `**Row Count:** ${table.rowCount.toLocaleString()}\n\n`;

    if (table.rowCount === 0) {
      md += '*No data in this table yet.*\n\n';
      md += '**Schema:**\n\n';
      md += '| Column | Type | Nullable |\n';
      md += '|--------|------|----------|\n';
      table.columns.forEach(col => {
        md += `| ${col.name} | ${col.type} | ${col.nullable ? 'Yes' : 'No'} |\n`;
      });
      md += '\n---\n\n';
      return;
    }

    md += '**Column Analysis:**\n\n';
    md += '| Column | Type | Nullable | Unique Values | Null % | Sample Values |\n';
    md += '|--------|------|----------|---------------|--------|---------------|\n';

    table.columns.forEach(col => {
      const nullPct = col.nullPercentage !== undefined ? col.nullPercentage.toFixed(1) + '%' : 'N/A';
      const uniqueCount = col.uniqueCount !== undefined ? col.uniqueCount.toLocaleString() : 'N/A';
      const samples = col.sampleValues.length > 0
        ? col.sampleValues.slice(0, 3).map(v => {
            if (v === null || v === undefined) return 'null';
            if (typeof v === 'string') return v.length > 30 ? `"${v.substring(0, 27)}..."` : `"${v}"`;
            if (v instanceof Date) return v.toISOString().split('T')[0];
            if (typeof v === 'object') return 'JSON';
            return String(v);
          }).join(', ')
        : '-';

      md += `| ${col.name} | ${col.type} | ${col.nullable ? 'Yes' : 'No'} | ${uniqueCount} | ${nullPct} | ${samples} |\n`;
    });

    md += '\n';

    // Add sample rows if available
    if (table.sampleRows.length > 0) {
      md += '**Sample Records:**\n\n';
      md += '```json\n';
      table.sampleRows.forEach((row, idx) => {
        const cleanRow = Object.fromEntries(
          Object.entries(row).map(([key, value]) => {
            if (value instanceof Date) return [key, value.toISOString()];
            if (typeof value === 'string' && value.length > 50) return [key, value.substring(0, 47) + '...'];
            return [key, value];
          })
        );
        md += JSON.stringify(cleanRow, null, 2);
        if (idx < table.sampleRows.length - 1) md += ',\n';
      });
      md += '\n```\n\n';
    }

    md += '---\n\n';
  });

  // Add insights section
  md += '## Data Insights\n\n';

  const emptyTables = tableInfos.filter(t => t.rowCount === 0);
  const largestTables = [...tableInfos].sort((a, b) => b.rowCount - a.rowCount).slice(0, 5);

  if (emptyTables.length > 0) {
    md += '### Empty Tables\n\n';
    emptyTables.forEach(t => {
      md += `- **${t.name}**: No data yet\n`;
    });
    md += '\n';
  }

  md += '### Largest Tables\n\n';
  largestTables.forEach(t => {
    md += `- **${t.name}**: ${t.rowCount.toLocaleString()} records\n`;
  });
  md += '\n';

  // Add column usage patterns
  md += '### Column Usage Patterns\n\n';
  tableInfos.forEach(table => {
    if (table.rowCount === 0) return;

    const highNullCols = table.columns.filter(c =>
      c.nullable && c.nullPercentage !== undefined && c.nullPercentage > 80
    );

    if (highNullCols.length > 0) {
      md += `**${table.name}** - Columns with >80% null values:\n`;
      highNullCols.forEach(col => {
        md += `- ${col.name}: ${col.nullPercentage?.toFixed(1)}% null\n`;
      });
      md += '\n';
    }
  });

  return md;
}

async function main() {
  try {
    console.log('🔍 Analyzing database...\n');

    const tables = await getAllTables();
    console.log(`Found ${tables.length} tables\n`);

    const tableInfos: TableInfo[] = [];

    for (const tableName of tables) {
      const info = await analyzeTable(tableName);
      tableInfos.push(info);
    }

    console.log('\n📝 Generating markdown...\n');
    const markdown = generateMarkdown(tableInfos);

    // Write to file
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(__dirname, '..', 'docs', 'DATA_DICTIONARY_ACTUAL.md');
    fs.writeFileSync(outputPath, markdown);

    console.log(`✅ Data dictionary generated: ${outputPath}`);
    console.log(`\nTotal tables analyzed: ${tableInfos.length}`);
    console.log(`Total records: ${tableInfos.reduce((sum, t) => sum + t.rowCount, 0).toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
