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

const displaySchema = z.object({
  dateFormat: z.string(),
  timeFormat: z.enum(["12h", "24h"]),
  numberFormat: z.string(),
  defaultDashboardView: z.string(),
  itemsPerPage: z.number().min(10).max(100),
})

type DisplayFormValues = z.infer<typeof displaySchema>

export default function DisplayPage() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const { toast } = useToast()

  const form = useForm<DisplayFormValues>({
    resolver: zodResolver(displaySchema),
    defaultValues: {
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
      numberFormat: "en-US",
      defaultDashboardView: "overview",
      itemsPerPage: 25,
    },
    values: settings?.display || undefined,
  })

  const { handleSubmit, reset, formState: { isDirty } } = form

  const onSubmit = async (data: DisplayFormValues) => {
    const success = await saveSettings({
      ...settings,
      display: data,
    })

    if (success) {
      toast({
        title: "Display Settings Saved",
        description: "Your display preferences have been updated.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save display settings.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Display</h3>
          <p className="text-sm text-muted-foreground">
            Customize how data is displayed
          </p>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Display</h3>
        <p className="text-sm text-muted-foreground">
          Customize how data is displayed
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dateFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Format</FormLabel>
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
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How dates are displayed throughout the app
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Format</FormLabel>
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
                          <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                          <SelectItem value="24h">24-hour</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Time format preference
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number Format</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select locale" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en-US">US (1,234.56)</SelectItem>
                          <SelectItem value="en-GB">UK (1,234.56)</SelectItem>
                          <SelectItem value="de-DE">DE (1.234,56)</SelectItem>
                          <SelectItem value="es-ES">ES (1.234,56)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Number formatting locale
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemsPerPage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Items Per Page</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of items to show in tables (10-100)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="defaultDashboardView"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Dashboard View</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select default view" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="overview">Overview</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Which tab to show by default on the dashboard
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
