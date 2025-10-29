'use client';

import { useState, useEffect, useCallback } from 'react';
import { pageContainerClasses } from "@/lib/ui-utils"
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { SLAMetricsOverview } from '@/components/sla/sla-metrics-overview';
import { SLAComplianceTrendChart } from '@/components/sla/sla-compliance-trend-chart';
import { SLABreachesTable } from '@/components/sla/sla-breaches-table';
import { DateRangePicker } from '@/components/sla/date-range-picker';
import { useToast } from '@/hooks/use-toast';

export default function SLAPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [timeMode, setTimeMode] = useState<'wallClock' | 'businessHours'>('wallClock');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Data states
  const [metricsData, setMetricsData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [breachesData, setBreachesData] = useState<any>(null);
  const [targetsData, setTargetsData] = useState<any>(null);

  // Loading states
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingBreaches, setIsLoadingBreaches] = useState(false);

  // Error states
  const [metricsError, setMetricsError] = useState<Error | undefined>();
  const [breachesError, setBreachesError] = useState<Error | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [breachTypeFilter, setBreachTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('openedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setIsLoadingMetrics(true);
    setMetricsError(undefined);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });

      const response = await fetch(`/api/sla/metrics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetricsData(data.metrics);
      setTargetsData(data.targets);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetricsError(error as Error);
      toast({
        title: 'Error',
        description: 'Failed to load SLA metrics',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [dateRange, toast]);

  // Fetch breaches
  const fetchBreaches = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setIsLoadingBreaches(true);
    setBreachesError(undefined);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        page: currentPage.toString(),
        pageSize: '50',
        sortBy: sortField,
        sortOrder,
      });

      if (breachTypeFilter !== 'all') {
        params.append('breachType', breachTypeFilter);
      }

      const response = await fetch(`/api/sla/breaches?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch breaches');
      }

      const data = await response.json();
      setBreachesData(data);
    } catch (error) {
      console.error('Error fetching breaches:', error);
      setBreachesError(error as Error);
      toast({
        title: 'Error',
        description: 'Failed to load SLA breaches',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBreaches(false);
    }
  }, [dateRange, currentPage, breachTypeFilter, sortField, sortOrder, toast]);

  // Initial load
  useEffect(() => {
    fetchMetrics();
    fetchBreaches();
  }, [dateRange, fetchMetrics, fetchBreaches]);

  // Fetch breaches when filters change
  useEffect(() => {
    fetchBreaches();
  }, [currentPage, breachTypeFilter, sortField, sortOrder, fetchBreaches]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
        fetchBreaches();
      }, 30000); // 30 seconds

      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [autoRefresh, fetchMetrics, fetchBreaches, refreshInterval]);

  const handleRefresh = () => {
    fetchMetrics();
    fetchBreaches();
    toast({
      title: 'Refreshing',
      description: 'Loading latest SLA data...',
    });
  };

  const handleChatClick = (chatId: string) => {
    router.push(`/dashboard/chats/${chatId}`);
  };

  return (
    <div className={pageContainerClasses}>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">SLA Compliance</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-primary/10' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center justify-between">
        <DateRangePicker
          dateRange={dateRange}
          onChange={setDateRange}
          maxDays={90}
        />
      </div>

      {/* Time Mode Tabs */}
      <Tabs value={timeMode} onValueChange={(v) => setTimeMode(v as any)}>
        <TabsList>
          <TabsTrigger value="wallClock">Wall Clock Time</TabsTrigger>
          <TabsTrigger value="businessHours">Business Hours Only</TabsTrigger>
        </TabsList>

        <TabsContent value={timeMode} className="space-y-4">
          {/* Metrics Overview */}
          <SLAMetricsOverview
            metrics={metricsData}
            targets={targetsData}
            isLoading={isLoadingMetrics}
            error={metricsError}
            timeMode={timeMode}
          />

          {/* Compliance Trend Chart */}
          <SLAComplianceTrendChart
            data={trendData}
            isLoading={isLoadingMetrics}
            error={metricsError}
            complianceTarget={targetsData?.complianceTarget}
          />

          {/* Breaches Table */}
          <SLABreachesTable
            breaches={breachesData?.breaches}
            pagination={breachesData?.pagination}
            isLoading={isLoadingBreaches}
            error={breachesError}
            onPageChange={setCurrentPage}
            onBreachTypeFilter={setBreachTypeFilter}
            onSortChange={(field, order) => {
              setSortField(field);
              setSortOrder(order);
            }}
            onChatClick={handleChatClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
