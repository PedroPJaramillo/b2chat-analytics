/**
 * Claude API integration for conversation analysis
 */

import type {
  ClaudeAnalysisPrompt,
  ClaudeAnalysisResponse,
} from '@/types/customer-analysis'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeAPIResponse {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
  model: string
  stop_reason: string
}

/**
 * Analyzes a batch of conversations using Claude API
 */
export async function analyzeConversations(
  prompt: ClaudeAnalysisPrompt
): Promise<ClaudeAnalysisResponse> {
  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const systemPrompt = buildSystemPrompt(prompt.analysisRequest)
  const userPrompt = buildUserPrompt(prompt.conversations)

  let lastError: Error | null = null

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Claude API error (${response.status}): ${errorText}`)
      }

      const data: ClaudeAPIResponse = await response.json()
      const resultText = data.content[0]?.text || '{}'

      // Parse JSON response with validation
      const parsedResult = parseClaudeResponse(resultText, prompt.conversations.length)
      return parsedResult
    } catch (error) {
      lastError = error as Error
      console.error(`Claude API attempt ${attempt} failed:`, error)

      // If not the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt)
        )
      }
    }
  }

  throw new Error(
    `Claude API failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  )
}

/**
 * Builds system prompt for Claude
 */
function buildSystemPrompt(analysisRequest: ClaudeAnalysisPrompt['analysisRequest']): string {
  return `You are a customer service analysis expert. Your task is to analyze customer service conversations and categorize them according to specific criteria.

For each conversation provided, you must analyze and determine:

${analysisRequest.categorizeIntent ? '- **Customer Intent**: What is the primary purpose of the conversation?\n  - PROJECT_INFO: Inquiries about projects (El Bosque, Majagua, La Colina, etc.)\n  - PAYMENT: Payment-related questions, financial documentation\n  - LEGAL: Legal documentation (escrituras, certificates)\n  - POST_PURCHASE: Post-purchase support, delivery queries\n  - OTHER: Uncategorized or mixed intent' : ''}

${analysisRequest.identifyJourneyStage ? '- **Journey Stage**: Where is the customer in their buying journey?\n  - PROSPECT: Initial inquiry, information seeking\n  - ACTIVE_BUYER: Discussing payments, documentation\n  - POST_PURCHASE: After-sale support' : ''}

${analysisRequest.assessSentiment ? '- **Sentiment**: What is the customer\'s emotional tone?\n  - POSITIVE: Positive language ("Muchas gracias", "Con mucho gusto")\n  - NEUTRAL: Information exchange\n  - FRICTION: Frustration, confusion (payment surprises, process confusion)' : ''}

${analysisRequest.evaluateAgentQuality ? '- **Agent Quality Score**: Rate the agent\'s response quality (1-10)\n  - Consider: Response completeness, professionalism, helpfulness\n  - 1-3: Poor (incomplete, unprofessional)\n  - 4-6: Adequate (basic service)\n  - 7-8: Good (helpful, professional)\n  - 9-10: Excellent (exceptional service)' : ''}

**IMPORTANT**: Return your analysis as a valid JSON object with this exact structure.
You MUST include the conversationIndex for each conversation exactly as provided in the input.

{
  "conversations": [
    {
      "conversationIndex": 0,
      "customerIntent": "PROJECT_INFO" | "PAYMENT" | "LEGAL" | "POST_PURCHASE" | "OTHER",
      "journeyStage": "PROSPECT" | "ACTIVE_BUYER" | "POST_PURCHASE",
      "sentiment": "POSITIVE" | "NEUTRAL" | "FRICTION",
      "agentQualityScore": 1-10,
      "reasoningNotes": "Brief explanation of your analysis"
    }
  ]
}

Analyze the conversation context carefully. Focus on the overall intent and tone, not just individual messages.`
}

/**
 * Builds user prompt with conversation data
 */
function buildUserPrompt(
  conversations: ClaudeAnalysisPrompt['conversations']
): string {
  let prompt = 'Please analyze the following customer service conversations:\n\n'

  for (const conv of conversations) {
    prompt += `--- Conversation ${conv.conversationIndex} ---\n`
    for (const msg of conv.messages) {
      const role = msg.sender === 'customer' ? 'Customer' : 'Agent'
      prompt += `[${role}] ${msg.content}\n`
    }
    prompt += '\n'
  }

  prompt += '\nPlease provide your analysis in the JSON format specified.'

  return prompt
}

/**
 * Parses Claude's JSON response and validates conversationIndex
 */
function parseClaudeResponse(
  responseText: string,
  expectedConversationCount: number
): ClaudeAnalysisResponse {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```json?\n?([\s\S]*?)\n?```/)
    const jsonText = jsonMatch ? jsonMatch[1] : responseText

    const parsed = JSON.parse(jsonText)

    // Validate structure
    if (!parsed.conversations || !Array.isArray(parsed.conversations)) {
      throw new Error('Invalid response structure: missing conversations array')
    }

    // Validate conversationIndex presence and uniqueness
    const receivedIndices = new Set<number>()
    for (const conv of parsed.conversations) {
      if (typeof conv.conversationIndex !== 'number') {
        console.warn(
          `Claude response missing conversationIndex for conversation:`,
          conv
        )
      } else {
        receivedIndices.add(conv.conversationIndex)
      }
    }

    // Check for missing indices
    for (let i = 0; i < expectedConversationCount; i++) {
      if (!receivedIndices.has(i)) {
        console.warn(
          `Claude response missing conversationIndex ${i} (expected ${expectedConversationCount} conversations)`
        )
      }
    }

    // Warn if Claude returned more than expected
    if (parsed.conversations.length > expectedConversationCount) {
      console.warn(
        `Claude returned ${parsed.conversations.length} results but only ${expectedConversationCount} were requested`
      )
    }

    return parsed as ClaudeAnalysisResponse
  } catch (error) {
    console.error('Failed to parse Claude response:', responseText)
    throw new Error(`Failed to parse Claude response: ${(error as Error).message}`)
  }
}

/**
 * Batches conversations into smaller groups for API calls
 */
export function batchConversations<T>(
  conversations: T[],
  batchSize: number
): T[][] {
  const batches: T[][] = []

  for (let i = 0; i < conversations.length; i += batchSize) {
    batches.push(conversations.slice(i, i + batchSize))
  }

  return batches
}
