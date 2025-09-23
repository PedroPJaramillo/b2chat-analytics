import { z } from 'zod'

// B2Chat API response schemas
const B2ChatAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  department: z.string().optional(),
  active: z.boolean(),
})

const B2ChatContactSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  identification: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  company: z.string().optional(),
  custom_attributes: z.record(z.any()).optional(),
})

const B2ChatChatSchema = z.object({
  id: z.string(),
  agent_id: z.string().optional(),
  contact_id: z.string().optional(),
  department: z.string().optional(),
  provider: z.enum(['whatsapp', 'facebook', 'telegram', 'livechat', 'b2cbotapi']),
  status: z.enum(['open', 'closed', 'pending']),
  is_agent_available: z.boolean().optional(),
  created_at: z.string().datetime(),
  opened_at: z.string().datetime().optional(),
  picked_up_at: z.string().datetime().optional(),
  response_at: z.string().datetime().optional(),
  closed_at: z.string().datetime().optional(),
  duration: z.number().optional(),
})

export type B2ChatAgent = z.infer<typeof B2ChatAgentSchema>
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
      const response = await fetch(`${this.baseURL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'password',
          username: this.credentials.username,
          password: this.credentials.password,
        }),
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

  async getAgents(): Promise<B2ChatAgent[]> {
    try {
      const response = await this.makeRequest<{ data: unknown[] }>('/agents')
      return response.data.map(agent => B2ChatAgentSchema.parse(agent))
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new B2ChatAPIError('Invalid agent data format', 422, error.errors)
      }
      throw error
    }
  }

  async getContacts(params?: {
    page?: number
    limit?: number
    updated_since?: Date
  }): Promise<{ data: B2ChatContact[]; pagination: any }> {
    try {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.updated_since) {
        searchParams.set('updated_since', params.updated_since.toISOString())
      }

      const response = await this.makeRequest<{
        data: unknown[]
        pagination: any
      }>(`/contacts?${searchParams.toString()}`)

      const contacts = response.data.map(contact => B2ChatContactSchema.parse(contact))
      return { data: contacts, pagination: response.pagination }
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
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.updated_since) {
        searchParams.set('updated_since', params.updated_since.toISOString())
      }

      const response = await this.makeRequest<{
        data: unknown[]
        pagination: any
      }>(`/chats?${searchParams.toString()}`)

      const chats = response.data.map(chat => B2ChatChatSchema.parse(chat))
      return { data: chats, pagination: response.pagination }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new B2ChatAPIError('Invalid chat data format', 422, error.errors)
      }
      throw error
    }
  }
}