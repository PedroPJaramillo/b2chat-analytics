import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Default settings structure
const defaultSettings = {
  notifications: {
    emailOnSyncComplete: true,
    emailOnSyncError: true,
    alertOnSystemError: true,
  },
  display: {
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    numberFormat: "en-US",
    defaultDashboardView: "overview",
    itemsPerPage: 25,
  },
  sync: {
    defaultTimeRange: "7d",
    autoSync: true,
    mediaBackup: true,
    dataRetentionDays: 365,
  },
  export: {
    defaultFormat: "csv",
    fileRetentionDays: 30,
    autoCleanup: true,
  },
}

// Validation schema
const settingsSchema = z.object({
  notifications: z.object({
    emailOnSyncComplete: z.boolean(),
    emailOnSyncError: z.boolean(),
    alertOnSystemError: z.boolean(),
  }).optional(),
  display: z.object({
    dateFormat: z.string(),
    timeFormat: z.enum(["12h", "24h"]),
    numberFormat: z.string(),
    defaultDashboardView: z.string(),
    itemsPerPage: z.number().min(10).max(100),
  }).optional(),
  sync: z.object({
    defaultTimeRange: z.enum(["1d", "7d", "30d", "90d", "full"]),
    autoSync: z.boolean(),
    mediaBackup: z.boolean(),
    dataRetentionDays: z.number().min(30).max(3650),
  }).optional(),
  export: z.object({
    defaultFormat: z.enum(["csv", "excel", "pdf"]),
    fileRetentionDays: z.number().min(1).max(365),
    autoCleanup: z.boolean(),
  }).optional(),
})

// GET /api/settings - Fetch user settings
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch all settings for the current user
    const userSettings = await prisma.systemSetting.findMany({
      where: {
        userId: userId,
      },
    })

    // Merge with defaults
    const settings = { ...defaultSettings }

    // Parse stored settings and merge
    userSettings.forEach((setting) => {
      const [category, key] = setting.key.split(".")
      if (category && key && settings[category as keyof typeof settings]) {
        try {
          const value = JSON.parse(setting.value)
          ;(settings[category as keyof typeof settings] as any)[key] = value
        } catch {
          // If parsing fails, use the raw value
          ;(settings[category as keyof typeof settings] as any)[key] = setting.value
        }
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update user settings
export async function PUT(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate the settings
    const validatedSettings = settingsSchema.parse(body)

    // Flatten and save each setting
    const settingsToSave: Array<{
      key: string
      value: string
      category: string
      description: string
    }> = []

    if (validatedSettings.notifications) {
      Object.entries(validatedSettings.notifications).forEach(([key, value]) => {
        settingsToSave.push({
          key: `notifications.${key}`,
          value: JSON.stringify(value),
          category: "notifications",
          description: `Notification setting: ${key}`,
        })
      })
    }

    if (validatedSettings.display) {
      Object.entries(validatedSettings.display).forEach(([key, value]) => {
        settingsToSave.push({
          key: `display.${key}`,
          value: JSON.stringify(value),
          category: "display",
          description: `Display setting: ${key}`,
        })
      })
    }

    if (validatedSettings.sync) {
      Object.entries(validatedSettings.sync).forEach(([key, value]) => {
        settingsToSave.push({
          key: `sync.${key}`,
          value: JSON.stringify(value),
          category: "sync",
          description: `Sync setting: ${key}`,
        })
      })
    }

    if (validatedSettings.export) {
      Object.entries(validatedSettings.export).forEach(([key, value]) => {
        settingsToSave.push({
          key: `export.${key}`,
          value: JSON.stringify(value),
          category: "export",
          description: `Export setting: ${key}`,
        })
      })
    }

    // Upsert all settings
    await Promise.all(
      settingsToSave.map((setting) =>
        prisma.systemSetting.upsert({
          where: {
            key: setting.key,
          },
          update: {
            value: setting.value,
            userId: userId,
          },
          create: {
            key: setting.key,
            value: setting.value,
            category: setting.category,
            description: setting.description,
            userId: userId,
            isSystemSetting: false,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    })
  } catch (error) {
    console.error("Error updating settings:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid settings data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    )
  }
}