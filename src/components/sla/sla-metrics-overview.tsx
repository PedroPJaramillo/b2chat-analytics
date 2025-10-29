'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle2, Clock, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SLAMetrics {
  overallCompliance: {
    rate: number;
    total: number;
    compliant: number;
    breached: number;
  };
  pickupCompliance: {
    rate: number;
    total: number;
    compliant: number;
    breached: number;
  };
  firstResponseCompliance: {
    rate: number;
    total: number;
    compliant: number;
    breached: number;
  };
  avgResponseCompliance: {
    rate: number;
    total: number;
    compliant: number;
    breached: number;
  };
  resolutionCompliance: {
    rate: number;
    total: number;
    compliant: number;
    breached: number;
  };
  avgPickupTime: number | null;
  avgFirstResponseTime: number | null;
  avgAvgResponseTime: number | null;
  avgResolutionTime: number | null;
}

interface SLAMetricsOverviewProps {
  metrics?: {
    wallClock: SLAMetrics;
    businessHours: SLAMetrics;
  };
  targets?: {
    pickupTarget: number;
    firstResponseTarget: number;
    avgResponseTarget: number;
    resolutionTarget: number;
    complianceTarget: number;
  };
  enabledMetrics?: {
    pickup: boolean;
    firstResponse: boolean;
    avgResponse: boolean;
    resolution: boolean;
  };
  isLoading?: boolean;
  error?: Error;
  timeMode?: 'wallClock' | 'businessHours';
}

/**
 * Formats seconds into human-readable duration
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'N/A';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Gets status color based on compliance rate and target
 */
function getComplianceStatus(rate: number, target: number): {
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
} {
  if (rate >= target) {
    return {
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      icon: CheckCircle2,
    };
  } else if (rate >= target - 10) {
    return {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
      icon: AlertCircle,
    };
  } else {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
      icon: AlertCircle,
    };
  }
}

export function SLAMetricsOverview({
  metrics,
  targets,
  enabledMetrics = {
    pickup: true,
    firstResponse: true,
    avgResponse: true,
    resolution: true,
  },
  isLoading = false,
  error,
  timeMode = 'wallClock',
}: SLAMetricsOverviewProps) {
  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Failed to load SLA metrics: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !metrics || !targets) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const currentMetrics = metrics[timeMode];
  const complianceTarget = targets.complianceTarget;

  const overallStatus = getComplianceStatus(
    currentMetrics.overallCompliance.rate,
    complianceTarget
  );
  const OverallIcon = overallStatus.icon;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Overall Compliance */}
        <Card className={cn(overallStatus.bgColor)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall SLA Compliance</CardTitle>
            <OverallIcon className={cn('h-4 w-4', overallStatus.color)} />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', overallStatus.color)}>
              {currentMetrics.overallCompliance.rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentMetrics.overallCompliance.compliant} of{' '}
              {currentMetrics.overallCompliance.total} chats
            </p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs text-muted-foreground">Target:</span>
              <span className="text-xs font-medium">{complianceTarget}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Breaches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Breaches</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMetrics.overallCompliance.breached}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentMetrics.overallCompliance.total > 0
                ? (
                    (currentMetrics.overallCompliance.breached /
                      currentMetrics.overallCompliance.total) *
                    100
                  ).toFixed(1)
                : 0}
              % of total chats
            </p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingDown className="h-3 w-3 text-red-600" />
              <span className="text-xs text-red-600">Needs attention</span>
            </div>
          </CardContent>
        </Card>

        {/* Avg First Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Avg First Response</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={enabledMetrics.firstResponse ? "default" : "secondary"} className="text-xs">
                      {enabledMetrics.firstResponse ? "Active" : "Inactive"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {enabledMetrics.firstResponse
                        ? "This metric counts toward overall SLA compliance"
                        : "This metric is tracked but doesn't affect overall SLA"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(currentMetrics.avgFirstResponseTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: {formatDuration(targets.firstResponseTarget)}
            </p>
            <div className="mt-2">
              <div
                className={cn(
                  'text-xs',
                  currentMetrics.avgFirstResponseTime &&
                    currentMetrics.avgFirstResponseTime <= targets.firstResponseTarget
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {currentMetrics.firstResponseCompliance.rate.toFixed(1)}% within target
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Resolution Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={enabledMetrics.resolution ? "default" : "secondary"} className="text-xs">
                      {enabledMetrics.resolution ? "Active" : "Inactive"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {enabledMetrics.resolution
                        ? "This metric counts toward overall SLA compliance"
                        : "This metric is tracked but doesn't affect overall SLA"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(currentMetrics.avgResolutionTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: {formatDuration(targets.resolutionTarget)}
            </p>
            <div className="mt-2">
              <div
                className={cn(
                  'text-xs',
                  currentMetrics.avgResolutionTime &&
                    currentMetrics.avgResolutionTime <= targets.resolutionTarget
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {currentMetrics.resolutionCompliance.rate.toFixed(1)}% within target
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Pickup Time Performance</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={enabledMetrics.pickup ? "default" : "secondary"} className="text-xs">
                      {enabledMetrics.pickup ? "Active" : "Inactive"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {enabledMetrics.pickup
                        ? "This metric counts toward overall SLA compliance"
                        : "This metric is tracked but doesn't affect overall SLA"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average:</span>
                <span className="text-sm font-medium">
                  {formatDuration(currentMetrics.avgPickupTime)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Target:</span>
                <span className="text-sm font-medium">
                  {formatDuration(targets.pickupTarget)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Compliance Rate:</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    currentMetrics.pickupCompliance.rate >= complianceTarget
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {currentMetrics.pickupCompliance.rate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Avg Response Time Performance</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={enabledMetrics.avgResponse ? "default" : "secondary"} className="text-xs">
                      {enabledMetrics.avgResponse ? "Active" : "Inactive"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {enabledMetrics.avgResponse
                        ? "This metric counts toward overall SLA compliance"
                        : "This metric is tracked but doesn't affect overall SLA"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average:</span>
                <span className="text-sm font-medium">
                  {formatDuration(currentMetrics.avgAvgResponseTime)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Target:</span>
                <span className="text-sm font-medium">
                  {formatDuration(targets.avgResponseTarget)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Compliance Rate:</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    currentMetrics.avgResponseCompliance.rate >= complianceTarget
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {currentMetrics.avgResponseCompliance.rate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
