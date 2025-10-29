import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart3, ArrowRight } from "lucide-react"
import { pageContainerClasses } from "@/lib/ui-utils"

export default function ReportsPage() {
  return (
    <div className={pageContainerClasses}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Export-ready summaries and scheduled report delivery live here.
          </p>
        </div>
        <Badge variant="secondary" className="inline-flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          Coming Soon
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In Development</CardTitle>
          <CardDescription>
            Custom report builders and scheduled deliveries are being connected to the analytics data warehouse.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Need insights today? Visit the analytics overview to slice the current dataset.
          </p>
          <Button asChild className="self-start">
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-2">
              Go to Analytics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
