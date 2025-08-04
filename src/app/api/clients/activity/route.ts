import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ClientActivity {
  clientId: string;
  activityType: 'TASK_CREATED' | 'TASK_COMPLETED' | 'TIME_LOGGED' | 'HEALTH_CHECK' | 'CREDENTIAL_ACCESSED' | 'REPORT_GENERATED' | 'DOMAIN_VERIFIED' | 'BACKUP_CREATED';
  description: string;
  metadata?: Record<string, unknown>;
  performedBy: string;
  performedAt: Date;
}

interface ActivitySummary {
  clientId: string;
  clientName: string;
  totalActivities: number;
  lastActivity: Date;
  activityBreakdown: Record<string, number>;
  recentActivities: ClientActivity[];
  engagementScore: number; // 0-100 based on activity frequency and recency
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; // Based on inactivity
}

interface ActivityMetrics {
  totalClients: number;
  activeClients: number; // Activity in last 30 days
  inactiveClients: number; // No activity in last 90 days
  atRiskClients: number; // No activity in last 60 days
  averageEngagementScore: number;
  topActiveClients: Array<{ clientId: string; clientName: string; score: number }>;
  activityTrends: Array<{ date: string; count: number }>;
}

// GET /api/clients/activity - Get client activity data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary'; // 'summary', 'detailed', 'metrics', 'timeline'
    const clientId = searchParams.get('clientId');
    const timeRange = searchParams.get('timeRange') || '30d'; // 7d, 30d, 90d, 1y
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const timeRangeStart = getTimeRangeStart(timeRange);

    if (type === 'summary') {
      // Get activity summary for all clients or specific client
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Client Activity' },
        generatedAt: { gte: timeRangeStart }
      };

      if (clientId) {
        whereClause.clientId = clientId;
      }

      const activities = await prisma.report.findMany({
        where: whereClause,
        orderBy: {
          generatedAt: 'desc'
        }
      });

      // Group activities by client
      const clientActivities = new Map<string, ClientActivity[]>();
      
      for (const activity of activities) {
        const reportData = activity.reportData as Record<string, unknown>;
        const activityData: ClientActivity = {
          clientId: activity.clientId || (reportData.clientId as string),
          activityType: reportData.activityType as ClientActivity['activityType'],
          description: reportData.description as string,
          metadata: reportData.metadata as Record<string, unknown> || {},
          performedBy: reportData.performedBy as string,
          performedAt: new Date(reportData.performedAt as string)
        };
        const clientId = activityData.clientId;
        
        if (!clientActivities.has(clientId)) {
          clientActivities.set(clientId, []);
        }
        clientActivities.get(clientId)!.push({
          ...activityData,
          performedAt: activity.generatedAt
        });
      }

      // Get client information
      const clientIds = Array.from(clientActivities.keys()).filter(id => id);
      const clients = await prisma.client.findMany({
        where: {
          id: { in: clientIds }
        },
        select: {
          id: true,
          domainName: true
        }
      });

      // Generate activity summaries
      const summaries: ActivitySummary[] = [];
      
      for (const client of clients) {
        const activities = clientActivities.get(client.id) || [];
        const summary = generateActivitySummary(client.id, client.domainName, activities);
        summaries.push(summary);
      }

      // Sort by engagement score
      summaries.sort((a, b) => b.engagementScore - a.engagementScore);

      return NextResponse.json({
        summaries: summaries.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total: summaries.length,
          pages: Math.ceil(summaries.length / limit)
        }
      });
    }

    if (type === 'detailed' && clientId) {
      // Get detailed activity for specific client
      const skip = (page - 1) * limit;
      
      const activities = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Client Activity' },
          clientId,
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
          title: { startsWith: 'Client Activity' },
          clientId,
          generatedAt: { gte: timeRangeStart }
        }
      });

      const activityData = activities.map(a => {
        const reportData = a.reportData as Record<string, unknown>;
        return {
          id: a.id,
          clientId: a.clientId || (reportData.clientId as string),
          activityType: reportData.activityType as ClientActivity['activityType'],
          description: reportData.description as string,
          metadata: reportData.metadata as Record<string, unknown> || {},
          performedBy: reportData.performedBy as string,
          performedAt: a.generatedAt
        };
      });

      return NextResponse.json({
        activities: activityData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'metrics') {
      // Get overall activity metrics
      const metrics = await generateActivityMetrics(timeRangeStart);
      return NextResponse.json({ metrics });
    }

    if (type === 'timeline') {
      // Get activity timeline data
      const activities = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Client Activity' },
          generatedAt: { gte: timeRangeStart },
          ...(clientId && { clientId })
        },
        orderBy: {
          generatedAt: 'asc'
        }
      });

      // Group by date
      const timeline = new Map<string, number>();
      
      for (const activity of activities) {
        const date = activity.generatedAt.toISOString().split('T')[0];
        timeline.set(date, (timeline.get(date) || 0) + 1);
      }

      const timelineData = Array.from(timeline.entries()).map(([date, count]) => ({
        date,
        count
      }));

      return NextResponse.json({ timeline: timelineData });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching client activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/clients/activity - Log client activity
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'log_activity') {
      const {
        clientId,
        activityType,
        description,
        metadata = {}
      }: Partial<ClientActivity> = data;

      if (!clientId || !activityType || !description) {
        return NextResponse.json(
          { error: 'clientId, activityType, and description are required' },
          { status: 400 }
        );
      }

      // Verify client exists
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, domainName: true }
      });

      if (!client) {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        );
      }

      // Log the activity
      const activityRecord = await prisma.report.create({
        data: {
          title: `Client Activity - ${client.domainName}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId,
          generatedAt: new Date(),
          reportData: {
            type: 'CLIENT_ACTIVITY',
            clientId,
            activityType,
            description,
            metadata: (metadata as Record<string, string | number | boolean>) || {},
            performedBy: session.user.id,
            performedAt: new Date().toISOString()
          }
        }
      });

      return NextResponse.json({
        message: 'Activity logged successfully',
        activityId: activityRecord.id
      });
    }

    if (action === 'bulk_log') {
      const { activities }: { activities: Partial<ClientActivity>[] } = data;

      if (!activities || activities.length === 0) {
        return NextResponse.json(
          { error: 'Activities array is required' },
          { status: 400 }
        );
      }

      const results = [];
      const errors = [];

      for (const activity of activities) {
        try {
          const { clientId, activityType, description, metadata = {} } = activity;

          if (!clientId || !activityType || !description) {
            errors.push({
              activity,
              error: 'Missing required fields'
            });
            continue;
          }

          // Verify client exists
          const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { id: true, domainName: true }
          });

          if (!client) {
            errors.push({
              activity,
              error: 'Client not found'
            });
            continue;
          }

          // Log the activity
          const activityRecord = await prisma.report.create({
            data: {
              title: `Client Activity - ${client.domainName}`,
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString()
              },
              totalHours: 0,
              totalAmount: 0,
              clientId,
              generatedAt: new Date(),
              reportData: {
                type: 'CLIENT_ACTIVITY',
                clientId,
                activityType,
                description,
                metadata: (metadata as Record<string, string | number | boolean>) || {},
                performedBy: session.user.id,
                performedAt: new Date().toISOString()
              }
            }
          });

          results.push({
            activityId: activityRecord.id,
            clientId,
            activityType
          });

        } catch (error) {
          errors.push({
            activity,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        message: 'Bulk activity logging completed',
        summary: {
          total: activities.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors
      });
    }

    if (action === 'auto_detect') {
      // Auto-detect and log activities from recent system events
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const activities = [];

      // Detect task activities
      const recentTasks = await prisma.task.findMany({
        where: {
          OR: [
            { createdAt: { gte: since } },
            { updatedAt: { gte: since } },
            { completedAt: { gte: since } }
          ]
        },
        include: {
          client: { select: { id: true, domainName: true } },
          createdBy: { select: { id: true, name: true } }
        }
      });

      for (const task of recentTasks) {
        if (task.client) {
          if (task.createdAt >= since) {
            activities.push({
              clientId: task.client.id,
              activityType: 'TASK_CREATED',
              description: `Task created: ${task.title}`,
              metadata: { taskId: task.id, taskTitle: task.title },
              performedBy: task.createdBy.id,
              performedAt: task.createdAt
            });
          }

          if (task.completedAt && task.completedAt >= since) {
            activities.push({
              clientId: task.client.id,
              activityType: 'TASK_COMPLETED',
              description: `Task completed: ${task.title}`,
              metadata: { taskId: task.id, taskTitle: task.title },
              performedBy: task.createdBy.id,
              performedAt: task.completedAt
            });
          }
        }
      }

      // Detect time logging activities
      const recentTimeEntries = await prisma.timeEntry.findMany({
        where: {
          createdAt: { gte: since }
        },
        include: {
          task: {
            include: {
              client: { select: { id: true, domainName: true } }
            }
          }
        }
      });

      for (const timeEntry of recentTimeEntries) {
        if (timeEntry.task.client) {
          activities.push({
            clientId: timeEntry.task.client.id,
            activityType: 'TIME_LOGGED',
            description: `Time logged: ${timeEntry.duration} minutes for ${timeEntry.task.title}`,
            metadata: {
              timeEntryId: timeEntry.id,
              taskId: timeEntry.task.id,
              duration: timeEntry.duration
            },
            performedBy: session.user.id, // Assuming current user logged the time
            performedAt: timeEntry.createdAt
          });
        }
      }

      // Detect health check activities
      const recentHealthChecks = await prisma.healthCheck.findMany({
        where: {
          checkedAt: { gte: since }
        },
        include: {
          client: { select: { id: true, domainName: true } }
        }
      });

      for (const healthCheck of recentHealthChecks) {
        activities.push({
          clientId: healthCheck.client.id,
          activityType: 'HEALTH_CHECK',
          description: `Health check performed: ${healthCheck.checkType} - ${healthCheck.status}`,
          metadata: {
            healthCheckId: healthCheck.id,
            checkType: healthCheck.checkType,
            status: healthCheck.status
          },
          performedBy: session.user.id,
          performedAt: healthCheck.checkedAt
        });
      }

      // Log detected activities
      const loggedActivities = [];
      for (const activity of activities) {
        try {
          const client = await prisma.client.findUnique({
            where: { id: activity.clientId },
            select: { domainName: true }
          });

          if (client) {
            const activityRecord = await prisma.report.create({
              data: {
                title: `Client Activity - ${client.domainName}`,
                dateRange: {
                  startDate: activity.performedAt.toISOString(),
                  endDate: activity.performedAt.toISOString()
                },
                totalHours: 0,
                totalAmount: 0,
                clientId: activity.clientId,
                generatedAt: activity.performedAt,
                reportData: {
                  type: 'CLIENT_ACTIVITY',
                  ...activity,
                  performedAt: activity.performedAt.toISOString(),
                  autoDetected: true
                }
              }
            });

            loggedActivities.push(activityRecord.id);
          }
        } catch (error) {
          console.error('Error logging auto-detected activity:', error);
        }
      }

      return NextResponse.json({
        message: 'Auto-detection completed',
        summary: {
          detected: activities.length,
          logged: loggedActivities.length
        },
        activities: loggedActivities
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing client activity request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getTimeRangeStart(timeRange: string): Date {
  const now = new Date();
  const start = new Date(now);
  
  switch (timeRange) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }
  
  return start;
}

function generateActivitySummary(clientId: string, clientName: string, activities: ClientActivity[]): ActivitySummary {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  // Activity breakdown
  const activityBreakdown: Record<string, number> = {};
  for (const activity of activities) {
    activityBreakdown[activity.activityType] = (activityBreakdown[activity.activityType] || 0) + 1;
  }
  
  // Recent activities (last 10)
  const recentActivities = activities.slice(0, 10);
  
  // Last activity date
  const lastActivity = activities.length > 0 ? activities[0].performedAt : new Date(0);
  
  // Calculate engagement score (0-100)
  let engagementScore = 0;
  
  // Base score from total activities (max 30 points)
  engagementScore += Math.min(activities.length * 2, 30);
  
  // Recency bonus (max 40 points)
  const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceLastActivity <= 7) {
    engagementScore += 40;
  } else if (daysSinceLastActivity <= 30) {
    engagementScore += 30;
  } else if (daysSinceLastActivity <= 60) {
    engagementScore += 15;
  }
  
  // Activity diversity bonus (max 20 points)
  const uniqueActivityTypes = Object.keys(activityBreakdown).length;
  engagementScore += Math.min(uniqueActivityTypes * 4, 20);
  
  // Recent activity frequency bonus (max 10 points)
  const recentActivitiesCount = activities.filter(a => a.performedAt >= thirtyDaysAgo).length;
  engagementScore += Math.min(recentActivitiesCount, 10);
  
  engagementScore = Math.min(engagementScore, 100);
  
  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (lastActivity < sixtyDaysAgo) {
    riskLevel = 'HIGH';
  } else if (lastActivity < thirtyDaysAgo) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }
  
  return {
    clientId,
    clientName,
    totalActivities: activities.length,
    lastActivity,
    activityBreakdown,
    recentActivities,
    engagementScore,
    riskLevel
  };
}

async function generateActivityMetrics(since: Date): Promise<ActivityMetrics> {
  // Get all clients
  const totalClients = await prisma.client.count();
  
  // Get activity data
  const activities = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Client Activity' },
      generatedAt: { gte: since }
    }
  });
  
  // Group by client
  const clientActivities = new Map<string, ClientActivity[]>();
  for (const activity of activities) {
    const clientId = activity.clientId;
    if (clientId) {
      if (!clientActivities.has(clientId)) {
        clientActivities.set(clientId, []);
      }
      const reportData = activity.reportData as Record<string, unknown>;
      clientActivities.get(clientId)!.push({
        clientId: activity.clientId || (reportData.clientId as string),
        activityType: reportData.activityType as ClientActivity['activityType'],
        description: reportData.description as string,
        metadata: reportData.metadata as Record<string, string | number | boolean> || {},
        performedBy: reportData.performedBy as string,
        performedAt: activity.generatedAt
      });
    }
  }
  
  // Calculate metrics
  const activeClients = clientActivities.size;
  const inactiveClients = totalClients - activeClients;
  
  // Calculate at-risk clients (no activity in 60 days)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const atRiskActivities = await prisma.report.count({
    where: {
      title: { startsWith: 'Client Activity' },
      generatedAt: { gte: sixtyDaysAgo, lt: since }
    }
  });
  const atRiskClients = Math.max(0, totalClients - activeClients - atRiskActivities);
  
  // Calculate average engagement score
  const allClients = await prisma.client.findMany({
    select: { id: true, domainName: true }
  });
  
  let totalEngagementScore = 0;
  const topActiveClients = [];
  
  for (const client of allClients) {
    const clientActivityList = clientActivities.get(client.id) || [];
    const summary = generateActivitySummary(client.id, client.domainName, clientActivityList);
    totalEngagementScore += summary.engagementScore;
    
    if (summary.engagementScore > 0) {
      topActiveClients.push({
        clientId: client.id,
        clientName: client.domainName,
        score: summary.engagementScore
      });
    }
  }
  
  const averageEngagementScore = totalClients > 0 ? totalEngagementScore / totalClients : 0;
  
  // Sort and limit top active clients
  topActiveClients.sort((a, b) => b.score - a.score);
  const topActiveClientsLimited = topActiveClients.slice(0, 10);
  
  // Generate activity trends (daily counts for the time range)
  const activityTrends = [];
  const trendMap = new Map<string, number>();
  
  for (const activity of activities) {
    const date = activity.generatedAt.toISOString().split('T')[0];
    trendMap.set(date, (trendMap.get(date) || 0) + 1);
  }
  
  for (const [date, count] of trendMap.entries()) {
    activityTrends.push({ date, count });
  }
  
  activityTrends.sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    totalClients,
    activeClients,
    inactiveClients,
    atRiskClients,
    averageEngagementScore: Math.round(averageEngagementScore),
    topActiveClients: topActiveClientsLimited,
    activityTrends
  };
}