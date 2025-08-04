import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import os from 'os';
import { performance } from 'perf_hooks';

interface MetricsData {
  type: string;
  metrics: SystemMetrics;
  recordedBy: string;
}

interface AlertData {
  type: string;
  severity: string;
  message: string;
  threshold: number;
  currentValue: number;
  resolved?: boolean;
  resolvedAt?: string;
  triggeredBy?: string;
}

interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
  database: {
    connections: number;
    queryTime: number;
    slowQueries: number;
  };
  application: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    activeUsers: number;
  };
}

interface PerformanceAlert {
  id: string;
  type: string;// 'CPU_HIGH' | 'MEMORY_HIGH' | 'DISK_FULL' | 'DB_SLOW' | 'ERROR_RATE_HIGH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

interface SystemHealth {
  overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  score: number; // 0-100
  components: {
    database: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    storage: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    memory: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    cpu: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    network: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  };
  lastChecked: Date;
}

// GET /api/system/monitoring - Get system monitoring data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin privileges (you may need to adjust this based on your user model)
    // For now, we'll allow all authenticated users

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'current'; // 'current', 'history', 'alerts', 'health'
    const timeRange = searchParams.get('timeRange') || '1h'; // 1h, 6h, 24h, 7d, 30d
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (type === 'current') {
      // Get current system metrics
      const metrics = await getCurrentSystemMetrics();
      return NextResponse.json({ metrics });
    }

    if (type === 'history') {
      // Get historical metrics
      const timeRangeStart = getTimeRangeStart(timeRange);
      const skip = (page - 1) * limit;

      const historicalMetrics = await prisma.report.findMany({
        where: {
          title: { startsWith: 'System Metrics' },
          generatedAt: { gte: timeRangeStart }
        },
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: {
          title: { startsWith: 'System Metrics' },
          generatedAt: { gte: timeRangeStart }
        }
      });

      const metricsData = historicalMetrics.map(record => {
        const data = record.reportData as unknown as MetricsData;
        return {
          recordTimestamp: record.generatedAt,
          ...data.metrics
        };
      });

      return NextResponse.json({
        metrics: metricsData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'alerts') {
      // Get performance alerts
      const timeRangeStart = getTimeRangeStart(timeRange);
      const skip = (page - 1) * limit;

      const alerts = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Performance Alert' },
          generatedAt: { gte: timeRangeStart }
        },
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: {
          title: { startsWith: 'Performance Alert' },
          generatedAt: { gte: timeRangeStart }
        }
      });

      const alertData = alerts.map(alert => {
        const data = alert.reportData as unknown as AlertData;
        return {
          id: alert.id,
          type: data.type,
          severity: data.severity,
          message: data.message,
          threshold: data.threshold,
          currentValue: data.currentValue,
          triggeredAt: alert.generatedAt,
          resolved: data.resolved || false,
          resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null
        };
      });

      return NextResponse.json({
        alerts: alertData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'health') {
      // Get system health status
      const health = await getSystemHealth();
      return NextResponse.json({ health });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching system monitoring data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/system/monitoring - Record system metrics or create alerts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'record_metrics') {
      // Record current system metrics
      const metrics = await getCurrentSystemMetrics();
      
      const metricsRecord = await prisma.report.create({
        data: {
          title: `System Metrics - ${new Date().toISOString()}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: 'system',
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify({
            type: 'SYSTEM_METRICS',
            metrics,
            recordedBy: session.user.id
          }))
        }
      });

      // Check for performance issues and create alerts
      const alerts = await checkPerformanceThresholds(metrics);
      
      for (const alert of alerts) {
        await prisma.report.create({
          data: {
            title: `Performance Alert - ${alert.type}`,
            dateRange: {
              startDate: new Date().toISOString(),
              endDate: new Date().toISOString()
            },
            totalHours: 0,
            totalAmount: 0,
            clientId: 'system',
            generatedAt: new Date(),
            reportData: JSON.parse(JSON.stringify({
              type: 'PERFORMANCE_ALERT',
              ...alert,
              triggeredBy: 'SYSTEM'
            }))
          }
        });
      }

      return NextResponse.json({
        message: 'System metrics recorded successfully',
        metricsId: metricsRecord.id,
        alertsCreated: alerts.length,
        alerts
      });
    }

    if (action === 'resolve_alert') {
      // Resolve performance alert
      const { alertId } = data;

      if (!alertId) {
        return NextResponse.json(
          { error: 'Alert ID is required' },
          { status: 400 }
        );
      }

      const alert = await prisma.report.findFirst({
        where: {
          id: alertId,
          title: { startsWith: 'Performance Alert' }
        }
      });

      if (!alert) {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }

      const alertData = alert.reportData as unknown as AlertData;
      await prisma.report.update({
        where: { id: alertId },
        data: {
          reportData: {
            ...alertData,
            resolved: true,
            resolvedAt: new Date().toISOString(),
            resolvedBy: session.user.id
          }
        }
      });

      return NextResponse.json({
        message: 'Alert resolved successfully'
      });
    }

    if (action === 'generate_report') {
      // Generate system health report
      const { timeRange = '24h', includeMetrics = true, includeAlerts = true } = data;
      
      const timeRangeStart = getTimeRangeStart(timeRange);
      const reportData: Record<string, unknown> = {
        type: 'SYSTEM_HEALTH_REPORT',
        timeRange,
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.id
      };

      if (includeMetrics) {
        const metrics = await prisma.report.findMany({
          where: {
            title: { startsWith: 'System Metrics' },
            generatedAt: { gte: timeRangeStart }
          },
          orderBy: {
            generatedAt: 'desc'
          }
        });

        reportData.metricsCount = metrics.length;
        reportData.metricsData = metrics.map(m => (m.reportData as unknown as MetricsData).metrics);
      }

      if (includeAlerts) {
        const alerts = await prisma.report.findMany({
          where: {
            title: { startsWith: 'Performance Alert' },
            generatedAt: { gte: timeRangeStart }
          },
          orderBy: {
            generatedAt: 'desc'
          }
        });

        reportData.alertsCount = alerts.length;
        reportData.alertsData = alerts.map(a => a.reportData);
      }

      // Calculate summary statistics
      const health = await getSystemHealth();
      reportData.healthSummary = health;

      const report = await prisma.report.create({
        data: {
          title: `System Health Report - ${timeRange}`,
          dateRange: {
            startDate: timeRangeStart.toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: 'system',
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(reportData))
        }
      });

      return NextResponse.json({
        message: 'System health report generated successfully',
        reportId: report.id,
        summary: {
          timeRange,
          metricsCount: reportData.metricsCount || 0,
          alertsCount: reportData.alertsCount || 0,
          healthScore: health.score
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing system monitoring request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
async function getCurrentSystemMetrics(): Promise<SystemMetrics> {
  const startTime = performance.now();
  
  // Get CPU info
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  
  // Get memory info
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  // Simulate disk usage (in a real implementation, you'd use a library like 'node-disk-info')
  const diskTotal = 1000000000000; // 1TB simulation
  const diskUsed = diskTotal * 0.6; // 60% used simulation
  const diskFree = diskTotal - diskUsed;
  
  // Test database performance
  const dbStartTime = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Database health check failed:', error);
  }
  const dbQueryTime = performance.now() - dbStartTime;
  
  // Get database connection info (simplified)
  const dbConnections = 10; // Simulated
  
  // Calculate application metrics
  const appUptime = process.uptime();
  const appResponseTime = performance.now() - startTime;
  
  // Get active users (from recent sessions or activity)
  const activeUsers = await prisma.user.count({
    where: {
      // Add your logic for active users, e.g., last activity within 15 minutes
      // lastActivity: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  });
  
  // Calculate error rate (from recent logs or reports)
  const recentErrors = await prisma.report.count({
    where: {
      title: { contains: 'Error' },
      generatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }
  });
  
  const totalRequests = 1000; // Simulated
  const errorRate = totalRequests > 0 ? (recentErrors / totalRequests) * 100 : 0;
  
  return {
    timestamp: new Date(),
    cpu: {
      usage: Math.random() * 100, // Simulated CPU usage
      loadAverage: loadAvg,
      cores: cpus.length
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usage: (usedMem / totalMem) * 100
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      free: diskFree,
      usage: (diskUsed / diskTotal) * 100
    },
    network: {
      connections: Math.floor(Math.random() * 100), // Simulated
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 1000000)
    },
    database: {
      connections: dbConnections,
      queryTime: dbQueryTime,
      slowQueries: Math.floor(Math.random() * 5) // Simulated
    },
    application: {
      uptime: appUptime,
      responseTime: appResponseTime,
      errorRate,
      activeUsers
    }
  };
}

async function checkPerformanceThresholds(metrics: SystemMetrics): Promise<Partial<PerformanceAlert>[]> {
  const alerts: Partial<PerformanceAlert>[] = [];
  
  // CPU threshold
  if (metrics.cpu.usage > 90) {
    alerts.push({
      type: 'CPU_HIGH',
      severity: metrics.cpu.usage > 95 ? 'CRITICAL' : 'HIGH',
      message: `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`,
      threshold: 90,
      currentValue: metrics.cpu.usage,
      triggeredAt: new Date(),
      resolved: false
    });
  }
  
  // Memory threshold
  if (metrics.memory.usage > 85) {
    alerts.push({
      type: 'MEMORY_HIGH',
      severity: metrics.memory.usage > 95 ? 'CRITICAL' : 'HIGH',
      message: `Memory usage is ${metrics.memory.usage.toFixed(1)}%`,
      threshold: 85,
      currentValue: metrics.memory.usage,
      triggeredAt: new Date(),
      resolved: false
    });
  }
  
  // Disk threshold
  if (metrics.disk.usage > 90) {
    alerts.push({
      type: 'DISK_FULL',
      severity: metrics.disk.usage > 95 ? 'CRITICAL' : 'HIGH',
      message: `Disk usage is ${metrics.disk.usage.toFixed(1)}%`,
      threshold: 90,
      currentValue: metrics.disk.usage,
      triggeredAt: new Date(),
      resolved: false
    });
  }
  
  // Database performance threshold
  if (metrics.database.queryTime > 1000) { // 1 second
    alerts.push({
      type: 'DB_SLOW',
      severity: metrics.database.queryTime > 5000 ? 'CRITICAL' : 'HIGH',
      message: `Database query time is ${metrics.database.queryTime.toFixed(1)}ms`,
      threshold: 1000,
      currentValue: metrics.database.queryTime,
      triggeredAt: new Date(),
      resolved: false
    });
  }
  
  // Error rate threshold
  if (metrics.application.errorRate > 5) { // 5%
    alerts.push({
      type: 'ERROR_RATE_HIGH',
      severity: metrics.application.errorRate > 10 ? 'CRITICAL' : 'HIGH',
      message: `Application error rate is ${metrics.application.errorRate.toFixed(1)}%`,
      threshold: 5,
      currentValue: metrics.application.errorRate,
      triggeredAt: new Date(),
      resolved: false
    });
  }
  
  return alerts;
}

async function getSystemHealth(): Promise<SystemHealth> {
  const metrics = await getCurrentSystemMetrics();
  
  // Calculate component health
  const components = {
    database: metrics.database.queryTime < 1000 ? 'HEALTHY' : metrics.database.queryTime < 5000 ? 'WARNING' : 'CRITICAL',
    storage: metrics.disk.usage < 80 ? 'HEALTHY' : metrics.disk.usage < 90 ? 'WARNING' : 'CRITICAL',
    memory: metrics.memory.usage < 80 ? 'HEALTHY' : metrics.memory.usage < 90 ? 'WARNING' : 'CRITICAL',
    cpu: metrics.cpu.usage < 80 ? 'HEALTHY' : metrics.cpu.usage < 90 ? 'WARNING' : 'CRITICAL',
    network: 'HEALTHY' // Simplified
  } as const;
  
  // Calculate overall health score
  const componentScores = {
    HEALTHY: 100,
    WARNING: 60,
    CRITICAL: 20
  };
  
  const totalScore = Object.values(components).reduce((sum, status) => sum + componentScores[status], 0);
  const score = totalScore / Object.keys(components).length;
  
  // Determine overall status
  const criticalComponents = Object.values(components).filter(status => status === 'CRITICAL').length;
  const warningComponents = Object.values(components).filter(status => status === 'WARNING').length;
  
  let overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  if (criticalComponents > 0) {
    overall = 'CRITICAL';
  } else if (warningComponents > 0) {
    overall = 'WARNING';
  } else {
    overall = 'HEALTHY';
  }
  
  return {
    overall,
    score: Math.round(score),
    components,
    lastChecked: new Date()
  };
}

function getTimeRangeStart(timeRange: string): Date {
  const now = new Date();
  const start = new Date(now);
  
  switch (timeRange) {
    case '1h':
      start.setHours(start.getHours() - 1);
      break;
    case '6h':
      start.setHours(start.getHours() - 6);
      break;
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    default:
      start.setHours(start.getHours() - 1);
  }
  
  return start;
}