"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useSLASettings } from "@/hooks/use-sla-settings"
import { useSLARecalculation } from "@/hooks/use-sla-recalculation"
import { slaConfigSchema, type SLAConfig, type RecalculationRequest, type LastRecalculation } from "@/types/sla"
import { getDefaultDateRange, formatRecalculationResult } from "@/lib/sla/recalculation-helpers"
import { SLARecalculationDialog } from "./sla-recalculation-dialog"
import { SLARecalculationResult } from "./sla-recalculation-result"
import { SLARecalculationAdvanced } from "./sla-recalculation-advanced"
import {
  Target,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Loader2,
  Wrench,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"

interface SLASettingsSectionProps {
  isAdmin: boolean
}

export function SLASettingsSection({ isAdmin }: SLASettingsSectionProps) {
  const { config, loading, saving, saveConfig } = useSLASettings()
  const { toast } = useToast()
  const [channelOverridesOpen, setChannelOverridesOpen] = useState(false)
  const [priorityOverridesOpen, setPriorityOverridesOpen] = useState(false)

  // Recalculation state
  const { recalculate, loading: recalculating } = useSLARecalculation()
  const [showRecalculateDialog, setShowRecalculateDialog] = useState(false)
  const [recalculateRequest, setRecalculateRequest] = useState<RecalculationRequest>(getDefaultDateRange())
  const [lastRecalculationResult, setLastRecalculationResult] = useState<LastRecalculation | null>(null)
  const [currentResult, setCurrentResult] = useState<any>(null)

  const form = useForm<SLAConfig>({
    resolver: zodResolver(slaConfigSchema),
    defaultValues: {
      firstResponseThreshold: 5,
      avgResponseThreshold: 5,
      resolutionThreshold: 30,
      pickupThreshold: 2,
      firstResponseTarget: 95,
      avgResponseTarget: 90,
      resolutionTarget: 90,
      pickupTarget: 98,
      enabledMetrics: {
        pickup: true,
        firstResponse: true,
        avgResponse: false,
        resolution: false,
      },
    },
    values: config || undefined,
  })

  const { handleSubmit, reset, watch, formState: { isDirty } } = form

  const enabledMetrics = watch("enabledMetrics")

  const onSubmit = async (data: SLAConfig) => {
    // Validate at least one metric is enabled
    if (!data.enabledMetrics.pickup && !data.enabledMetrics.firstResponse &&
        !data.enabledMetrics.avgResponse && !data.enabledMetrics.resolution) {
      toast({
        title: "Validation Error",
        description: "At least one SLA metric must be enabled.",
        variant: "destructive",
      })
      return
    }

    const success = await saveConfig(data)

    if (success) {
      toast({
        title: "SLA Configuration Saved",
        description: "SLA thresholds and targets have been updated successfully.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save SLA configuration. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReset = () => {
    if (config) {
      reset(config)
      toast({
        title: "SLA Configuration Reset",
        description: "SLA settings have been reset to last saved values.",
      })
    }
  }

  // Load last recalculation from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('lastSLARecalculation')
    if (stored) {
      try {
        setLastRecalculationResult(JSON.parse(stored))
      } catch (e) {
        // Ignore invalid stored data
      }
    }
  }, [])

  // Recalculation handlers
  const handleQuickRecalculate = () => {
    setRecalculateRequest(getDefaultDateRange())
    setShowRecalculateDialog(true)
  }

  const handleConfirmRecalculation = async () => {
    try {
      const result = await recalculate(recalculateRequest)
      setShowRecalculateDialog(false)

      if (result.success && result.failed === 0) {
        toast({
          title: "SLA Recalculation Complete",
          description: formatRecalculationResult(result),
        })
      }

      // Save to localStorage
      const lastRecalc: LastRecalculation = {
        timestamp: new Date().toISOString(),
        processed: result.processed,
        failed: result.failed,
        duration: result.duration,
      }
      setLastRecalculationResult(lastRecalc)
      localStorage.setItem('lastSLARecalculation', JSON.stringify(lastRecalc))

      // Set current result for detailed display
      setCurrentResult(result)
    } catch (error) {
      setShowRecalculateDialog(false)
      toast({
        title: "Recalculation Failed",
        description: error instanceof Error ? error.message : "An error occurred during recalculation",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Target className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <CardTitle>SLA Configuration</CardTitle>
              <Badge variant="secondary">Admin Only</Badge>
            </div>
            <CardDescription>
              Configure Service Level Agreement thresholds and compliance targets
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Form {...form}>
            <div className="space-y-6">
              {/* Active SLA Metrics */}
              <div>
                <h3 className="text-sm font-medium mb-2">Active SLA Metrics</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select which metrics determine overall SLA compliance. Disabled metrics are still calculated but don't affect compliance.
                </p>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="enabledMetrics.pickup"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Pickup Time
                          </FormLabel>
                          <FormDescription>
                            Time from chat opened to agent assignment
                          </FormDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={field.value ? "default" : "secondary"}>
                            {field.value ? "Active" : "Inactive"}
                          </Badge>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabledMetrics.firstResponse"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            First Response Time
                          </FormLabel>
                          <FormDescription>
                            Time from chat opened to first agent message
                          </FormDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={field.value ? "default" : "secondary"}>
                            {field.value ? "Active" : "Inactive"}
                          </Badge>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabledMetrics.avgResponse"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Average Response Time
                          </FormLabel>
                          <FormDescription>
                            Average time between customer messages and agent replies
                          </FormDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={field.value ? "default" : "secondary"}>
                            {field.value ? "Active" : "Inactive"}
                          </Badge>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabledMetrics.resolution"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Resolution Time
                          </FormLabel>
                          <FormDescription>
                            Total time from chat opened to chat closed
                          </FormDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={field.value ? "default" : "secondary"}>
                            {field.value ? "Active" : "Inactive"}
                          </Badge>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Default Thresholds */}
            <div>
              <h3 className="text-sm font-medium mb-4">Default Thresholds (Minutes)</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="pickupThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Time to agent pickup
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="firstResponseThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Response</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={240}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Time to first agent response
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avgResponseThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avg Response</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={240}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Average response time
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="resolutionThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Time to close chat
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Compliance Targets */}
            <div>
              <h3 className="text-sm font-medium mb-4">Compliance Targets (%)</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="pickupTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Target compliance %
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="firstResponseTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Response</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Target compliance %
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avgResponseTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avg Response</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Target compliance %
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="resolutionTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Target compliance %
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Channel Overrides - Collapsible */}
            <Collapsible
              open={channelOverridesOpen}
              onOpenChange={setChannelOverridesOpen}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                  <h3 className="text-sm font-medium">Channel-Specific Overrides (Optional)</h3>
                  {channelOverridesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Override default thresholds for specific channels. Leave blank to use defaults.
                </p>

                {/* WhatsApp */}
                <div className="grid gap-4 md:grid-cols-3 p-4 rounded-lg border">
                  <div className="md:col-span-3">
                    <h4 className="text-sm font-medium">WhatsApp</h4>
                  </div>
                  <FormField
                    control={form.control}
                    name="channelOverrides.whatsapp.firstResponse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Response (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={240}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelOverrides.whatsapp.resolution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resolution (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={1440}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelOverrides.whatsapp.pickup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* LiveChat */}
                <div className="grid gap-4 md:grid-cols-3 p-4 rounded-lg border">
                  <div className="md:col-span-3">
                    <h4 className="text-sm font-medium">Live Chat</h4>
                  </div>
                  <FormField
                    control={form.control}
                    name="channelOverrides.livechat.firstResponse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Response (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={240}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelOverrides.livechat.resolution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resolution (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={1440}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelOverrides.livechat.pickup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Action Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              <Button
                type="submit"
                disabled={!isDirty || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save SLA Settings
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={!isDirty || saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
            </div>
          </Form>
        </form>

        {/* SLA Maintenance Section */}
        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            <h3 className="text-lg font-semibold">SLA Maintenance</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            Recalculate SLA metrics to apply configuration changes to existing chats.
          </p>

          {/* Unsaved changes warning */}
          {isDirty && (
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Unsaved Changes</AlertTitle>
              <AlertDescription>
                Save your configuration changes first to recalculate with the new settings.
              </AlertDescription>
            </Alert>
          )}

          {/* Last recalculation info */}
          {lastRecalculationResult && (
            <SLARecalculationResult
              lastRecalculation={lastRecalculationResult}
              mode="compact"
            />
          )}

          {/* Quick recalculate button */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleQuickRecalculate}
              disabled={isDirty || recalculating}
            >
              {recalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalculate Last 30 Days
                </>
              )}
            </Button>
          </div>

          {/* Advanced options */}
          <SLARecalculationAdvanced
            defaultRequest={recalculateRequest}
            onRequestChange={(request) => {
              setRecalculateRequest(request)
              setShowRecalculateDialog(true)
            }}
            disabled={isDirty || recalculating}
          />

          {/* Current result display */}
          {currentResult && (
            <SLARecalculationResult
              result={currentResult}
              mode="detailed"
              onDismiss={() => setCurrentResult(null)}
            />
          )}
        </div>
      </CardContent>

      {/* Recalculation confirmation dialog */}
      <SLARecalculationDialog
        open={showRecalculateDialog}
        onOpenChange={setShowRecalculateDialog}
        onConfirm={handleConfirmRecalculation}
        request={recalculateRequest}
        loading={recalculating}
      />
    </Card>
  )
}