import { defineConfig } from 'prisma'

export default defineConfig({
  seed: 'tsx prisma/seed.ts',
  // Add other Prisma configuration options here
  errorFormat: 'pretty',
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
})