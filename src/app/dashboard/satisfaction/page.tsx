import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserCheck, ArrowRight } from "lucide-react"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function SatisfactionPage() {
  return (
    <div className={pageContainerClasses}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Customer Satisfaction</h2>
          <p className="text-sm text-muted-foreground">
            Map CSAT, NPS, and qualitative feedback trends.
          </p>
        </div>
        <Badge variant="secondary" className="inline-flex items-center gap-1">
          <UserCheck className="h-3 w-3" />
          Beta
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>
            We&apos;re connecting customer feedback streams and sentiment scoring to power this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            For now, monitor satisfaction deltas from the main analytics overview.
          </p>
          <Button asChild className="self-start">
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-2">
              Analytics Overview
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
