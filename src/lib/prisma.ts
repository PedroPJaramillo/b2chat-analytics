import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with conditional configuration
const createPrismaClient = () => {
  if (!process.env.DATABASE_URL) {
    // During build time, return a mock client to prevent errors
    return new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://placeholder:5432/placeholder',
        },
      },
    })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma