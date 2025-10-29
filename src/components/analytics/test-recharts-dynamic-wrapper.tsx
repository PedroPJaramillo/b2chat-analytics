"use client"

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Test 1: Basic client component (no dynamic import)
export { TestRechartsBasic } from './test-recharts'

// Test 2: Dynamically loaded component
const TestRechartsDynamicClient = dynamic(
  () => import('./test-recharts').then(mod => ({ default: mod.TestRechartsDynamic })),
  {
    ssr: false,
    loading: () => (
      <Card className="border-4 border-gray-500">
        <CardHeader>
          <CardTitle>Loading dynamic chart...</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }
)

export function TestRechartsDynamicWrapper() {
  return <TestRechartsDynamicClient />
}
