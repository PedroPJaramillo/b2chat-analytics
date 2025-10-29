"use client"

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { VolumeChartData } from "@/hooks/use-volume-chart"

/**
 * Dynamic wrapper for VolumeChart to fix Recharts SSR issues
 *
 * Recharts requires client-side rendering because it uses browser-specific APIs
 * and window dimensions. This wrapper uses next/dynamic with ssr: false to
 * ensure the chart only renders on the client, preventing hydration mismatches.
 */

interface VolumeChartProps {
  data: VolumeChartData
  title?: string
  description?: string
  variant?: 'line' | 'area'
  showChannelBreakdown?: boolean
  className?: string
}

// Loading skeleton that matches the chart layout
function ChartLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex flex-wrap gap-4 pt-4">
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-16 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[350px] w-full" />
      </CardContent>
    </Card>
  )
}

// Dynamically import VolumeChart with SSR disabled
const VolumeChartClient = dynamic(
  () => import('./volume-chart').then(mod => ({ default: mod.VolumeChart })),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton />
  }
)

// Export wrapper component with the same interface as VolumeChart
export function DynamicVolumeChart(props: VolumeChartProps) {
  return <VolumeChartClient {...props} />
}
