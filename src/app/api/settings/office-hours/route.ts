import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { officeHoursConfigSchema, defaultOfficeHoursConfig } from "@/types/office-hours"
import { getCurrentUser } from "@/lib/auth"

// GET /api/settings/office-hours - Get office hours configuration
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch office hours configuration from system settings
    const officeHoursSetting = await prisma.systemSetting.findUnique({
      where: {
        key: "officeHours.config",
      },
    })

    if (!officeHoursSetting) {
      return NextResponse.json(defaultOfficeHoursConfig)
    }

    try {
      const config = JSON.parse(officeHoursSetting.value)
      return NextResponse.json(config)
    } catch (error) {
      console.error("Error parsing office hours config:", error)
      return NextResponse.json(defaultOfficeHoursConfig)
    }
  } catch (error) {
    console.error("Error fetching office hours configuration:", error)
    return NextResponse.json(
      { error: "Failed to fetch office hours configuration" },
      { status: 500 }
    )
  }
}

// PUT /api/settings/office-hours - Update office hours configuration
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

    // Validate the office hours configuration
    const validatedConfig = officeHoursConfigSchema.parse(body)

    // Save configuration as a single JSON setting
    await prisma.systemSetting.upsert({
      where: {
        key: "officeHours.config",
      },
      update: {
        value: JSON.stringify(validatedConfig),
      },
      create: {
        key: "officeHours.config",
        value: JSON.stringify(validatedConfig),
        category: "officeHours",
        description: "Office hours configuration including schedule and timezone",
        isSystemSetting: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Office hours configuration updated successfully",
      config: validatedConfig,
    })
  } catch (error) {
    console.error("Error updating office hours configuration:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid office hours configuration", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update office hours configuration" },
      { status: 500 }
    )
  }
}