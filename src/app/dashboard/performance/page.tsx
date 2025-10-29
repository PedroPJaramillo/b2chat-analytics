import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function PerformancePage() {
  return (
    <div className={pageContainerClasses}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Insights</h2>
          <p className="text-sm text-muted-foreground">
            Track top-line productivity metrics across teams and agents.
          </p>
        </div>
        <Badge variant="secondary">Preview</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Detailed performance dashboards are being finalized. Review the core analytics view for the live dataset in the meantime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            We&apos;re consolidating agent scorecards, team benchmarks, and SLA pacing into this section.
          </p>
          <Button asChild className="self-start">
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-2">
              Go to Analytics Overview
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
