/**
 * Unit tests for Claude response index-based mapping
 */

import { describe, it, expect, jest } from '@jest/globals'

describe('Claude Response Index Mapping', () => {
  describe('Index-to-Chat Mapping', () => {
    it('should create correct index-to-chat mapping', () => {
      const batch = [
        { id: 'chat-uuid-1', messages: [] },
        { id: 'chat-uuid-2', messages: [] },
        { id: 'chat-uuid-3', messages: [] },
      ]

      const indexToChatMap = new Map<number, string>()
      batch.forEach((chat, index) => {
        indexToChatMap.set(index, chat.id)
      })

      expect(indexToChatMap.get(0)).toBe('chat-uuid-1')
      expect(indexToChatMap.get(1)).toBe('chat-uuid-2')
      expect(indexToChatMap.get(2)).toBe('chat-uuid-3')
      expect(indexToChatMap.size).toBe(3)
    })

    it('should handle single chat correctly', () => {
      const batch = [{ id: 'single-chat-id', messages: [] }]

      const indexToChatMap = new Map<number, string>()
      batch.forEach((chat, index) => {
        indexToChatMap.set(index, chat.id)
      })

      expect(indexToChatMap.get(0)).toBe('single-chat-id')
      expect(indexToChatMap.size).toBe(1)
    })

    it('should handle empty batch', () => {
      const batch: Array<{ id: string; messages: any[] }> = []

      const indexToChatMap = new Map<number, string>()
      batch.forEach((chat, index) => {
        indexToChatMap.set(index, chat.id)
      })

      expect(indexToChatMap.size).toBe(0)
    })
  })

  describe('Missing ConversationIndex Handling', () => {
    it('should skip results with missing conversationIndex', () => {
      const claudeResponse = {
        conversations: [
          { conversationIndex: 0, customerIntent: 'PAYMENT' },
          // conversationIndex 1 is missing - Claude skipped it
          { conversationIndex: 2, customerIntent: 'LEGAL' },
        ],
      }

      const indexToChatMap = new Map([
        [0, 'chat-1'],
        [1, 'chat-2'],
        [2, 'chat-3'],
      ])

      const processedChatIds: string[] = []
      for (const result of claudeResponse.conversations) {
        const chatId = indexToChatMap.get(result.conversationIndex)
        if (chatId) {
          processedChatIds.push(chatId)
        }
      }

      expect(processedChatIds).toEqual(['chat-1', 'chat-3'])
      expect(processedChatIds.length).toBe(2) // Should process 2 out of 3
    })

    it('should skip results with invalid conversationIndex', () => {
      const claudeResponse = {
        conversations: [
          { conversationIndex: 0, customerIntent: 'PAYMENT' },
          { conversationIndex: 99, customerIntent: 'LEGAL' }, // Invalid index
        ],
      }

      const indexToChatMap = new Map([
        [0, 'chat-1'],
        [1, 'chat-2'],
      ])

      const processedChatIds: string[] = []
      const skippedIndices: number[] = []

      for (const result of claudeResponse.conversations) {
        const chatId = indexToChatMap.get(result.conversationIndex)
        if (chatId) {
          processedChatIds.push(chatId)
        } else {
          skippedIndices.push(result.conversationIndex)
        }
      }

      expect(processedChatIds).toEqual(['chat-1'])
      expect(skippedIndices).toEqual([99])
    })
  })

  describe('ChatId Validation', () => {
    it('should warn on chatId mismatch but use mapped chatId', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = {
        conversationIndex: 0,
        chatId: 'wrong-chat-id', // Claude hallucinated
        customerIntent: 'PAYMENT',
      }

      const indexToChatMap = new Map([[0, 'correct-chat-id']])
      const chatId = indexToChatMap.get(result.conversationIndex)

      // Simulate the validation logic
      if (result.chatId && result.chatId !== chatId) {
        console.warn('chatId mismatch')
      }

      expect(chatId).toBe('correct-chat-id') // Use mapped, not Claude's
      expect(consoleSpy).toHaveBeenCalledWith('chatId mismatch')

      consoleSpy.mockRestore()
    })

    it('should not warn when chatIds match', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = {
        conversationIndex: 0,
        chatId: 'correct-chat-id',
        customerIntent: 'PAYMENT',
      }

      const indexToChatMap = new Map([[0, 'correct-chat-id']])
      const chatId = indexToChatMap.get(result.conversationIndex)

      if (result.chatId && result.chatId !== chatId) {
        console.warn('chatId mismatch')
      }

      expect(chatId).toBe('correct-chat-id')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should not warn when Claude does not return chatId', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = {
        conversationIndex: 0,
        // chatId is not present
        customerIntent: 'PAYMENT',
      }

      const indexToChatMap = new Map([[0, 'correct-chat-id']])
      const chatId = indexToChatMap.get(result.conversationIndex)

      if (result.chatId && result.chatId !== chatId) {
        console.warn('chatId mismatch')
      }

      expect(chatId).toBe('correct-chat-id')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Batch Processing', () => {
    it('should process all conversations when all indices are valid', () => {
      const claudeResponse = {
        conversations: [
          { conversationIndex: 0, customerIntent: 'PAYMENT' },
          { conversationIndex: 1, customerIntent: 'LEGAL' },
          { conversationIndex: 2, customerIntent: 'OTHER' },
        ],
      }

      const indexToChatMap = new Map([
        [0, 'chat-1'],
        [1, 'chat-2'],
        [2, 'chat-3'],
      ])

      const processedChatIds: string[] = []
      for (const result of claudeResponse.conversations) {
        const chatId = indexToChatMap.get(result.conversationIndex)
        if (chatId) {
          processedChatIds.push(chatId)
        }
      }

      expect(processedChatIds).toEqual(['chat-1', 'chat-2', 'chat-3'])
      expect(processedChatIds.length).toBe(3)
    })

    it('should handle out-of-order responses', () => {
      const claudeResponse = {
        conversations: [
          { conversationIndex: 2, customerIntent: 'LEGAL' },
          { conversationIndex: 0, customerIntent: 'PAYMENT' },
          { conversationIndex: 1, customerIntent: 'OTHER' },
        ],
      }

      const indexToChatMap = new Map([
        [0, 'chat-1'],
        [1, 'chat-2'],
        [2, 'chat-3'],
      ])

      const processedChatIds: string[] = []
      for (const result of claudeResponse.conversations) {
        const chatId = indexToChatMap.get(result.conversationIndex)
        if (chatId) {
          processedChatIds.push(chatId)
        }
      }

      // Order depends on Claude's response order, not index order
      expect(processedChatIds).toEqual(['chat-3', 'chat-1', 'chat-2'])
      expect(processedChatIds.length).toBe(3)
    })
  })
})
