"use client"

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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useOfficeHours } from "@/hooks/use-office-hours"
import {
  officeHoursConfigSchema,
  officeHoursPresets,
  commonTimezones,
  type OfficeHoursConfig,
} from "@/types/office-hours"
import {
  Clock,
  Save,
  RotateCcw,
  Loader2,
} from "lucide-react"

interface OfficeHoursSectionProps {
  isAdmin: boolean
}

const daysOfWeek = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const

export function OfficeHoursSection({ isAdmin }: OfficeHoursSectionProps) {
  const { config, loading, saving, saveConfig } = useOfficeHours()
  const { toast } = useToast()

  const form = useForm<OfficeHoursConfig>({
    resolver: zodResolver(officeHoursConfigSchema),
    defaultValues: {
      enabled: false,
      timezone: "America/New_York",
      applyToAnalytics: true,
      applyToSLA: true,
      schedule: {
        monday: { enabled: true, start: "09:00", end: "17:00" },
        tuesday: { enabled: true, start: "09:00", end: "17:00" },
        wednesday: { enabled: true, start: "09:00", end: "17:00" },
        thursday: { enabled: true, start: "09:00", end: "17:00" },
        friday: { enabled: true, start: "09:00", end: "17:00" },
        saturday: { enabled: false, start: "10:00", end: "14:00" },
        sunday: { enabled: false, start: "10:00", end: "14:00" },
      },
    },
    values: config || undefined,
  })

  const { handleSubmit, reset, setValue, watch, formState: { isDirty } } = form

  const enabled = watch("enabled")

  const onSubmit = async (data: OfficeHoursConfig) => {
    const success = await saveConfig(data)

    if (success) {
      toast({
        title: "Office Hours Saved",
        description: "Office hours configuration has been updated successfully.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save office hours configuration. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReset = () => {
    if (config) {
      reset(config)
      toast({
        title: "Office Hours Reset",
        description: "Office hours settings have been reset to last saved values.",
      })
    }
  }

  const applyPreset = (presetName: keyof typeof officeHoursPresets) => {
    const preset = officeHoursPresets[presetName]
    setValue("schedule", preset, { shouldDirty: true })
    toast({
      title: "Preset Applied",
      description: `"${presetName}" schedule has been applied.`,
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-60 w-full" />
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
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <CardTitle>Office Hours</CardTitle>
              <Badge variant="secondary">Admin Only</Badge>
            </div>
            <CardDescription>
              Configure business hours for analytics and SLA calculations
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Enable Office Hours */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Office Hours
                    </FormLabel>
                    <FormDescription>
                      Apply business hours filtering to analytics and SLA calculations
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

            {enabled && (
              <>
                <Separator />

                {/* Timezone */}
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {commonTimezones.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Timezone for office hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Quick Presets */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Quick Presets</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset("Standard Business Hours")}
                    >
                      Standard (8AM-6PM, Mon-Sat)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset("Extended Hours")}
                    >
                      Extended (7AM-7PM, Mon-Sat)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset("24/7")}
                    >
                      24/7
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Weekly Schedule */}
                <div>
                  <h3 className="text-sm font-medium mb-4">Weekly Schedule</h3>
                  <div className="space-y-3">
                    {daysOfWeek.map(({ key, label }) => (
                      <div
                        key={key}
                        className="flex items-center space-x-4 p-3 rounded-lg border"
                      >
                        <FormField
                          control={form.control}
                          name={`schedule.${key}.enabled`}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                          <span className="text-sm font-medium">{label}</span>

                          <FormField
                            control={form.control}
                            name={`schedule.${key}.start`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="time"
                                    {...field}
                                    disabled={!watch(`schedule.${key}.enabled`)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`schedule.${key}.end`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="time"
                                    {...field}
                                    disabled={!watch(`schedule.${key}.enabled`)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Application Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Apply Office Hours To:</h3>

                  <FormField
                    control={form.control}
                    name="applyToAnalytics"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Analytics
                          </FormLabel>
                          <FormDescription>
                            Filter analytics data to show only business hours
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
                    name="applyToSLA"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            SLA Calculations
                          </FormLabel>
                          <FormDescription>
                            Exclude off-hours from SLA compliance calculations
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
                </div>
              </>
            )}

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
                    Save Office Hours
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
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}