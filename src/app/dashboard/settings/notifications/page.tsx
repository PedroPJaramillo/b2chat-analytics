"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"
import { useSettings } from "@/hooks/use-settings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Save, RotateCcw, Loader2 } from "lucide-react"

const notificationSchema = z.object({
  emailOnSyncComplete: z.boolean(),
  emailOnSyncError: z.boolean(),
  alertOnSystemError: z.boolean(),
})

type NotificationFormValues = z.infer<typeof notificationSchema>

export default function NotificationsPage() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const { toast } = useToast()

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailOnSyncComplete: true,
      emailOnSyncError: true,
      alertOnSystemError: true,
    },
    values: settings?.notifications || undefined,
  })

  const { handleSubmit, reset, formState: { isDirty } } = form

  const onSubmit = async (data: NotificationFormValues) => {
    const success = await saveSettings({
      ...settings,
      notifications: data,
    })

    if (success) {
      toast({
        title: "Notifications Saved",
        description: "Your notification preferences have been updated.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save notification settings.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Manage your notification preferences
          </p>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Manage your notification preferences
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Sync Complete Notifications */}
              <FormField
                control={form.control}
                name="emailOnSyncComplete"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Sync Complete Notifications
                      </FormLabel>
                      <FormDescription>
                        Receive an email when data synchronization completes
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

              {/* Sync Error Notifications */}
              <FormField
                control={form.control}
                name="emailOnSyncError"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Sync Error Notifications
                      </FormLabel>
                      <FormDescription>
                        Receive an email when synchronization errors occur
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

              {/* System Error Alerts */}
              <FormField
                control={form.control}
                name="alertOnSystemError"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        System Error Alerts
                      </FormLabel>
                      <FormDescription>
                        Show in-app alerts for system errors
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
            <Button type="submit" disabled={!isDirty || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
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
