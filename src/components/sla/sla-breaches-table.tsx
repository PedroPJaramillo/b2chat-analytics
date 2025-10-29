'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BreachData {
  chatId: string;
  openedAt: string;
  closedAt: string | null;
  channel: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  agent: {
    id: string;
    name: string;
    email: string;
  } | null;
  breachTypes: string[];
  metrics: {
    wallClock: {
      timeToPickup: number | null;
      firstResponseTime: number | null;
      avgResponseTime: number | null;
      resolutionTime: number | null;
      pickupSLA: boolean | null;
      firstResponseSLA: boolean | null;
      avgResponseSLA: boolean | null;
      resolutionSLA: boolean | null;
    };
  };
}

interface SLABreachesTableProps {
  breaches?: BreachData[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  isLoading?: boolean;
  error?: Error;
  onPageChange?: (page: number) => void;
  onBreachTypeFilter?: (type: string) => void;
  onSortChange?: (field: string, order: 'asc' | 'desc') => void;
  onChatClick?: (chatId: string) => void;
}

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

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getBreachBadgeVariant(type: string): 'destructive' | 'default' | 'secondary' {
  switch (type) {
    case 'pickup':
      return 'destructive';
    case 'first_response':
      return 'destructive';
    case 'resolution':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatBreachType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function SLABreachesTable({
  breaches,
  pagination,
  isLoading = false,
  error,
  onPageChange,
  onBreachTypeFilter,
  onSortChange,
  onChatClick,
}: SLABreachesTableProps) {
  const [sortField, setSortField] = useState<string>('openedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [breachTypeFilter, setBreachTypeFilter] = useState<string>('all');

  const handleSort = (field: string) => {
    const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(newOrder);
    onSortChange?.(field, newOrder);
  };

  const handleBreachTypeChange = (value: string) => {
    setBreachTypeFilter(value);
    onBreachTypeFilter?.(value);
  };

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Failed to load breaches: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !breaches) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>SLA Breaches</CardTitle>
            <CardDescription>
              {pagination?.total || 0} total breaches found
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={breachTypeFilter} onValueChange={handleBreachTypeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Breaches</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="first_response">First Response</SelectItem>
                <SelectItem value="avg_response">Avg Response</SelectItem>
                <SelectItem value="resolution">Resolution</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('openedAt')}
                  >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Breach Types</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('resolutionTime')}
                  >
                    Resolution Time
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      No breaches found for the selected filters
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                breaches.map((breach) => (
                  <TableRow key={breach.chatId} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium text-xs">
                      {format(new Date(breach.openedAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {breach.customer?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {breach.customer?.phone || 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {breach.agent?.name || 'Unassigned'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {breach.agent?.email || 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {breach.channel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {breach.breachTypes.map((type) => (
                          <Badge
                            key={type}
                            variant={getBreachBadgeVariant(type)}
                            className="text-xs"
                          >
                            {formatBreachType(type)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "text-sm font-medium",
                        breach.metrics.wallClock.resolutionSLA === false
                          ? "text-red-600"
                          : "text-muted-foreground"
                      )}>
                        {formatDuration(breach.metrics.wallClock.resolutionTime)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onChatClick?.(breach.chatId)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={!pagination.hasPreviousPage}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
