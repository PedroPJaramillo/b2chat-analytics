"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { MoreHorizontal, Search, Filter, MessageSquare, Clock, User } from "lucide-react"
import { format } from 'date-fns'

interface Chat {
  id: string
  customer: string
  agent: string | null
  status: string
  startTime: string
  lastMessage: string
  messages: number
  priority: string
  topic: string
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'closed':
    case 'resolved':
      return 'bg-gray-100 text-gray-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const formatTime = (timestamp: string) => {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // Less than 1 minute
    if (diff < 60000) return 'Just now'

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    }

    // More than 24 hours
    return format(date, 'MMM d, yyyy HH:mm')
  } catch {
    return timestamp
  }
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.append('status', statusFilter)

        const response = await fetch(`/api/chats${params.toString() ? `?${params}` : ''}`)

        if (!response.ok) {
          throw new Error('Failed to fetch chats')
        }

        const data = await response.json()
        setChats(data)
      } catch (error) {
        console.error('Error fetching chats:', error)
        // Use fallback data if API fails
        setChats([])
      } finally {
        setLoading(false)
      }
    }

    fetchChats()
  }, [statusFilter])

  const filteredChats = chats.filter(chat =>
    chat.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.agent?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Chats</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            <MessageSquare className="mr-1 h-3 w-3" />
            {filteredChats.length} Active
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Conversations</CardTitle>
          <CardDescription>
            Monitor and manage customer chat sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, agent, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-[100px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredChats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No chats found
                  </TableCell>
                </TableRow>
              ) : (
                filteredChats.map((chat) => (
                  <TableRow key={chat.id}>
                    <TableCell className="font-medium">{chat.customer}</TableCell>
                    <TableCell>{chat.agent || 'Unassigned'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(chat.status)}>
                        {chat.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(chat.priority)}>
                        {chat.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{chat.topic}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <MessageSquare className="mr-1 h-4 w-4 text-muted-foreground" />
                        {chat.messages}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                        {formatTime(chat.startTime)}
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(chat.lastMessage)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}