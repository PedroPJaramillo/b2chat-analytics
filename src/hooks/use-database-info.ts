import { useState, useEffect } from "react"

export interface DatabaseInfo {
  connected: boolean
  version: string
  databaseName: string
  databaseSize: string
  stats: {
    users: number
    agents: number
    contacts: number
    chats: number
    messages: number
    total: number
  }
}

export function useDatabaseInfo() {
  const [info, setInfo] = useState<DatabaseInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/settings/database")

      if (!response.ok) {
        throw new Error("Failed to fetch database information")
      }

      const data = await response.json()
      setInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching database info:", err)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      setTesting(true)
      setError(null)

      const response = await fetch("/api/settings/database/test", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Connection test failed")
      }

      // Refresh info after successful test
      await fetchInfo()

      return {
        success: true,
        message: data.message,
        latency: data.latency,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection test failed"
      setError(message)
      return {
        success: false,
        message,
      }
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    fetchInfo()
  }, [])

  return {
    info,
    loading,
    testing,
    error,
    testConnection,
    refreshInfo: fetchInfo,
  }
}