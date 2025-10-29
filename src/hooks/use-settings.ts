import { useState, useEffect } from "react"

export interface UserSettings {
  notifications: {
    emailOnSyncComplete: boolean
    emailOnSyncError: boolean
    alertOnSystemError: boolean
  }
  display: {
    dateFormat: string
    timeFormat: "12h" | "24h"
    numberFormat: string
    defaultDashboardView: string
    itemsPerPage: number
  }
  sync: {
    defaultTimeRange: "1d" | "7d" | "30d" | "90d" | "full"
    autoSync: boolean
    mediaBackup: boolean
    dataRetentionDays: number
  }
  export: {
    defaultFormat: "csv" | "excel" | "pdf"
    fileRetentionDays: number
    autoCleanup: boolean
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/settings")

      if (!response.ok) {
        throw new Error("Failed to fetch settings")
      }

      const data = await response.json()
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching settings:", err)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save settings")
      }

      // Refetch settings to ensure we have the latest
      await fetchSettings()

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error saving settings:", err)
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    settings,
    loading,
    saving,
    error,
    saveSettings,
    refreshSettings: fetchSettings,
  }
}