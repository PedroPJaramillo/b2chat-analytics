"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"
import { useSettings } from "@/hooks/use-settings"
import {
  Card,
  CardContent,
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
import { Save, RotateCcw, Loader2 } from "lucide-react"

const exportSchema = z.object({
  defaultFormat: z.enum(["csv", "excel", "pdf"]),
  fileRetentionDays: z.number().min(1).max(365),
  autoCleanup: z.boolean(),
})

type ExportFormValues = z.infer<typeof exportSchema>

export default function ExportPage() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const { toast } = useToast()

  const form = useForm<ExportFormValues>({
    resolver: zodResolver(exportSchema),
    defaultValues: {
      defaultFormat: "csv",
      fileRetentionDays: 30,
      autoCleanup: true,
    },
    values: settings?.export || undefined,
  })

  const { handleSubmit, reset, formState: { isDirty } } = form

  const onSubmit = async (data: ExportFormValues) => {
    const success = await saveSettings({
      ...settings,
      export: data,
    })

    if (success) {
      toast({
        title: "Export Settings Saved",
        description: "Your export preferences have been updated.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save export settings.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Export</h3>
          <p className="text-sm text-muted-foreground">
            Configure export defaults and file management
          </p>
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Export</h3>
        <p className="text-sm text-muted-foreground">
          Configure export defaults and file management
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <FormField
                control={form.control}
                name="defaultFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Export Format</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Default format for exporting data
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fileRetentionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File Retention (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      How long to keep exported files (1-365 days)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoCleanup"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Automatic Cleanup
                      </FormLabel>
                      <FormDescription>
                        Automatically delete old exported files
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
