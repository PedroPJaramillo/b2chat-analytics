"use client"

import { useState } from 'react'
import { AlertCircle, Copy, RefreshCw, X, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"

interface ErrorDetails {
  statusCode?: number
  endpoint?: string
  requestUrl?: string
  rawResponse?: any
  timestamp?: string
}

interface ErrorDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errorMessage: string
  errorDetails?: ErrorDetails
  onRetry?: () => void
}

export function ErrorDetailsDialog({
  open,
  onOpenChange,
  errorMessage,
  errorDetails,
  onRetry,
}: ErrorDetailsDialogProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true)
  const { toast } = useToast()

  const getStatusBadgeVariant = (statusCode?: number): "default" | "secondary" | "destructive" | "outline" => {
    if (!statusCode) return 'secondary'
    if (statusCode >= 500) return 'destructive'
    if (statusCode >= 400) return 'destructive' // Use destructive for 4xx errors as well
    return 'secondary'
  }

  const getDiagnosisMessage = (errorMessage: string, errorDetails?: ErrorDetails) => {
    // Check if this is a B2Chat internal service error
    if (errorMessage.includes('chats-http') || errorMessage.includes('contacts-http')) {
      return {
        type: 'b2chat-infrastructure',
        title: 'B2Chat API Infrastructure Issue',
        description: 'The B2Chat API is experiencing connectivity issues with its internal microservices. This is not a configuration problem on your end.',
        suggestions: [
          'Retry the sync operation (the issue may be temporary)',
          'Wait a few minutes and try again',
          'Contact B2Chat support if the error persists',
          'Check B2Chat status page for known issues',
        ]
      }
    }

    // Check for authentication errors
    if (errorDetails?.statusCode === 401 || errorDetails?.statusCode === 403) {
      return {
        type: 'authentication',
        title: 'Authentication Error',
        description: 'There is an issue with your B2Chat API credentials or permissions.',
        suggestions: [
          'Verify your B2CHAT_USERNAME and B2CHAT_PASSWORD in environment variables',
          'Check that your B2Chat account has API access enabled',
          'Ensure your API credentials have not expired',
          'Contact your B2Chat administrator for access',
        ]
      }
    }

    // Check for rate limiting
    if (errorDetails?.statusCode === 429) {
      return {
        type: 'rate-limit',
        title: 'Rate Limit Exceeded',
        description: 'You have exceeded the B2Chat API rate limit.',
        suggestions: [
          'Wait a few minutes before retrying',
          'Reduce the batch size in sync configuration',
          'Contact B2Chat support to increase your rate limits',
        ]
      }
    }

    // Generic server error
    if (errorDetails?.statusCode && errorDetails.statusCode >= 500) {
      return {
        type: 'server-error',
        title: 'Server Error',
        description: 'The B2Chat API is experiencing server-side issues.',
        suggestions: [
          'Retry the operation (server errors are often temporary)',
          'Contact B2Chat support if the issue persists',
        ]
      }
    }

    // Unknown error
    return {
      type: 'unknown',
      title: 'Unknown Error',
      description: 'An unexpected error occurred during the sync operation.',
      suggestions: [
        'Check the error details below for more information',
        'Retry the operation',
        'Contact support with the error details if the issue persists',
      ]
    }
  }

  const diagnosis = getDiagnosisMessage(errorMessage, errorDetails)

  const copyErrorDetails = () => {
    const details = {
      errorMessage,
      timestamp: errorDetails?.timestamp || new Date().toISOString(),
      statusCode: errorDetails?.statusCode,
      endpoint: errorDetails?.endpoint,
      requestUrl: errorDetails?.requestUrl,
      response: errorDetails?.rawResponse,
    }

    navigator.clipboard.writeText(JSON.stringify(details, null, 2))
    toast({
      title: 'Copied to clipboard',
      description: 'Error details have been copied to your clipboard',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Sync Error Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about the sync operation failure
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="raw">Raw Response</TabsTrigger>
            <TabsTrigger value="actions">Suggested Actions</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[450px] mt-4">
            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              {/* Request Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {errorDetails?.requestUrl && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Request URL</p>
                      <p className="text-sm font-mono break-all bg-muted p-2 rounded-md">
                        {errorDetails.requestUrl}
                      </p>
                    </div>
                  )}
                  {errorDetails?.endpoint && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Endpoint</p>
                      <p className="text-sm font-mono">{errorDetails.endpoint}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Error Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Error Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {errorDetails?.statusCode && (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-muted-foreground">HTTP Status:</p>
                      <Badge variant={getStatusBadgeVariant(errorDetails.statusCode)}>
                        {errorDetails.statusCode}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Error Message</p>
                    <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20">
                      {errorMessage}
                    </p>
                  </div>
                  {errorDetails?.timestamp && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                      <p className="text-sm">{new Date(errorDetails.timestamp).toLocaleString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Diagnosis */}
              <Collapsible open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
                <Card>
                  <CardHeader>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer">
                        <CardTitle className="text-base">Diagnosis</CardTitle>
                        {diagnosticsOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <Alert variant={diagnosis.type === 'b2chat-infrastructure' ? 'default' : 'destructive'}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{diagnosis.title}</AlertTitle>
                        <AlertDescription>{diagnosis.description}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </TabsContent>

            {/* Raw Response Tab */}
            <TabsContent value="raw" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Raw API Response</CardTitle>
                  <CardDescription>
                    The complete response from the B2Chat API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                    {JSON.stringify(errorDetails?.rawResponse || { message: errorMessage }, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Suggested Actions Tab */}
            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Suggested Actions</CardTitle>
                  <CardDescription>
                    Steps you can take to resolve this issue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {diagnosis.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-sm">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {diagnosis.type === 'b2chat-infrastructure' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>This is a B2Chat API Issue</AlertTitle>
                  <AlertDescription>
                    The error message indicates an internal B2Chat infrastructure problem.
                    Your configuration is correct - this is not an issue with your settings.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <Separator />

        {/* Action Buttons */}
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" onClick={copyErrorDetails}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Error Details
          </Button>
          <div className="flex gap-2">
            {onRetry && (
              <Button variant="default" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Sync
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
