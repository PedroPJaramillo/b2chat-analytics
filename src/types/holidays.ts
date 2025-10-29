import { z } from "zod"

// Custom holiday
export const customHolidaySchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  name: z.string().min(1, "Holiday name is required"),
  recurring: z.boolean().default(false),
})

export type CustomHoliday = z.infer<typeof customHolidaySchema>

// Preset holidays configuration
export const presetHolidaysConfigSchema = z.object({
  enabled: z.boolean().default(false),
  countryCode: z.string().default("US"),
  includeRegional: z.boolean().default(false),
})

export type PresetHolidaysConfig = z.infer<typeof presetHolidaysConfigSchema>

// Holiday configuration
export const holidayConfigSchema = z.object({
  enabled: z.boolean().default(false),
  customHolidays: z.array(customHolidaySchema).default([]),
  presetHolidays: presetHolidaysConfigSchema.optional(),
  excludeFromSLA: z.boolean().default(true),
  excludeFromAnalytics: z.boolean().default(false),
})

export type HolidayConfig = z.infer<typeof holidayConfigSchema>

// Default holiday configuration
export const defaultHolidayConfig: HolidayConfig = {
  enabled: false,
  customHolidays: [],
  presetHolidays: {
    enabled: false,
    countryCode: "US",
    includeRegional: false,
  },
  excludeFromSLA: true,
  excludeFromAnalytics: false,
}

// Preset US holidays (2025)
export const usHolidays2025: CustomHoliday[] = [
  { date: "2025-01-01", name: "New Year's Day", recurring: true },
  { date: "2025-01-20", name: "Martin Luther King Jr. Day", recurring: false },
  { date: "2025-02-17", name: "Presidents' Day", recurring: false },
  { date: "2025-05-26", name: "Memorial Day", recurring: false },
  { date: "2025-07-04", name: "Independence Day", recurring: true },
  { date: "2025-09-01", name: "Labor Day", recurring: false },
  { date: "2025-10-13", name: "Columbus Day", recurring: false },
  { date: "2025-11-11", name: "Veterans Day", recurring: true },
  { date: "2025-11-27", name: "Thanksgiving Day", recurring: false },
  { date: "2025-12-25", name: "Christmas Day", recurring: true },
]

// Available country presets
export const availableCountries = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "UK", name: "United Kingdom" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
] as const

// Helper to get preset holidays for a country
export function getPresetHolidays(countryCode: string): CustomHoliday[] {
  switch (countryCode) {
    case "US":
      return usHolidays2025
    // Add more countries as needed
    default:
      return []
  }
}