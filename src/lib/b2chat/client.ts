import { z } from 'zod'
import { logger } from '@/lib/logger'

// B2Chat API response schemas

const B2ChatContactSchema = z.object({
  contact_id: z.union([z.string(), z.number()]).transform(val => String(val)),
  fullname: z.string().nullable().default(''),
  mobile: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  identification: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  custom_attributes: z.record(z.any()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  created: z.string().nullable().optional(),
  updated: z.string().nullable().optional(),
})

const B2ChatChatSchema = z.object({
  chat_id: z.union([z.string(), z.number()]).transform(val => String(val)),
  alias: z.string().nullable().optional(), // New field from API
  agent: z.any().transform(val => {
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val?.name) return val.name
    return null
  }).nullable().optional(),
  contact: z.any().transform(val => {
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val?.name) return val.name
    return null
  }).nullable().optional(),
  department: z.string().nullable().optional(),
  provider: z.string().nullable().default('livechat'),
  status: z.string().nullable().default('pending'),
  is_agent_available: z.boolean().nullable().optional(),
  created_at: z.union([z.string(), z.null()]).nullable().default(new Date().toISOString()),
  opened_at: z.union([z.string(), z.null()]).nullable().optional(),
  picked_up_at: z.union([z.string(), z.null()]).nullable().optional(),
  responded_at: z.union([z.string(), z.null()]).nullable().optional(),
  closed_at: z.union([z.string(), z.null()]).nullable().optional(),
  duration: z.union([z.string(), z.number(), z.null()]).nullable().optional(),
  messages: z.array(z.any()).nullable().optional(),
  tags: z.union([z.array(z.string()), z.null()]).nullable().optional(),
  viewer_url: z.string().nullable().optional(),
})

export type B2ChatContact = z.infer<typeof B2ChatContactSchema>
export type B2ChatChat = z.infer<typeof B2ChatChatSchema>

export class B2ChatAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'B2ChatAPIError'
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

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new B2ChatAPIError(
        `Request failed: ${endpoint}`,
        response.status,
        await response.text()
      )
    }

    return response.json()
  }


  async getContacts(params?: {
    page?: number
    limit?: number
    updated_since?: Date
  }): Promise<{ data: B2ChatContact[]; pagination: any }> {
    try {
      const searchParams = new URLSearchParams()
      // B2Chat uses offset instead of page
      const offset = params?.page ? (params.page - 1) * (params?.limit || 100) : 0
      searchParams.set('offset', offset.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.updated_since) {
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

      // B2Chat returns contacts in a different structure
      const contacts = (response.contacts || []).map(contact => B2ChatContactSchema.parse(contact))

      return {
        data: contacts,
        pagination: {
          total: response.total || 0,
          exported: response.exported || contacts.length,
          hasNextPage: (response.total || 0) > offset + contacts.length
        }
      }
    } catch (error) {
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
  }): Promise<{ data: B2ChatChat[]; pagination: any }> {
    try {
      const searchParams = new URLSearchParams()
      // B2Chat uses offset instead of page
      const offset = params?.page ? (params.page - 1) * (params?.limit || 100) : 0
      searchParams.set('offset', offset.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.updated_since) {
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

      // B2Chat returns chats in a different structure
      logger.info('B2Chat API response received', {
        totalChats: (response.chats || []).length,
        sampleChat: (response.chats || [])[0] || null,
        responseKeys: Object.keys(response),
        apiParams: {
          offset,
          limit: params?.limit,
          date_range_from: searchParams.get('date_range_from'),
          date_range_to: searchParams.get('date_range_to'),
          updated_since: params?.updated_since?.toISOString()
        }
      })

      const chats = (response.chats || []).map((chat, index) => {
        try {
          return B2ChatChatSchema.parse(chat)
        } catch (parseError) {
          logger.error('Chat data validation failed', {
            chatIndex: index,
            chatData: chat,
            error: parseError instanceof z.ZodError ? JSON.stringify(parseError.errors) : String(parseError)
          })
          throw parseError
        }
      })

      return {
        data: chats,
        pagination: {
          total: response.total || 0,
          exported: response.exported || chats.length,
          hasNextPage: (response.total || 0) > offset + chats.length
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Zod validation error in getChats', {
          error: JSON.stringify(error.errors),
          formattedError: error.format()
        })
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