import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { holidayConfigSchema, defaultHolidayConfig } from "@/types/holidays"
import { getCurrentUser } from "@/lib/auth"

// GET /api/settings/holidays - Get holiday configuration
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch holiday configuration from system settings
    const holidaySetting = await prisma.systemSetting.findUnique({
      where: {
        key: "holidays.config",
      },
    })

    if (!holidaySetting) {
      return NextResponse.json(defaultHolidayConfig)
    }

    try {
      const config = JSON.parse(holidaySetting.value)
      return NextResponse.json(config)
    } catch (error) {
      console.error("Error parsing holiday config:", error)
      return NextResponse.json(defaultHolidayConfig)
    }
  } catch (error) {
    console.error("Error fetching holiday configuration:", error)
    return NextResponse.json(
      { error: "Failed to fetch holiday configuration" },
      { status: 500 }
    )
  }
}

// PUT /api/settings/holidays - Update holiday configuration
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

    // Validate the holiday configuration
    const validatedConfig = holidayConfigSchema.parse(body)

    // Save configuration as a single JSON setting
    await prisma.systemSetting.upsert({
      where: {
        key: "holidays.config",
      },
      update: {
        value: JSON.stringify(validatedConfig),
      },
      create: {
        key: "holidays.config",
        value: JSON.stringify(validatedConfig),
        category: "holidays",
        description: "Holiday configuration including custom and preset holidays",
        isSystemSetting: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Holiday configuration updated successfully",
      config: validatedConfig,
    })
  } catch (error) {
    console.error("Error updating holiday configuration:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid holiday configuration", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update holiday configuration" },
      { status: 500 }
    )
  }
}