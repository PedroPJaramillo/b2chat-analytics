/**
 * Analysis worker service - orchestrates the complete analysis process
 */

import { prisma } from '@/lib/prisma'
import type { AnalysisFilters } from '@/types/customer-analysis'
import {
  calculateResponseTimeMetrics,
  calculateVolumeMetrics,
  calculatePeakTimeMetrics,
  groupChatsByAgent,
  calculateAgentMetrics,
} from './metrics'
import { analyzeConversations, batchConversations } from './claude'
import type { Chat, Message, Prisma } from '@prisma/client'

interface ChatWithMessages extends Chat {
  messages: Message[]
}

const CONVERSATION_BATCH_SIZE = 15 // Process 15 conversations per Claude API call
const CHAT_FETCH_BATCH_SIZE = 500 // Fetch 500 chats at a time from database

/**
 * Main worker function to process an analysis job
 */
export async function processAnalysis(analysisId: string): Promise<void> {
  const startTime = Date.now()

  try {
    console.log(`[Worker] Starting analysis: ${analysisId}`)

    // Get analysis record
    const analysis = await prisma.customerAnalysis.findUnique({
      where: { id: analysisId },
    })

    if (!analysis) {
      throw new Error(`Analysis not found: ${analysisId}`)
    }

    // Update status to PROCESSING
    await prisma.customerAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    })

    const filtersJson = analysis.filters as Prisma.JsonValue
    if (!filtersJson || Array.isArray(filtersJson) || typeof filtersJson !== 'object') {
      throw new Error('Invalid analysis filters stored in database')
    }

    const filters = filtersJson as unknown as AnalysisFilters

    // Fetch chats with messages
    console.log(`[Worker] Fetching chats for analysis ${analysisId}`)
    const chats = await fetchChatsWithMessages(filters)

    console.log(`[Worker] Found ${chats.length} chats to analyze`)

    if (chats.length === 0) {
      // No data to analyze
      await prisma.customerAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processingTimeMs: Date.now() - startTime,
          totalChatsAnalyzed: 0,
          totalMessagesAnalyzed: 0,
          aiAnalysisCount: 0,
        },
      })
      return
    }

    // Calculate rule-based metrics
    console.log(`[Worker] Calculating rule-based metrics`)
    const responseMetrics = calculateResponseTimeMetrics(chats)
    const volumeMetrics = calculateVolumeMetrics(chats)
    const peakTimeMetrics = calculatePeakTimeMetrics(chats)

    // Store overall metrics
    await storeMetrics(analysisId, responseMetrics, volumeMetrics, peakTimeMetrics)

    // Calculate agent-specific metrics
    const chatsByAgent = groupChatsByAgent(chats)
    for (const [agentId, agentChats] of Object.entries(chatsByAgent)) {
      const agentMetrics = calculateAgentMetrics(agentChats)
      await storeAgentMetrics(analysisId, agentId, agentMetrics)
    }

    // Process AI analysis in batches
    console.log(`[Worker] Starting AI analysis for ${chats.length} conversations`)
    let aiAnalysisCount = 0

    try {
      const conversationBatches = batchConversations(chats, CONVERSATION_BATCH_SIZE)

      for (let i = 0; i < conversationBatches.length; i++) {
        const batch = conversationBatches[i]
        console.log(
          `[Worker] Processing AI batch ${i + 1}/${conversationBatches.length}`
        )

        // Prepare conversations with indices for reliable mapping
        const conversations = batch.map((chat, index) => ({
          conversationIndex: index,
          chatId: chat.id, // For Claude's reference only
          messages: chat.messages.map((msg) => ({
            sender: msg.incoming ? 'customer' : 'agent',
            content: msg.text || '[No text content]',
            timestamp: msg.timestamp.toISOString(),
          })),
        }))

        // Create index-to-chat mapping (our source of truth)
        const indexToChatMap = new Map<number, string>()
        batch.forEach((chat, index) => {
          indexToChatMap.set(index, chat.id)
        })

        // Call Claude API
        const analysisResult = await analyzeConversations({
          conversations,
          analysisRequest: {
            categorizeIntent: true,
            identifyJourneyStage: true,
            assessSentiment: true,
            evaluateAgentQuality: true,
          },
        })

        // Store categorizations using index-based mapping
        for (const result of analysisResult.conversations) {
          // Use conversationIndex as primary mapping key
          const chatId = indexToChatMap.get(result.conversationIndex)

          if (!chatId) {
            console.warn(
              `[Worker] Invalid conversationIndex ${result.conversationIndex} in Claude response. Skipping.`
            )
            continue
          }

          // Optional: Validate chatId if Claude returned one
          if (result.chatId && result.chatId !== chatId) {
            console.warn(
              `[Worker] chatId mismatch at index ${result.conversationIndex}: expected ${chatId}, got ${result.chatId}. Using mapped chatId.`
            )
          }

          try {
            await prisma.customerCategorization.create({
              data: {
                analysisId,
                chatId, // Use our mapped chatId, not Claude's
                customerIntent: result.customerIntent,
                journeyStage: result.journeyStage,
                sentiment: result.sentiment,
                agentQualityScore: result.agentQualityScore,
                reasoningNotes: result.reasoningNotes,
                confidenceScore: 0.9, // Could be extracted from Claude's response
              },
            })
            aiAnalysisCount++
          } catch (error) {
            console.error(
              `[Worker] Failed to create categorization for chatId ${chatId}:`,
              error
            )
            // Continue processing other results instead of failing entire batch
          }
        }
      }

      // Calculate and store aggregated AI metrics
      await storeAIAggregatedMetrics(analysisId)

      // Mark as COMPLETED
      await prisma.customerAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processingTimeMs: Date.now() - startTime,
          totalChatsAnalyzed: chats.length,
          totalMessagesAnalyzed: volumeMetrics.totalMessages,
          aiAnalysisCount,
        },
      })

      console.log(
        `[Worker] Analysis ${analysisId} completed successfully in ${Date.now() - startTime}ms`
      )
    } catch (aiError) {
      // If AI analysis fails, mark as PARTIAL (we still have rule-based metrics)
      console.error(`[Worker] AI analysis failed:`, aiError)

      await prisma.customerAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'PARTIAL',
          completedAt: new Date(),
          processingTimeMs: Date.now() - startTime,
          totalChatsAnalyzed: chats.length,
          totalMessagesAnalyzed: volumeMetrics.totalMessages,
          aiAnalysisCount,
          errorMessage: `AI analysis failed: ${(aiError as Error).message}`,
        },
      })

      console.log(
        `[Worker] Analysis ${analysisId} completed with partial results`
      )
    }
  } catch (error) {
    console.error(`[Worker] Analysis ${analysisId} failed:`, error)

    // Mark as FAILED
    await prisma.customerAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        errorMessage: (error as Error).message,
      },
    })

    throw error
  }
}

/**
 * Fetches chats with messages based on filters
 */
async function fetchChatsWithMessages(
  filters: AnalysisFilters
): Promise<ChatWithMessages[]> {
  const startDate = new Date(filters.dateStart)
  const endDate = new Date(filters.dateEnd)
  endDate.setHours(23, 59, 59, 999)

  const whereClause: any = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    isDeleted: false,
  }

  if (filters.agentIds && filters.agentIds.length > 0) {
    whereClause.agentId = { in: filters.agentIds }
  }

  if (filters.departmentIds && filters.departmentIds.length > 0) {
    whereClause.departmentId = { in: filters.departmentIds }
  }

  if (filters.contactIds && filters.contactIds.length > 0) {
    whereClause.contactId = { in: filters.contactIds }
  }

  const chats = await prisma.chat.findMany({
    where: whereClause,
    include: {
      messages: {
        orderBy: { timestamp: 'asc' },
      },
    },
    take: CHAT_FETCH_BATCH_SIZE,
  })

  return chats
}

/**
 * Stores overall metrics as KPIs
 */
async function storeMetrics(
  analysisId: string,
  responseMetrics: any,
  volumeMetrics: any,
  peakTimeMetrics: any
): Promise<void> {
  const kpis = [
    // Response time metrics
    {
      metricType: 'RESPONSE_TIME' as const,
      metricName: 'first_response_average',
      numericValue: responseMetrics.firstResponseTime.average,
      category: 'performance',
    },
    {
      metricType: 'RESPONSE_TIME' as const,
      metricName: 'first_response_p50',
      numericValue: responseMetrics.firstResponseTime.p50,
      category: 'performance',
    },
    {
      metricType: 'RESPONSE_TIME' as const,
      metricName: 'first_response_p90',
      numericValue: responseMetrics.firstResponseTime.p90,
      category: 'performance',
    },
    // Volume metrics
    {
      metricType: 'VOLUME' as const,
      metricName: 'total_chats',
      numericValue: volumeMetrics.totalChats,
      category: 'volume',
    },
    {
      metricType: 'VOLUME' as const,
      metricName: 'total_messages',
      numericValue: volumeMetrics.totalMessages,
      category: 'volume',
    },
    // Peak time metrics
    {
      metricType: 'PEAK_TIME' as const,
      metricName: 'messages_by_hour',
      jsonValue: peakTimeMetrics.byHour,
      category: 'operational',
    },
    {
      metricType: 'PEAK_TIME' as const,
      metricName: 'messages_by_day',
      jsonValue: peakTimeMetrics.byDayOfWeek,
      category: 'operational',
    },
    // Channel distribution
    {
      metricType: 'CHANNEL_USAGE' as const,
      metricName: 'channel_distribution',
      jsonValue: volumeMetrics.channelDistribution,
      category: 'operational',
    },
  ]

  await prisma.analysisKPI.createMany({
    data: kpis.map((kpi) => ({
      analysisId,
      ...kpi,
    })),
  })
}

/**
 * Stores agent-specific metrics
 */
async function storeAgentMetrics(
  analysisId: string,
  agentId: string,
  metrics: any
): Promise<void> {
  await prisma.analysisKPI.createMany({
    data: [
      {
        analysisId,
        agentId,
        metricType: 'RESPONSE_TIME',
        metricName: 'agent_first_response_p50',
        numericValue: metrics.firstResponseTime.p50,
        category: 'agent_performance',
      },
      {
        analysisId,
        agentId,
        metricType: 'VOLUME',
        metricName: 'agent_total_chats',
        numericValue: metrics.totalChats,
        category: 'agent_performance',
      },
    ],
  })
}

/**
 * Stores aggregated AI metrics (intent distribution, sentiment, etc.)
 */
async function storeAIAggregatedMetrics(analysisId: string): Promise<void> {
  // Get all categorizations for this analysis
  const categorizations = await prisma.customerCategorization.findMany({
    where: { analysisId },
  })

  if (categorizations.length === 0) return

  // Calculate intent distribution
  const intentCounts: Record<string, number> = {}
  const journeyCounts: Record<string, number> = {}
  const sentimentCounts: Record<string, number> = {}

  for (const cat of categorizations) {
    if (cat.customerIntent) {
      intentCounts[cat.customerIntent] =
        (intentCounts[cat.customerIntent] || 0) + 1
    }
    if (cat.journeyStage) {
      journeyCounts[cat.journeyStage] = (journeyCounts[cat.journeyStage] || 0) + 1
    }
    if (cat.sentiment) {
      sentimentCounts[cat.sentiment] = (sentimentCounts[cat.sentiment] || 0) + 1
    }
  }

  // Convert to percentages
  const total = categorizations.length
  const intentDistribution: Record<string, number> = {}
  const journeyDistribution: Record<string, number> = {}
  const sentimentDistribution: Record<string, number> = {}

  for (const [intent, count] of Object.entries(intentCounts)) {
    intentDistribution[intent] = count / total
  }
  for (const [journey, count] of Object.entries(journeyCounts)) {
    journeyDistribution[journey] = count / total
  }
  for (const [sentiment, count] of Object.entries(sentimentCounts)) {
    sentimentDistribution[sentiment] = count / total
  }

  // Store as KPIs
  await prisma.analysisKPI.createMany({
    data: [
      {
        analysisId,
        metricType: 'CUSTOMER_INTENT',
        metricName: 'intent_distribution',
        jsonValue: intentDistribution,
        category: 'customer_analysis',
      },
      {
        analysisId,
        metricType: 'JOURNEY_STAGE',
        metricName: 'journey_distribution',
        jsonValue: journeyDistribution,
        category: 'customer_analysis',
      },
      {
        analysisId,
        metricType: 'SENTIMENT',
        metricName: 'sentiment_distribution',
        jsonValue: sentimentDistribution,
        category: 'customer_analysis',
      },
    ],
  })
}
