"use client"

import { useUser } from "@clerk/nextjs"
import { useDatabaseInfo } from "@/hooks/use-database-info"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { redirect } from "next/navigation"

export default function DatabasePage() {
  const { user, isLoaded } = useUser()
  const { info: dbInfo, loading: dbLoading, testing, testConnection } = useDatabaseInfo()
  const { toast } = useToast()

  const getUserRole = () => {
    return (user?.publicMetadata?.role as string) || "Manager"
  }

  const isAdmin = getUserRole() === "Admin"

  const handleTestConnection = async () => {
    const result = await testConnection()

    if (result.success) {
      toast({
        title: "Connection Successful",
        description: `Database is connected. Latency: ${result.latency}`,
      })
    } else {
      toast({
        title: "Connection Failed",
        description: result.message,
        variant: "destructive",
      })
    }
  }

  if (!isAdmin) {
    redirect("/dashboard/settings/profile")
  }

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium">Database</h3>
          <Badge variant="secondary">Admin Only</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Database connection status and information
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {dbLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {dbInfo?.connected ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-base font-medium">
                      {dbInfo?.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    PostgreSQL {dbInfo?.version || "Unknown"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>

              {/* Database Information */}
              {dbInfo && (
                <>
                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Database Name</label>
                      <div className="text-lg font-mono bg-muted p-2 rounded">
                        {dbInfo.databaseName}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Database Size</label>
                      <div className="text-lg font-mono bg-muted p-2 rounded">
                        {dbInfo.databaseSize}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-sm font-medium mb-3 block">Record Counts</label>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Users</span>
                        <span className="font-semibold">{dbInfo.stats.users.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Agents</span>
                        <span className="font-semibold">{dbInfo.stats.agents.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Contacts</span>
                        <span className="font-semibold">{dbInfo.stats.contacts.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Chats</span>
                        <span className="font-semibold">{dbInfo.stats.chats.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Messages</span>
                        <span className="font-semibold">{dbInfo.stats.messages.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted">
                        <span className="text-sm font-medium">Total Records</span>
                        <span className="font-bold">{dbInfo.stats.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
