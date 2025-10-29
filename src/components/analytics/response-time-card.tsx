import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock, Info, TrendingDown, TrendingUp } from "lucide-react"

interface ResponseTimeCardProps {
  title: string
  metrics: {
    avg: string
    p50: string
    p95: string
    p99?: string
    min?: string
    max?: string
  }
  trend?: number
  variant?: 'default' | 'compact'
  tooltip?: string
}

export function ResponseTimeCard({
  title,
  metrics,
  trend,
  variant = 'default',
  tooltip
}: ResponseTimeCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px]">
                <p className="text-xs whitespace-pre-line">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">{metrics.avg} <span className="text-sm text-muted-foreground">avg</span></div>

          {variant === 'default' && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">P50:</span>
                <span className="font-medium">{metrics.p50}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">P95:</span>
                <span className="font-medium">{metrics.p95}</span>
              </div>
              {metrics.p99 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P99:</span>
                  <span className="font-medium">{metrics.p99}</span>
                </div>
              )}
              {metrics.min && metrics.max && (
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Range:</span>
                  <span className="font-medium">{metrics.min} - {metrics.max}</span>
                </div>
              )}
            </div>
          )}

          {variant === 'compact' && (
            <div className="flex gap-2 text-xs">
              <Badge variant="outline">P50: {metrics.p50}</Badge>
              <Badge variant="outline">P95: {metrics.p95}</Badge>
            </div>
          )}

          {trend !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {trend < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">{Math.abs(trend)}% improvement</span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">{trend}% slower</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}