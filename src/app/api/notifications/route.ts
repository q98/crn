import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface NotificationChannelData {
  userId: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  lastUsed?: string;
  totalNotifications?: number;
}

interface NotificationTemplateData {
  userId: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables: string[];
  isDefault: boolean;
}

interface NotificationHistoryData {
  userId: string;
  channelId: string;
  channelName: string;
  type: string;
  recipient: string;
  subject?: string;
  message: string;
  status: string;
  deliveredAt?: string;
  errorMessage?: string;
  alertId?: string;
  metadata?: Record<string, unknown>;
}

// Type guard functions
function isNotificationChannelData(data: unknown): data is NotificationChannelData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'name' in data &&
    'type' in data &&
    'enabled' in data
  );
}

function isNotificationTemplateData(data: unknown): data is NotificationTemplateData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'name' in data &&
    'type' in data &&
    'body' in data
  );
}

function isNotificationHistoryData(data: unknown): data is NotificationHistoryData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'channelId' in data &&
    'channelName' in data &&
    'type' in data &&
    'recipient' in data &&
    'message' in data &&
    'status' in data
  );
}

// GET /api/notifications - Get notification channels, templates, or history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'channels'; // 'channels', 'templates', 'history'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const channelType = searchParams.get('channelType');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    if (type === 'channels') {
      // Get notification channels
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Notification Channel' },
        reportData: {
          path: '$.userId',
          equals: session.user.id
        }
      };

      if (channelType) {
        whereClause.reportData = {
          path: '$.type',
          equals: channelType
        };
      }

      const channels = await prisma.report.findMany({
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

      const channelData = channels.map(channel => {
        if (!isNotificationChannelData(channel.reportData)) {
          throw new Error('Invalid notification channel data');
        }
        const data = channel.reportData;
        return {
          id: channel.id,
          name: data.name,
          type: data.type,
          enabled: data.enabled,
          config: data.config,
          filters: data.filters,
          createdAt: channel.generatedAt,
          lastUsed: data.lastUsed ? new Date(data.lastUsed) : null,
          totalNotifications: data.totalNotifications || 0
        };
      });

      return NextResponse.json({
        channels: channelData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'templates') {
      // Get notification templates
      const templates = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Notification Template' },
          reportData: {
            path: '$.userId',
            equals: session.user.id
          }
        },
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: {
          title: { startsWith: 'Notification Template' },
          reportData: {
            path: '$.userId',
            equals: session.user.id
          }
        }
      });

      const templateData = templates.map(template => {
        if (!isNotificationTemplateData(template.reportData)) {
          throw new Error('Invalid notification template data');
        }
        const data = template.reportData;
        return {
          id: template.id,
          name: data.name,
          type: data.type,
          subject: data.subject,
          body: data.body,
          variables: data.variables,
          isDefault: data.isDefault,
          createdAt: template.generatedAt
        };
      });

      return NextResponse.json({
        templates: templateData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'history') {
      // Get notification history
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Notification History' },
        reportData: {
          path: '$.userId',
          equals: session.user.id
        }
      };

      if (status) {
        whereClause.reportData = {
          path: '$.status',
          equals: status
        };
      }

      const history = await prisma.report.findMany({
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

      const historyData = history.map(record => {
        if (!isNotificationHistoryData(record.reportData)) {
          throw new Error('Invalid notification history data');
        }
        const data = record.reportData;
        return {
          id: record.id,
          channelId: data.channelId,
          channelName: data.channelName,
          type: data.type,
          recipient: data.recipient,
          subject: data.subject,
          message: data.message,
          status: data.status,
          deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
          errorMessage: data.errorMessage,
          alertId: data.alertId,
          metadata: data.metadata,
          createdAt: record.generatedAt
        };
      });

      return NextResponse.json({
        history: historyData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications - Create notification channel or template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    if (action === 'createChannel') {
      const channelData: NotificationChannelData = {
        userId: session.user.id,
        name: data.name,
        type: data.type,
        enabled: data.enabled,
        config: data.config || {},
        filters: data.filters || {},
        lastUsed: new Date().toISOString(),
        totalNotifications: 0
      };

      const report = await prisma.report.create({
        data: {
          title: `Notification Channel: ${data.name}`,
          dateRange: { startDate: new Date(), endDate: new Date() },
          totalHours: 0,
          totalAmount: 0,
          clientId: '', // Required field, using empty string for system reports
          reportData: JSON.parse(JSON.stringify(channelData))
        }
      });

      return NextResponse.json({
        success: true,
        channel: Object.assign({ id: report.id }, channelData)
      });
    }

    if (action === 'createTemplate') {
      const templateData: NotificationTemplateData = {
        userId: session.user.id,
        name: data.name,
        type: data.type,
        subject: data.subject,
        body: data.body,
        variables: data.variables || [],
        isDefault: data.isDefault || false
      };

      const report = await prisma.report.create({
        data: {
          title: `Notification Template: ${data.name}`,
          dateRange: { startDate: new Date(), endDate: new Date() },
          totalHours: 0,
          totalAmount: 0,
          clientId: '', // Required field, using empty string for system reports
          reportData: JSON.parse(JSON.stringify(templateData))
        }
      });

      return NextResponse.json({
        success: true,
        template: Object.assign({ id: report.id }, templateData)
      });
    }

    if (action === 'sendNotification') {
      // Find the channel
      const channel = await prisma.report.findFirst({
        where: {
          title: { startsWith: 'Notification Channel' },
          reportData: {
            path: '$.name',
            equals: data.channelName
          }
        }
      });

      if (!channel || !isNotificationChannelData(channel.reportData)) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      }

      const channelData = channel.reportData;

      // Find the template
      const template = await prisma.report.findFirst({
        where: {
          title: { startsWith: 'Notification Template' },
          reportData: {
            path: '$.name',
            equals: data.templateName
          }
        }
      });

      if (!template || !isNotificationTemplateData(template.reportData)) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const templateData = template.reportData;

      // Create notification history record
      const historyData: NotificationHistoryData = {
        userId: session.user.id,
        channelId: channel.id,
        channelName: channelData.name,
        type: channelData.type,
        recipient: data.recipient,
        subject: templateData.subject,
        message: templateData.body,
        status: 'SENT',
        deliveredAt: new Date().toISOString(),
        alertId: data.alertId,
        metadata: data.metadata || {}
      };

      const historyReport = await prisma.report.create({
        data: {
          title: `Notification History: ${channelData.name}`,
          dateRange: { startDate: new Date(), endDate: new Date() },
          totalHours: 0,
          totalAmount: 0,
          clientId: '', // Required field, using empty string for system reports
          reportData: JSON.parse(JSON.stringify(historyData))
        }
      });

      // Update channel usage stats
      const updatedChannelData = Object.assign({}, channelData, {
        lastUsed: new Date().toISOString(),
        totalNotifications: (channelData.totalNotifications || 0) + 1
      });

      await prisma.report.update({
        where: { id: channel.id },
        data: {
          reportData: updatedChannelData
        }
      });

      return NextResponse.json({
        success: true,
        notificationId: historyReport.id,
        status: 'SENT'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/notifications - Update notification channel or template
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, data } = body;

    if (action === 'updateChannel') {
      const channel = await prisma.report.findFirst({
        where: {
          id,
          title: { startsWith: 'Notification Channel' },
          reportData: {
            path: '$.userId',
            equals: session.user.id
          }
        }
      });

      if (!channel || !isNotificationChannelData(channel.reportData)) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      }

      const channelData = channel.reportData;
      const updatedData = Object.assign({}, channelData, {
        name: data.name || channelData.name,
        type: data.type || channelData.type,
        enabled: data.enabled !== undefined ? data.enabled : channelData.enabled,
        config: data.config || channelData.config,
        filters: data.filters || channelData.filters
      });

      await prisma.report.update({
        where: { id },
        data: {
          title: `Notification Channel: ${updatedData.name}`,
          reportData: updatedData
        }
      });

      return NextResponse.json({
        success: true,
        channel: Object.assign({ id }, updatedData)
      });
    }

    if (action === 'updateTemplate') {
      const template = await prisma.report.findFirst({
        where: {
          id,
          title: { startsWith: 'Notification Template' },
          reportData: {
            path: '$.userId',
            equals: session.user.id
          }
        }
      });

      if (!template || !isNotificationTemplateData(template.reportData)) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const templateData = template.reportData;
      const updatedData = Object.assign({}, templateData, {
        name: data.name || templateData.name,
        type: data.type || templateData.type,
        subject: data.subject || templateData.subject,
        body: data.body || templateData.body,
        variables: data.variables || templateData.variables,
        isDefault: data.isDefault !== undefined ? data.isDefault : templateData.isDefault
      });

      await prisma.report.update({
        where: { id },
        data: {
          title: `Notification Template: ${updatedData.name}`,
          reportData: updatedData
        }
      });

      return NextResponse.json({
        success: true,
        template: Object.assign({ id }, updatedData)
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/notifications - Delete notification channel or template
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action parameter' }, { status: 400 });
    }

    if (action === 'deleteChannel') {
      const channel = await prisma.report.findFirst({
        where: {
          id,
          title: { startsWith: 'Notification Channel' },
          reportData: {
            path: '$.userId',
            equals: session.user.id
          }
        }
      });

      if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      }

      await prisma.report.delete({
        where: { id }
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'deleteTemplate') {
      const template = await prisma.report.findFirst({
        where: {
          id,
          title: { startsWith: 'Notification Template' },
          reportData: {
            path: '$.userId',
            equals: session.user.id
          }
        }
      });

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      await prisma.report.delete({
        where: { id }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}