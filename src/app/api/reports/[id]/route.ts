import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/reports/[id] - Get a specific report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Generate report data based on the report type
    const report = await generateReportData(id);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate report data based on report ID/type
async function generateReportData(id: string) {
  const baseReport = {
    id,
    generatedAt: new Date().toISOString(),
    status: 'Generated',
  };

  switch (id) {
    case '1': // Client Activity Summary
      const clients = await prisma.client.findMany({
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
            },
          },
          credentials: {
            select: {
              id: true,
              service: true,
              createdAt: true,
            },
          },
          healthChecks: {
            select: {
              id: true,
              status: true,
              checkedAt: true,
            },
          },
        },
      });
      return {
        ...baseReport,
        name: 'Client Activity Summary',
        type: 'Client Activity',
        description: 'Overview of all client activities and interactions',
        data: {
          totalClients: clients.length,
          clients: clients.map(client => ({
            id: client.id,
            domainName: client.domainName,
            totalTasks: client.tasks.length,
            totalCredentials: client.credentials.length,
            totalHealthChecks: client.healthChecks.length,
            lastActivity: client.tasks.length > 0 
              ? Math.max(...client.tasks.map(t => new Date(t.createdAt).getTime()))
              : new Date(client.createdAt).getTime(),
          })),
        },
      };

    case '2': // Website Health Status
      const healthChecks = await prisma.healthCheck.findMany({
        include: {
          client: {
            select: {
              id: true,
              domainName: true,
            },
          },
        },
      });
      return {
        ...baseReport,
        name: 'Website Health Status',
        type: 'Health Check',
        description: 'Current health status of all monitored websites',
        data: {
          totalChecks: healthChecks.length,
          healthyCount: healthChecks.filter(h => (h.status as string) === 'HEALTHY').length,
          warningCount: healthChecks.filter(h => (h.status as string) === 'WARNING').length,
          criticalCount: healthChecks.filter(h => (h.status as string) === 'CRITICAL').length,
          checks: healthChecks,
        },
      };

    case '3': // Time Tracking Summary
      const timeEntries = await prisma.timeEntry.findMany({
        include: {
          task: {
            include: {
              client: {
                select: {
                  id: true,
                  domainName: true,
                },
              },
            },
          },
        },
      });
      const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0) / 60, 0);
      return {
        ...baseReport,
        name: 'Time Tracking Summary',
        type: 'Time Tracking',
        description: 'Summary of time spent on tasks and projects',
        data: {
          totalEntries: timeEntries.length,
          totalHours,
          averageHoursPerEntry: timeEntries.length > 0 ? totalHours / timeEntries.length : 0,
          entriesByClient: timeEntries.reduce((acc, entry) => {
            if (entry.task.client) {
              const clientName = entry.task.client.domainName;
              if (!acc[clientName]) {
                acc[clientName] = { hours: 0, entries: 0 };
              }
              acc[clientName].hours += (entry.duration || 0) / 60;
              acc[clientName].entries += 1;
            }
            return acc;
          }, {} as Record<string, { hours: number; entries: number }>),
        },
      };

    case '4': // SSL Certificate Expiry
      const sslHealthChecks = await prisma.healthCheck.findMany({
        where: {
          checkType: 'SSL_CERTIFICATE',
        },
        include: {
          client: {
            select: {
              id: true,
              domainName: true,
            },
          },
        },
      });
      return {
        ...baseReport,
        name: 'SSL Certificate Expiry',
        type: 'Security',
        description: 'SSL certificate expiration dates and status',
        data: {
          totalSSLChecks: sslHealthChecks.length,
          validCertificates: sslHealthChecks.filter(h => (h.status as string) === 'HEALTHY').length,
          expiringSoon: sslHealthChecks.filter(h => (h.status as string) === 'WARNING').length,
          expired: sslHealthChecks.filter(h => (h.status as string) === 'CRITICAL').length,
          checks: sslHealthChecks,
        },
      };

    case '5': // Task Completion Summary
      const tasks = await prisma.task.findMany({
        include: {
          client: {
            select: {
              id: true,
              domainName: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return {
        ...baseReport,
        name: 'Task Completion Summary',
        type: 'Task Management',
        description: 'Overview of completed and pending tasks',
        data: {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
          inProgressTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
          pendingTasks: tasks.filter(t => t.status === 'OPEN').length,
          tasksByPriority: {
            high: tasks.filter(t => t.priority === 'HIGH').length,
            medium: tasks.filter(t => t.priority === 'MEDIUM').length,
            low: tasks.filter(t => t.priority === 'LOW').length,
          },
          tasks,
        },
      };

    case '6': // Client Billing Summary
      const clientsWithTasks = await prisma.client.findMany({
        include: {
          tasks: {
            include: {
              timeEntries: true,
            },
          },
        },
      });
      return {
        ...baseReport,
        name: 'Client Billing Summary',
        type: 'Billing',
        description: 'Billing information and payment status',
        data: {
          totalClients: clientsWithTasks.length,
          clientBilling: clientsWithTasks.map(client => {
            const totalHours = client.tasks.reduce(
              (sum, task) => sum + task.timeEntries.reduce((taskSum, entry) => taskSum + (entry.duration || 0) / 60, 0),
              0
            );
            return {
              id: client.id,
              domainName: client.domainName,
              totalHours,
              totalTasks: client.tasks.length,
              estimatedBilling: totalHours * 75, // Assuming $75/hour rate
            };
          }),
        },
      };

    case '7': // Website Performance Metrics
              const performanceChecks = await prisma.healthCheck.findMany({
          where: {
            checkType: 'UPTIME',
          },
        include: {
          client: {
            select: {
              id: true,
              domainName: true,
            },
          },
        },
      });
      return {
        ...baseReport,
        name: 'Website Performance Metrics',
        type: 'Performance',
        description: 'Performance metrics for all monitored websites',
        data: {
          totalPerformanceChecks: performanceChecks.length,
          goodPerformance: performanceChecks.filter(h => (h.status as string) === 'HEALTHY').length,
          needsImprovement: performanceChecks.filter(h => (h.status as string) === 'WARNING').length,
          poorPerformance: performanceChecks.filter(h => (h.status as string) === 'CRITICAL').length,
          checks: performanceChecks,
        },
      };

    default:
      return null;
  }
}

// PUT /api/reports/[id] - Update a specific report
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // For now, just return the updated report data
    // In a real application, you would update the report in the database
    const updatedReport = {
      id,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/[id] - Delete a specific report
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // For now, just return success
    // In a real application, you would delete the report from the database
    return NextResponse.json({ message: `Report ${id} deleted successfully` });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}