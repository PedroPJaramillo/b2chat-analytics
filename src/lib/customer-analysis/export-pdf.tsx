/**
 * PDF Export Generation using @react-pdf/renderer
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  coverPage: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 10,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#2563eb',
    borderBottom: '2 solid #2563eb',
    paddingBottom: 4,
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 8,
    color: '#374151',
  },
  text: {
    fontSize: 11,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    marginTop: 8,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '2 solid #374151',
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
  },
  tableCell: {
    fontSize: 10,
    padding: 4,
  },
  tableCellHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    padding: 4,
  },
  col1: { width: '40%' },
  col2: { width: '30%' },
  col3: { width: '30%' },
  metric: {
    marginBottom: 6,
    paddingLeft: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#6b7280',
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10,
  },
})

const toNumberEntries = <T extends Record<string, number>>(record: T) =>
  Object.entries(record) as Array<[keyof T & string, number]>

// Helper functions
function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Cover Page Component
const CoverPage: React.FC<{ data: AnalysisResultsResponse; generatedAt: Date }> = ({
  data,
  generatedAt,
}) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.coverPage}>
      <Text style={styles.title}>Customer Analysis Report</Text>
      <Text style={styles.subtitle}>
        Analysis Period: {formatDate(data.summary.dateRange.start)} -{' '}
        {formatDate(data.summary.dateRange.end)}
      </Text>
      <Text style={styles.subtitle}>
        Generated: {generatedAt.toLocaleDateString('en-US')}
      </Text>
      <Text style={[styles.subtitle, { marginTop: 40 }]}>
        Total Chats Analyzed: {data.summary.totalChatsAnalyzed.toLocaleString()}
      </Text>
      <Text style={styles.subtitle}>
        Total Messages: {data.summary.totalMessagesAnalyzed.toLocaleString()}
      </Text>
    </View>
    <View style={styles.footer}>
      <Text>B2Chat Analytics - Customer Service Analysis Dashboard</Text>
    </View>
  </Page>
)

// Executive Summary Component
const ExecutiveSummary: React.FC<{ data: AnalysisResultsResponse }> = ({ data }) => {
  const [topIntentCategory, topIntentPercentage] = toNumberEntries(
    data.customerInsights.intentDistribution
  ).sort(([, a], [, b]) => b - a)[0] ?? ['N/A', 0]
  const [topSentimentCategory, topSentimentPercentage] = toNumberEntries(
    data.customerInsights.sentimentDistribution
  ).sort(([, a], [, b]) => b - a)[0] ?? ['N/A', 0]
  const [topJourneyStage, topJourneyPercentage] = toNumberEntries(
    data.customerInsights.journeyStageDistribution
  ).sort(([, a], [, b]) => b - a)[0] ?? ['N/A', 0]

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Executive Summary</Text>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Analysis Overview</Text>
        <Text style={styles.text}>
          This report analyzes {data.summary.totalChatsAnalyzed.toLocaleString()} customer
          conversations containing {data.summary.totalMessagesAnalyzed.toLocaleString()}{' '}
          messages from {formatDate(data.summary.dateRange.start)} to{' '}
          {formatDate(data.summary.dateRange.end)}.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Key Findings</Text>
        <Text style={styles.text}>
          • <Text style={styles.label}>Primary Customer Intent:</Text> {topIntentCategory} (
          {formatPercentage(topIntentPercentage)})
        </Text>
        <Text style={styles.text}>
          • <Text style={styles.label}>Dominant Journey Stage:</Text> {topJourneyStage} (
          {formatPercentage(topJourneyPercentage)})
        </Text>
        <Text style={styles.text}>
          • <Text style={styles.label}>Overall Sentiment:</Text> {topSentimentCategory} (
          {formatPercentage(topSentimentPercentage)})
        </Text>
        {data.agentPerformance.topPerformers.length > 0 && (
          <Text style={styles.text}>
            • <Text style={styles.label}>Top Performer:</Text>{' '}
            {data.agentPerformance.topPerformers[0].agentName} (
            {data.agentPerformance.topPerformers[0].metric.replace(/_/g, ' ')})
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text>Page 2</Text>
      </View>
    </Page>
  )
}

// Customer Insights Component
const CustomerInsightsSection: React.FC<{ data: AnalysisResultsResponse }> = ({ data }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.sectionTitle}>Customer Insights</Text>

    <View style={styles.section}>
      <Text style={styles.subsectionTitle}>Customer Intent Distribution</Text>
      {toNumberEntries(data.customerInsights.intentDistribution).map(([intent, percentage]) => (
        <Text key={intent} style={styles.metric}>
          {intent.replace(/_/g, ' ')}: {formatPercentage(percentage)}
        </Text>
      ))}
    </View>

    <View style={styles.section}>
      <Text style={styles.subsectionTitle}>Customer Journey Stage</Text>
      {toNumberEntries(data.customerInsights.journeyStageDistribution).map(([stage, percentage]) => (
        <Text key={stage} style={styles.metric}>
          {stage.replace(/_/g, ' ')}: {formatPercentage(percentage)}
        </Text>
      ))}
    </View>

    <View style={styles.section}>
      <Text style={styles.subsectionTitle}>Sentiment Analysis</Text>
      {toNumberEntries(data.customerInsights.sentimentDistribution).map(
        ([sentiment, percentage]) => (
          <Text key={sentiment} style={styles.metric}>
            {sentiment}: {formatPercentage(percentage)}
          </Text>
        )
      )}
    </View>

    <View style={styles.footer}>
      <Text>Page 3</Text>
    </View>
  </Page>
)

// Agent Performance Component
const AgentPerformanceSection: React.FC<{ data: AnalysisResultsResponse }> = ({ data }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.sectionTitle}>Agent Performance</Text>

    {data.agentPerformance.byAgent.length > 0 ? (
      <>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, styles.col1]}>Agent Name</Text>
            <Text style={[styles.tableCellHeader, styles.col2]}>Chats</Text>
            <Text style={[styles.tableCellHeader, styles.col3]}>Avg Response</Text>
          </View>
          {data.agentPerformance.byAgent.slice(0, 15).map((agent) => (
            <View key={agent.agentId} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.col1]}>{agent.agentName}</Text>
              <Text style={[styles.tableCell, styles.col2]}>{agent.metrics.totalChats}</Text>
              <Text style={[styles.tableCell, styles.col3]}>
                {formatTime(agent.metrics.firstResponseTime.average)}
              </Text>
            </View>
          ))}
        </View>

        {data.agentPerformance.topPerformers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>Top Performers</Text>
            {data.agentPerformance.topPerformers.map((performer) => (
              <Text key={`${performer.agentId}-${performer.metric}`} style={styles.metric}>
                {performer.agentName} - {performer.metric.replace(/_/g, ' ')}:{' '}
                {performer.metric.includes('time')
                  ? formatTime(performer.value)
                  : performer.value.toLocaleString()}
              </Text>
            ))}
          </View>
        )}
      </>
    ) : (
      <Text style={styles.text}>No agent performance data available.</Text>
    )}

    <View style={styles.footer}>
      <Text>Page 4</Text>
    </View>
  </Page>
)

// Operational Insights Component
const OperationalInsightsSection: React.FC<{ data: AnalysisResultsResponse }> = ({ data }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.sectionTitle}>Operational Insights</Text>

    <View style={styles.section}>
      <Text style={styles.subsectionTitle}>Peak Hours (Top 5)</Text>
      {Object.entries(data.operationalInsights.peakTimes.byHour)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([hour, count]) => (
          <Text key={hour} style={styles.metric}>
            {hour}:00 - {parseInt(hour) + 1}:00: {count} messages
          </Text>
        ))}
    </View>

    <View style={styles.section}>
      <Text style={styles.subsectionTitle}>Peak Days</Text>
      {Object.entries(data.operationalInsights.peakTimes.byDayOfWeek)
        .sort(([, a], [, b]) => b - a)
        .map(([day, count]) => (
          <Text key={day} style={styles.metric}>
            {day}: {count} messages
          </Text>
        ))}
    </View>

    <View style={styles.section}>
      <Text style={styles.subsectionTitle}>Channel Distribution</Text>
      <Text style={styles.metric}>
        Text Messages: {data.operationalInsights.channelDistribution.text}
      </Text>
      <Text style={styles.metric}>
        Voice Messages: {data.operationalInsights.channelDistribution.voice}
      </Text>
      <Text style={styles.metric}>
        Media Messages: {data.operationalInsights.channelDistribution.media}
      </Text>
    </View>

    {data.operationalInsights.commonPainPoints.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Common Pain Points</Text>
        {data.operationalInsights.commonPainPoints.slice(0, 5).map((painPoint, index) => (
          <View key={index} style={{ marginBottom: 8 }}>
            <Text style={styles.text}>
              <Text style={styles.label}>{painPoint.category}:</Text> {painPoint.description}
            </Text>
            <Text style={[styles.text, { fontSize: 9, color: '#6b7280' }]}>
              Frequency: {painPoint.frequency} occurrences
            </Text>
          </View>
        ))}
      </View>
    )}

    <View style={styles.footer}>
      <Text>Page 5</Text>
    </View>
  </Page>
)

// Main Document Component
const AnalysisReportDocument: React.FC<{
  data: AnalysisResultsResponse
  generatedAt: Date
}> = ({ data, generatedAt }) => (
  <Document
    title="Customer Analysis Report"
    author="B2Chat Analytics"
    subject={`Analysis Report ${data.analysisId}`}
    creator="B2Chat Customer Analysis Dashboard"
  >
    <CoverPage data={data} generatedAt={generatedAt} />
    <ExecutiveSummary data={data} />
    <CustomerInsightsSection data={data} />
    <AgentPerformanceSection data={data} />
    <OperationalInsightsSection data={data} />
  </Document>
)

// Export function to generate PDF buffer
export async function generatePDF(data: AnalysisResultsResponse): Promise<Buffer> {
  const generatedAt = new Date()
  const doc = <AnalysisReportDocument data={data} generatedAt={generatedAt} />
  const asPdf = pdf(doc)
  const stream = await asPdf.toBuffer()

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = []

    stream.on('data', (chunk: Buffer) => {
      chunks.push(Uint8Array.from(chunk))
    })

    stream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    stream.on('error', (error) => {
      reject(error)
    })
  })
}

// Export filename generator
export function generatePDFFilename(analysisId: string): string {
  const timestamp = new Date().toISOString().split('T')[0]
  return `customer-analysis-${timestamp}-${analysisId.substring(0, 8)}.pdf`
}
