"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award } from "lucide-react"

interface LeaderboardEntry {
  name: string
  avg: string
  p50: string
  p95: string
  chatCount: number
}

interface ResponseTimeLeaderboardProps {
  title: string
  data: LeaderboardEntry[]
  type: 'agents' | 'departments'
}

export function ResponseTimeLeaderboard({ title, data, type }: ResponseTimeLeaderboardProps) {
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-4 w-4 text-yellow-500" />
      case 1:
        return <Medal className="h-4 w-4 text-gray-400" />
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />
      default:
        return <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
    }
  }

  const getPerformanceBadge = (avg: string) => {
    const match = avg.match(/^([\d.]+)([smh])$/)
    if (!match) return null

    const value = parseFloat(match[1])
    const unit = match[2]

    let minutes = 0
    switch (unit) {
      case 's': minutes = value / 60; break
      case 'm': minutes = value; break
      case 'h': minutes = value * 60; break
    }

    if (minutes < 1) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (minutes < 3) return <Badge className="bg-blue-100 text-blue-800">Good</Badge>
    if (minutes < 5) return <Badge className="bg-yellow-100 text-yellow-800">Average</Badge>
    return <Badge className="bg-red-100 text-red-800">Needs Improvement</Badge>
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-2 pb-2 border-b text-xs font-medium text-muted-foreground">
            <div className="col-span-2">Name</div>
            <div>Avg</div>
            <div>P50</div>
            <div>P95</div>
            <div className="text-right">Chats</div>
          </div>

          {data.slice(0, 10).map((entry, index) => (
            <div
              key={entry.name}
              className="grid grid-cols-6 gap-2 items-center py-2 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="col-span-2 flex items-center gap-2">
                {getRankIcon(index)}
                <span className="text-sm font-medium truncate">{entry.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm">{entry.avg}</span>
                {index === 0 && getPerformanceBadge(entry.avg)}
              </div>
              <div className="text-sm text-muted-foreground">{entry.p50}</div>
              <div className="text-sm text-muted-foreground">{entry.p95}</div>
              <div className="text-sm text-right text-muted-foreground">{entry.chatCount}</div>
            </div>
          ))}

          {data.length > 10 && (
            <div className="text-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Showing top 10 of {data.length} {type}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}