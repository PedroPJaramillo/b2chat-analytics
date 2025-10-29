/**
 * CSV Export Generation with flat metric structure
 */

import type { AnalysisResultsResponse } from '@/types/customer-analysis'

// Helper function to escape CSV values
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''

  const strValue = String(value)

  // Escape if contains comma, quote, or newline
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`
  }

  return strValue
}

// Helper function to format CSV row
function formatCSVRow(row: (string | number | null | undefined)[]): string {
  return row.map(escapeCSVValue).join(',')
}

// Helper function to format milliseconds to seconds
function msToSeconds(ms: number): number {
  return Math.round(ms / 1000)
}

// Helper function to format percentage
function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Generate CSV string from analysis data
 * Uses a flat structure with Section, Metric, Value columns
 */
export function generateCSV(data: AnalysisResultsResponse): string {
  const rows: string[][] = []

  // Header row
  rows.push(['Section', 'Metric', 'Value', 'Unit'])

  // Summary section
  rows.push(['Summary', 'Analysis ID', data.analysisId, ''])
  rows.push(['Summary', 'Status', data.status, ''])
  rows.push([
    'Summary',
    'Total Chats Analyzed',
    data.summary.totalChatsAnalyzed.toString(),
    'chats',
  ])
  rows.push([
    'Summary',
    'Total Messages Analyzed',
    data.summary.totalMessagesAnalyzed.toString(),
    'messages',
  ])
  rows.push([
    'Summary',
    'AI Analysis Count',
    data.summary.aiAnalysisCount.toString(),
    'categorizations',
  ])
  rows.push(['Summary', 'Date Range Start', data.summary.dateRange.start, ''])
  rows.push(['Summary', 'Date Range End', data.summary.dateRange.end, ''])

  // Empty separator row
  rows.push(['', '', '', ''])

  // Customer Intent Distribution
  rows.push(['Customer Intent', 'Category', 'Percentage', ''])
  Object.entries(data.customerInsights.intentDistribution).forEach(([intent, percentage]) => {
    rows.push(['Customer Intent', intent, formatPercentage(percentage), '%'])
  })

  // Empty separator row
  rows.push(['', '', '', ''])

  // Journey Stage Distribution
  rows.push(['Journey Stage', 'Stage', 'Percentage', ''])
  Object.entries(data.customerInsights.journeyStageDistribution).forEach(([stage, percentage]) => {
    rows.push(['Journey Stage', stage, formatPercentage(percentage), '%'])
  })

  // Empty separator row
  rows.push(['', '', '', ''])

  // Sentiment Distribution
  rows.push(['Sentiment', 'Type', 'Percentage', ''])
  Object.entries(data.customerInsights.sentimentDistribution).forEach(
    ([sentiment, percentage]) => {
      rows.push(['Sentiment', sentiment, formatPercentage(percentage), '%'])
    }
  )

  // Empty separator row
  rows.push(['', '', '', ''])

  // Agent Performance
  if (data.agentPerformance.byAgent.length > 0) {
    rows.push(['Agent Performance', 'Agent Name', 'Metric', 'Value'])

    data.agentPerformance.byAgent.forEach((agent) => {
      rows.push(['Agent Performance', agent.agentName, 'Agent ID', agent.agentId])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'Total Chats',
        agent.metrics.totalChats.toString(),
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'Total Messages',
        agent.metrics.totalMessages.toString(),
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'First Response Time (avg)',
        `${msToSeconds(agent.metrics.firstResponseTime.average)} seconds`,
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'First Response Time (p50)',
        `${msToSeconds(agent.metrics.firstResponseTime.p50)} seconds`,
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'First Response Time (p90)',
        `${msToSeconds(agent.metrics.firstResponseTime.p90)} seconds`,
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'First Response Time (p95)',
        `${msToSeconds(agent.metrics.firstResponseTime.p95)} seconds`,
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'Average Handling Time',
        `${msToSeconds(agent.metrics.averageHandlingTime)} seconds`,
      ])
      rows.push([
        'Agent Performance',
        agent.agentName,
        'Quality Score (avg)',
        agent.metrics.qualityScore.average.toFixed(1),
      ])

      // Quality score distribution
      Object.entries(agent.metrics.qualityScore.distribution).forEach(([score, count]) => {
        rows.push([
          'Agent Performance',
          agent.agentName,
          `Quality Score ${score}`,
          `${count} chats`,
        ])
      })

      // Empty separator row between agents
      rows.push(['', '', '', ''])
    })
  }

  // Top Performers
  if (data.agentPerformance.topPerformers.length > 0) {
    rows.push(['Top Performers', 'Agent Name', 'Metric', 'Value'])

    data.agentPerformance.topPerformers.forEach((performer) => {
      const formattedValue = performer.metric.includes('time')
        ? `${msToSeconds(performer.value)} seconds`
        : performer.value.toString()

      rows.push([
        'Top Performers',
        performer.agentName,
        performer.metric.replace(/_/g, ' '),
        formattedValue,
      ])
    })

    // Empty separator row
    rows.push(['', '', '', ''])
  }

  // Peak Times - By Hour
  rows.push(['Peak Times', 'Hour', 'Message Count', ''])
  Object.entries(data.operationalInsights.peakTimes.byHour)
    .sort(([hourA], [hourB]) => parseInt(hourA) - parseInt(hourB))
    .forEach(([hour, count]) => {
      rows.push(['Peak Times', `${hour}:00`, count.toString(), 'messages'])
    })

  // Empty separator row
  rows.push(['', '', '', ''])

  // Peak Times - By Day of Week
  rows.push(['Peak Days', 'Day', 'Message Count', ''])
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  dayOrder.forEach((day) => {
    const count = data.operationalInsights.peakTimes.byDayOfWeek[day]
    if (count !== undefined) {
      rows.push(['Peak Days', day, count.toString(), 'messages'])
    }
  })

  // Empty separator row
  rows.push(['', '', '', ''])

  // Channel Distribution
  rows.push(['Channel Distribution', 'Channel', 'Count', ''])
  rows.push([
    'Channel Distribution',
    'Text',
    data.operationalInsights.channelDistribution.text.toString(),
    'messages',
  ])
  rows.push([
    'Channel Distribution',
    'Voice',
    data.operationalInsights.channelDistribution.voice.toString(),
    'messages',
  ])
  rows.push([
    'Channel Distribution',
    'Media',
    data.operationalInsights.channelDistribution.media.toString(),
    'messages',
  ])

  // Empty separator row
  rows.push(['', '', '', ''])

  // Common Pain Points
  if (data.operationalInsights.commonPainPoints.length > 0) {
    rows.push(['Common Pain Points', 'Category', 'Description', 'Frequency'])

    data.operationalInsights.commonPainPoints.forEach((painPoint) => {
      rows.push([
        'Common Pain Points',
        painPoint.category,
        painPoint.description,
        painPoint.frequency.toString(),
      ])
    })
  }

  // Convert all rows to CSV string
  return rows.map((row) => formatCSVRow(row)).join('\n')
}

/**
 * Generate CSV filename
 */
export function generateCSVFilename(analysisId: string): string {
  const timestamp = new Date().toISOString().split('T')[0]
  return `customer-analysis-${timestamp}-${analysisId.substring(0, 8)}.csv`
}

/**
 * Convert CSV string to Buffer for download
 */
export function csvToBuffer(csvString: string): Buffer {
  return Buffer.from(csvString, 'utf-8')
}
