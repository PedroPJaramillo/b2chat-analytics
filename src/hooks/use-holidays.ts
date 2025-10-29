import { useState, useEffect } from "react"
import type { HolidayConfig } from "@/types/holidays"

export function useHolidays() {
  const [config, setConfig] = useState<HolidayConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/settings/holidays")

      if (!response.ok) {
        throw new Error("Failed to fetch holiday configuration")
      }

      const data = await response.json()
      setConfig(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching holiday configuration:", err)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (newConfig: Partial<HolidayConfig>) => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch("/api/settings/holidays", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save holiday configuration")
      }

      const result = await response.json()
      setConfig(result.config)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error saving holiday configuration:", err)
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  return {
    config,
    loading,
    saving,
    error,
    saveConfig,
    refreshConfig: fetchConfig,
  }
}