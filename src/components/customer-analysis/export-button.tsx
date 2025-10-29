/**
 * Export Button Component
 * Handles PDF and CSV export with format selection
 */

'use client'

import { useState } from 'react'
import { useExportAnalysis } from '@/hooks/use-customer-analysis'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileText, Table, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ExportButtonProps {
  analysisId: string
  disabled?: boolean
}

export function ExportButton({ analysisId, disabled }: ExportButtonProps) {
  const { mutate: exportAnalysis, isPending, error } = useExportAnalysis(analysisId)
  const { toast } = useToast()
  const [exportingFormat, setExportingFormat] = useState<'PDF' | 'CSV' | null>(null)

  const handleExport = (format: 'PDF' | 'CSV') => {
    setExportingFormat(format)

    exportAnalysis(
      { format },
      {
        onSuccess: (response) => {
          toast({
            title: `${format} Export Complete`,
            description:
              format === 'PDF'
                ? 'Your report has been generated and is ready to download.'
                : 'CSV file has been downloaded to your device.',
            variant: 'default',
          })

          // For PDF, open the download URL
          if (format === 'PDF' && response.downloadUrl) {
            window.open(response.downloadUrl, '_blank')
          }

          setExportingFormat(null)
        },
        onError: (err) => {
          toast({
            title: 'Export Failed',
            description: err.message,
            variant: 'destructive',
          })
          setExportingFormat(null)
        },
      }
    )
  }

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={disabled || isPending} size="default" className="gap-2">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting {exportingFormat}...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Report
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport('PDF')} disabled={isPending}>
            <FileText className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('CSV')} disabled={isPending}>
            <Table className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
