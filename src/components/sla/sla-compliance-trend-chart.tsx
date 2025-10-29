'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface TrendDataPoint {
  date: string;
  overallCompliance: number;
  pickupCompliance: number;
  firstResponseCompliance: number;
  avgResponseCompliance: number;
  resolutionCompliance: number;
}

interface SLAComplianceTrendChartProps {
  data?: TrendDataPoint[];
  isLoading?: boolean;
  error?: Error;
  complianceTarget?: number;
}

export function SLAComplianceTrendChart({
  data,
  isLoading = false,
  error,
  complianceTarget = 95,
}: SLAComplianceTrendChartProps) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA Compliance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Failed to load trend data: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA Compliance Trend</CardTitle>
          <CardDescription>Daily compliance rates over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">
            {format(new Date(label), 'MMM dd, yyyy')}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any) => (
              <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
                <span className="font-medium">{entry.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Compliance Trend</CardTitle>
        <CardDescription>
          Daily compliance rates over the past 30 days (Target: {complianceTarget}%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 10,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />

            {/* Target line */}
            <Line
              type="monotone"
              dataKey={() => complianceTarget}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              dot={false}
              name="Target"
              strokeWidth={1}
            />

            {/* Overall compliance */}
            <Line
              type="monotone"
              dataKey="overallCompliance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Overall"
              activeDot={{ r: 5 }}
            />

            {/* Individual metrics */}
            <Line
              type="monotone"
              dataKey="pickupCompliance"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
              name="Pickup"
            />
            <Line
              type="monotone"
              dataKey="firstResponseCompliance"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              name="First Response"
            />
            <Line
              type="monotone"
              dataKey="avgResponseCompliance"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              dot={false}
              name="Avg Response"
            />
            <Line
              type="monotone"
              dataKey="resolutionCompliance"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              name="Resolution"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legend explanation */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Overall</strong> represents the percentage of chats that met all SLA targets.
            Individual metrics show compliance rates for each specific SLA metric.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
