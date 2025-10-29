"use client"

import { useId } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useToast } from "@/hooks/use-toast"
import { useSyncConfig } from "@/hooks/use-sync-config"
import { Loader2, Save, RotateCcw } from "lucide-react"

// Zod schema for sync configuration validation
const syncConfigSchema = z.object({
  interval: z.number().min(1, "Interval must be at least 1 minute").max(1440, "Interval cannot exceed 24 hours"),
  batchSize: z.number().min(10, "Batch size must be at least 10").max(1000, "Batch size cannot exceed 1000"),
  autoSync: z.boolean(),
  fullSync: z.boolean(),
  retryAttempts: z.number().min(0, "Retry attempts cannot be negative").max(10, "Cannot exceed 10 retry attempts"),
  retryDelay: z.number().min(100, "Delay must be at least 100ms").max(60000, "Delay cannot exceed 60 seconds"),
})

type SyncConfigFormValues = z.infer<typeof syncConfigSchema>

interface SyncConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncConfigModal({ open, onOpenChange }: SyncConfigModalProps) {
  const { config, loading, saving, saveConfig } = useSyncConfig()
  const { toast } = useToast()
  const descriptionId = useId()

  const form = useForm<SyncConfigFormValues>({
    resolver: zodResolver(syncConfigSchema),
    defaultValues: config,
    values: config, // This will update form when config changes
  })

  const { handleSubmit, reset, formState: { isDirty } } = form

  const onSubmit = async (data: SyncConfigFormValues) => {
    try {
      await saveConfig(data)
      toast({
        title: "Configuration Saved",
        description: "Sync configuration has been updated successfully.",
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      })
    }
  }

  const handleReset = () => {
    reset(config)
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        aria-describedby={descriptionId}
      >
        <DialogHeader>
          <DialogTitle>Sync Configuration</DialogTitle>
          <DialogDescription id={descriptionId}>
            Configure sync settings and schedule for data synchronization
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 py-4">
              {/* Sync Interval */}
              <FormField
                control={form.control}
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

              {/* Batch Size */}
              <FormField
                control={form.control}
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
                      Number of records to process per batch (10-1000)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto Sync */}
              <FormField
                control={form.control}
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
                control={form.control}
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

              {/* Retry Attempts */}
              <FormField
                control={form.control}
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
                control={form.control}
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={!isDirty || saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={!isDirty || saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
