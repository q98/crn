import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface MonitoringAlert {
  id?: string;
  type: 'UPTIME' | 'PERFORMANCE' | 'SSL' | 'SECURITY' | 'RESOURCE' | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED' | 'ESCALATED';
  title: string;
  description: string;
  source: {
    clientId?: string;
    domain?: string;
    service?: string;
    endpoint?: string;
    component?: string;
  };
  conditions: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte' | 'contains' | 'not_contains';
    threshold: number | string;
    duration?: number; // minutes
    consecutiveFailures?: number;
  }[];
  currentValue?: number | string;
  triggeredAt: Date;
  lastTriggered: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  suppressedUntil?: Date;
  escalationLevel: number;
  escalationRules?: {
    level: number;
    delayMinutes: number;
    recipients: string[];
    channels: ('EMAIL' | 'SMS' | 'SLACK' | 'WEBHOOK')[];
  }[];
  notifications: {
    sent: number;
    lastSent?: Date;
    channels: string[];
    recipients: string[];
  };
  metadata: {
    tags?: string[];
    runbookUrl?: string;
    relatedAlerts?: string[];
    affectedServices?: string[];
    estimatedImpact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    customFields?: Record<string, unknown>;
  };
  history: {
    timestamp: Date;
    action: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED' | 'SUPPRESSED' | 'UPDATED';
    performedBy?: string;
    details?: string;
    previousStatus?: string;
    newStatus?: string;
  }[];
}

interface AlertRule {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  type: MonitoringAlert['type'];
  severity: MonitoringAlert['severity'];
  conditions: MonitoringAlert['conditions'];
  targets: {
    clientIds?: string[];
    domains?: string[];
    services?: string[];
    tags?: string[];
    all?: boolean;
  };
  schedule?: {
    enabled: boolean;
    timezone: string;
    activeHours?: {
      start: string; // HH:MM
      end: string; // HH:MM
    };
    activeDays?: number[]; // 0-6 for Sunday-Saturday
    maintenanceWindows?: {
      start: Date;
      end: Date;
      recurring?: boolean;
      frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    }[];
  };
  notifications: {
    channels: ('EMAIL' | 'SMS' | 'SLACK' | 'WEBHOOK')[];
    recipients: string[];
    escalation: {
      enabled: boolean;
      rules: MonitoringAlert['escalationRules'];
    };
    throttling: {
      enabled: boolean;
      maxPerHour: number;
      maxPerDay: number;
    };
  };
  actions?: {
    autoResolve?: {
      enabled: boolean;
      conditions: MonitoringAlert['conditions'];
    };
    autoEscalate?: {
      enabled: boolean;
      afterMinutes: number;
    };
    runbook?: {
      url: string;
      autoExecute?: boolean;
    };
    webhooks?: {
      url: string;
      method: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
      payload?: Record<string, unknown>;
    }[];
  };
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

interface NotificationChannel {
  id?: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'SLACK' | 'WEBHOOK' | 'DISCORD' | 'TEAMS';
  enabled: boolean;
  configuration: {
    // Email
    smtpServer?: string;
    smtpPort?: number;
    smtpUsername?: string;
    smtpPassword?: string;
    fromAddress?: string;
    
    // SMS
    provider?: 'TWILIO' | 'AWS_SNS' | 'NEXMO';
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
    
    // Slack
    webhookUrl?: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
    
    // Webhook
    url?: string;
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    authentication?: {
      type: 'NONE' | 'BASIC' | 'BEARER' | 'API_KEY';
      username?: string;
      password?: string;
      token?: string;
      apiKey?: string;
      apiKeyHeader?: string;
    };
  };
  testConfiguration?: {
    lastTested?: Date;
    testResult?: 'SUCCESS' | 'FAILURE';
    testError?: string;
  };
  createdBy: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

// GET /api/monitoring/alerts - Get alerts, rules, and notification channels
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'alerts'; // 'alerts', 'rules', 'channels', 'stats'
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const alertType = searchParams.get('alertType');
    const clientId = searchParams.get('clientId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (type === 'alerts') {
      // Get monitoring alerts
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Monitoring Alert -' }
      };
      
      if (status) {
        whereClause.reportData = {
          path: ['status'],
          equals: status
        };
      }
      
      if (severity) {
        whereClause.reportData = {
          path: ['severity'],
          equals: severity
        };
      }
      
      if (alertType) {
        whereClause.reportData = {
          path: ['type'],
          equals: alertType
        };
      }
      
      if (clientId) {
        whereClause.reportData = {
          path: ['source', 'clientId'],
          equals: clientId
        };
      }
      
      if (startDate || endDate) {
        whereClause.generatedAt = {};
        if (startDate) {
          (whereClause.generatedAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          (whereClause.generatedAt as Record<string, unknown>).lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;
      
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

      const alertData = alerts.map(alert => ({
        id: alert.id,
        ...(alert.reportData as unknown as MonitoringAlert),
        triggeredAt: alert.generatedAt
      }));

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

    if (type === 'rules') {
      // Get alert rules
      const rules = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Alert Rule -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const ruleData = rules.map(rule => ({
        id: rule.id,
        ...(rule.reportData as unknown as AlertRule),
        createdAt: rule.generatedAt
      }));

      return NextResponse.json({ rules: ruleData });
    }

    if (type === 'channels') {
      // Get notification channels
      const channels = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Notification Channel -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const channelData = channels.map(channel => ({
        id: channel.id,
        ...(channel.reportData as unknown as NotificationChannel),
        createdAt: channel.generatedAt
      }));

      return NextResponse.json({ channels: channelData });
    }

    if (type === 'stats') {
      // Get alert statistics
      const stats = await generateAlertStats(clientId || undefined);
      return NextResponse.json({ stats });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching monitoring alerts data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/monitoring/alerts - Create alerts, rules, channels, or manage alert actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_alert') {
      const {
        type,
        severity,
        title,
        description,
        source,
        conditions,
        currentValue,
        metadata = {}
      }: {
        type: MonitoringAlert['type'];
        severity: MonitoringAlert['severity'];
        title: string;
        description: string;
        source: MonitoringAlert['source'];
        conditions: MonitoringAlert['conditions'];
        currentValue?: number | string;
        metadata?: MonitoringAlert['metadata'];
      } = data;

      if (!type || !severity || !title || !description || !conditions) {
        return NextResponse.json(
          { error: 'type, severity, title, description, and conditions are required' },
          { status: 400 }
        );
      }

      const alert: MonitoringAlert = {
        type,
        severity,
        status: 'ACTIVE',
        title,
        description,
        source,
        conditions,
        currentValue,
        triggeredAt: new Date(),
        lastTriggered: new Date(),
        escalationLevel: 0,
        notifications: {
          sent: 0,
          channels: [],
          recipients: []
        },
        metadata,
        history: [{
          timestamp: new Date(),
          action: 'TRIGGERED',
          details: 'Alert created and triggered'
        }]
      };

      const alertRecord = await prisma.report.create({
        data: {
          title: `Monitoring Alert - ${type} - ${title}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(alert))
        }
      });

      // Process alert notifications
      await processAlertNotifications(alertRecord.id, alert);

      return NextResponse.json({
        message: 'Alert created',
        alertId: alertRecord.id
      });
    }

    if (action === 'create_rule') {
      const {
        name,
        description,
        type,
        severity,
        conditions,
        targets,
        schedule,
        notifications,
        actions
      }: {
        name: string;
        description: string;
        type: AlertRule['type'];
        severity: AlertRule['severity'];
        conditions: AlertRule['conditions'];
        targets: AlertRule['targets'];
        schedule?: AlertRule['schedule'];
        notifications: AlertRule['notifications'];
        actions?: AlertRule['actions'];
      } = data;

      if (!name || !type || !severity || !conditions || !targets || !notifications) {
        return NextResponse.json(
          { error: 'name, type, severity, conditions, targets, and notifications are required' },
          { status: 400 }
        );
      }

      const rule: AlertRule = {
        name,
        description,
        enabled: true,
        type,
        severity,
        conditions,
        targets,
        schedule,
        notifications,
        actions,
        createdBy: session.user.id,
        createdAt: new Date(),
        lastModified: new Date(),
        triggerCount: 0
      };

      const ruleRecord = await prisma.report.create({
        data: {
          title: `Alert Rule - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(rule))
        }
      });

      return NextResponse.json({
        message: 'Alert rule created',
        ruleId: ruleRecord.id
      });
    }

    if (action === 'create_channel') {
      const {
        name,
        type,
        configuration
      }: {
        name: string;
        type: NotificationChannel['type'];
        configuration: NotificationChannel['configuration'];
      } = data;

      if (!name || !type || !configuration) {
        return NextResponse.json(
          { error: 'name, type, and configuration are required' },
          { status: 400 }
        );
      }

      const channel: NotificationChannel = {
        name,
        type,
        enabled: true,
        configuration,
        createdBy: session.user.id,
        createdAt: new Date(),
        usageCount: 0
      };

      const channelRecord = await prisma.report.create({
        data: {
          title: `Notification Channel - ${type} - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(channel))
        }
      });

      return NextResponse.json({
        message: 'Notification channel created',
        channelId: channelRecord.id
      });
    }

    if (action === 'acknowledge_alert') {
      const { alertId }: { alertId: string } = data;

      if (!alertId) {
        return NextResponse.json(
          { error: 'alertId is required' },
          { status: 400 }
        );
      }

      const alertRecord = await prisma.report.findUnique({
        where: { id: alertId }
      });

      if (!alertRecord) {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }

      const alert = alertRecord.reportData as unknown as MonitoringAlert;
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = session.user.id;
      alert.history.push({
        timestamp: new Date(),
        action: 'ACKNOWLEDGED',
        performedBy: session.user.id,
        previousStatus: 'ACTIVE',
        newStatus: 'ACKNOWLEDGED'
      });

      await prisma.report.update({
        where: { id: alertId },
        data: {
          reportData: JSON.parse(JSON.stringify(alert))
        }
      });

      return NextResponse.json({
        message: 'Alert acknowledged'
      });
    }

    if (action === 'resolve_alert') {
      const { alertId, resolution }: { alertId: string; resolution?: string } = data;

      if (!alertId) {
        return NextResponse.json(
          { error: 'alertId is required' },
          { status: 400 }
        );
      }

      const alertRecord = await prisma.report.findUnique({
        where: { id: alertId }
      });

      if (!alertRecord) {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }

      const alert = alertRecord.reportData as unknown as MonitoringAlert;
      const previousStatus = alert.status;
      alert.status = 'RESOLVED';
      alert.resolvedAt = new Date();
      alert.history.push({
        timestamp: new Date(),
        action: 'RESOLVED',
        performedBy: session.user.id,
        details: resolution,
        previousStatus,
        newStatus: 'RESOLVED'
      });

      await prisma.report.update({
        where: { id: alertId },
        data: {
          reportData: JSON.parse(JSON.stringify(alert))
        }
      });

      return NextResponse.json({
        message: 'Alert resolved'
      });
    }

    if (action === 'suppress_alert') {
      const { alertId, suppressUntil }: { alertId: string; suppressUntil: Date } = data;

      if (!alertId || !suppressUntil) {
        return NextResponse.json(
          { error: 'alertId and suppressUntil are required' },
          { status: 400 }
        );
      }

      const alertRecord = await prisma.report.findUnique({
        where: { id: alertId }
      });

      if (!alertRecord) {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }

      const alert = alertRecord.reportData as unknown as MonitoringAlert;
      const previousStatus = alert.status;
      alert.status = 'SUPPRESSED';
      alert.suppressedUntil = new Date(suppressUntil);
      alert.history.push({
        timestamp: new Date(),
        action: 'SUPPRESSED',
        performedBy: session.user.id,
        details: `Suppressed until ${new Date(suppressUntil).toISOString()}`,
        previousStatus,
        newStatus: 'SUPPRESSED'
      });

      await prisma.report.update({
        where: { id: alertId },
        data: {
          reportData: JSON.parse(JSON.stringify(alert))
        }
      });

      return NextResponse.json({
        message: 'Alert suppressed'
      });
    }

    if (action === 'test_channel') {
      const { channelId }: { channelId: string } = data;

      if (!channelId) {
        return NextResponse.json(
          { error: 'channelId is required' },
          { status: 400 }
        );
      }

      const channelRecord = await prisma.report.findUnique({
        where: { id: channelId }
      });

      if (!channelRecord) {
        return NextResponse.json(
          { error: 'Channel not found' },
          { status: 404 }
        );
      }

      const channel = channelRecord.reportData as unknown as NotificationChannel;
      const testResult = await testNotificationChannel(channel);

      // Update test configuration
      channel.testConfiguration = {
        lastTested: new Date(),
        testResult: testResult.success ? 'SUCCESS' : 'FAILURE',
        testError: testResult.error
      };

      await prisma.report.update({
        where: { id: channelId },
        data: {
          reportData: JSON.parse(JSON.stringify(channel))
        }
      });

      return NextResponse.json({
        message: testResult.success ? 'Channel test successful' : 'Channel test failed',
        success: testResult.success,
        error: testResult.error
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing monitoring alerts request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to process alert notifications
async function processAlertNotifications(
  alertId: string,
  alert: MonitoringAlert
): Promise<void> {
  try {
    // Get applicable alert rules
    const rules = await getApplicableAlertRules(alert);
    
    for (const rule of rules) {
      // Check if alert should be sent based on throttling
      if (shouldSendNotification(rule, alert)) {
        // Send notifications through configured channels
        await sendAlertNotifications(rule, alert);
        
        // Update alert notification count
        alert.notifications.sent++;
        alert.notifications.lastSent = new Date();
        
        // Update rule trigger count
        rule.triggerCount++;
        rule.lastTriggered = new Date();
        
        await prisma.report.update({
          where: { id: alertId },
          data: {
            reportData: JSON.parse(JSON.stringify(alert))
          }
        });
      }
    }
  } catch (error) {
    console.error('Error processing alert notifications:', error);
  }
}

// Helper function to get applicable alert rules
async function getApplicableAlertRules(alert: MonitoringAlert): Promise<AlertRule[]> {
  const rules = await prisma.report.findMany({
    where: {
      title: { startsWith: 'Alert Rule -' }
    }
  });

  return rules
    .map(rule => rule.reportData as unknown as AlertRule)
    .filter(rule => {
      if (!rule.enabled) return false;
      if (rule.type !== alert.type) return false;
      
      // Check if alert matches rule targets
      if (rule.targets.all) return true;
      
      if (rule.targets.clientIds && alert.source.clientId) {
        return rule.targets.clientIds.includes(alert.source.clientId);
      }
      
      if (rule.targets.domains && alert.source.domain) {
        return rule.targets.domains.some(domain => 
          alert.source.domain?.includes(domain)
        );
      }
      
      return false;
    });
}

// Helper function to check if notification should be sent
function shouldSendNotification(rule: AlertRule, alert: MonitoringAlert): boolean {
  if (!rule.notifications.throttling.enabled) return true;
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Check hourly limit
  const recentNotifications = alert.history.filter(h => 
    h.action === 'TRIGGERED' && h.timestamp > oneHourAgo
  ).length;
  
  if (recentNotifications >= rule.notifications.throttling.maxPerHour) {
    return false;
  }
  
  // Check daily limit
  const dailyNotifications = alert.history.filter(h => 
    h.action === 'TRIGGERED' && h.timestamp > oneDayAgo
  ).length;
  
  if (dailyNotifications >= rule.notifications.throttling.maxPerDay) {
    return false;
  }
  
  return true;
}

// Helper function to send alert notifications
async function sendAlertNotifications(rule: AlertRule, alert: MonitoringAlert): Promise<void> {
  for (const channelType of rule.notifications.channels) {
    try {
      // Get notification channels of this type
      const channels = await prisma.report.findMany({
        where: {
          title: { startsWith: `Notification Channel - ${channelType}` }
        }
      });
      
      for (const channelRecord of channels) {
        const channel = channelRecord.reportData as unknown as NotificationChannel;
        if (channel.enabled) {
          await sendNotification(channel, alert, rule.notifications.recipients);
          
          // Update channel usage
          channel.usageCount++;
          channel.lastUsed = new Date();
          
          await prisma.report.update({
            where: { id: channelRecord.id },
            data: {
              reportData: JSON.parse(JSON.stringify(channel))
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error sending ${channelType} notification:`, error);
    }
  }
}

// Helper function to send individual notification
async function sendNotification(
  channel: NotificationChannel,
  alert: MonitoringAlert,
  recipients: string[]
): Promise<void> {
  const message = formatAlertMessage(alert);
  
  switch (channel.type) {
    case 'EMAIL':
      await sendEmailNotification(channel, message, recipients);
      break;
    case 'SLACK':
      await sendSlackNotification(channel, message);
      break;
    case 'WEBHOOK':
      await sendWebhookNotification(channel, alert);
      break;
    // Add other notification types as needed
  }
}

// Helper function to format alert message
function formatAlertMessage(alert: MonitoringAlert): string {
  return `🚨 ${alert.severity} Alert: ${alert.title}\n\n` +
         `Description: ${alert.description}\n` +
         `Source: ${alert.source.domain || alert.source.service || 'Unknown'}\n` +
         `Triggered: ${alert.triggeredAt.toISOString()}\n` +
         `Current Value: ${alert.currentValue || 'N/A'}`;
}

// Helper function to send email notification
async function sendEmailNotification(
  channel: NotificationChannel,
  message: string,
  recipients: string[]
): Promise<void> {
  // Implementation would depend on email service
  console.log(`Sending email notification to ${recipients.join(', ')}:`, message);
}

// Helper function to send Slack notification
async function sendSlackNotification(
  channel: NotificationChannel,
  message: string
): Promise<void> {
  if (!channel.configuration.webhookUrl) {
    throw new Error('Slack webhook URL not configured');
  }
  
  const payload = {
    text: message,
    channel: channel.configuration.channel,
    username: channel.configuration.username || 'SHP Monitor',
    icon_emoji: channel.configuration.iconEmoji || ':warning:'
  };
  
  const response = await fetch(channel.configuration.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.statusText}`);
  }
}

// Helper function to send webhook notification
async function sendWebhookNotification(
  channel: NotificationChannel,
  alert: MonitoringAlert
): Promise<void> {
  if (!channel.configuration.url) {
    throw new Error('Webhook URL not configured');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...channel.configuration.headers
  };
  
  // Add authentication headers if configured
  if (channel.configuration.authentication) {
    const auth = channel.configuration.authentication;
    switch (auth.type) {
      case 'BEARER':
        headers['Authorization'] = `Bearer ${auth.token}`;
        break;
      case 'API_KEY':
        if (auth.apiKeyHeader && auth.apiKey) {
          headers[auth.apiKeyHeader] = auth.apiKey;
        }
        break;
    }
  }
  
  const response = await fetch(channel.configuration.url, {
    method: channel.configuration.method || 'POST',
    headers,
    body: JSON.stringify({
      alert,
      timestamp: new Date().toISOString()
    })
  });
  
  if (!response.ok) {
    throw new Error(`Webhook notification failed: ${response.statusText}`);
  }
}

// Helper function to test notification channel
async function testNotificationChannel(
  channel: NotificationChannel
): Promise<{ success: boolean; error?: string }> {
  try {
    const testAlert: MonitoringAlert = {
      type: 'CUSTOM',
      severity: 'LOW',
      status: 'ACTIVE',
      title: 'Test Alert',
      description: 'This is a test alert to verify notification channel configuration.',
      source: { component: 'Test System' },
      conditions: [],
      triggeredAt: new Date(),
      lastTriggered: new Date(),
      escalationLevel: 0,
      notifications: { sent: 0, channels: [], recipients: [] },
      metadata: {},
      history: []
    };
    
    await sendNotification(channel, testAlert, ['test@example.com']);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to generate alert statistics
async function generateAlertStats(clientId?: string): Promise<Record<string, unknown>> {
  const whereClause: Record<string, unknown> = {
    title: { startsWith: 'Monitoring Alert -' }
  };
  
  if (clientId) {
    whereClause.reportData = {
      path: ['source', 'clientId'],
      equals: clientId
    };
  }

  const alerts = await prisma.report.findMany({
    where: whereClause,
    orderBy: {
      generatedAt: 'desc'
    },
    take: 1000 // Limit for performance
  });

  const stats = {
    totalAlerts: alerts.length,
    statusDistribution: {
      active: 0,
      acknowledged: 0,
      resolved: 0,
      suppressed: 0
    },
    severityDistribution: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    typeDistribution: {
      uptime: 0,
      performance: 0,
      ssl: 0,
      security: 0,
      resource: 0,
      custom: 0
    },
    trends: {
      alertsPerDay: [] as Array<{ date: string; count: number }>,
      meanTimeToAcknowledge: 0,
      meanTimeToResolve: 0
    },
    topAlertSources: [] as Array<{ source: string; count: number }>
  };

  let totalAckTime = 0;
  let totalResolveTime = 0;
  let ackedCount = 0;
  let resolvedCount = 0;
  const sourceCounts: Record<string, number> = {};

  alerts.forEach(alertRecord => {
    const alert = alertRecord.reportData as unknown as MonitoringAlert;
    
    // Status distribution
    switch (alert.status) {
      case 'ACTIVE':
        stats.statusDistribution.active++;
        break;
      case 'ACKNOWLEDGED':
        stats.statusDistribution.acknowledged++;
        break;
      case 'RESOLVED':
        stats.statusDistribution.resolved++;
        break;
      case 'SUPPRESSED':
        stats.statusDistribution.suppressed++;
        break;
    }
    
    // Severity distribution
    switch (alert.severity) {
      case 'LOW':
        stats.severityDistribution.low++;
        break;
      case 'MEDIUM':
        stats.severityDistribution.medium++;
        break;
      case 'HIGH':
        stats.severityDistribution.high++;
        break;
      case 'CRITICAL':
        stats.severityDistribution.critical++;
        break;
    }
    
    // Type distribution
    switch (alert.type) {
      case 'UPTIME':
        stats.typeDistribution.uptime++;
        break;
      case 'PERFORMANCE':
        stats.typeDistribution.performance++;
        break;
      case 'SSL':
        stats.typeDistribution.ssl++;
        break;
      case 'SECURITY':
        stats.typeDistribution.security++;
        break;
      case 'RESOURCE':
        stats.typeDistribution.resource++;
        break;
      case 'CUSTOM':
        stats.typeDistribution.custom++;
        break;
    }
    
    // Calculate response times
    if (alert.acknowledgedAt) {
      const ackTime = alert.acknowledgedAt.getTime() - alert.triggeredAt.getTime();
      totalAckTime += ackTime;
      ackedCount++;
    }
    
    if (alert.resolvedAt) {
      const resolveTime = alert.resolvedAt.getTime() - alert.triggeredAt.getTime();
      totalResolveTime += resolveTime;
      resolvedCount++;
    }
    
    // Count alert sources
    const source = alert.source.domain || alert.source.service || alert.source.component || 'Unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });

  // Calculate averages
  if (ackedCount > 0) {
    stats.trends.meanTimeToAcknowledge = totalAckTime / ackedCount / (1000 * 60); // minutes
  }
  
  if (resolvedCount > 0) {
    stats.trends.meanTimeToResolve = totalResolveTime / resolvedCount / (1000 * 60); // minutes
  }
  
  // Top alert sources
  stats.topAlertSources = Object.entries(sourceCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));

  return stats;
}