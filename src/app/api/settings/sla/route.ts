import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { slaConfigSchema, defaultSLAConfig } from "@/types/sla"
import { ZodError } from "zod"
import { getCurrentUser } from "@/lib/auth"

// GET /api/settings/sla - Get SLA configuration
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch SLA configuration from system settings
    const slaSettings = await prisma.systemSetting.findMany({
      where: {
        category: "sla",
      },
    })

    // Start with defaults
    let config = { ...defaultSLAConfig }

    // Merge stored settings
    slaSettings.forEach((setting) => {
      const key = setting.key.replace("sla.", "")
      try {
        const value = JSON.parse(setting.value)

        if (key === "channelOverrides" || key === "priorityOverrides" || key === "enabledMetrics") {
          config[key] = value
        } else {
          // Handle simple numeric values
          ;(config as any)[key] = value
        }
      } catch (error) {
        console.error(`Error parsing SLA setting ${setting.key}:`, error)
      }
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error fetching SLA configuration:", error)
    return NextResponse.json(
      { error: "Failed to fetch SLA configuration" },
      { status: 500 }
    )
  }
}

// PUT /api/settings/sla - Update SLA configuration
export async function PUT(request: Request) {
  try {
    // Check authentication and get user with role from Clerk metadata
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is admin (role from Clerk publicMetadata)
    if (user.role !== "Admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()

    console.log('Received SLA config update:', JSON.stringify(body, null, 2))

    // Validate the SLA configuration
    const validatedConfig = slaConfigSchema.parse(body)

    // Validate at least one metric is enabled
    if (validatedConfig.enabledMetrics) {
      const { pickup, firstResponse, avgResponse, resolution } = validatedConfig.enabledMetrics
      if (!pickup && !firstResponse && !avgResponse && !resolution) {
        return NextResponse.json(
          { error: "At least one SLA metric must be enabled" },
          { status: 400 }
        )
      }
    }

    // Prepare settings to save
    const settingsToSave = [
      {
        key: "sla.firstResponseThreshold",
        value: JSON.stringify(validatedConfig.firstResponseThreshold),
        category: "sla",
        description: "First response SLA threshold in minutes",
      },
      {
        key: "sla.avgResponseThreshold",
        value: JSON.stringify(validatedConfig.avgResponseThreshold),
        category: "sla",
        description: "Average response SLA threshold in minutes",
      },
      {
        key: "sla.resolutionThreshold",
        value: JSON.stringify(validatedConfig.resolutionThreshold),
        category: "sla",
        description: "Resolution SLA threshold in minutes",
      },
      {
        key: "sla.pickupThreshold",
        value: JSON.stringify(validatedConfig.pickupThreshold),
        category: "sla",
        description: "Pickup SLA threshold in minutes",
      },
      {
        key: "sla.firstResponseTarget",
        value: JSON.stringify(validatedConfig.firstResponseTarget),
        category: "sla",
        description: "First response compliance target percentage",
      },
      {
        key: "sla.avgResponseTarget",
        value: JSON.stringify(validatedConfig.avgResponseTarget),
        category: "sla",
        description: "Average response compliance target percentage",
      },
      {
        key: "sla.resolutionTarget",
        value: JSON.stringify(validatedConfig.resolutionTarget),
        category: "sla",
        description: "Resolution compliance target percentage",
      },
      {
        key: "sla.pickupTarget",
        value: JSON.stringify(validatedConfig.pickupTarget),
        category: "sla",
        description: "Pickup compliance target percentage",
      },
      {
        key: "sla.enabledMetrics",
        value: JSON.stringify(validatedConfig.enabledMetrics),
        category: "sla",
        description: "Enabled SLA metrics that count toward overall compliance",
      },
    ]

    // Add channel overrides if provided
    if (validatedConfig.channelOverrides) {
      settingsToSave.push({
        key: "sla.channelOverrides",
        value: JSON.stringify(validatedConfig.channelOverrides),
        category: "sla",
        description: "Channel-specific SLA threshold overrides",
      })
    }

    // Add priority overrides if provided
    if (validatedConfig.priorityOverrides) {
      settingsToSave.push({
        key: "sla.priorityOverrides",
        value: JSON.stringify(validatedConfig.priorityOverrides),
        category: "sla",
        description: "Priority-based SLA threshold overrides",
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
          },
          create: {
            key: setting.key,
            value: setting.value,
            category: setting.category,
            description: setting.description,
            isSystemSetting: true,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: "SLA configuration updated successfully",
      config: validatedConfig,
    })
  } catch (error) {
    console.error("Error updating SLA configuration:", error)

    if (error instanceof ZodError) {
      console.error("Zod validation errors:", error.errors)
      return NextResponse.json(
        {
          error: "Invalid SLA configuration",
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update SLA configuration" },
      { status: 500 }
    )
  }
}