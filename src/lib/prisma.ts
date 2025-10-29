import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with conditional configuration
const createPrismaClient = () => {
  if (!process.env.DATABASE_URL) {
    // During build time or when DATABASE_URL is not set, throw descriptive error
    throw new Error(
      'DATABASE_URL environment variable is required. Please set it in your .env file or environment variables.\n' +
      'Example: DATABASE_URL="postgresql://username:password@localhost:5432/b2chat_analytics"'
    )
  }

  // Determine Prisma log level based on LOG_LEVEL env var
  const logLevel = process.env.LOG_LEVEL || 'info'
  const prismaLogs: Prisma.LogLevel[] =
    logLevel === 'trace' || logLevel === 'debug' ? ['query', 'info', 'warn', 'error'] :
    logLevel === 'info' ? ['warn', 'error'] :
    logLevel === 'warn' ? ['warn', 'error'] :
    ['error'] // error or fatal

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? prismaLogs : ['error'],
    // Add better error handling and connection configuration
    errorFormat: 'pretty',
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma