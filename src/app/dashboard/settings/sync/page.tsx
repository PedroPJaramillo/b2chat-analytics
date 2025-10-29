"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/hooks/use-toast"
import { useSettings } from "@/hooks/use-settings"
import { useSyncConfig } from "@/hooks/use-sync-config"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Save, RotateCcw, Loader2, Settings2, Database } from "lucide-react"
import { redirect } from "next/navigation"

const syncSchema = z.object({
  defaultTimeRange: z.enum(["1d", "7d", "30d", "90d", "full"]),
  autoSync: z.boolean(),
  mediaBackup: z.boolean(),
  dataRetentionDays: z.number().min(30).max(3650),
})

type SyncFormValues = z.infer<typeof syncSchema>

// Separate schema for sync configuration
const syncConfigSchema = z.object({
  interval: z.number().min(1, "Interval must be at least 1 minute").max(1440, "Interval cannot exceed 24 hours"),
  batchSize: z.number().min(10, "Batch size must be at least 10").max(1000, "Batch size cannot exceed 1000"),
  autoSync: z.boolean(),
  fullSync: z.boolean(),
  retryAttempts: z.number().min(0, "Retry attempts cannot be negative").max(10, "Cannot exceed 10 retry attempts"),
  retryDelay: z.number().min(100, "Delay must be at least 100ms").max(60000, "Delay cannot exceed 60 seconds"),
})

type SyncConfigFormValues = z.infer<typeof syncConfigSchema>

export default function SyncPage() {
  const { user } = useUser()
  const { settings, loading, saving, saveSettings } = useSettings()
  const { config: syncConfig, loading: configLoading, saving: configSaving, saveConfig } = useSyncConfig()
  const { toast } = useToast()

  const getUserRole = () => {
    return (user?.publicMetadata?.role as string) || "Manager"
  }

  const isAdmin = getUserRole() === "Admin"

  const form = useForm<SyncFormValues>({
    resolver: zodResolver(syncSchema),
    defaultValues: {
      defaultTimeRange: "7d",
      autoSync: true,
      mediaBackup: true,
      dataRetentionDays: 365,
    },
    values: settings?.sync || undefined,
  })

  const configForm = useForm<SyncConfigFormValues>({
    resolver: zodResolver(syncConfigSchema),
    defaultValues: syncConfig,
    values: syncConfig,
  })

  const { handleSubmit, reset, formState: { isDirty } } = form
  const { handleSubmit: handleConfigSubmit, reset: resetConfig, formState: { isDirty: isConfigDirty } } = configForm

  const onSubmit = async (data: SyncFormValues) => {
    const success = await saveSettings({
      ...settings,
      sync: data,
    })

    if (success) {
      toast({
        title: "Sync Settings Saved",
        description: "Your sync preferences have been updated.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save sync settings.",
        variant: "destructive",
      })
    }
  }

  const onConfigSubmit = async (data: SyncConfigFormValues) => {
    try {
      await saveConfig(data)
      toast({
        title: "Sync Configuration Saved",
        description: "Your sync configuration has been updated.",
      })
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      })
    }
  }

  if (!isAdmin) {
    redirect("/dashboard/settings/profile")
  }

  if (loading || configLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-medium">Data Sync</h3>
            <Badge variant="secondary">Admin Only</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure default sync behavior
          </p>
        </div>
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium">Data Sync</h3>
          <Badge variant="secondary">Admin Only</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure sync behavior and performance settings
        </p>
      </div>

      {/* Sync Configuration - Batch Size, Interval, etc. */}
      <Form {...configForm}>
        <form onSubmit={handleConfigSubmit(onConfigSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Settings2 className="h-5 w-5" />
                <CardTitle>Sync Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure sync intervals, batch sizes, and retry behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Batch Size */}
              <FormField
                control={configForm.control}
                name="batchSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Size</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="10"
                        max="1000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of records to process per batch (10-1000). Higher values may improve sync speed but use more memory.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sync Interval */}
              <FormField
                control={configForm.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sync Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="1440"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      How often to automatically sync data (1-1440 minutes)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                {/* Retry Attempts */}
                <FormField
                  control={configForm.control}
                  name="retryAttempts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry Attempts</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of retry attempts on sync failure (0-10)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Retry Delay */}
                <FormField
                  control={configForm.control}
                  name="retryDelay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry Delay (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="100"
                          max="60000"
                          step="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                        />
                      </FormControl>
                      <FormDescription>
                        Delay between retry attempts (100-60000ms)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Auto Sync */}
              <FormField
                control={configForm.control}
                name="autoSync"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Auto Sync</FormLabel>
                      <FormDescription>
                        Enable automatic synchronization
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Full Sync */}
              <FormField
                control={configForm.control}
                name="fullSync"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Full Sync</FormLabel>
                      <FormDescription>
                        Reimport all data instead of incremental updates
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <Button type="submit" disabled={!isConfigDirty || configSaving}>
              {configSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => resetConfig()}
              disabled={!isConfigDirty || configSaving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>
      </Form>

      {/* General Sync Settings */}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <CardTitle>General Settings</CardTitle>
              </div>
              <CardDescription>
                Configure default sync behavior and data retention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="defaultTimeRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Time Range</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1d">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                        <SelectItem value="full">Full Sync</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Default time range for data synchronization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoSync"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Automatic Sync
                      </FormLabel>
                      <FormDescription>
                        Enable automatic data synchronization
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mediaBackup"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Media Backup
                      </FormLabel>
                      <FormDescription>
                        Automatically backup media files (images, files)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataRetentionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Retention (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={30}
                        max={3650}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      How long to keep synchronized data (30-3650 days)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <Button type="submit" disabled={!isDirty || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={!isDirty || saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
