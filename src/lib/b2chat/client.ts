import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * B2Chat API Client
 *
 * IMPORTANT: B2Chat API returns different field names than our internal schema.
 * See docs/development/B2CHAT_API_FIELD_MAPPING.md for complete field mapping guide.
 *
 * Key differences:
 * - API returns "name" but we use "fullname"
 * - API returns "mobile_number" in nested contacts but we use "mobile"
 * - API returns "response_at" but we use "responded_at"
 * - API doesn't provide "contact_id" - we generate it from available fields
 *
 * Always preprocess API responses before schema validation!
 */

// B2Chat API response schemas

const B2ChatMessageSchema = z.object({
  created_at: z.string(), // Message timestamp
  incoming: z.boolean(), // Direction: true=customer→agent, false=agent→customer
  type: z.string().transform(val => {
    // Normalize message type to lowercase and map to expected values
    const normalized = val.toLowerCase()
    if (normalized === 'text') return 'text'
    if (normalized === 'image') return 'image'
    return 'file' // Default to file for any other type (document, video, etc.)
  }), // Message type
  body: z.string(), // Text content or media URL
  caption: z.string().nullable().optional(), // Optional description for images/files
  broadcasted: z.boolean().optional(), // Whether message was broadcasted (ignore in processing)
  location: z.any().nullable().optional(), // Location data (ignore in processing)
}).passthrough() // Allow extra fields from B2Chat API

const B2ChatContactSchema = z.object({
  // B2Chat API doesn't return contact_id in /contacts/export - we'll generate it
  contact_id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(), // Alternative ID field
  // B2Chat API returns "name" not "fullname" - handle both
  fullname: z.string().nullable().optional(),
  name: z.string().nullable().optional(), // B2Chat API uses this field
  mobile: z.string().nullable().optional(),
  mobile_number: z.string().nullable().optional(), // Alternative mobile field from B2Chat
  phone_number: z.string().nullable().optional(),
  landline: z.string().nullable().optional(), // Additional phone field from B2Chat
  email: z.string().nullable().optional(),
  identification: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  merchant_id: z.union([z.string(), z.number()]).nullable().optional(), // B2Chat specific field
  custom_attributes: z.union([z.record(z.any()), z.array(z.any())]).nullable().optional(), // Can be object or array
  /**
   * Contact tags assigned in B2Chat
   * Structure: [{ name: "VIP", assigned_at: 1706644084 }]
   * assigned_at is Unix timestamp (seconds since epoch)
   * B2Chat users can create new tags dynamically - no schema change needed
   */
  tags: z.array(z.object({
    name: z.string(),
    assigned_at: z.number() // Unix timestamp
  })).nullable().optional(),
  row_index: z.union([z.number(), z.null()]).nullable().optional(), // B2Chat specific field (can be null)
  /**
   * Original creation timestamp in B2Chat (not our sync time)
   * Format: "2020-11-09 19:10:23"
   */
  created: z.string().nullable().optional(),
  /**
   * Original last update timestamp in B2Chat
   * Format: "2024-01-25 16:24:14"
   */
  updated: z.string().nullable().optional(),
}).passthrough() // Allow extra fields from B2Chat API

const B2ChatChatSchema = z.object({
  chat_id: z.union([z.string(), z.number()]).transform(val => String(val)),
  alias: z.string().nullable().optional(), // New field from API
  // Keep full agent object for extraction (don't transform to string)
  agent: z.any().nullable().optional(),
  // Keep full contact object for extraction (don't transform to string)
  contact: z.any().nullable().optional(),
  // Keep full department object/string for extraction
  department: z.any().nullable().optional(),
  provider: z.string().transform(val => {
    if (!val) return 'livechat'
    // Normalize provider names from B2Chat (WHATSAPPB2CHAT -> whatsapp, etc.)
    const normalized = val.toLowerCase().replace(/b2chat$/i, '').trim()
    // Map to our enum values
    if (normalized.includes('whatsapp')) return 'whatsapp'
    if (normalized.includes('facebook')) return 'facebook'
    if (normalized.includes('telegram')) return 'telegram'
    if (normalized.includes('bot') || normalized.includes('api')) return 'b2cbotapi'
    return 'livechat' // Default fallback
  }).nullable().default('livechat'),
  /**
   * Status field - Full 8-status support (Feature 001)
   *
   * B2Chat provides 8 distinct statuses for chat lifecycle:
   * - BOT_CHATTING: Bot handling before human agent
   * - OPENED: Available for agent pickup
   * - PICKED_UP: Agent accepted chat
   * - RESPONDED_BY_AGENT: Agent sent first response
   * - CLOSED: Chat completed (no survey)
   * - COMPLETING_POLL: Awaiting survey response
   * - COMPLETED_POLL: Survey completed by customer
   * - ABANDONED_POLL: Survey not completed (timeout)
   *
   * Legacy values (open, closed, pending) remain for backward compatibility.
   */
  status: z.union([z.string(), z.null()]).transform(val => {
    if (!val) return 'OPENED'

    // Normalize to uppercase with underscores
    const normalized = val.toUpperCase().replace(/\s+/g, '_')

    // Direct mapping for B2Chat statuses
    const statusMap: Record<string, string> = {
      'BOT_CHATTING': 'BOT_CHATTING',
      'OPENED': 'OPENED',
      'PICKED_UP': 'PICKED_UP',
      'RESPONDED_BY_AGENT': 'RESPONDED_BY_AGENT',
      'CLOSED': 'CLOSED',
      'COMPLETING_POLL': 'COMPLETING_POLL',
      'COMPLETED_POLL': 'COMPLETED_POLL',
      'ABANDONED_POLL': 'ABANDONED_POLL',

      // Legacy aliases (for backward compatibility and API variations)
      'OPEN': 'PICKED_UP',
      'FINISHED': 'CLOSED',
      'PENDING': 'OPENED',
    }

    const mapped = statusMap[normalized]

    if (!mapped) {
      logger.warn('Unknown B2Chat status encountered', {
        originalStatus: val,
        normalized,
        fallbackTo: 'OPENED'
      })
      return 'OPENED' // Safe fallback
    }

    return mapped
  }).default('OPENED'),
  is_agent_available: z.boolean().nullable().optional(),
  created_at: z.union([z.string(), z.null()]).nullable().default(new Date().toISOString()),
  opened_at: z.union([z.string(), z.null()]).nullable().optional(),
  picked_up_at: z.union([z.string(), z.null()]).nullable().optional(),
  // B2Chat API returns "response_at" but we use "responded_at" internally
  responded_at: z.union([z.string(), z.null()]).nullable().optional(),
  response_at: z.union([z.string(), z.null()]).nullable().optional(), // B2Chat API field name
  closed_at: z.union([z.string(), z.null()]).nullable().optional(),
  duration: z.union([z.string(), z.number(), z.null()]).nullable().optional(),

  // Survey-related fields (Feature 001: Full Status Support)
  poll_started_at: z.union([z.string(), z.null()]).nullable().optional(),
  poll_completed_at: z.union([z.string(), z.null()]).nullable().optional(),
  poll_abandoned_at: z.union([z.string(), z.null()]).nullable().optional(),
  poll_response: z.any().nullable().optional(), // JSON survey response data

  messages: z.array(B2ChatMessageSchema).nullable().optional(),
  tags: z.union([z.array(z.string()), z.null()]).nullable().optional(),
  viewer_url: z.string().nullable().optional(),
}).passthrough() // Allow extra fields from B2Chat API

export type B2ChatMessage = z.infer<typeof B2ChatMessageSchema>
export type B2ChatContact = z.infer<typeof B2ChatContactSchema>
export type B2ChatChat = z.infer<typeof B2ChatChatSchema>

export class B2ChatAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown,
    public endpoint?: string,
    public requestUrl?: string
  ) {
    super(message)
    this.name = 'B2ChatAPIError'
  }

  /**
   * Get a user-friendly error message
   */
  getUserFriendlyMessage(): string {
    switch (this.statusCode) {
      case 401:
        return 'B2Chat API authentication failed. Please check your username and password.';
      case 403:
        return 'Access denied to B2Chat API. Please check your account permissions.';
      case 404:
        return 'B2Chat API endpoint not found. The service may be unavailable.';
      case 429:
        return 'Too many requests to B2Chat API. Please wait before trying again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'B2Chat API server error. The service may be temporarily unavailable.';
      default:
        return `B2Chat API error (${this.statusCode}): ${this.message}`;
    }
  }

  /**
   * Check if this is a temporary error that should be retried
   */
  isRetryable(): boolean {
    return [429, 500, 502, 503, 504].includes(this.statusCode);
  }

  /**
   * Check if this is an authentication error
   */
  isAuthenticationError(): boolean {
    return [401, 403].includes(this.statusCode);
  }
}

export class B2ChatClient {
  private baseURL: string
  private credentials: { username: string; password: string }
  private accessToken?: string
  private tokenExpiresAt?: Date

  constructor() {
    this.baseURL = process.env.B2CHAT_API_URL || 'https://api.b2chat.io'
    this.credentials = {
      username: process.env.B2CHAT_USERNAME || '',
      password: process.env.B2CHAT_PASSWORD || '',
    }
  }

  private async authenticate(): Promise<void> {
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return // Token is still valid
    }

    try {
      const credentials = `${this.credentials.username}:${this.credentials.password}`
      const response = await fetch(`${this.baseURL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(credentials)}`,
        },
        body: 'grant_type=client_credentials',
      })

      if (!response.ok) {
        throw new B2ChatAPIError(
          'Authentication failed',
          response.status,
          await response.text()
        )
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000 - 60000) // 1 minute buffer
    } catch (error) {
      if (error instanceof B2ChatAPIError) throw error
      throw new B2ChatAPIError('Authentication error', 500, error)
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.authenticate()

    const fullUrl = `${this.baseURL}${endpoint}`

    // Log request details for debugging
    logger.debug('B2Chat API request', {
      url: fullUrl,
      method: options.method || 'GET',
      endpoint,
    })

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');

      // Try to parse error response if it's JSON
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { message: errorText };
      }

      const errorMessage = errorDetails.message || errorDetails.error || errorText || 'Unknown error';

      // Log detailed error for debugging
      logger.error('B2Chat API error response', {
        url: fullUrl,
        endpoint,
        statusCode: response.status,
        statusText: response.statusText,
        errorMessage,
        rawResponse: errorText,
        parsedError: errorDetails,
        timestamp: new Date().toISOString(),
      })

      throw new B2ChatAPIError(
        `B2Chat API request failed: ${errorMessage}`,
        response.status,
        errorDetails,
        endpoint,
        fullUrl
      );
    }

    return response.json()
  }


  async getContacts(params?: {
    page?: number
    limit?: number
    updated_since?: Date
    dateRange?: { startDate?: Date; endDate?: Date }
  }): Promise<{ data: B2ChatContact[]; pagination: any }> {
    try {
      const searchParams = new URLSearchParams()
      // B2Chat uses offset instead of page
      const offset = params?.page ? (params.page - 1) * (params?.limit || 100) : 0
      searchParams.set('offset', offset.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())

      // Use date range if provided, otherwise fall back to updated_since
      if (params?.dateRange) {
        if (params.dateRange.startDate) {
          searchParams.set('updated_from', params.dateRange.startDate.toISOString().split('T')[0])
        }
        if (params.dateRange.endDate) {
          searchParams.set('updated_to', params.dateRange.endDate.toISOString().split('T')[0])
        }
      } else if (params?.updated_since) {
        // B2Chat uses updated_from and updated_to
        searchParams.set('updated_from', params.updated_since.toISOString().split('T')[0])
        searchParams.set('updated_to', new Date().toISOString().split('T')[0])
      }

      const response = await this.makeRequest<{
        contacts?: unknown[]
        exported?: number
        total?: number
        trace_id?: string
        message?: string
      }>(`/contacts/export?${searchParams.toString()}`)

      // Log raw response for debugging
      logger.debug('B2Chat contacts API response', {
        total: response.total,
        exported: response.exported,
        contactsCount: response.contacts?.length || 0,
        hasContacts: !!response.contacts,
        sampleContact: response.contacts?.[0] || null
      })

      // Check if response has contacts array
      if (!response.contacts || !Array.isArray(response.contacts)) {
        logger.warn('B2Chat API returned invalid response structure', {
          response,
          hasContacts: !!response.contacts,
          isArray: Array.isArray(response.contacts)
        })
        return {
          data: [],
          pagination: {
            total: 0,
            exported: 0,
            hasNextPage: false
          }
        }
      }

      // Preprocess and parse contacts with per-item error handling
      const contacts: B2ChatContact[] = []
      const errors: Array<{ index: number; contact: any; error: string }> = []

      response.contacts.forEach((rawContact: any, index) => {
        try {
          // Normalize B2Chat API field names to our schema
          const normalized = {
            // Generate contact_id from available fields if not provided
            contact_id: rawContact.contact_id || rawContact.id || rawContact.mobile || rawContact.identification || `contact_${index}`,
            // Map "name" to "fullname"
            fullname: rawContact.fullname || rawContact.name || '',
            name: rawContact.name,
            // Keep all other fields as-is
            mobile: rawContact.mobile,
            mobile_number: rawContact.mobile_number,
            phone_number: rawContact.phone_number,
            landline: rawContact.landline,
            email: rawContact.email,
            identification: rawContact.identification,
            address: rawContact.address,
            city: rawContact.city,
            country: rawContact.country,
            company: rawContact.company,
            merchant_id: rawContact.merchant_id,
            custom_attributes: rawContact.custom_attributes,
            tags: rawContact.tags,
            row_index: rawContact.row_index,
            created: rawContact.created,
            updated: rawContact.updated,
          }

          const parsed = B2ChatContactSchema.parse(normalized)
          contacts.push(parsed)
        } catch (parseError) {
          const errorMsg = parseError instanceof z.ZodError
            ? JSON.stringify(parseError.errors)
            : String(parseError)

          logger.error('Failed to parse individual contact', {
            index,
            contactData: rawContact,
            error: errorMsg
          })

          errors.push({ index, contact: rawContact, error: errorMsg })
        }
      })

      // Log summary if there were errors
      if (errors.length > 0) {
        logger.warn('Some contacts failed to parse', {
          totalContacts: response.contacts.length,
          successfulContacts: contacts.length,
          failedContacts: errors.length,
          firstError: errors[0]
        })
      }

      return {
        data: contacts,
        pagination: {
          total: response.total || 0,
          exported: response.exported || contacts.length,
          // hasNextPage: Stop if we got fewer records than requested
          // Use exported field from API, fallback to array length if missing
          hasNextPage: (response.exported || contacts.length) >= (params?.limit || 100)
        }
      }
    } catch (error) {
      // Log detailed error information
      logger.error('Failed to fetch contacts from B2Chat API', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof z.ZodError ? 'ValidationError' : error instanceof B2ChatAPIError ? 'APIError' : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined
      })

      if (error instanceof z.ZodError) {
        throw new B2ChatAPIError('Invalid contact data format', 422, error.errors)
      }
      throw error
    }
  }

  async getChats(params?: {
    page?: number
    limit?: number
    updated_since?: Date
    dateRange?: { startDate?: Date; endDate?: Date }
  }): Promise<{ data: B2ChatChat[]; pagination: any }> {
    try {
      const searchParams = new URLSearchParams()
      // B2Chat uses offset instead of page
      const offset = params?.page ? (params.page - 1) * (params?.limit || 100) : 0
      searchParams.set('offset', offset.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())

      // Use date range if provided, otherwise fall back to updated_since
      if (params?.dateRange) {
        if (params.dateRange.startDate) {
          searchParams.set('date_range_from', params.dateRange.startDate.toISOString().split('T')[0])
        }
        if (params.dateRange.endDate) {
          searchParams.set('date_range_to', params.dateRange.endDate.toISOString().split('T')[0])
        }
      } else if (params?.updated_since) {
        // B2Chat uses date_range_from and date_range_to
        searchParams.set('date_range_from', params.updated_since.toISOString().split('T')[0])
        searchParams.set('date_range_to', new Date().toISOString().split('T')[0])
      }

      const response = await this.makeRequest<{
        chats?: unknown[]
        exported?: number
        total?: number
        trace_id?: string
        message?: string
      }>(`/chats/export?${searchParams.toString()}`)

      // Log raw response for debugging
      logger.debug('B2Chat chats API response', {
        total: response.total,
        exported: response.exported,
        chatsCount: response.chats?.length || 0,
        hasChats: !!response.chats,
        sampleChat: response.chats?.[0] || null,
        apiParams: {
          offset,
          limit: params?.limit,
          date_range_from: searchParams.get('date_range_from'),
          date_range_to: searchParams.get('date_range_to'),
          updated_since: params?.updated_since?.toISOString()
        }
      })

      // Check if response has chats array
      if (!response.chats || !Array.isArray(response.chats)) {
        logger.warn('B2Chat API returned invalid chats response structure', {
          response,
          hasChats: !!response.chats,
          isArray: Array.isArray(response.chats)
        })
        return {
          data: [],
          pagination: {
            total: 0,
            exported: 0,
            hasNextPage: false
          }
        }
      }

      // Preprocess and parse chats with per-item error handling
      const chats: B2ChatChat[] = []
      const errors: Array<{ index: number; chat: any; error: string }> = []

      response.chats.forEach((rawChat: any, index) => {
        try {
          // Normalize B2Chat API field names to our schema
          const normalized = {
            ...rawChat,
            // Map "response_at" to "responded_at" if needed
            responded_at: rawChat.responded_at || rawChat.response_at,
            // Normalize nested contact if present
            contact: rawChat.contact ? {
              ...rawChat.contact,
              // Map "name" to "fullname" for nested contact
              fullname: rawChat.contact.fullname || rawChat.contact.name,
              // Map "mobile_number" to "mobile"
              mobile: rawChat.contact.mobile || rawChat.contact.mobile_number,
            } : undefined,
            // Keep agent as-is (it already has correct field names)
            agent: rawChat.agent,
            // Keep department as-is
            department: rawChat.department,
          }

          const parsed = B2ChatChatSchema.parse(normalized)
          chats.push(parsed)
        } catch (parseError) {
          const errorMsg = parseError instanceof z.ZodError
            ? JSON.stringify(parseError.errors)
            : String(parseError)

          logger.error('Failed to parse individual chat', {
            index,
            chatData: rawChat,
            error: errorMsg
          })

          errors.push({ index, chat: rawChat, error: errorMsg })
        }
      })

      // Log summary if there were errors
      if (errors.length > 0) {
        logger.warn('Some chats failed to parse', {
          totalChats: response.chats.length,
          successfulChats: chats.length,
          failedChats: errors.length,
          firstError: errors[0]
        })
      }

      return {
        data: chats,
        pagination: {
          total: response.total || 0,
          exported: response.exported || chats.length,
          // hasNextPage: Stop if we got fewer records than requested
          // Use exported field from API, fallback to array length if missing
          hasNextPage: (response.exported || chats.length) >= (params?.limit || 100)
        }
      }
    } catch (error) {
      // Log detailed error information
      logger.error('Failed to fetch chats from B2Chat API', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof z.ZodError ? 'ValidationError' : error instanceof B2ChatAPIError ? 'APIError' : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined
      })

      if (error instanceof z.ZodError) {
        throw new B2ChatAPIError('Invalid chat data format', 422, error.errors)
      }
      throw error
    }
  }

  async getTotalCounts(): Promise<{ contacts: number; chats: number }> {
    try {
      // Get total contacts count by fetching first page with limit 1
      const contactsResponse = await this.makeRequest<{
        contacts?: unknown[]
        total?: number
      }>('/contacts/export?limit=1&offset=0')

      // Get total chats count by fetching first page with limit 1
      const chatsResponse = await this.makeRequest<{
        chats?: unknown[]
        total?: number
      }>('/chats/export?limit=1&offset=0')

      return {
        contacts: contactsResponse.total || 0,
        chats: chatsResponse.total || 0
      }
    } catch (error) {
      logger.error('Failed to get B2Chat total counts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}