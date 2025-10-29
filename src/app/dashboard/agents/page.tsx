"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoreHorizontal, Activity, Clock, MessageSquare, Edit, Trash, Power } from "lucide-react"
import { useAgents } from "@/hooks/use-agents"
import { pageContainerClasses } from "@/lib/ui-utils"

const getStatusBadge = (status: string) => {
  switch (status) {
    case "online":
      return <Badge variant="default" className="bg-green-100 text-green-800">Online</Badge>
    case "away":
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Away</Badge>
    case "offline":
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Offline</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function AgentsPage() {
  const { data: agents, loading, error, refetch } = useAgents()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: "", email: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingAgent, setEditingAgent] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Calculate avgResponseTime - must be before early returns to follow Rules of Hooks
  const avgResponseTime = useMemo(() => {
    if (!agents || agents.length === 0) return '0'
    const sum = agents.reduce((acc, agent) => {
      const minutes = parseFloat(agent.avgResponseTime.replace('m', ''))
      return acc + minutes
    }, 0)
    return (sum / agents.length).toFixed(1)
  }, [agents])

  if (loading) {
    return (
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Agents</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className={pageContainerClasses}>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Agents</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-semibold">Error loading agents</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.email) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      })

      if (!response.ok) throw new Error('Failed to add agent')

      setIsAddDialogOpen(false)
      setNewAgent({ name: "", email: "" })
      refetch()
    } catch (error) {
      console.error('Error adding agent:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditAgent = async () => {
    if (!editingAgent?.name || !editingAgent?.email) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/agents/${editingAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingAgent.name, email: editingAgent.email })
      })

      if (!response.ok) throw new Error('Failed to update agent')

      setIsEditDialogOpen(false)
      setEditingAgent(null)
      refetch()
    } catch (error) {
      console.error('Error updating agent:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (agentId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'online' ? 'offline' : 'online'
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus === 'online' })
      })

      if (!response.ok) throw new Error('Failed to update agent status')

      refetch()
    } catch (error) {
      console.error('Error updating agent status:', error)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete agent')

      refetch()
    } catch (error) {
      console.error('Error deleting agent:', error)
    }
  }

  return (
    <div className={pageContainerClasses}>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agents</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>Add Agent</Button>
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
            <DialogDescription>
              Create a new agent to handle customer conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newAgent.email}
                onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAgent} disabled={isSubmitting || !newAgent.name || !newAgent.email}>
              {isSubmitting ? "Adding..." : "Add Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update agent information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editingAgent?.name || ""}
                onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editingAgent?.email || ""}
                onChange={(e) => setEditingAgent({ ...editingAgent, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditAgent} disabled={isSubmitting || !editingAgent?.name || !editingAgent?.email}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">
              Active agents in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Now</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.filter(agent => agent.status === "online").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {agents.length > 0 ? Math.round((agents.filter(agent => agent.status === "online").length / agents.length) * 100) : 0}% availability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.reduce((sum, agent) => sum + agent.activeChats, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}m</div>
            <p className="text-xs text-muted-foreground">
              Across all agents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Overview</CardTitle>
          <CardDescription>
            Manage and monitor your customer service agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active Chats</TableHead>
                <TableHead>Avg Response</TableHead>
                <TableHead>Total Chats</TableHead>
                <TableHead>Satisfaction</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-muted-foreground">{agent.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(agent.status)}
                  </TableCell>
                  <TableCell>{agent.activeChats}</TableCell>
                  <TableCell>{agent.avgResponseTime}</TableCell>
                  <TableCell>{agent.totalChats}</TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {agent.satisfaction !== null && agent.satisfaction !== undefined
                        ? `${agent.satisfaction}%`
                        : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingAgent(agent)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(agent.id, agent.status)}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {agent.status === 'online' ? 'Set Offline' : 'Set Online'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteAgent(agent.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}