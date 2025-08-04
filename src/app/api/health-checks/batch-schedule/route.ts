import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Type guard functions
function isScheduledHealthCheckData(obj: unknown): obj is ScheduledHealthCheckData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'userId' in obj &&
    'healthCheckId' in obj &&
    'checkType' in obj &&
    'frequency' in obj &&
    'enabled' in obj &&
    'nextCheck' in obj
  );
}

interface ScheduledHealthCheckData {
  userId: string;
  healthCheckId: string;
  checkType: string;
  frequency: string;
  enabled: boolean;
  nextCheck: string;
  notificationSettings?: Record<string, unknown>;
  customSettings?: Record<string, unknown>;
  status?: string;
  responseTime?: number | null;
  statusCode?: number | null;
  errorMessage?: string | null;
  url?: string;
  method?: string;
  expectedStatus?: number;
  timeout?: number;
  interval?: number;
}

interface UpdateData {
  enabled?: boolean;
  frequency?: string;
  notificationSettings?: Record<string, unknown>;
  customSettings?: Record<string, unknown>;
}

interface BatchScheduleRequest {
  clientIds: string[];
  checkType: 'UPTIME' | 'SSL' | 'PERFORMANCE' | 'SECURITY' | 'ALL';
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  enabled: boolean;
  notificationSettings?: {
    emailOnFailure: boolean;
    emailOnRecovery: boolean;
    webhookUrl?: string;
  };
  customSettings?: {
    timeout: number;
    retryAttempts: number;
    expectedStatusCode?: number;
    checkContent?: string;
  };
}

interface ScheduleResult {
  success: boolean;
  scheduled: number;
  failed: number;
  results: Array<{
    clientId: string;
    clientName: string;
    domainName: string;
    success: boolean;
    error?: string;
    scheduledChecks?: string[];
  }>;
}

// POST /api/health-checks/batch-schedule - Schedule health checks for multiple clients
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      clientIds,
      checkType,
      frequency,
      enabled = true,
      notificationSettings,
      customSettings
    }: BatchScheduleRequest = await request.json();

    // Validate input
    if (!clientIds || clientIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one client ID is required' },
        { status: 400 }
      );
    }

    if (!['UPTIME', 'SSL', 'PERFORMANCE', 'SECURITY', 'ALL'].includes(checkType)) {
      return NextResponse.json(
        { error: 'Invalid check type' },
        { status: 400 }
      );
    }

    if (!['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency' },
        { status: 400 }
      );
    }

    // Get clients to schedule checks for
    const clients = await prisma.client.findMany({
      where: {
        id: {
          in: clientIds
        }
      }
    });

    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'No clients found' },
        { status: 404 }
      );
    }

    const result: ScheduleResult = {
      success: true,
      scheduled: 0,
      failed: 0,
      results: []
    };

    // Define check types to create
    const checkTypes = checkType === 'ALL' 
      ? ['UPTIME', 'SSL', 'PERFORMANCE', 'SECURITY']
      : [checkType];

    // Process each client
    for (const client of clients) {
      try {
        const scheduledChecks: string[] = [];

        // Create health checks for each type
        for (const type of checkTypes) {
          // Create scheduled check record for tracking
          const scheduledCheck = await prisma.report.create({
            data: {
              title: `Scheduled Health Check - ${type} - ${client.domainName}`,
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: calculateNextCheck(frequency).toISOString()
              },
              totalHours: 0,
              totalAmount: 0,
              clientId: client.id,
              generatedAt: new Date(),
              reportData: JSON.parse(JSON.stringify({
                type: 'SCHEDULED_HEALTH_CHECK',
                checkType: type,
                frequency,
                healthCheckId: `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                enabled,
                notificationSettings: notificationSettings || {},
                customSettings: customSettings || {},
                userId: session.user.id,
                nextCheck: calculateNextCheck(frequency).toISOString(),
                url: `https://${client.domainName}`,
                method: 'GET',
                expectedStatus: customSettings?.expectedStatusCode || 200,
                timeout: customSettings?.timeout || 30000,
                interval: getIntervalMinutes(frequency),
                status: 'PENDING',
                responseTime: null,
                statusCode: null,
                errorMessage: null
              }))
            }
          });

          scheduledChecks.push(`${type}: ${scheduledCheck.id}`);
        }

        result.results.push({
          clientId: client.id,
          clientName: client.domainName, // Using domainName as client name
          domainName: client.domainName,
          success: true,
          scheduledChecks
        });
        result.scheduled++;

      } catch (error) {
        result.results.push({
          clientId: client.id,
          clientName: client.domainName, // Using domainName as client name
          domainName: client.domainName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    if (result.failed > 0) {
      result.success = false;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error scheduling batch health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/health-checks/batch-schedule - Get scheduled health checks
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const clientId = searchParams.get('clientId');

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Record<string, unknown> = {
      title: {
        startsWith: 'Scheduled Health Check'
      },
      reportData: {
        path: '$.userId',
        equals: session.user.id
      }
    };

    if (clientId) {
      whereClause.clientId = clientId;
    }

    // Get scheduled health checks
    const scheduledChecks = await prisma.report.findMany({
      where: whereClause,
      orderBy: {
        generatedAt: 'desc'
      },
      skip,
      take: limit
    });

    const totalCount = await prisma.report.count({
      where: whereClause
    });

    const scheduledHealthChecks = scheduledChecks.map(schedule => {
      if (!isScheduledHealthCheckData(schedule.reportData)) {
        return null;
      }
      const data = schedule.reportData;
      
      return {
        id: schedule.id,
        client: {
          id: schedule.clientId,
          name: 'Unknown',
          domainName: 'Unknown'
        },
        checkType: data.checkType,
        frequency: data.frequency,
        enabled: data.enabled,
        nextCheck: new Date(data.nextCheck),
        createdAt: schedule.generatedAt,
        healthCheckStatus: {
          id: data.healthCheckId,
          status: data.status || 'PENDING',
          lastChecked: schedule.generatedAt,
          responseTime: data.responseTime || null,
          statusCode: data.statusCode || null,
          errorMessage: data.errorMessage || null
        },
        notificationSettings: data.notificationSettings,
        customSettings: data.customSettings
      };
    }).filter(Boolean);

    return NextResponse.json({
      scheduledChecks: scheduledHealthChecks,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching scheduled health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/health-checks/batch-schedule - Update scheduled health checks
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      scheduleIds,
      enabled,
      frequency,
      notificationSettings,
      customSettings
    } = await request.json();

    if (!scheduleIds || scheduleIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one schedule ID is required' },
        { status: 400 }
      );
    }

    const updateData: UpdateData = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (frequency) updateData.frequency = frequency;
    if (notificationSettings) updateData.notificationSettings = notificationSettings;
    if (customSettings) updateData.customSettings = customSettings;

    let updatedCount = 0;

    // Update each schedule
    for (const scheduleId of scheduleIds) {
      try {
        const existingSchedule = await prisma.report.findFirst({
          where: {
            id: scheduleId,
            title: {
              startsWith: 'Scheduled Health Check'
            },
            reportData: {
              path: '$.userId',
              equals: session.user.id
            }
          }
        });

        if (existingSchedule) {
          if (!isScheduledHealthCheckData(existingSchedule.reportData)) {
            continue;
          }
          const existingData = existingSchedule.reportData;
          const newFrequency = frequency || existingData.frequency;
          
          await prisma.report.update({
            where: { id: scheduleId },
            data: {
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: calculateNextCheck(newFrequency).toISOString()
              },
              reportData: JSON.parse(JSON.stringify({
                ...(existingData as ScheduledHealthCheckData),
                ...updateData,
                nextCheck: calculateNextCheck(newFrequency).toISOString()
              }))
            }
          });

          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating schedule ${scheduleId}:`, error);
      }
    }

    return NextResponse.json({
      message: `Updated ${updatedCount} scheduled health checks`,
      updatedCount
    });

  } catch (error) {
    console.error('Error updating scheduled health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/health-checks/batch-schedule - Delete scheduled health checks
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scheduleIds } = await request.json();

    if (!scheduleIds || scheduleIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one schedule ID is required' },
        { status: 400 }
      );
    }

    let deletedCount = 0;
    const healthCheckIdsToDelete: string[] = [];

    // Get health check IDs before deleting schedules
    for (const scheduleId of scheduleIds) {
      try {
        const schedule = await prisma.report.findFirst({
          where: {
            id: scheduleId,
            title: {
              startsWith: 'Scheduled Health Check'
            },
            reportData: {
              path: '$.userId',
              equals: session.user.id
            }
          }
        });

        if (schedule && isScheduledHealthCheckData(schedule.reportData)) {
          const data = schedule.reportData;
          if (data.healthCheckId) {
            healthCheckIdsToDelete.push(data.healthCheckId);
          }
        }
      } catch (error) {
        console.error(`Error getting schedule ${scheduleId}:`, error);
      }
    }

    // Delete the schedules
    const deletedSchedules = await prisma.report.deleteMany({
      where: {
        id: {
          in: scheduleIds
        },
        title: {
          startsWith: 'Scheduled Health Check'
        },
        reportData: {
          path: '$.userId',
          equals: session.user.id
        }
      }
    });

    deletedCount = deletedSchedules.count;

    // Note: Health checks are stored in the Report model, so they're deleted with the schedules

    return NextResponse.json({
      message: `Deleted ${deletedCount} scheduled health checks`,
      deletedCount
    });

  } catch (error) {
    console.error('Error deleting scheduled health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getIntervalMinutes(frequency: string): number {
  switch (frequency) {
    case 'HOURLY': return 60;
    case 'DAILY': return 1440;
    case 'WEEKLY': return 10080;
    case 'MONTHLY': return 43200;
    default: return 1440;
  }
}

function calculateNextCheck(frequency: string): Date {
  const now = new Date();
  const nextCheck = new Date(now);
  
  switch (frequency) {
    case 'HOURLY':
      nextCheck.setHours(nextCheck.getHours() + 1);
      break;
    case 'DAILY':
      nextCheck.setDate(nextCheck.getDate() + 1);
      break;
    case 'WEEKLY':
      nextCheck.setDate(nextCheck.getDate() + 7);
      break;
    case 'MONTHLY':
      nextCheck.setMonth(nextCheck.getMonth() + 1);
      break;
  }
  
  return nextCheck;
}