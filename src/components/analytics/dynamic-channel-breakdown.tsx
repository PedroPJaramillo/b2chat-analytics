"use client"

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Dynamic wrapper for ChannelBreakdownChart to fix Recharts SSR issues
 *
 * Recharts requires client-side rendering because it uses browser-specific APIs
 * and window dimensions. This wrapper uses next/dynamic with ssr: false to
 * ensure the chart only renders on the client, preventing hydration mismatches.
 */

interface ChannelResponseTime {
  name: string
  avg: string
  p50: string
  p95: string
  count: number
}

interface ChannelBreakdownChartProps {
  data: ChannelResponseTime[]
}

// Loading skeleton that matches the chart layout
function ChartLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-[300px] w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Dynamically import ChannelBreakdownChart with SSR disabled
const ChannelBreakdownChartClient = dynamic(
  () => import('./channel-breakdown-chart').then(mod => ({ default: mod.ChannelBreakdownChart })),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton />
  }
)

// Export wrapper component with the same interface as ChannelBreakdownChart
export function DynamicChannelBreakdownChart(props: ChannelBreakdownChartProps) {
  return <ChannelBreakdownChartClient {...props} />
}
