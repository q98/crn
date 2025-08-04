import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // bytes
    used: number; // bytes
    free: number; // bytes
    usage: number; // percentage
  };
  disk: {
    total: number; // bytes
    used: number; // bytes
    free: number; // bytes
    usage: number; // percentage
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    errors: number;
  };
  database: {
    connections: {
      active: number;
      idle: number;
      total: number;
    };
    queries: {
      total: number;
      slow: number;
      failed: number;
      avgResponseTime: number; // milliseconds
    };
    size: number; // bytes
  };
  application: {
    uptime: number; // seconds
    version: string;
    environment: string;
    activeUsers: number;
    requestsPerMinute: number;
    errorRate: number; // percentage
    responseTime: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

interface PerformanceMetrics {
  timestamp: Date;
  endpoint: string;
  method: string;
  responseTime: number; // milliseconds
  statusCode: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  error?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface UptimeMetrics {
  timestamp: Date;
  service: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  responseTime?: number;
  statusCode?: number;
  error?: string;
  location?: string;
  checks: {
    dns: boolean;
    tcp: boolean;
    http: boolean;
    ssl: boolean;
  };
}

interface SecurityMetrics {
  timestamp: Date;
  type: 'LOGIN_ATTEMPT' | 'FAILED_LOGIN' | 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT' | 'BLOCKED_IP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: {
    ip: string;
    userAgent?: string;
    country?: string;
    city?: string;
  };
  target: {
    userId?: string;
    endpoint?: string;
    resource?: string;
  };
  details: Record<string, unknown>;
  blocked: boolean;
  action?: string;
}

interface DashboardData {
  overview: {
    totalClients: number;
    totalCredentials: number;
    totalTasks: number;
    activeAlerts: number;
    systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    uptime: number; // percentage
    lastUpdated: Date;
  };
  systemMetrics: SystemMetrics;
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    triggeredAt: Date;
    status: string;
  }>;
  performanceData: {
    responseTime: Array<{ timestamp: Date; value: number }>;
    throughput: Array<{ timestamp: Date; value: number }>;
    errorRate: Array<{ timestamp: Date; value: number }>;
  };
  uptimeData: {
    overall: number;
    services: Array<{
      name: string;
      status: string;
      uptime: number;
      lastCheck: Date;
    }>;
  };
  securityData: {
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recentEvents: SecurityMetrics[];
    blockedIPs: number;
    failedLogins: number;
  };
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
    network: {
      in: number;
      out: number;
    };
  };
  trends: {
    clientGrowth: Array<{ date: string; count: number }>;
    taskCompletion: Array<{ date: string; completed: number; total: number }>;
    alertFrequency: Array<{ date: string; count: number }>;
  };
}

// GET /api/monitoring/dashboard - Get dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h'; // 1h, 6h, 24h, 7d, 30d
    const includeMetrics = searchParams.get('includeMetrics') === 'true';
    const includePerformance = searchParams.get('includePerformance') === 'true';
    const includeSecurity = searchParams.get('includeSecurity') === 'true';

    // Calculate time range
    const now = new Date();
    const timeRangeMs = getTimeRangeMs(timeRange);
    const startTime = new Date(now.getTime() - timeRangeMs);

    // Get overview data
    const overview = await getOverviewData();

    // Get system metrics
    const systemMetrics = await getCurrentSystemMetrics();

    // Get recent alerts
    const recentAlerts = await getRecentAlerts(10);

    // Get performance data
    const performanceData = await getPerformanceData(startTime, now);

    // Get uptime data
    const uptimeData = await getUptimeData(startTime, now);

    // Get security data
    const securityData = await getSecurityData(startTime, now);

    // Get resource usage
    const resourceUsage = await getResourceUsage();

    // Get trends
    const trends = await getTrends(startTime, now);

    const dashboardData: DashboardData = {
      overview,
      systemMetrics,
      recentAlerts,
      performanceData,
      uptimeData,
      securityData,
      resourceUsage,
      trends
    };

    // Include additional metrics if requested
    const response: Record<string, unknown> = { dashboard: dashboardData };

    if (includeMetrics) {
      response.detailedMetrics = await getDetailedMetrics(startTime, now);
    }

    if (includePerformance) {
      response.performanceMetrics = await getPerformanceMetrics(startTime, now);
    }

    if (includeSecurity) {
      response.securityMetrics = await getSecurityMetrics(startTime, now);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/monitoring/dashboard - Record metrics or update dashboard settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'record_metrics') {
      const { metrics }: { metrics: SystemMetrics } = data;

      if (!metrics) {
        return NextResponse.json(
          { error: 'metrics is required' },
          { status: 400 }
        );
      }

      // Store system metrics
      await prisma.report.create({
        data: {
          title: `System Metrics - ${new Date().toISOString()}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: '',
          reportData: JSON.parse(JSON.stringify({
            type: 'SYSTEM_METRICS',
            ...metrics
          }))
        }
      });

      return NextResponse.json({
        message: 'Metrics recorded successfully'
      });
    }

    if (action === 'record_performance') {
      const { performance }: { performance: PerformanceMetrics } = data;

      if (!performance) {
        return NextResponse.json(
          { error: 'performance data is required' },
          { status: 400 }
        );
      }

      // Store performance metrics
      await prisma.report.create({
        data: {
          title: `Performance Metrics - ${performance.endpoint}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: '',
          reportData: JSON.parse(JSON.stringify({
            type: 'PERFORMANCE_METRICS',
            ...performance
          }))
        }
      });

      return NextResponse.json({
        message: 'Performance metrics recorded successfully'
      });
    }

    if (action === 'record_uptime') {
      const { uptime }: { uptime: UptimeMetrics } = data;

      if (!uptime) {
        return NextResponse.json(
          { error: 'uptime data is required' },
          { status: 400 }
        );
      }

      // Store uptime metrics
      await prisma.report.create({
        data: {
          title: `Uptime Metrics - ${uptime.service}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: '',
          reportData: JSON.parse(JSON.stringify({
            type: 'UPTIME_METRICS',
            ...uptime
          }))
        }
      });

      return NextResponse.json({
        message: 'Uptime metrics recorded successfully'
      });
    }

    if (action === 'record_security') {
      const { security }: { security: SecurityMetrics } = data;

      if (!security) {
        return NextResponse.json(
          { error: 'security data is required' },
          { status: 400 }
        );
      }

      // Store security metrics
      await prisma.report.create({
        data: {
          title: `Security Event - ${security.type}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: '',
          reportData: JSON.parse(JSON.stringify({
            ...security,
            type: 'SECURITY_METRICS'
          }))
        }
      });

      return NextResponse.json({
        message: 'Security metrics recorded successfully'
      });
    }

    if (action === 'update_settings') {
      const { settings }: { settings: Record<string, unknown> } = data;

      if (!settings) {
        return NextResponse.json(
          { error: 'settings is required' },
          { status: 400 }
        );
      }

      // Store dashboard settings
      await prisma.report.create({
        data: {
          title: `Dashboard Settings - ${session.user.id}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: '',
          reportData: JSON.parse(JSON.stringify({
            type: 'DASHBOARD_SETTINGS',
            userId: session.user.id,
            settings
          }))
        }
      });

      return NextResponse.json({
        message: 'Dashboard settings updated successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing dashboard request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get time range in milliseconds
function getTimeRangeMs(timeRange: string): number {
  switch (timeRange) {
    case '1h':
      return 60 * 60 * 1000;
    case '6h':
      return 6 * 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

// Helper function to get overview data
async function getOverviewData(): Promise<DashboardData['overview']> {
  const [clientCount, credentialCount, taskCount, alertCount] = await Promise.all([
    prisma.client.count(),
    prisma.credential.count(),
    prisma.task.count(),
    prisma.report.count({
      where: {
        title: { startsWith: 'Monitoring Alert -' },
        reportData: {
          path: 'status',
          equals: 'ACTIVE'
        }
      }
    })
  ]);

  // Calculate system health based on active alerts
  let systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (alertCount > 10) {
    systemHealth = 'CRITICAL';
  } else if (alertCount > 5) {
    systemHealth = 'WARNING';
  }

  // Calculate uptime (mock data - in real implementation, this would come from actual monitoring)
  const uptime = 99.9;

  return {
    totalClients: clientCount,
    totalCredentials: credentialCount,
    totalTasks: taskCount,
    activeAlerts: alertCount,
    systemHealth,
    uptime,
    lastUpdated: new Date()
  };
}

// Helper function to get current system metrics
async function getCurrentSystemMetrics(): Promise<SystemMetrics> {
  // In a real implementation, this would collect actual system metrics
  // For now, we'll return mock data
  return {
    timestamp: new Date(),
    cpu: {
      usage: Math.random() * 100,
      cores: 4,
      loadAverage: [1.2, 1.5, 1.8]
    },
    memory: {
      total: 8 * 1024 * 1024 * 1024, // 8GB
      used: 4 * 1024 * 1024 * 1024, // 4GB
      free: 4 * 1024 * 1024 * 1024, // 4GB
      usage: 50
    },
    disk: {
      total: 500 * 1024 * 1024 * 1024, // 500GB
      used: 200 * 1024 * 1024 * 1024, // 200GB
      free: 300 * 1024 * 1024 * 1024, // 300GB
      usage: 40
    },
    network: {
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 1000000),
      packetsIn: Math.floor(Math.random() * 10000),
      packetsOut: Math.floor(Math.random() * 10000),
      errors: 0
    },
    database: {
      connections: {
        active: 5,
        idle: 10,
        total: 15
      },
      queries: {
        total: 1000,
        slow: 2,
        failed: 0,
        avgResponseTime: 50
      },
      size: 100 * 1024 * 1024 // 100MB
    },
    application: {
      uptime: 86400, // 1 day
      version: '1.0.0',
      environment: 'production',
      activeUsers: 25,
      requestsPerMinute: 100,
      errorRate: 0.1,
      responseTime: {
        avg: 200,
        p50: 150,
        p95: 500,
        p99: 1000
      }
    }
  };
}

// Helper function to get recent alerts
async function getRecentAlerts(limit: number): Promise<DashboardData['recentAlerts']> {
  const alerts = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Monitoring Alert -' }
    },
    orderBy: {
      generatedAt: 'desc'
    },
    take: limit
  });

  return alerts.map(alert => {
    const alertData = alert.reportData as Record<string, unknown>;
    return {
      id: alert.id,
      type: alertData.type as string,
      severity: alertData.severity as string,
      title: alertData.title as string,
      triggeredAt: alert.generatedAt,
      status: alertData.status as string
    };
  });
}

// Helper function to get performance data
async function getPerformanceData(
  startTime: Date,
  endTime: Date
): Promise<DashboardData['performanceData']> {
  const performanceMetrics = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Performance Metrics -' },
      generatedAt: {
        gte: startTime,
        lte: endTime
      }
    },
    orderBy: {
      generatedAt: 'asc'
    }
  });

  const responseTime: Array<{ timestamp: Date; value: number }> = [];
  const throughput: Array<{ timestamp: Date; value: number }> = [];
  const errorRate: Array<{ timestamp: Date; value: number }> = [];

  // Group metrics by time intervals
  const intervalMs = 5 * 60 * 1000; // 5 minutes
  const intervals = new Map<number, {
    responseTimes: number[];
    requests: number;
    errors: number;
  }>();

  performanceMetrics.forEach(metric => {
    const data = metric.reportData as unknown as PerformanceMetrics;
    const intervalKey = Math.floor(metric.generatedAt.getTime() / intervalMs) * intervalMs;
    
    if (!intervals.has(intervalKey)) {
      intervals.set(intervalKey, {
        responseTimes: [],
        requests: 0,
        errors: 0
      });
    }
    
    const interval = intervals.get(intervalKey)!;
    interval.responseTimes.push(data.responseTime);
    interval.requests++;
    
    if (data.statusCode >= 400) {
      interval.errors++;
    }
  });

  // Calculate aggregated metrics
  intervals.forEach((data, timestamp) => {
    const avgResponseTime = data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length;
    const errorPercentage = (data.errors / data.requests) * 100;
    
    responseTime.push({
      timestamp: new Date(timestamp),
      value: avgResponseTime
    });
    
    throughput.push({
      timestamp: new Date(timestamp),
      value: data.requests
    });
    
    errorRate.push({
      timestamp: new Date(timestamp),
      value: errorPercentage
    });
  });

  return {
    responseTime,
    throughput,
    errorRate
  };
}

// Helper function to get uptime data
async function getUptimeData(
  startTime: Date,
  endTime: Date
): Promise<DashboardData['uptimeData']> {
  const uptimeMetrics = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Uptime Metrics -' },
      generatedAt: {
        gte: startTime,
        lte: endTime
      }
    },
    orderBy: {
      generatedAt: 'desc'
    }
  });

  const serviceStats = new Map<string, {
    total: number;
    up: number;
    lastCheck: Date;
    status: string;
  }>();

  uptimeMetrics.forEach(metric => {
    const data = metric.reportData as unknown as UptimeMetrics;
    
    if (!serviceStats.has(data.service)) {
      serviceStats.set(data.service, {
        total: 0,
        up: 0,
        lastCheck: data.timestamp,
        status: data.status
      });
    }
    
    const stats = serviceStats.get(data.service)!;
    stats.total++;
    
    if (data.status === 'UP') {
      stats.up++;
    }
    
    if (data.timestamp > stats.lastCheck) {
      stats.lastCheck = data.timestamp;
      stats.status = data.status;
    }
  });

  const services = Array.from(serviceStats.entries()).map(([name, stats]) => ({
    name,
    status: stats.status,
    uptime: stats.total > 0 ? (stats.up / stats.total) * 100 : 100,
    lastCheck: stats.lastCheck
  }));

  const overall = services.length > 0 
    ? services.reduce((sum, service) => sum + service.uptime, 0) / services.length
    : 100;

  return {
    overall,
    services
  };
}

// Helper function to get security data
async function getSecurityData(
  startTime: Date,
  endTime: Date
): Promise<DashboardData['securityData']> {
  const securityMetrics = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Security Event -' },
      generatedAt: {
        gte: startTime,
        lte: endTime
      }
    },
    orderBy: {
      generatedAt: 'desc'
    },
    take: 50
  });

  const recentEvents = securityMetrics.map(metric => 
    metric.reportData as unknown as SecurityMetrics
  );

  // Calculate threat level based on recent events
  const criticalEvents = recentEvents.filter(e => e.severity === 'CRITICAL').length;
  const highEvents = recentEvents.filter(e => e.severity === 'HIGH').length;
  
  let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (criticalEvents > 0) {
    threatLevel = 'CRITICAL';
  } else if (highEvents > 5) {
    threatLevel = 'HIGH';
  } else if (highEvents > 0 || recentEvents.length > 10) {
    threatLevel = 'MEDIUM';
  }

  const blockedIPs = new Set(
    recentEvents
      .filter(e => e.blocked)
      .map(e => e.source.ip)
  ).size;

  const failedLogins = recentEvents.filter(
    e => e.type === 'FAILED_LOGIN'
  ).length;

  return {
    threatLevel,
    recentEvents: recentEvents.slice(0, 10),
    blockedIPs,
    failedLogins
  };
}

// Helper function to get resource usage
async function getResourceUsage(): Promise<DashboardData['resourceUsage']> {
  // In a real implementation, this would get actual resource usage
  // For now, return mock data
  return {
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    network: {
      in: Math.random() * 1000,
      out: Math.random() * 1000
    }
  };
}

// Helper function to get trends
async function getTrends(
  startTime: Date,
  endTime: Date
): Promise<DashboardData['trends']> {
  // Client growth trend
  const clientGrowth: Array<{ date: string; count: number }> = [];
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let time = startTime.getTime(); time <= endTime.getTime(); time += dayMs) {
    const date = new Date(time);
    const count = await prisma.client.count({
      where: {
        createdAt: {
          lte: date
        }
      }
    });
    
    clientGrowth.push({
      date: date.toISOString().split('T')[0],
      count
    });
  }

  // Task completion trend
  const taskCompletion: Array<{ date: string; completed: number; total: number }> = [];
  
  for (let time = startTime.getTime(); time <= endTime.getTime(); time += dayMs) {
    const date = new Date(time);
    const nextDay = new Date(time + dayMs);
    
    const [completed, total] = await Promise.all([
      prisma.task.count({
        where: {
          status: 'COMPLETED',
          updatedAt: {
            gte: date,
            lt: nextDay
          }
        }
      }),
      prisma.task.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDay
          }
        }
      })
    ]);
    
    taskCompletion.push({
      date: date.toISOString().split('T')[0],
      completed,
      total
    });
  }

  // Alert frequency trend
  const alertFrequency: Array<{ date: string; count: number }> = [];
  
  for (let time = startTime.getTime(); time <= endTime.getTime(); time += dayMs) {
    const date = new Date(time);
    const nextDay = new Date(time + dayMs);
    
    const count = await prisma.report.count({
      where: {
        title: { startsWith: 'Monitoring Alert -' },
        generatedAt: {
          gte: date,
          lt: nextDay
        }
      }
    });
    
    alertFrequency.push({
      date: date.toISOString().split('T')[0],
      count
    });
  }

  return {
    clientGrowth,
    taskCompletion,
    alertFrequency
  };
}

// Helper function to get detailed metrics
async function getDetailedMetrics(
  startTime: Date,
  endTime: Date
): Promise<SystemMetrics[]> {
  const metrics = await prisma.report.findMany({
    where: {
      title: { startsWith: 'System Metrics -' },
      generatedAt: {
        gte: startTime,
        lte: endTime
      }
    },
    orderBy: {
      generatedAt: 'asc'
    }
  });

  return metrics.map(metric => metric.reportData as unknown as SystemMetrics);
}

// Helper function to get performance metrics
async function getPerformanceMetrics(
  startTime: Date,
  endTime: Date
): Promise<PerformanceMetrics[]> {
  const metrics = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Performance Metrics -' },
      generatedAt: {
        gte: startTime,
        lte: endTime
      }
    },
    orderBy: {
      generatedAt: 'asc'
    }
  });

  return metrics.map(metric => metric.reportData as unknown as PerformanceMetrics);
}

// Helper function to get security metrics
async function getSecurityMetrics(
  startTime: Date,
  endTime: Date
): Promise<SecurityMetrics[]> {
  const metrics = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Security Event -' },
      generatedAt: {
        gte: startTime,
        lte: endTime
      }
    },
    orderBy: {
      generatedAt: 'asc'
    }
  });

  return metrics.map(metric => metric.reportData as unknown as SecurityMetrics);
}