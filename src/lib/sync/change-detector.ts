import { Contact, Agent, Department, Chat, ChatStatus } from '@prisma/client'
import { logger } from '@/lib/logger'

/**
 * Detect changes between existing and new entity data
 * Returns only the fields that changed with old and new values
 */

export interface ContactChanges {
  hasChanges: boolean
  changedFields: string[]
  oldValues: Record<string, any>
  newValues: Record<string, any>
}

export interface AgentChanges {
  hasChanges: boolean
  changedFields: string[]
  oldValues: Record<string, any>
  newValues: Record<string, any>
}

export interface DepartmentChanges {
  hasChanges: boolean
  changedFields: string[]
  oldValues: Record<string, any>
  newValues: Record<string, any>
}

export interface ChatChanges {
  hasChanges: boolean
  statusChanged: boolean
  previousStatus?: ChatStatus
  newStatus?: ChatStatus
  changedFields: string[]
  oldValues: Record<string, any>
  newValues: Record<string, any>
}

/**
 * Detect contact changes
 */
export function detectContactChanges(
  existing: Contact,
  rawData: any
): ContactChanges | null {
  const changedFields: string[] = []
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}

  // Fields to compare
  const fieldsToCheck = [
    'fullName',
    'mobile',
    'phoneNumber', // Will now capture landline changes
    'email',
    'identification',
    'address',
    'city',
    'country',
    'company',
    'merchantId', // Feature 002: NEW
  ]

  // Map raw data fields to our schema
  const normalizedNew = {
    fullName: rawData.fullname || rawData.name || '',
    mobile: rawData.mobile || rawData.mobile_number || null,
    phoneNumber: rawData.landline || null, // FIXED: was rawData.phone_number
    email: rawData.email || null,
    identification: rawData.identification || null,
    address: rawData.address || null,
    city: rawData.city || null,
    country: rawData.country || null,
    company: rawData.company || null,
    merchantId: rawData.merchant_id ? String(rawData.merchant_id) : null, // Feature 002: NEW
  }

  // Compare each field
  for (const field of fieldsToCheck) {
    const oldValue = existing[field as keyof typeof normalizedNew]
    const newValue = normalizedNew[field as keyof typeof normalizedNew]

    // Normalize nulls and empty strings for comparison
    const normalizedOld = oldValue === null || oldValue === '' ? null : oldValue
    const normalizedNewValue = newValue === null || newValue === '' ? null : newValue

    if (normalizedOld !== normalizedNewValue) {
      changedFields.push(field)
      oldValues[field] = normalizedOld
      newValues[field] = normalizedNewValue
    }
  }

  // Check custom attributes (JSON field)
  if (rawData.custom_attributes) {
    const oldCustom = JSON.stringify(existing.customAttributes || {})
    const newCustom = JSON.stringify(rawData.custom_attributes || {})
    if (oldCustom !== newCustom) {
      changedFields.push('customAttributes')
      oldValues.customAttributes = existing.customAttributes
      newValues.customAttributes = rawData.custom_attributes
    }
  }

  // Feature 002: Check tags (JSON field with dynamic structure)
  if (rawData.tags !== undefined) {
    const oldTags = existing.tags ? JSON.stringify(existing.tags) : null
    const newTags = rawData.tags ? JSON.stringify(rawData.tags) : null

    if (oldTags !== newTags) {
      changedFields.push('tags')
      oldValues.tags = existing.tags
      newValues.tags = rawData.tags
    }
  }

  // Feature 002: Compare B2Chat timestamps (may be initially null, then populated)
  const compareTimestamp = (
    field: 'b2chatCreatedAt' | 'b2chatUpdatedAt',
    rawField: string | null | undefined
  ) => {
    if (!rawField) return // Skip if no new timestamp

    const oldValue = existing[field]
    const newValue = new Date(rawField)

    // Validate new date
    if (isNaN(newValue.getTime())) return

    const normalizedOld = oldValue ? oldValue.getTime() : null
    const normalizedNew = newValue.getTime()

    if (normalizedOld !== normalizedNew) {
      changedFields.push(field)
      oldValues[field] = oldValue
      newValues[field] = newValue
    }
  }

  compareTimestamp('b2chatCreatedAt', rawData.created)
  compareTimestamp('b2chatUpdatedAt', rawData.updated)

  const hasChanges = changedFields.length > 0

  if (hasChanges) {
    logger.debug('Contact changes detected', {
      contactId: existing.id,
      b2chatId: existing.b2chatId,
      changedFields,
    })
  }

  return {
    hasChanges,
    changedFields,
    oldValues,
    newValues,
  }
}

/**
 * Detect agent changes
 */
export function detectAgentChanges(
  existing: Agent,
  rawData: any
): AgentChanges | null {
  const changedFields: string[] = []
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}

  // Map raw data to schema
  const normalizedNew = {
    name: rawData.name || rawData.full_name || 'Unknown Agent',
    email: rawData.email || null,
    username: rawData.username || null,
  }

  // Compare fields
  const fieldsToCheck = ['name', 'email', 'username']

  for (const field of fieldsToCheck) {
    const oldValue = existing[field as keyof typeof normalizedNew]
    const newValue = normalizedNew[field as keyof typeof normalizedNew]

    const normalizedOld = oldValue === null || oldValue === '' ? null : oldValue
    const normalizedNewValue = newValue === null || newValue === '' ? null : newValue

    if (normalizedOld !== normalizedNewValue) {
      changedFields.push(field)
      oldValues[field] = normalizedOld
      newValues[field] = normalizedNewValue
    }
  }

  const hasChanges = changedFields.length > 0

  if (hasChanges) {
    logger.debug('Agent changes detected', {
      agentId: existing.id,
      changedFields,
    })
  }

  return {
    hasChanges,
    changedFields,
    oldValues,
    newValues,
  }
}

/**
 * Detect department changes
 */
export function detectDepartmentChanges(
  existing: Department,
  rawData: any
): DepartmentChanges | null {
  const changedFields: string[] = []
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}

  // Parse department data (can be string or object)
  let newName: string
  if (typeof rawData === 'string') {
    newName = rawData
  } else if (typeof rawData === 'object') {
    newName = rawData.name || rawData.department_name || 'Unknown Department'
  } else {
    return null
  }

  // Compare name
  if (existing.name !== newName) {
    changedFields.push('name')
    oldValues.name = existing.name
    newValues.name = newName
  }

  const hasChanges = changedFields.length > 0

  if (hasChanges) {
    logger.debug('Department changes detected', {
      departmentId: existing.id,
      changedFields,
    })
  }

  return {
    hasChanges,
    changedFields,
    oldValues,
    newValues,
  }
}

/**
 * Detect chat changes (including status changes)
 */
export function detectChatChanges(
  existing: Chat,
  rawData: any
): ChatChanges | null {
  const changedFields: string[] = []
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}

  // Status is already normalized by B2ChatClient schema (Feature 001)
  const newStatus = rawData.status || 'OPENED'

  // Check for status change
  const statusChanged = existing.status !== newStatus
  if (statusChanged) {
    changedFields.push('status')
    oldValues.status = existing.status
    newValues.status = newStatus
  }

  // Map provider
  let newProvider = rawData.provider?.toLowerCase() || 'livechat'
  if (!['whatsapp', 'facebook', 'telegram', 'livechat', 'b2cbotapi'].includes(newProvider)) {
    newProvider = 'livechat'
  }

  if (existing.provider !== newProvider) {
    changedFields.push('provider')
    oldValues.provider = existing.provider
    newValues.provider = newProvider
  }

  // Check timestamp fields
  const timestampFields = [
    { key: 'openedAt', raw: 'opened_at' },
    { key: 'pickedUpAt', raw: 'picked_up_at' },
    { key: 'responseAt', raw: 'responded_at' },
    { key: 'closedAt', raw: 'closed_at' },
  ]

  for (const field of timestampFields) {
    const oldTime = existing[field.key as keyof Chat]
    const newTime = rawData[field.raw] ? new Date(rawData[field.raw]) : null

    // Compare timestamps (convert to ISO strings for comparison)
    const oldISO = oldTime instanceof Date ? oldTime.toISOString() : null
    const newISO = newTime ? newTime.toISOString() : null

    if (oldISO !== newISO) {
      changedFields.push(field.key)
      oldValues[field.key] = oldTime
      newValues[field.key] = newTime
    }
  }

  // Check alias and tags (new fields)
  if (rawData.alias !== undefined) {
    const oldAlias = existing.alias || null
    const newAlias = rawData.alias || null
    if (oldAlias !== newAlias) {
      changedFields.push('alias')
      oldValues.alias = oldAlias
      newValues.alias = newAlias
    }
  }

  if (rawData.tags !== undefined) {
    const oldTags = JSON.stringify(existing.tags || [])
    const newTags = JSON.stringify(rawData.tags || [])
    if (oldTags !== newTags) {
      changedFields.push('tags')
      oldValues.tags = existing.tags
      newValues.tags = rawData.tags
    }
  }

  // Check duration
  let newDuration: number | null = null
  if (rawData.duration) {
    if (typeof rawData.duration === 'string') {
      const parts = rawData.duration.split(':').map((p: string) => parseInt(p) || 0)
      if (parts.length >= 3) {
        const [hours, minutes, seconds] = parts
        newDuration = hours * 3600 + minutes * 60 + seconds
      }
    } else if (typeof rawData.duration === 'number') {
      newDuration = rawData.duration
    }
  }

  if (existing.duration !== newDuration) {
    changedFields.push('duration')
    oldValues.duration = existing.duration
    newValues.duration = newDuration
  }

  // Check survey fields (Feature 001: Full Status Support)
  const surveyFields = [
    { key: 'pollStartedAt', raw: 'poll_started_at' },
    { key: 'pollCompletedAt', raw: 'poll_completed_at' },
    { key: 'pollAbandonedAt', raw: 'poll_abandoned_at' },
  ]

  for (const field of surveyFields) {
    const oldTime = existing[field.key as keyof Chat]
    const newTime = rawData[field.raw] ? new Date(rawData[field.raw]) : null

    // Compare timestamps (convert to ISO strings for comparison)
    const oldISO = oldTime instanceof Date ? oldTime.toISOString() : null
    const newISO = newTime ? newTime.toISOString() : null

    if (oldISO !== newISO) {
      changedFields.push(field.key)
      oldValues[field.key] = oldTime
      newValues[field.key] = newTime
    }
  }

  // Check poll response (JSON field)
  if (rawData.poll_response !== undefined) {
    const oldResponse = JSON.stringify(existing.pollResponse || null)
    const newResponse = JSON.stringify(rawData.poll_response || null)
    if (oldResponse !== newResponse) {
      changedFields.push('pollResponse')
      oldValues.pollResponse = existing.pollResponse
      newValues.pollResponse = rawData.poll_response
    }
  }

  const hasChanges = changedFields.length > 0

  if (hasChanges) {
    logger.debug('Chat changes detected', {
      chatId: existing.id,
      b2chatId: existing.b2chatId,
      statusChanged,
      changedFields,
    })
  }

  return {
    hasChanges,
    statusChanged,
    previousStatus: statusChanged ? existing.status : undefined,
    newStatus: statusChanged ? (newStatus as ChatStatus) : undefined,
    changedFields,
    oldValues,
    newValues,
  }
}

/**
 * Detect new messages for a chat
 * Returns messages that don't already exist in the database
 */
export function detectNewMessages(
  existingMessageTimestamps: Date[],
  rawMessages: any[]
): any[] {
  if (!rawMessages || rawMessages.length === 0) {
    return []
  }

  // Convert existing timestamps to ISO strings for faster comparison
  const existingTimestampStrings = new Set(
    existingMessageTimestamps.map((ts) => ts.toISOString())
  )

  // Filter messages that don't have matching timestamps
  const newMessages = rawMessages.filter((msg) => {
    if (!msg.created_at) return false
    const msgTimestamp = new Date(msg.created_at).toISOString()
    return !existingTimestampStrings.has(msgTimestamp)
  })

  logger.debug('Detected new messages', {
    totalRawMessages: rawMessages.length,
    existingMessages: existingMessageTimestamps.length,
    newMessages: newMessages.length,
  })

  return newMessages
}

/**
 * Compare two objects and return a diff summary
 */
export function createChangesSummary(changes: {
  contacts?: { created: number; updated: number; unchanged: number }
  chats?: { created: number; updated: number; unchanged: number; statusChanged: number }
  agents?: { created: number; updated: number; unchanged: number }
  departments?: { created: number; updated: number; unchanged: number }
  messages?: { created: number }
}): any {
  return {
    summary: {
      totalCreated:
        (changes.contacts?.created || 0) +
        (changes.chats?.created || 0) +
        (changes.agents?.created || 0) +
        (changes.departments?.created || 0) +
        (changes.messages?.created || 0),
      totalUpdated:
        (changes.contacts?.updated || 0) +
        (changes.chats?.updated || 0) +
        (changes.agents?.updated || 0) +
        (changes.departments?.updated || 0),
      totalUnchanged:
        (changes.contacts?.unchanged || 0) +
        (changes.chats?.unchanged || 0) +
        (changes.agents?.unchanged || 0) +
        (changes.departments?.unchanged || 0),
      chatStatusChanges: changes.chats?.statusChanged || 0,
    },
    details: changes,
  }
}
