"use client"

import { pageContainerClasses } from "@/lib/ui-utils"
import { RawDataTable } from "@/components/raw-data/raw-data-table"
import { Badge } from "@/components/ui/badge"

export default function RawDataPage() {
  return (
    <div className={pageContainerClasses}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight">Raw Data</h2>
            <Badge variant="outline" className="text-xs">Debug</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            View raw data extracted from B2Chat API before transformation
          </p>
        </div>
      </div>

      {/* Raw Data Table */}
      <RawDataTable />
    </div>
  )
}
