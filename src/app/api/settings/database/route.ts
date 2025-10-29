import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/settings/database - Get database connection information
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get database stats
    const [
      userCount,
      agentCount,
      contactCount,
      chatCount,
      messageCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.agent.count(),
      prisma.contact.count(),
      prisma.chat.count(),
      prisma.message.count(),
    ])

    // Test database connection
    const connectionTest = await prisma.$queryRaw`SELECT 1 as connected`
    const isConnected = Array.isArray(connectionTest) && connectionTest.length > 0

    // Get database version info
    const versionResult = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`
    const dbVersion = versionResult[0]?.version || "Unknown"

    // Parse PostgreSQL version
    const versionMatch = dbVersion.match(/PostgreSQL ([\d.]+)/)
    const postgresVersion = versionMatch ? versionMatch[1] : "Unknown"

    // Get database name from connection
    const dbNameResult = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`
    const databaseName = dbNameResult[0]?.current_database || "Unknown"

    // Get database size
    const sizeResult = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `
    const databaseSize = sizeResult[0]?.size || "Unknown"

    return NextResponse.json({
      connected: isConnected,
      version: postgresVersion,
      databaseName,
      databaseSize,
      stats: {
        users: userCount,
        agents: agentCount,
        contacts: contactCount,
        chats: chatCount,
        messages: messageCount,
        total: userCount + agentCount + contactCount + chatCount + messageCount,
      },
    })
  } catch (error) {
    console.error("Error fetching database info:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch database information",
        connected: false,
      },
      { status: 500 }
    )
  }
}

// POST /api/settings/database/test - Test database connection
export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Simple connection test
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const endTime = Date.now()
    const latency = endTime - startTime

    return NextResponse.json({
      success: true,
      connected: true,
      latency: `${latency}ms`,
      message: "Database connection successful",
    })
  } catch (error) {
    console.error("Database connection test failed:", error)
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 }
    )
  }
}