/**
 * Configuration Status Component
 *
 * Shows the current configuration status and any critical issues
 * that might prevent sync operations from working.
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  criticalIssues?: string[];
  timestamp: string;
}

export function ConfigurationStatus() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setHealthStatus(data);
      } catch (error) {
        console.error('Failed to check health status:', error);
        setHealthStatus({
          status: 'unhealthy',
          criticalIssues: ['Unable to connect to health check service'],
          timestamp: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <span>Checking system status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!healthStatus) {
    return null;
  }

  const { status, criticalIssues = [] } = healthStatus;

  if (status === 'healthy' && criticalIssues.length === 0) {
    return null; // Don't show anything if everything is working
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50';
      case 'degraded':
        return 'border-yellow-200 bg-yellow-50';
      case 'unhealthy':
        return 'border-red-200 bg-red-50';
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'healthy':
        return 'text-green-800';
      case 'degraded':
        return 'text-yellow-800';
      case 'unhealthy':
        return 'text-red-800';
    }
  };

  const getBadgeVariant = () => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'unhealthy':
        return 'destructive';
    }
  };

  return (
    <Card className={getStatusColor()}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className={`text-lg ${getTextColor()}`}>
              System Configuration
            </CardTitle>
          </div>
          <Badge variant={getBadgeVariant()}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      {criticalIssues.length > 0 && (
        <CardContent className="pt-0">
          <CardDescription className={`text-sm ${getTextColor()}`}>
            The following configuration issues may prevent sync operations:
          </CardDescription>
          <ul className={`mt-2 space-y-1 text-sm ${getTextColor()}`}>
            {criticalIssues.map((issue, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="font-medium">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>

          {status === 'unhealthy' && (
            <div className={`mt-3 text-xs ${getTextColor()}`}>
              Please contact your administrator to resolve these configuration issues.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}