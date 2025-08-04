import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';



interface AlertRule {
  id?: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: {
    responseTime?: {
      threshold: number;
      operator: 'gt' | 'gte' | 'lt' | 'lte';
    };
    statusCode?: {
      expected: number[];
      operator: 'in' | 'not_in';
    };
    uptime?: {
      threshold: number;
      period: '1h' | '24h' | '7d' | '30d';
    };
    consecutiveFailures?: {
      count: number;
    };
  };
  actions: {
    email?: {
      enabled: boolean;
      recipients: string[];
      template?: string;
    };
    webhook?: {
      enabled: boolean;
      url: string;
      method: 'POST' | 'PUT';
      headers?: Record<string, string>;
      payload?: Record<string, unknown>;
    };
    sms?: {
      enabled: boolean;
      phoneNumbers: string[];
    };
  };
  clientIds?: string[];
  healthCheckIds?: string[];
}

// GET /api/health-checks/alerts - Get alerts and alert rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'alerts'; // 'alerts' or 'rules'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // 'active', 'resolved', 'acknowledged'
    const severity = searchParams.get('severity');
    const clientId = searchParams.get('clientId');

    const skip = (page - 1) * limit;

    if (type === 'rules') {
      // Get alert rules
      const alertRules = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Alert Rule' }
        },
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: {
          title: { startsWith: 'Alert Rule' }
        }
      });

      const rules = alertRules
        .filter(rule => {
          const data = rule.reportData as Record<string, unknown>;
          return (data?.userId as string) === session.user.id;
        })
        .map(rule => {
          const data = rule.reportData as Record<string, unknown>;
          return {
            id: rule.id,
            name: (data?.name as string) || '',
            description: data?.description as string | undefined,
            enabled: (data?.enabled as boolean) || false,
            conditions: (data?.conditions as Record<string, unknown>) || {},
            actions: (data?.actions as Record<string, unknown>) || {},
            clientIds: (data?.clientIds as string[]) || [],
            healthCheckIds: (data?.healthCheckIds as string[]) || [],
            createdAt: rule.generatedAt,
            updatedAt: rule.generatedAt
          };
        });

      return NextResponse.json({
        rules,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    // Get alerts
    const whereClause: Record<string, unknown> = {
      title: { startsWith: 'Health Check Alert' }
    };

    if (clientId) {
      whereClause.clientId = clientId;
    }

    const alerts = await prisma.report.findMany({
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

    const alertData = alerts
      .filter(alert => {
        const data = alert.reportData as Record<string, unknown>;
        return (data?.triggeredBy as string) === session.user.id;
      })
      .filter(alert => {
        const data = alert.reportData as Record<string, unknown>;
        if (!status) return true;
        
        if (status === 'active') {
          return !(data?.resolved as boolean);
        } else if (status === 'resolved') {
          return data?.resolved as boolean;
        } else if (status === 'acknowledged') {
          return data?.acknowledged as boolean;
        }
        return true;
      })
      .filter(alert => {
        const data = alert.reportData as Record<string, unknown>;
        if (!severity) return true;
        return (data?.severity as string) === severity;
      })
      .map(alert => {
        const data = alert.reportData as Record<string, unknown>;
        return {
          id: alert.id,
          type: (data?.alertType as string) || 'ERROR',
          severity: (data?.severity as string) || 'MEDIUM',
          title: alert.title,
          message: (data?.message as string) || '',
          healthCheckId: (data?.healthCheckId as string) || '',
          clientId: alert.clientId,
          client: null, // Client data not available in Report model
          triggeredAt: alert.generatedAt,
          resolvedAt: data?.resolvedAt ? new Date(data.resolvedAt as string) : null,
          acknowledged: (data?.acknowledged as boolean) || false,
          acknowledgedAt: data?.acknowledgedAt ? new Date(data.acknowledgedAt as string) : null,
          acknowledgedBy: data?.acknowledgedBy as string,
          ruleId: data?.ruleId as string,
          metadata: {
            url: data?.url as string,
            statusCode: data?.statusCode as number,
            responseTime: data?.responseTime as number,
            errorMessage: data?.errorMessage as string
          }
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

  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/health-checks/alerts - Create alert rule or acknowledge alerts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_rule') {
      // Create new alert rule
      const {
        name,
        description,
        enabled = true,
        conditions,
        actions,
        clientIds,
        healthCheckIds
      }: AlertRule = data;

      if (!name || !conditions || !actions) {
        return NextResponse.json(
          { error: 'Name, conditions, and actions are required' },
          { status: 400 }
        );
      }

      const alertRule = await prisma.report.create({
        data: {
          title: `Alert Rule - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: clientIds?.[0] || '',
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify({
            type: 'ALERT_RULE',
            name,
            description,
            enabled,
            conditions,
            actions,
            clientIds: clientIds || [],
            healthCheckIds: healthCheckIds || [],
            userId: session.user.id,
            createdBy: session.user.id
          }))
        }
      });

      return NextResponse.json({
        message: 'Alert rule created successfully',
        ruleId: alertRule.id
      });
    }

    if (action === 'acknowledge') {
      // Acknowledge alerts
      const { alertIds } = data;

      if (!alertIds || alertIds.length === 0) {
        return NextResponse.json(
          { error: 'At least one alert ID is required' },
          { status: 400 }
        );
      }

      let acknowledgedCount = 0;

      for (const alertId of alertIds) {
        try {
          const alert = await prisma.report.findFirst({
            where: {
              id: alertId,
              title: { startsWith: 'Health Check Alert' }
            }
          });

          if (alert) {
            const data = typeof alert.reportData === 'object' && alert.reportData !== null ? alert.reportData : {};
            await prisma.report.update({
              where: { id: alertId },
              data: {
                reportData: JSON.parse(JSON.stringify({
                  ...data,
                  acknowledged: true,
                  acknowledgedAt: new Date().toISOString(),
                  acknowledgedBy: session.user.id
                }))
              }
            });
            acknowledgedCount++;
          }
        } catch (error) {
          console.error(`Error acknowledging alert ${alertId}:`, error);
        }
      }

      return NextResponse.json({
        message: `Acknowledged ${acknowledgedCount} alerts`,
        acknowledgedCount
      });
    }

    if (action === 'resolve') {
      // Resolve alerts
      const { alertIds } = data;

      if (!alertIds || alertIds.length === 0) {
        return NextResponse.json(
          { error: 'At least one alert ID is required' },
          { status: 400 }
        );
      }

      let resolvedCount = 0;

      for (const alertId of alertIds) {
        try {
          const alert = await prisma.report.findFirst({
            where: {
              id: alertId,
              title: { startsWith: 'Health Check Alert' }
            }
          });

          if (alert) {
            const data = typeof alert.reportData === 'object' && alert.reportData !== null ? alert.reportData : {};
            await prisma.report.update({
              where: { id: alertId },
              data: {
                reportData: JSON.parse(JSON.stringify({
                  ...data,
                  resolved: true,
                  resolvedAt: new Date().toISOString(),
                  resolvedBy: session.user.id
                }))
              }
            });
            resolvedCount++;
          }
        } catch (error) {
          console.error(`Error resolving alert ${alertId}:`, error);
        }
      }

      return NextResponse.json({
        message: `Resolved ${resolvedCount} alerts`,
        resolvedCount
      });
    }

    if (action === 'test_rule') {
      // Test alert rule
      const { ruleId } = data;

      if (!ruleId) {
        return NextResponse.json(
          { error: 'Rule ID is required' },
          { status: 400 }
        );
      }

      const rule = await prisma.report.findFirst({
        where: {
          id: ruleId,
          title: { startsWith: 'Alert Rule' }
        }
      });

      if (!rule) {
        return NextResponse.json(
          { error: 'Alert rule not found' },
          { status: 404 }
        );
      }

      const ruleData = typeof rule.reportData === 'object' && rule.reportData !== null ? rule.reportData as Record<string, unknown> : {};

      // Simulate rule execution
      const testResult = {
        ruleId,
        ruleName: ruleData.name as string,
        conditions: ruleData.conditions,
        actions: ruleData.actions,
        testExecutedAt: new Date(),
        simulatedTrigger: true,
        message: 'This is a test alert triggered manually'
      };

      // Execute actions if enabled
      const actions = typeof ruleData.actions === 'object' && ruleData.actions !== null ? ruleData.actions as Record<string, unknown> : {};
      if (
        typeof actions.email === 'object' &&
        actions.email !== null &&
        'enabled' in actions.email &&
        (actions.email as { enabled: boolean }).enabled
      ) {
        // In a real implementation, you would send actual emails
        const email = actions.email as { recipients?: string[] };
        testResult.message += '. Email notification would be sent to: ' + 
          (email.recipients ?? []).join(', ');
      }

      if (
        typeof actions.webhook === 'object' &&
        actions.webhook !== null &&
        'enabled' in actions.webhook &&
        (actions.webhook as { enabled: boolean }).enabled
      ) {
        // In a real implementation, you would call the webhook
        const webhook = actions.webhook as { url?: string };
        testResult.message += '. Webhook would be called at: ' + 
          (webhook.url ?? '');
      }

      return NextResponse.json({
        message: 'Alert rule test completed',
        testResult
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing alert request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/health-checks/alerts - Update alert rule
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      ruleId,
      name,
      description,
      enabled,
      conditions,
      actions,
      clientIds,
      healthCheckIds
    } = await request.json();

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

          const existingRule = await prisma.report.findFirst({
        where: {
          id: ruleId,
          title: { startsWith: 'Alert Rule' }
        }
      });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }

    // Check if the rule belongs to the current user
    const ruleData = existingRule.reportData as Record<string, unknown>;
    if (ruleData?.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const existingData = existingRule.reportData as Record<string, unknown>;
    const updateData = {
      ...existingData,
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(enabled !== undefined && { enabled }),
      ...(conditions && { conditions }),
      ...(actions && { actions }),
      ...(clientIds && { clientIds }),
      ...(healthCheckIds && { healthCheckIds }),
      updatedAt: new Date().toISOString(),
      updatedBy: session.user.id
    };

    await prisma.report.update({
      where: { id: ruleId },
      data: {
        title: name ? `Alert Rule - ${name}` : existingRule.title,
        reportData: JSON.parse(JSON.stringify(updateData))
      }
    });

    return NextResponse.json({
      message: 'Alert rule updated successfully'
    });

  } catch (error) {
    console.error('Error updating alert rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/health-checks/alerts - Delete alert rule or alerts
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleIds, alertIds } = await request.json();

    let deletedCount = 0;

    if (ruleIds && ruleIds.length > 0) {
      // Delete alert rules
      const rulesToDelete = await prisma.report.findMany({
        where: {
          id: {
            in: ruleIds
          },
          title: { startsWith: 'Alert Rule' }
        }
      });

      // Filter rules that belong to the current user
      const userRules = rulesToDelete.filter(rule => {
        const data = rule.reportData as Record<string, unknown>;
        return data?.userId === session.user.id;
      });

      const deletedRules = await prisma.report.deleteMany({
        where: {
          id: {
            in: userRules.map(rule => rule.id)
          }
        }
      });
      deletedCount += deletedRules.count;
    }

    if (alertIds && alertIds.length > 0) {
      // Delete alerts
      const deletedAlerts = await prisma.report.deleteMany({
        where: {
          id: {
            in: alertIds
          },
          title: { startsWith: 'Health Check Alert' }
        }
      });
      deletedCount += deletedAlerts.count;
    }

    return NextResponse.json({
      message: `Deleted ${deletedCount} items`,
      deletedCount
    });

  } catch (error) {
    console.error('Error deleting alerts/rules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}