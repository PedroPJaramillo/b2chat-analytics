/**
 * Customer Insights Visualization
 * Displays customer intent, journey, and sentiment distributions
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

interface CustomerInsightsViewProps {
  data: AnalysisResultsResponse['customerInsights']
}

const COLORS = {
  intent: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  journey: ['#0ea5e9', '#6366f1', '#8b5cf6'],
  sentiment: ['#22c55e', '#94a3b8', '#ef4444'],
}

const toNumberEntries = <T extends Record<string, number>>(record: T) =>
  Object.entries(record) as Array<[keyof T & string, number]>

export function CustomerInsightsView({ data }: CustomerInsightsViewProps) {
  // Transform data for charts
  const intentData = toNumberEntries(data.intentDistribution)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: Math.round(value * 100),
      percentage: value,
    }))
    .sort((a, b) => b.value - a.value)

  const journeyData = toNumberEntries(data.journeyStageDistribution)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value: Math.round(value * 100),
      percentage: value,
    }))
    .sort((a, b) => b.value - a.value)

  const sentimentData = toNumberEntries(data.sentimentDistribution)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100),
      percentage: value,
    }))
    .sort((a, b) => b.value - a.value)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value}% ({payload[0].payload.percentage.toFixed(3)})
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Customer Intent Distribution */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Customer Intent Distribution</CardTitle>
          <CardDescription>What customers are asking about</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={intentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {intentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.intent[index % COLORS.intent.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journey Stage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Stage</CardTitle>
          <CardDescription>Customer lifecycle position</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={journeyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {journeyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.journey[index % COLORS.journey.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {journeyData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS.journey[index % COLORS.journey.length] }}
                  />
                  <span>{item.name}</span>
                </div>
                <span className="font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sentiment Analysis */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Sentiment Distribution</CardTitle>
          <CardDescription>Overall customer satisfaction and sentiment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sentiment Bars */}
            <div className="space-y-4">
              {sentimentData.map((item, index) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS.sentiment[index] }}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.value}%</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: COLORS.sentiment[index],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sentiment Pie */}
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.sentiment[index]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
