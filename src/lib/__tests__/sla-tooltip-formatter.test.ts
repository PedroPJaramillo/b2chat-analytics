import {
  formatDuration,
  getSLAIcon,
  getAppliedThresholds,
  formatMetricRow,
  formatSLATooltip,
  type ChatWithSLA,
} from '../sla-tooltip-formatter'
import type { SLAConfig } from '@/types/sla'
import { defaultSLAConfig } from '@/types/sla'

describe('sla-tooltip-formatter', () => {
  describe('formatDuration', () => {
    it('should format milliseconds to seconds', () => {
      expect(formatDuration(5000)).toBe('5s')
      expect(formatDuration(45000)).toBe('45s')
    })

    it('should format milliseconds to minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s') // 1 min 30 sec
      expect(formatDuration(125000)).toBe('2m 5s') // 2 min 5 sec
    })

    it('should format milliseconds to hours and minutes', () => {
      expect(formatDuration(3900000)).toBe('1h 5m') // 1 hour 5 min
      expect(formatDuration(7200000)).toBe('2h') // 2 hours
    })

    it('should format milliseconds to days and hours', () => {
      expect(formatDuration(90000000)).toBe('1d 1h') // 1 day 1 hour
      expect(formatDuration(86400000)).toBe('1d') // 1 day
    })

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s')
    })

    it('should handle null and undefined', () => {
      expect(formatDuration(null)).toBe('-')
      expect(formatDuration(undefined)).toBe('-')
    })
  })

  describe('getSLAIcon', () => {
    it('should return ✅ for passed SLA when enabled', () => {
      expect(getSLAIcon(true, true)).toBe('✅')
    })

    it('should return ❌ for failed SLA when enabled', () => {
      expect(getSLAIcon(false, true)).toBe('❌')
    })

    it('should return ⊘ for disabled metrics', () => {
      expect(getSLAIcon(true, false)).toBe('⊘')
      expect(getSLAIcon(false, false)).toBe('⊘')
      expect(getSLAIcon(null, false)).toBe('⊘')
    })

    it('should return - for null/undefined when enabled', () => {
      expect(getSLAIcon(null, true)).toBe('-')
      expect(getSLAIcon(undefined, true)).toBe('-')
    })
  })

  describe('getAppliedThresholds', () => {
    const config: SLAConfig = { ...defaultSLAConfig }

    it('should return default thresholds when no overrides', () => {
      const thresholds = getAppliedThresholds('normal', 'whatsapp', {
        ...config,
        channelOverrides: undefined,
        priorityOverrides: undefined,
      })

      expect(thresholds).toEqual({
        pickup: 2,
        firstResponse: 5,
        avgResponse: 5,
        resolution: 30,
      })
    })

    it('should apply channel overrides when priority has no override', () => {
      // Create config without priority overrides
      const configWithoutPriorityOverrides: SLAConfig = {
        ...config,
        priorityOverrides: undefined,
      }

      const thresholds = getAppliedThresholds('normal', 'whatsapp', configWithoutPriorityOverrides)

      // WhatsApp overrides: FR=3, AR=3, RES=20, PU=1
      expect(thresholds.pickup).toBe(1)
      expect(thresholds.firstResponse).toBe(3)
      expect(thresholds.avgResponse).toBe(3)
      expect(thresholds.resolution).toBe(20)
    })

    it('should apply priority overrides', () => {
      const thresholds = getAppliedThresholds('urgent', 'telegram', config)

      // Urgent overrides: FR=1, AR=1, RES=10, PU=1
      expect(thresholds.pickup).toBe(1)
      expect(thresholds.firstResponse).toBe(1)
      expect(thresholds.avgResponse).toBe(1)
      expect(thresholds.resolution).toBe(10)
    })

    it('should prioritize priority overrides over channel overrides', () => {
      // Both WhatsApp and Urgent have overrides
      // Priority should win
      const thresholds = getAppliedThresholds('urgent', 'whatsapp', config)

      // Urgent takes precedence
      expect(thresholds.pickup).toBe(1)
      expect(thresholds.firstResponse).toBe(1)
      expect(thresholds.avgResponse).toBe(1)
      expect(thresholds.resolution).toBe(10)
    })

    it('should handle different priority levels correctly', () => {
      const urgentThresholds = getAppliedThresholds('urgent', 'telegram', config)
      const highThresholds = getAppliedThresholds('high', 'telegram', config)
      const normalThresholds = getAppliedThresholds('normal', 'telegram', config)
      const lowThresholds = getAppliedThresholds('low', 'telegram', config)

      expect(urgentThresholds.firstResponse).toBe(1)
      expect(highThresholds.firstResponse).toBe(3)
      expect(normalThresholds.firstResponse).toBe(5)
      expect(lowThresholds.firstResponse).toBe(10)
    })

    it('should handle different channel types correctly', () => {
      // When priority overrides exist, they take precedence
      // So with default config, "normal" priority uses normal override (FR=5) regardless of channel
      const whatsappThresholds = getAppliedThresholds('normal', 'whatsapp', config)
      const livechatThresholds = getAppliedThresholds('normal', 'livechat', config)
      const facebookThresholds = getAppliedThresholds('normal', 'facebook', config)

      // All use "normal" priority override (FR=5, PU=2)
      expect(whatsappThresholds.firstResponse).toBe(5)
      expect(whatsappThresholds.pickup).toBe(2)
      expect(livechatThresholds.firstResponse).toBe(5)
      expect(livechatThresholds.pickup).toBe(2)
      expect(facebookThresholds.firstResponse).toBe(5)
      expect(facebookThresholds.pickup).toBe(2)
    })
  })

  describe('formatMetricRow', () => {
    it('should format metric row with passing SLA', () => {
      const result = formatMetricRow(
        'Pickup Time',
        90000, // 1m 30s
        true, // WC passed
        75000, // 1m 15s
        true, // BH passed
        2, // 2 min threshold
        true // enabled
      )

      expect(result).toContain('PICKUP TIME')
      expect(result).toContain('Wall Clock:     ✅ 1m 30s / 2m')
      expect(result).toContain('Business Hours: ✅ 1m 15s / 2m')
    })

    it('should format metric row with breached SLA', () => {
      const result = formatMetricRow(
        'First Response',
        375000, // 6m 15s
        false, // WC failed
        345000, // 5m 45s
        false, // BH failed
        5, // 5 min threshold
        true // enabled
      )

      expect(result).toContain('FIRST RESPONSE')
      expect(result).toContain('Wall Clock:     ❌ 6m 15s / 5m')
      expect(result).toContain('Business Hours: ❌ 5m 45s / 5m')
    })

    it('should format disabled metric', () => {
      const result = formatMetricRow(
        'Avg Response',
        300000,
        false,
        250000,
        false,
        5,
        false // disabled
      )

      expect(result).toContain('AVG RESPONSE')
      expect(result).toContain('Wall Clock:     ⊘ Disabled')
      expect(result).toContain('Business Hours: ⊘ Disabled')
    })

    it('should handle null/incomplete values', () => {
      const result = formatMetricRow(
        'Resolution',
        null,
        null,
        null,
        null,
        30,
        true // enabled
      )

      expect(result).toContain('RESOLUTION')
      expect(result).toContain('Wall Clock:     - Not available yet')
      expect(result).toContain('Business Hours: - Not available yet')
    })
  })

  describe('formatSLATooltip', () => {
    const mockConfig: SLAConfig = { ...defaultSLAConfig }

    it('should format complete tooltip with all metrics passing', () => {
      const chat: ChatWithSLA = {
        priority: 'normal',
        provider: 'whatsapp',
        pickupTimeMs: 90000, // 1m 30s
        pickupSLA: true,
        pickupTimeBHMs: 75000,
        pickupSLABH: true,
        firstResponseTimeMs: 180000, // 3m
        firstResponseSLA: true,
        firstResponseTimeBHMs: 150000,
        firstResponseSLABH: true,
        avgResponseTimeMs: 120000, // 2m
        avgResponseSLA: true,
        avgResponseTimeBHMs: 100000,
        avgResponseSLABH: true,
        resolutionTimeMs: 900000, // 15m
        resolutionSLA: true,
        resolutionTimeBHMs: 800000,
        resolutionSLABH: true,
        overallSLA: true,
        overallSLABH: true,
      }

      const result = formatSLATooltip(chat, mockConfig)

      expect(result).toContain('Overall SLA: Within SLA ✅')
      expect(result).toContain('PICKUP TIME')
      expect(result).toContain('FIRST RESPONSE TIME')
      expect(result).toContain('AVG RESPONSE TIME')
      expect(result).toContain('RESOLUTION TIME')
      expect(result).toContain('Config: Normal Priority, WhatsApp')
    })

    it('should format tooltip with one metric breached', () => {
      const chat: ChatWithSLA = {
        priority: 'high',
        provider: 'telegram',
        pickupTimeMs: 90000,
        pickupSLA: true,
        pickupTimeBHMs: 75000,
        pickupSLABH: true,
        firstResponseTimeMs: 375000, // 6m 15s - BREACHED (threshold: 3m for high priority)
        firstResponseSLA: false,
        firstResponseTimeBHMs: 345000,
        firstResponseSLABH: false,
        avgResponseTimeMs: null,
        avgResponseSLA: null,
        avgResponseTimeBHMs: null,
        avgResponseSLABH: null,
        resolutionTimeMs: null,
        resolutionSLA: null,
        resolutionTimeBHMs: null,
        resolutionSLABH: null,
        overallSLA: false, // BREACHED
        overallSLABH: false,
      }

      const result = formatSLATooltip(chat, mockConfig)

      expect(result).toContain('Overall SLA: Breached ❌')
      expect(result).toContain('✅ 1m 30s / 1m') // Pickup (high priority = 1m)
      expect(result).toContain('❌ 6m 15s / 3m') // First Response (high priority = 3m)
      expect(result).toContain('Config: High Priority, Telegram')
    })

    it('should show disabled metrics with ⊘ icon', () => {
      const chat: ChatWithSLA = {
        priority: 'normal',
        provider: 'livechat',
        pickupTimeMs: 45000,
        pickupSLA: true,
        pickupTimeBHMs: 40000,
        pickupSLABH: true,
        firstResponseTimeMs: 55000,
        firstResponseSLA: true,
        firstResponseTimeBHMs: 50000,
        firstResponseSLABH: true,
        avgResponseTimeMs: 120000,
        avgResponseSLA: true, // This doesn't matter
        avgResponseTimeBHMs: 100000,
        avgResponseSLABH: true,
        resolutionTimeMs: 600000,
        resolutionSLA: true, // This doesn't matter
        resolutionTimeBHMs: 550000,
        resolutionSLABH: true,
        overallSLA: true,
        overallSLABH: true,
      }

      const result = formatSLATooltip(chat, mockConfig)

      // Avg Response and Resolution are disabled by default
      const lines = result.split('\n')
      const avgResponseSection = lines.slice(lines.findIndex(l => l.includes('AVG RESPONSE')))
      const resolutionSection = lines.slice(lines.findIndex(l => l.includes('RESOLUTION')))

      expect(avgResponseSection.join('\n')).toContain('⊘ Disabled')
      expect(resolutionSection.join('\n')).toContain('⊘ Disabled')
    })

    it('should handle incomplete data (null values)', () => {
      const chat: ChatWithSLA = {
        priority: 'urgent',
        provider: 'facebook',
        pickupTimeMs: 60000,
        pickupSLA: true,
        pickupTimeBHMs: 55000,
        pickupSLABH: true,
        firstResponseTimeMs: null, // Not yet responded
        firstResponseSLA: null,
        firstResponseTimeBHMs: null,
        firstResponseSLABH: null,
        avgResponseTimeMs: null,
        avgResponseSLA: null,
        avgResponseTimeBHMs: null,
        avgResponseSLABH: null,
        resolutionTimeMs: null, // Not yet closed
        resolutionSLA: null,
        resolutionTimeBHMs: null,
        resolutionSLABH: null,
        overallSLA: null, // Incomplete
        overallSLABH: null,
      }

      const result = formatSLATooltip(chat, mockConfig)

      expect(result).toContain('Overall SLA: Incomplete -')
      expect(result).toContain('- Not available yet')
      expect(result).toContain('Config: Urgent Priority, Facebook')
    })

    it('should apply correct thresholds based on priority', () => {
      const urgentChat: ChatWithSLA = {
        priority: 'urgent',
        provider: 'whatsapp',
        pickupTimeMs: 45000,
        pickupSLA: true,
        pickupTimeBHMs: 40000,
        pickupSLABH: true,
        firstResponseTimeMs: 55000,
        firstResponseSLA: true,
        firstResponseTimeBHMs: 50000,
        firstResponseSLABH: true,
        avgResponseTimeMs: null,
        avgResponseSLA: null,
        avgResponseTimeBHMs: null,
        avgResponseSLABH: null,
        resolutionTimeMs: null,
        resolutionSLA: null,
        resolutionTimeBHMs: null,
        resolutionSLABH: null,
        overallSLA: true,
        overallSLABH: true,
      }

      const result = formatSLATooltip(urgentChat, mockConfig)

      // Urgent priority: PU=1m, FR=1m
      expect(result).toContain('45s / 1m') // Pickup
      expect(result).toContain('55s / 1m') // First Response
    })

    it('should apply correct thresholds based on channel', () => {
      // Use config without priority overrides so channel overrides apply
      const configWithoutPriorityOverrides: SLAConfig = {
        ...mockConfig,
        priorityOverrides: undefined,
      }

      const livechatChat: ChatWithSLA = {
        priority: 'normal',
        provider: 'livechat',
        pickupTimeMs: 30000,
        pickupSLA: true,
        pickupTimeBHMs: 25000,
        pickupSLABH: true,
        firstResponseTimeMs: 45000,
        firstResponseSLA: true,
        firstResponseTimeBHMs: 40000,
        firstResponseSLABH: true,
        avgResponseTimeMs: null,
        avgResponseSLA: null,
        avgResponseTimeBHMs: null,
        avgResponseSLABH: null,
        resolutionTimeMs: null,
        resolutionSLA: null,
        resolutionTimeBHMs: null,
        resolutionSLABH: null,
        overallSLA: true,
        overallSLABH: true,
      }

      const result = formatSLATooltip(livechatChat, configWithoutPriorityOverrides)

      // LiveChat: PU=1m, FR=1m
      expect(result).toContain('30s / 1m') // Pickup
      expect(result).toContain('45s / 1m') // First Response
    })

    it('should prioritize priority overrides over channel overrides', () => {
      // WhatsApp normally has FR=3m, but Urgent priority should override to FR=1m
      const urgentWhatsappChat: ChatWithSLA = {
        priority: 'urgent',
        provider: 'whatsapp',
        pickupTimeMs: 45000,
        pickupSLA: true,
        pickupTimeBHMs: 40000,
        pickupSLABH: true,
        firstResponseTimeMs: 55000,
        firstResponseSLA: true,
        firstResponseTimeBHMs: 50000,
        firstResponseSLABH: true,
        avgResponseTimeMs: null,
        avgResponseSLA: null,
        avgResponseTimeBHMs: null,
        avgResponseSLABH: null,
        resolutionTimeMs: null,
        resolutionSLA: null,
        resolutionTimeBHMs: null,
        resolutionSLABH: null,
        overallSLA: true,
        overallSLABH: true,
      }

      const result = formatSLATooltip(urgentWhatsappChat, mockConfig)

      // Should use Urgent thresholds (1m) NOT WhatsApp thresholds (3m)
      expect(result).toContain('55s / 1m')
      expect(result).toContain('Config: Urgent Priority, WhatsApp')
    })

    it('should format provider names correctly', () => {
      const providers: Array<ChatWithSLA['provider']> = [
        'whatsapp',
        'telegram',
        'facebook',
        'livechat',
        'b2cbotapi',
      ]

      const expectedNames = [
        'WhatsApp',
        'Telegram',
        'Facebook',
        'Live Chat',
        'B2C Bot API',
      ]

      providers.forEach((provider, index) => {
        const chat: ChatWithSLA = {
          priority: 'normal',
          provider,
          pickupTimeMs: 60000,
          pickupSLA: true,
          pickupTimeBHMs: 55000,
          pickupSLABH: true,
          firstResponseTimeMs: null,
          firstResponseSLA: null,
          firstResponseTimeBHMs: null,
          firstResponseSLABH: null,
          avgResponseTimeMs: null,
          avgResponseSLA: null,
          avgResponseTimeBHMs: null,
          avgResponseSLABH: null,
          resolutionTimeMs: null,
          resolutionSLA: null,
          resolutionTimeBHMs: null,
          resolutionSLABH: null,
          overallSLA: null,
          overallSLABH: null,
        }

        const result = formatSLATooltip(chat, mockConfig)
        expect(result).toContain(expectedNames[index])
      })
    })

    it('should format priority names correctly', () => {
      const priorities: Array<ChatWithSLA['priority']> = [
        'urgent',
        'high',
        'normal',
        'low',
      ]

      const expectedNames = ['Urgent', 'High', 'Normal', 'Low']

      priorities.forEach((priority, index) => {
        const chat: ChatWithSLA = {
          priority,
          provider: 'whatsapp',
          pickupTimeMs: 60000,
          pickupSLA: true,
          pickupTimeBHMs: 55000,
          pickupSLABH: true,
          firstResponseTimeMs: null,
          firstResponseSLA: null,
          firstResponseTimeBHMs: null,
          firstResponseSLABH: null,
          avgResponseTimeMs: null,
          avgResponseSLA: null,
          avgResponseTimeBHMs: null,
          avgResponseSLABH: null,
          resolutionTimeMs: null,
          resolutionSLA: null,
          resolutionTimeBHMs: null,
          resolutionSLABH: null,
          overallSLA: null,
          overallSLABH: null,
        }

        const result = formatSLATooltip(chat, mockConfig)
        expect(result).toContain(`${expectedNames[index]} Priority`)
      })
    })
  })
})
