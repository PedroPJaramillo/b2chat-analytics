import { z } from "zod"

// Time string validation (HH:MM format in 24-hour)
const timeStringSchema = z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (use HH:MM)")

// Day schedule
export const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: timeStringSchema,
  end: timeStringSchema,
})

export type DaySchedule = z.infer<typeof dayScheduleSchema>

// Weekly schedule
export const weeklyScheduleSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
})

export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>

// Office hours configuration
export const officeHoursConfigSchema = z.object({
  enabled: z.boolean().default(false),
  timezone: z.string().default("America/New_York"),
  schedule: weeklyScheduleSchema,
  applyToAnalytics: z.boolean().default(true),
  applyToSLA: z.boolean().default(true),
})

export type OfficeHoursConfig = z.infer<typeof officeHoursConfigSchema>

// Default office hours configuration
export const defaultOfficeHoursConfig: OfficeHoursConfig = {
  enabled: false,
  timezone: "America/New_York",
  schedule: {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "10:00", end: "14:00" },
    sunday: { enabled: false, start: "10:00", end: "14:00" },
  },
  applyToAnalytics: true,
  applyToSLA: true,
}

// Quick presets
export const officeHoursPresets = {
  "Standard Business Hours": {
    monday: { enabled: true, start: "08:00", end: "18:00" },
    tuesday: { enabled: true, start: "08:00", end: "18:00" },
    wednesday: { enabled: true, start: "08:00", end: "18:00" },
    thursday: { enabled: true, start: "08:00", end: "18:00" },
    friday: { enabled: true, start: "08:00", end: "18:00" },
    saturday: { enabled: true, start: "08:00", end: "12:00" },
    sunday: { enabled: false, start: "10:00", end: "14:00" },
  },
  "24/7": {
    monday: { enabled: true, start: "00:00", end: "23:59" },
    tuesday: { enabled: true, start: "00:00", end: "23:59" },
    wednesday: { enabled: true, start: "00:00", end: "23:59" },
    thursday: { enabled: true, start: "00:00", end: "23:59" },
    friday: { enabled: true, start: "00:00", end: "23:59" },
    saturday: { enabled: true, start: "00:00", end: "23:59" },
    sunday: { enabled: true, start: "00:00", end: "23:59" },
  },
  "Extended Hours": {
    monday: { enabled: true, start: "07:00", end: "19:00" },
    tuesday: { enabled: true, start: "07:00", end: "19:00" },
    wednesday: { enabled: true, start: "07:00", end: "19:00" },
    thursday: { enabled: true, start: "07:00", end: "19:00" },
    friday: { enabled: true, start: "07:00", end: "19:00" },
    saturday: { enabled: true, start: "07:00", end: "19:00" },
    sunday: { enabled: false, start: "10:00", end: "14:00" },
  },
} as const

// Common timezones
export const commonTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Bogota",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const