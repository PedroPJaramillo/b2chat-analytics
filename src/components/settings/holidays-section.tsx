"use client"

import { useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useHolidays } from "@/hooks/use-holidays"
import {
  holidayConfigSchema,
  customHolidaySchema,
  availableCountries,
  getPresetHolidays,
  type HolidayConfig,
  type CustomHoliday,
} from "@/types/holidays"
import {
  Calendar as CalendarIcon,
  Save,
  RotateCcw,
  Loader2,
  Plus,
  Trash2,
  Download,
} from "lucide-react"

interface HolidaysSectionProps {
  isAdmin: boolean
}

export function HolidaysSection({ isAdmin }: HolidaysSectionProps) {
  const { config, loading, saving, saveConfig } = useHolidays()
  const { toast } = useToast()
  const [addHolidayOpen, setAddHolidayOpen] = useState(false)
  const [newHoliday, setNewHoliday] = useState<Partial<CustomHoliday>>({
    date: "",
    name: "",
    recurring: false,
  })

  const form = useForm<HolidayConfig>({
    resolver: zodResolver(holidayConfigSchema),
    defaultValues: {
      enabled: false,
      customHolidays: [],
      presetHolidays: {
        enabled: false,
        countryCode: "US",
        includeRegional: false,
      },
      excludeFromSLA: true,
      excludeFromAnalytics: false,
    },
    values: config || undefined,
  })

  const { handleSubmit, reset, watch, setValue, formState: { isDirty } } = form

  const enabled = watch("enabled")
  const customHolidays = watch("customHolidays") || []

  const onSubmit = async (data: HolidayConfig) => {
    const success = await saveConfig(data)

    if (success) {
      toast({
        title: "Holidays Saved",
        description: "Holiday configuration has been updated successfully.",
      })
    } else {
      toast({
        title: "Save Failed",
        description: "Failed to save holiday configuration. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReset = () => {
    if (config) {
      reset(config)
      toast({
        title: "Holidays Reset",
        description: "Holiday settings have been reset to last saved values.",
      })
    }
  }

  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast({
        title: "Invalid Holiday",
        description: "Please provide both date and name.",
        variant: "destructive",
      })
      return
    }

    try {
      customHolidaySchema.parse(newHoliday)
      const currentHolidays = customHolidays || []
      setValue("customHolidays", [...currentHolidays, { ...newHoliday, id: Date.now().toString() } as CustomHoliday], { shouldDirty: true })
      setNewHoliday({ date: "", name: "", recurring: false })
      setAddHolidayOpen(false)
      toast({
        title: "Holiday Added",
        description: `${newHoliday.name} has been added to the list.`,
      })
    } catch (error) {
      toast({
        title: "Invalid Holiday",
        description: "Please check your input.",
        variant: "destructive",
      })
    }
  }

  const removeHoliday = (index: number) => {
    const currentHolidays = customHolidays || []
    const holidayName = currentHolidays[index]?.name
    setValue("customHolidays", currentHolidays.filter((_, i) => i !== index), { shouldDirty: true })
    toast({
      title: "Holiday Removed",
      description: `${holidayName} has been removed.`,
    })
  }

  const importPresetHolidays = () => {
    const presetConfig = watch("presetHolidays")
    if (!presetConfig?.countryCode) {
      toast({
        title: "No Country Selected",
        description: "Please select a country first.",
        variant: "destructive",
      })
      return
    }

    const presetHolidays = getPresetHolidays(presetConfig.countryCode)
    const currentHolidays = customHolidays || []

    // Merge, avoiding duplicates
    const existingDates = new Set(currentHolidays.map(h => h.date))
    const newHolidays = presetHolidays.filter(h => !existingDates.has(h.date))

    setValue("customHolidays", [...currentHolidays, ...newHolidays], { shouldDirty: true })

    toast({
      title: "Holidays Imported",
      description: `Added ${newHolidays.length} holidays from ${presetConfig.countryCode}.`,
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
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <CardTitle>Holidays</CardTitle>
              <Badge variant="secondary">Admin Only</Badge>
            </div>
            <CardDescription>
              Manage holidays for SLA and analytics exclusions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Enable Holidays */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Holiday Tracking
                    </FormLabel>
                    <FormDescription>
                      Track and exclude holidays from calculations
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

                {/* Preset Holidays */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Preset Holidays</h3>

                  <FormField
                    control={form.control}
                    name="presetHolidays.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use Preset Holidays
                          </FormLabel>
                          <FormDescription>
                            Automatically include holidays for a country
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

                  {watch("presetHolidays.enabled") && (
                    <div className="flex items-center space-x-4">
                      <FormField
                        control={form.control}
                        name="presetHolidays.countryCode"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Country</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableCountries.map((country) => (
                                  <SelectItem key={country.code} value={country.code}>
                                    {country.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="outline"
                        onClick={importPresetHolidays}
                        className="mt-8"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Import to Custom List
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Custom Holidays */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Custom Holidays</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddHolidayOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Holiday
                    </Button>
                  </div>

                  {customHolidays.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No custom holidays added yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customHolidays.map((holiday, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <div className="font-medium">{holiday.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {holiday.date}
                              {holiday.recurring && " (Recurring annually)"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHoliday(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Application Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Apply Holidays To:</h3>

                  <FormField
                    control={form.control}
                    name="excludeFromSLA"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            SLA Calculations
                          </FormLabel>
                          <FormDescription>
                            Exclude holidays from SLA compliance calculations
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
                    name="excludeFromAnalytics"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Analytics
                          </FormLabel>
                          <FormDescription>
                            Exclude holidays from analytics data (still visible but marked)
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
                    Save Holidays
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

        {/* Add Holiday Dialog */}
        <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Holiday</DialogTitle>
              <DialogDescription>
                Add a holiday to exclude from calculations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Holiday Name</label>
                <Input
                  placeholder="e.g., New Year's Day"
                  value={newHoliday.name || ""}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  value={newHoliday.date || ""}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newHoliday.recurring || false}
                  onCheckedChange={(checked) => setNewHoliday({ ...newHoliday, recurring: checked })}
                />
                <label className="text-sm">Recurring annually</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddHolidayOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addHoliday}>Add Holiday</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}