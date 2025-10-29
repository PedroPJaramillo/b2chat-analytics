"use client"

import { useMemo } from "react"
import { Progress } from "@/components/ui/progress"

interface SimpleBarChartProps {
  data: Array<{
    name: string
    value: number
    maxValue?: number
  }>
  className?: string
}

export function SimpleBarChart({ data, className }: SimpleBarChartProps) {
  const maxValue = useMemo(
    () => Math.max(...data.map(item => item.maxValue || item.value)),
    [data]
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {data.map((item, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-sm text-muted-foreground">{item.value}</span>
          </div>
          <Progress
            value={(item.value / maxValue) * 100}
            className="h-2"
          />
        </div>
      ))}
    </div>
  )
}