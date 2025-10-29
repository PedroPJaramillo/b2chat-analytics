import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Timer, ArrowRight } from "lucide-react"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function ResponseTimesPage() {
  return (
    <div className={pageContainerClasses}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Response Time Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Drill into percentile trends across channels and teams.
          </p>
        </div>
        <Badge variant="secondary" className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" />
          In Progress
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hang tight!</CardTitle>
          <CardDescription>
            We&apos;re preparing channel-specific heatmaps and SLA breach alerts for this view.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Until then, leverage the analytics response-time tab for the latest percentile and compliance data.
          </p>
          <Button asChild className="self-start">
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-2">
              Open Response-Time Tab
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
