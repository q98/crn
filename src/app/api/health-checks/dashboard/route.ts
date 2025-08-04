import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Type guard functions
function isHealthCheckResultData(obj: unknown): obj is HealthCheckResultData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'status' in obj &&
    'statusCode' in obj &&
    'healthCheckId' in obj
  );
}

function isAlertData(obj: unknown): obj is AlertData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'message' in obj &&
    'severity' in obj &&
    'resolved' in obj &&
    'healthCheckId' in obj
  );
}

interface HealthCheckResultData {
  status: string;
  statusCode: number;
  responseTime?: number;
  errorMessage?: string;
  healthCheckId: string;
  url?: string;
  method?: string;
  timeout?: number;
  expectedStatus?: number;
}

interface AlertData {
  type: string;
  message: string;
  severity: string;
  resolved: boolean;
  resolvedAt?: string;
  healthCheckId: string;
}

interface DashboardStats {
  totalChecks: number;
  activeChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  uptimePercentage: number;
  checksLast24h: number;
  alertsLast24h: number;
}

interface CheckStatus {
  id: string;
  url: string;
  status: 'UP' | 'DOWN' | 'PENDING' | 'ERROR';
  responseTime: number | null;
  statusCode: number | null;
  lastChecked: Date | null;
  errorMessage: string | null;
  client: {
    id: string;
    name: string;
    domainName: string;
  };
  uptime: {
    percentage: number;
    totalChecks: number;
    successfulChecks: number;
  };
}

interface AlertInfo {
  id: string;
  type: 'DOWN' | 'SLOW' | 'ERROR' | 'SSL_EXPIRY';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: Date;
  resolved: boolean;
  resolvedAt: Date | null;
  healthCheckId: string;
  client: {
    id: string;
    name: string;
  };
}

interface DashboardResponse {
  stats: DashboardStats;
  recentChecks: CheckStatus[];
  activeAlerts: AlertInfo[];
  uptimeHistory: Array<{
    date: string;
    uptime: number;
    totalChecks: number;
    successfulChecks: number;
  }>;
  responseTimeHistory: Array<{
    timestamp: string;
    averageResponseTime: number;
    checkCount: number;
  }>;
}

// GET /api/health-checks/dashboard - Get dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h'; // 24h, 7d, 30d
    const clientId = searchParams.get('clientId');

    // Calculate time range
    const now = new Date();
    const timeRangeStart = new Date();
    switch (timeRange) {
      case '7d':
        timeRangeStart.setDate(now.getDate() - 7);
        break;
      case '30d':
        timeRangeStart.setDate(now.getDate() - 30);
        break;
      default: // 24h
        timeRangeStart.setHours(now.getHours() - 24);
    }

    // Build where clause for client filtering
    // const clientFilter = clientId ? { clientId } : {};

    // Get all health checks for the user's clients
    // const userClients = await prisma.client.findMany({
    //   where: {
    //     // Add user filtering if needed based on your schema
    //   },
    //   select: { id: true }
    // });

    // const clientIds = userClients.map(c => c.id);
    // const healthCheckFilter = {
    //   ...clientFilter,
    //   clientId: clientId ? clientId : { in: clientIds }
    // };

    // Get basic stats from Report model
    const totalChecks = await prisma.report.count({
      where: {
        title: { startsWith: 'Health Check' },
        ...(clientId && { clientId })
      }
    });

    const activeChecks = await prisma.report.count({
      where: {
        title: { startsWith: 'Health Check' },
        reportData: {
          path: '$.enabled',
          equals: true
        },
        ...(clientId && { clientId })
      }
    });

    const failedChecks = await prisma.report.count({
      where: {
        title: { startsWith: 'Health Check' },
        reportData: {
          path: '$.status',
          equals: 'DOWN'
        },
        ...(clientId && { clientId })
      }
    });

    // Get recent health checks with client info
    const recentHealthChecks = await prisma.report.findMany({
      where: {
        title: { startsWith: 'Health Check' },
        ...(clientId && { clientId })
      },
      orderBy: {
        generatedAt: 'desc'
      },
      take: 20
    });

    // Calculate average response time from Report model
    const responseTimeReports = await prisma.report.findMany({
      where: {
        title: { startsWith: 'Health Check' },
        reportData: {
          path: '$.responseTime',
          not: 'null'
        },
        generatedAt: { gte: timeRangeStart },
        ...(clientId && { clientId })
      }
    });

    // Calculate average manually since we can't use aggregate on JSON fields
    const responseTimes = responseTimeReports
      .map(r => {
        if (!isHealthCheckResultData(r.reportData)) {
          return null;
        }
        return r.reportData.responseTime;
      })
      .filter((rt): rt is number => rt !== null && rt !== undefined);

    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0;

    // Get health check history for uptime calculation
    const healthCheckHistory = await prisma.report.findMany({
      where: {
        title: { startsWith: 'Health Check Result' },
        generatedAt: { gte: timeRangeStart },
        ...(clientId && { clientId })
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    // Calculate uptime percentage
    const totalHistoryChecks = healthCheckHistory.length;
    const successfulHistoryChecks = healthCheckHistory.filter(h => {
      if (!isHealthCheckResultData(h.reportData)) {
        return false;
      }
      const data = h.reportData;
      return data.status === 'UP' || data.statusCode === 200;
    }).length;
    
    const uptimePercentage = totalHistoryChecks > 0 
      ? (successfulHistoryChecks / totalHistoryChecks) * 100 
      : 100;

    // Get checks in last 24h
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    
    const checksLast24h = await prisma.report.count({
      where: {
        title: { startsWith: 'Health Check Result' },
        generatedAt: { gte: last24h },
        ...(clientId && { clientId })
      }
    });

    // Get alerts (stored as reports with alert type)
    const activeAlerts = await prisma.report.findMany({
      where: {
        title: { startsWith: 'Health Check Alert' },
        generatedAt: { gte: timeRangeStart },
        ...(clientId && { clientId })
      },
      orderBy: {
        generatedAt: 'desc'
      },
      take: 10
    });

    const alertsLast24h = await prisma.report.count({
      where: {
        title: { startsWith: 'Health Check Alert' },
        generatedAt: { gte: last24h },
        ...(clientId && { clientId })
      }
    });

    // Build dashboard stats
    const stats: DashboardStats = {
      totalChecks,
      activeChecks,
      failedChecks,
      averageResponseTime: avgResponseTime,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      checksLast24h,
      alertsLast24h
    };

    // Transform recent checks
    const recentChecks: CheckStatus[] = await Promise.all(
      recentHealthChecks.map(async (check) => {
        if (!isHealthCheckResultData(check.reportData)) {
          return null;
        }
        const checkData = check.reportData;
        
        // Get uptime stats for this specific check
        const checkHistory = await prisma.report.findMany({
          where: {
            title: { startsWith: 'Health Check Result' },
            reportData: {
              path: '$.healthCheckId',
              equals: checkData.healthCheckId
            },
            generatedAt: { gte: timeRangeStart }
          }
        });

        const totalCheckHistory = checkHistory.length;
        const successfulCheckHistory = checkHistory.filter(h => {
          if (!isHealthCheckResultData(h.reportData)) {
            return false;
          }
          const data = h.reportData;
          return data.status === 'UP' || data.statusCode === 200;
        }).length;

        const uptimePercentage = totalCheckHistory > 0 
          ? (successfulCheckHistory / totalCheckHistory) * 100 
          : 100;

        return {
          id: check.id,
          url: checkData.url || '',
          status: (checkData.status as 'UP' | 'DOWN' | 'PENDING' | 'ERROR') || 'PENDING',
          responseTime: checkData.responseTime || null,
          statusCode: checkData.statusCode || null,
          lastChecked: check.generatedAt,
          errorMessage: checkData.errorMessage || null,
          client: {
            id: check.clientId || '',
            name: 'Unknown',
            domainName: 'Unknown'
          },
          uptime: {
            percentage: Math.round(uptimePercentage * 100) / 100,
            totalChecks: totalCheckHistory,
            successfulChecks: successfulCheckHistory
          }
        };
      })
    ).then(checks => checks.filter(Boolean) as CheckStatus[]);

    // Transform alerts
    const alertInfos: AlertInfo[] = activeAlerts.map(alert => {
      if (!isAlertData(alert.reportData)) {
        return null;
      }
      const data = alert.reportData;
      return {
        id: alert.id,
        type: (data.type as 'DOWN' | 'SLOW' | 'ERROR' | 'SSL_EXPIRY') || 'ERROR',
        message: data.message || 'Health check alert',
        severity: (data.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') || 'MEDIUM',
        createdAt: alert.generatedAt,
        resolved: data.resolved || false,
        resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null,
        healthCheckId: data.healthCheckId || '',
        client: {
          id: alert.clientId || '',
          name: 'Unknown'
        }
      };
    }).filter(Boolean) as AlertInfo[];

    // Generate uptime history (daily aggregates)
    const uptimeHistory = [];
    const days = timeRange === '30d' ? 30 : timeRange === '7d' ? 7 : 1;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayHistory = healthCheckHistory.filter(h => 
        h.generatedAt >= date && h.generatedAt < nextDate
      );
      
      const dayTotal = dayHistory.length;
      const daySuccessful = dayHistory.filter(h => {
        if (!isHealthCheckResultData(h.reportData)) {
          return false;
        }
        const data = h.reportData;
        return data.status === 'UP' || data.statusCode === 200;
      }).length;
      
      const dayUptime = dayTotal > 0 ? (daySuccessful / dayTotal) * 100 : 100;
      
      uptimeHistory.push({
        date: date.toISOString().split('T')[0],
        uptime: Math.round(dayUptime * 100) / 100,
        totalChecks: dayTotal,
        successfulChecks: daySuccessful
      });
    }

    // Generate response time history (hourly aggregates for 24h, daily for longer)
    const responseTimeHistory = [];
    const intervals = timeRange === '24h' ? 24 : days;
    const intervalType = timeRange === '24h' ? 'hour' : 'day';
    
    for (let i = intervals - 1; i >= 0; i--) {
      const date = new Date();
      if (intervalType === 'hour') {
        date.setHours(date.getHours() - i, 0, 0, 0);
      } else {
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
      }
      
      const nextDate = new Date(date);
      if (intervalType === 'hour') {
        nextDate.setHours(nextDate.getHours() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      const intervalHistory = healthCheckHistory.filter(h => {
        if (!isHealthCheckResultData(h.reportData)) {
          return false;
        }
        const data = h.reportData;
        return h.generatedAt >= date && h.generatedAt < nextDate && data.responseTime;
      });
      
      const avgResponseTime = intervalHistory.length > 0 
        ? intervalHistory.reduce((sum, h) => {
            if (!isHealthCheckResultData(h.reportData)) {
              return sum;
            }
            const data = h.reportData;
            return sum + (data.responseTime || 0);
          }, 0) / intervalHistory.length
        : 0;
      
      responseTimeHistory.push({
        timestamp: date.toISOString(),
        averageResponseTime: Math.round(avgResponseTime),
        checkCount: intervalHistory.length
      });
    }

    const dashboardData: DashboardResponse = {
      stats,
      recentChecks,
      activeAlerts: alertInfos,
      uptimeHistory,
      responseTimeHistory
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/health-checks/dashboard - Trigger manual health check
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { healthCheckIds } = await request.json();

    if (!healthCheckIds || healthCheckIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one health check ID is required' },
        { status: 400 }
      );
    }

    const results = [];

    // Perform manual health checks
    for (const healthCheckId of healthCheckIds) {
      try {
        const healthCheck = await prisma.report.findUnique({
          where: { id: healthCheckId }
        });

        if (!healthCheck) {
          results.push({
            healthCheckId,
            success: false,
            error: 'Health check not found'
          });
          continue;
        }

        if (!healthCheck || !healthCheck.title.startsWith('Health Check')) {
          results.push({
            healthCheckId,
            success: false,
            error: 'Health check not found'
          });
          continue;
        }

        if (!isHealthCheckResultData(healthCheck.reportData)) {
          results.push({
            healthCheckId,
            success: false,
            error: 'Invalid health check data structure'
          });
          continue;
        }

        const healthCheckData = healthCheck.reportData;
        
        // Perform the actual health check
        const startTime = Date.now();
        let status = 'UP';
        let statusCode = null;
        let responseTime = null;
        let errorMessage = null;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), healthCheckData.timeout || 5000);
          
          const response = await fetch(healthCheckData.url || '', {
            method: healthCheckData.method || 'GET',
            headers: {
              'User-Agent': 'SHP Health Monitor/1.0'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          responseTime = Date.now() - startTime;
          statusCode = response.status;

          if (response.status !== (healthCheckData.expectedStatus || 200)) {
            status = 'DOWN';
                          errorMessage = `Expected status ${healthCheckData.expectedStatus || 200}, got ${response.status}`;
          }
        } catch (error) {
          responseTime = Date.now() - startTime;
          status = 'ERROR';
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }

        // Create health check result record
        await prisma.report.create({
          data: {
            title: `Health Check Result - Manual Check`,
            dateRange: {
              startDate: new Date().toISOString(),
              endDate: new Date().toISOString()
            },
            totalHours: 0,
            totalAmount: 0,
            clientId: healthCheck.clientId,
            generatedAt: new Date(),
            reportData: JSON.parse(JSON.stringify({
              type: 'HEALTH_CHECK_RESULT',
              healthCheckId: healthCheck.id,
              url: healthCheckData.url,
              method: healthCheckData.method,
              status,
              statusCode,
              responseTime,
              errorMessage,
              expectedStatus: healthCheckData.expectedStatus,
              manual: true,
              triggeredBy: session.user.id
            }))
          }
        });

        // Create alert if check failed
        if (status !== 'UP') {
          await prisma.report.create({
            data: {
              title: `Health Check Alert - Manual Check`,
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString()
              },
              totalHours: 0,
              totalAmount: 0,
              clientId: healthCheck.clientId,
              generatedAt: new Date(),
              reportData: JSON.parse(JSON.stringify({
                type: 'HEALTH_CHECK_ALERT',
                healthCheckId: healthCheck.id,
                alertType: status === 'ERROR' ? 'ERROR' : 'DOWN',
                severity: 'HIGH',
                message: errorMessage || `Health check failed with status ${status}`,
                url: healthCheckData.url,
                statusCode,
                responseTime,
                resolved: false,
                triggeredBy: session.user.id
              }))
            }
          });
        }

        results.push({
          healthCheckId,
          success: true,
          status,
          statusCode,
          responseTime,
          errorMessage
        });

      } catch (error) {
        results.push({
          healthCheckId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Completed ${results.length} manual health checks`,
      results
    });

  } catch (error) {
    console.error('Error performing manual health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}