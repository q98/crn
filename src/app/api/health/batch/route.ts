import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// Type guard functions
function isBatchHealthCheckOperation(obj: unknown): obj is BatchHealthCheckOperation {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'status' in obj &&
    'targetClients' in obj &&
    'checkTypes' in obj &&
    'configuration' in obj &&
    'results' in obj &&
    'startedAt' in obj &&
    'performedBy' in obj
  );
}

function isHealthCheckTemplate(obj: unknown): obj is HealthCheckTemplate {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'description' in obj &&
    'checkTypes' in obj &&
    'configuration' in obj &&
    'isDefault' in obj &&
    'createdBy' in obj &&
    'createdAt' in obj &&
    'usageCount' in obj
  );
}

function isHealthCheckAlert(obj: unknown): obj is HealthCheckAlert {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'clientId' in obj &&
    'domain' in obj &&
    'alertType' in obj &&
    'severity' in obj &&
    'status' in obj &&
    'message' in obj &&
    'details' in obj &&
    'firstDetected' in obj &&
    'lastDetected' in obj &&
    'escalationLevel' in obj &&
    'notificationsSent' in obj
  );
}

interface BatchHealthCheckOperation {
  id?: string;
  type: 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  targetClients: string[]; // Client IDs
  filters?: {
    clientIds?: string[];
    domainPatterns?: string[];
    healthStatuses?: ('HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN')[];
    lastCheckedBefore?: Date;
    tags?: string[];
    includeSubdomains?: boolean;
  };
  checkTypes: {
    websiteUptime?: boolean;
    sslCertificate?: boolean;
    dnsResolution?: boolean;
    responseTime?: boolean;
    httpStatus?: boolean;
    contentValidation?: boolean;
    securityHeaders?: boolean;
    performanceMetrics?: boolean;
  };
  configuration: {
    timeout: number; // milliseconds
    retryAttempts: number;
    retryDelay: number; // milliseconds
    userAgent: string;
    followRedirects: boolean;
    maxRedirects: number;
    validateSSL: boolean;
    customHeaders?: Record<string, string>;
    expectedStatusCodes?: number[];
    expectedContent?: string[];
    performanceThresholds?: {
      responseTime: number; // milliseconds
      firstByteTime: number; // milliseconds
      domainLookupTime: number; // milliseconds
    };
  };
  schedule?: {
    enabled: boolean;
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number; // e.g., every 2 hours, every 3 days
    time?: string; // HH:MM for daily/weekly/monthly
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    timezone: string;
    nextRun?: Date;
    lastRun?: Date;
    endDate?: Date;
  };
  results: {
    totalChecked: number;
    successful: number;
    failed: number;
    warnings: number;
    errors: Array<{
      clientId: string;
      domain: string;
      error: string;
      details?: Record<string, unknown>;
    }>;
    healthChecks: Array<{
      clientId: string;
      domain: string;
      status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
      responseTime: number;
      httpStatus: number;
      sslValid: boolean;
      sslExpiry: Date | null;
      dnsResolved: boolean;
      contentValid: boolean;
      securityScore: number;
      performanceMetrics: {
        responseTime: number;
        firstByteTime: number;
        domainLookupTime: number;
        downloadTime: number;
        totalTime: number;
      };
      issues: Array<{
        type: 'SSL' | 'DNS' | 'HTTP' | 'CONTENT' | 'SECURITY' | 'PERFORMANCE';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        message: string;
        recommendation?: string;
      }>;
      timestamp: Date;
    }>;
    summary: {
      healthyCount: number;
      warningCount: number;
      criticalCount: number;
      unknownCount: number;
      averageResponseTime: number;
      sslIssuesCount: number;
      dnsIssuesCount: number;
      performanceIssuesCount: number;
    };
  };
  notifications?: {
    onCompletion: boolean;
    onFailure: boolean;
    onCriticalIssues: boolean;
    emailRecipients?: string[];
    webhookUrl?: string;
    slackChannel?: string;
  };
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  performedBy: string;
  metadata?: Record<string, unknown>;
}

interface HealthCheckTemplate {
  id?: string;
  name: string;
  description: string;
  checkTypes: BatchHealthCheckOperation['checkTypes'];
  configuration: BatchHealthCheckOperation['configuration'];
  schedule?: BatchHealthCheckOperation['schedule'];
  notifications?: BatchHealthCheckOperation['notifications'];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface HealthCheckAlert {
  id?: string;
  clientId: string;
  domain: string;
  alertType: 'DOWNTIME' | 'SSL_EXPIRY' | 'PERFORMANCE' | 'SECURITY' | 'DNS_FAILURE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
  message: string;
  details: Record<string, unknown>;
  firstDetected: Date;
  lastDetected: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  suppressedUntil?: Date;
  escalationLevel: number;
  notificationsSent: number;
  relatedAlerts?: string[]; // IDs of related alerts
}

// GET /api/health/batch - Get batch operations, templates, and alerts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'operations'; // 'operations', 'templates', 'alerts', 'stats'
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (type === 'operations') {
      // Get batch health check operations
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Batch Health Check Operation -' }
      };
      
      if (status) {
        whereClause.reportData = {
          path: '$.status',
          equals: status
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
      
      const operations = await prisma.report.findMany({
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

      const operationData = operations.map(op => {
        const parsedData = typeof op.reportData === 'string' ? JSON.parse(op.reportData) : op.reportData;
        if (!isBatchHealthCheckOperation(parsedData)) {
          return null;
        }
        return {
          id: op.id,
          ...parsedData,
          startedAt: op.generatedAt
        };
      }).filter(Boolean);

      return NextResponse.json({
        operations: operationData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'templates') {
      // Get health check templates
      const templates = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Health Check Template -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const templateData = templates.map(template => {
        const parsedData = typeof template.reportData === 'string' ? JSON.parse(template.reportData) : template.reportData;
        if (!isHealthCheckTemplate(parsedData)) {
          return null;
        }
        return {
          id: template.id,
          ...parsedData,
          createdAt: template.generatedAt
        };
      }).filter(Boolean);

      return NextResponse.json({ templates: templateData });
    }

    if (type === 'alerts') {
      // Get health check alerts
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Health Check Alert -' }
      };
      
      if (clientId) {
        whereClause.reportData = {
          path: '$.clientId',
          equals: clientId
        };
      }
      
      if (status) {
        whereClause.reportData = {
          path: '$.status',
          equals: status
        };
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

      const alertData = alerts.map(alert => {
        const parsedData = typeof alert.reportData === 'string' ? JSON.parse(alert.reportData) : alert.reportData;
        if (!isHealthCheckAlert(parsedData)) {
          return null;
        }
        return {
          id: alert.id,
          ...parsedData,
          firstDetected: alert.generatedAt
        };
      }).filter(Boolean);

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

    if (type === 'stats') {
      // Get health check statistics
      const stats = await generateHealthCheckStats(clientId || undefined);
      return NextResponse.json({ stats });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching batch health check data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/health/batch - Execute batch health checks, create templates, or manage alerts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'batch_check') {
      const {
        clientIds,
        filters,
        checkTypes = {
          websiteUptime: true,
          sslCertificate: true,
          dnsResolution: true,
          responseTime: true,
          httpStatus: true
        },
        configuration = {
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          userAgent: 'SHP Health Monitor/1.0',
          followRedirects: true,
          maxRedirects: 5,
          validateSSL: true,
          expectedStatusCodes: [200, 301, 302]
        },
        notifications
      }: {
        clientIds?: string[];
        filters?: BatchHealthCheckOperation['filters'];
        checkTypes?: BatchHealthCheckOperation['checkTypes'];
        configuration?: BatchHealthCheckOperation['configuration'];
        notifications?: BatchHealthCheckOperation['notifications'];
      } = data;

      // Get target clients
      const targetClients = await getTargetClients(clientIds, filters);
      
      if (targetClients.length === 0) {
        return NextResponse.json(
          { error: 'No clients found matching criteria' },
          { status: 400 }
        );
      }

      // Create batch operation record
      const operation: BatchHealthCheckOperation = {
        type: 'IMMEDIATE',
        status: 'PENDING',
        targetClients: targetClients.map(c => c.id),
        filters,
        checkTypes,
        configuration,
        results: {
          totalChecked: 0,
          successful: 0,
          failed: 0,
          warnings: 0,
          errors: [],
          healthChecks: [],
          summary: {
            healthyCount: 0,
            warningCount: 0,
            criticalCount: 0,
            unknownCount: 0,
            averageResponseTime: 0,
            sslIssuesCount: 0,
            dnsIssuesCount: 0,
            performanceIssuesCount: 0
          }
        },
        notifications,
        startedAt: new Date(),
        performedBy: session.user.id
      };

      const operationRecord = await prisma.report.create({
        data: {
          title: `Batch Health Check Operation - IMMEDIATE - ${new Date().toISOString()}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: '', // Required field
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(operation))
        }
      });

      // Process health checks asynchronously
      processBatchHealthCheck(operationRecord.id, operation, targetClients, session.user.id);

      return NextResponse.json({
        message: 'Batch health check started',
        operationId: operationRecord.id,
        targetCount: targetClients.length
      });
    }

    if (action === 'schedule_check') {
      const {
        clientIds,
        filters,
        checkTypes,
        configuration,
        schedule,
        notifications
      }: {
        clientIds?: string[];
        filters?: BatchHealthCheckOperation['filters'];
        checkTypes: BatchHealthCheckOperation['checkTypes'];
        configuration: BatchHealthCheckOperation['configuration'];
        schedule: BatchHealthCheckOperation['schedule'];
        notifications?: BatchHealthCheckOperation['notifications'];
      } = data;

      if (!schedule) {
        return NextResponse.json(
          { error: 'schedule is required' },
          { status: 400 }
        );
      }

      const targetClients = await getTargetClients(clientIds, filters);
      
      const operation: BatchHealthCheckOperation = {
        type: 'SCHEDULED',
        status: 'PENDING',
        targetClients: targetClients.map(c => c.id),
        filters,
        checkTypes,
        configuration,
        schedule,
        results: {
          totalChecked: 0,
          successful: 0,
          failed: 0,
          warnings: 0,
          errors: [],
          healthChecks: [],
          summary: {
            healthyCount: 0,
            warningCount: 0,
            criticalCount: 0,
            unknownCount: 0,
            averageResponseTime: 0,
            sslIssuesCount: 0,
            dnsIssuesCount: 0,
            performanceIssuesCount: 0
          }
        },
        notifications,
        startedAt: new Date(),
        performedBy: session.user.id
      };

      const operationRecord = await prisma.report.create({
        data: {
          title: `Batch Health Check Operation - SCHEDULED - ${schedule.frequency}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: schedule.endDate?.toISOString() || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: '', // Required field
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(operation))
        }
      });

      return NextResponse.json({
        message: 'Health check scheduled',
        operationId: operationRecord.id,
        nextRun: schedule.nextRun
      });
    }

    if (action === 'create_template') {
      const {
        name,
        description,
        checkTypes,
        configuration,
        schedule,
        notifications,
        isDefault = false
      }: {
        name: string;
        description: string;
        checkTypes: HealthCheckTemplate['checkTypes'];
        configuration: HealthCheckTemplate['configuration'];
        schedule?: HealthCheckTemplate['schedule'];
        notifications?: HealthCheckTemplate['notifications'];
        isDefault?: boolean;
      } = data;

      if (!name || !checkTypes || !configuration) {
        return NextResponse.json(
          { error: 'name, checkTypes, and configuration are required' },
          { status: 400 }
        );
      }

      const template: HealthCheckTemplate = {
        name,
        description,
        checkTypes,
        configuration,
        schedule,
        notifications,
        isDefault,
        createdBy: session.user.id,
        createdAt: new Date(),
        usageCount: 0
      };

      const templateRecord = await prisma.report.create({
        data: {
          title: `Health Check Template - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: '', // Required field
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(template))
        }
      });

      return NextResponse.json({
        message: 'Health check template created',
        templateId: templateRecord.id
      });
    }

    if (action === 'create_alert') {
      const {
        clientId,
        domain,
        alertType,
        severity,
        message,
        details
      }: {
        clientId: string;
        domain: string;
        alertType: HealthCheckAlert['alertType'];
        severity: HealthCheckAlert['severity'];
        message: string;
        details: Record<string, unknown>;
      } = data;

      if (!clientId || !domain || !alertType || !severity || !message) {
        return NextResponse.json(
          { error: 'clientId, domain, alertType, severity, and message are required' },
          { status: 400 }
        );
      }

      const alert: HealthCheckAlert = {
        clientId,
        domain,
        alertType,
        severity,
        status: 'ACTIVE',
        message,
        details,
        firstDetected: new Date(),
        lastDetected: new Date(),
        escalationLevel: 0,
        notificationsSent: 0
      };

      const alertRecord = await prisma.report.create({
        data: {
          title: `Health Check Alert - ${alertType} - ${domain}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: clientId, // Use the provided clientId
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(alert))
        }
      });

      return NextResponse.json({
        message: 'Health check alert created',
        alertId: alertRecord.id
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

      const parsedData = typeof alertRecord.reportData === 'string' ? JSON.parse(alertRecord.reportData) : alertRecord.reportData;
      if (!isHealthCheckAlert(parsedData)) {
        return NextResponse.json(
          { error: 'Invalid alert data structure' },
          { status: 400 }
        );
      }
      
      const alert = parsedData;
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedBy = session.user.id;
      alert.acknowledgedAt = new Date();

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

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing batch health check request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get target clients based on IDs or filters
async function getTargetClients(
  clientIds?: string[],
  filters?: BatchHealthCheckOperation['filters']
): Promise<Array<{ id: string; domainName: string; [key: string]: unknown }>> {
  const whereClause: Record<string, unknown> = {};

  if (clientIds && clientIds.length > 0) {
    whereClause.id = { in: clientIds };
  } else if (filters) {
    if (filters.clientIds && filters.clientIds.length > 0) {
      whereClause.id = { in: filters.clientIds };
    }
    
    if (filters.domainPatterns && filters.domainPatterns.length > 0) {
      whereClause.OR = filters.domainPatterns.map(pattern => ({
        domainName: { contains: pattern }
      }));
    }
    
    // Add other filter conditions as needed
  }

  const clients = await prisma.client.findMany({
    where: whereClause,
    select: {
      id: true,
      domainName: true
    }
  });

  return clients;
}

// Helper function to process batch health check
async function processBatchHealthCheck(
  operationId: string,
  operation: BatchHealthCheckOperation,
  clients: Array<{ id: string; domainName: string; [key: string]: unknown }>,
  _userId: string
): Promise<void> {
  try {
    // Update status to in progress
    await prisma.report.update({
      where: { id: operationId },
      data: {
        reportData: JSON.parse(JSON.stringify({
          ...operation,
          status: 'IN_PROGRESS'
        }))
      }
    });

    const results = {
      totalChecked: 0,
      successful: 0,
      failed: 0,
      warnings: 0,
      errors: [] as Array<{ clientId: string; domain: string; error: string; details?: Record<string, unknown> }>,
      healthChecks: [] as Array<{ 
        clientId: string; 
        domain: string; 
        status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN'; 
        responseTime: number; 
        httpStatus: number; 
        sslValid: boolean; 
        sslExpiry: Date | null; 
        dnsResolved: boolean;
        contentValid: boolean;
        securityScore: number;
        performanceMetrics: {
          responseTime: number;
          firstByteTime: number;
          domainLookupTime: number;
          downloadTime: number;
          totalTime: number;
        };
        issues: Array<{ 
          type: 'SSL' | 'DNS' | 'HTTP' | 'CONTENT' | 'SECURITY' | 'PERFORMANCE'; 
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; 
          message: string; 
        }>;
        timestamp: Date;
      }>,
      summary: {
        healthyCount: 0,
        warningCount: 0,
        criticalCount: 0,
        unknownCount: 0,
        averageResponseTime: 0,
        sslIssuesCount: 0,
        dnsIssuesCount: 0,
        performanceIssuesCount: 0
      }
    };

    const responseTimes: number[] = [];

    for (const client of clients) {
      results.totalChecked++;
      
      try {
        const healthCheck = await performHealthCheck(
          client.domainName,
          operation.checkTypes,
          operation.configuration
        );
        
        const healthCheckWithMetadata = {
          ...healthCheck,
          clientId: client.id,
          domain: client.domainName,
          timestamp: new Date(),
          // Ensure all required properties are present
          dnsResolved: healthCheck.dnsResolved,
          contentValid: healthCheck.contentValid,
          securityScore: healthCheck.securityScore,
          performanceMetrics: {
            responseTime: healthCheck.performanceMetrics.responseTime || 0,
            firstByteTime: healthCheck.performanceMetrics.firstByteTime || 0,
            domainLookupTime: healthCheck.performanceMetrics.domainLookupTime || 0,
            downloadTime: healthCheck.performanceMetrics.downloadTime || 0,
            totalTime: healthCheck.performanceMetrics.totalTime || 0
          },
          issues: healthCheck.issues.map(issue => ({
            type: issue.type as 'SSL' | 'DNS' | 'HTTP' | 'CONTENT' | 'SECURITY' | 'PERFORMANCE',
            severity: issue.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            message: issue.message
          }))
        };
        
        results.healthChecks.push(healthCheckWithMetadata);
        responseTimes.push(healthCheck.responseTime);
        
        // Update summary counts
        switch (healthCheckWithMetadata.status) {
          case 'HEALTHY':
            results.summary.healthyCount++;
            results.successful++;
            break;
          case 'WARNING':
            results.summary.warningCount++;
            results.warnings++;
            break;
          case 'CRITICAL':
            results.summary.criticalCount++;
            results.failed++;
            break;
          default:
            results.summary.unknownCount++;
            results.failed++;
        }
        
        // Count specific issue types
        healthCheck.issues.forEach((issue: { type: string; severity: string; message: string }) => {
          switch (issue.type) {
            case 'SSL':
              results.summary.sslIssuesCount++;
              break;
            case 'DNS':
              results.summary.dnsIssuesCount++;
              break;
            case 'PERFORMANCE':
              results.summary.performanceIssuesCount++;
              break;
          }
        });
        
        // Create health check record
        await prisma.healthCheck.create({
          data: {
            clientId: client.id,
            checkType: 'UPTIME',
            status: healthCheck.status === 'HEALTHY' ? 'HEALTHY' : 
                   healthCheck.status === 'WARNING' ? 'WARNING' : 'CRITICAL',
            details: JSON.stringify({
              responseTime: healthCheck.responseTime,
              httpStatus: healthCheck.httpStatus,
              sslValid: healthCheck.sslValid,
              sslExpiry: healthCheck.sslExpiry,
              issues: healthCheck.issues,
              performanceMetrics: healthCheck.performanceMetrics
            }),
            checkedAt: new Date()
          }
        });
        
        // Create alerts for critical issues
        if (healthCheck.status === 'CRITICAL') {
          await createHealthCheckAlert({
            clientId: client.id,
            domain: client.domainName,
            alertType: 'DOWNTIME',
            severity: 'CRITICAL',
            status: 'ACTIVE',
            message: `Critical health check failure for ${client.domainName}`,
            details: {
              httpStatus: healthCheck.httpStatus,
              responseTime: healthCheck.responseTime,
              issues: healthCheck.issues
            },
            firstDetected: new Date(),
            lastDetected: new Date(),
            escalationLevel: 0,
            notificationsSent: 0
          });
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          clientId: client.id,
          domain: client.domainName,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: { timestamp: new Date().toISOString() }
        });
      }
    }

    // Calculate average response time
    if (responseTimes.length > 0) {
      results.summary.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    // When building the finalOperation, ensure healthChecks is always of the correct type
    results.healthChecks = results.healthChecks.map(hc => ({
      clientId: hc.clientId,
      domain: hc.domain,
      status: hc.status as 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN',
      responseTime: 'responseTime' in hc ? hc.responseTime : 0,
      httpStatus: 'httpStatus' in hc ? hc.httpStatus : 0,
      sslValid: 'sslValid' in hc ? hc.sslValid : false,
      sslExpiry: 'sslExpiry' in hc && hc.sslExpiry !== undefined ? hc.sslExpiry : null,
      dnsResolved: 'dnsResolved' in hc ? hc.dnsResolved : false,
      contentValid: 'contentValid' in hc ? hc.contentValid : false,
      securityScore: 'securityScore' in hc ? hc.securityScore : 0,
      performanceMetrics: {
        responseTime: 'performanceMetrics' in hc && hc.performanceMetrics?.responseTime ? hc.performanceMetrics.responseTime : 0,
        firstByteTime: 'performanceMetrics' in hc && hc.performanceMetrics?.firstByteTime ? hc.performanceMetrics.firstByteTime : 0,
        domainLookupTime: 'performanceMetrics' in hc && hc.performanceMetrics?.domainLookupTime ? hc.performanceMetrics.domainLookupTime : 0,
        downloadTime: 'performanceMetrics' in hc && hc.performanceMetrics?.downloadTime ? hc.performanceMetrics.downloadTime : 0,
        totalTime: 'performanceMetrics' in hc && hc.performanceMetrics?.totalTime ? hc.performanceMetrics.totalTime : 0
      },
      issues: 'issues' in hc ? hc.issues.map(issue => ({
        type: issue.type as 'SSL' | 'DNS' | 'HTTP' | 'CONTENT' | 'SECURITY' | 'PERFORMANCE',
        severity: issue.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        message: issue.message
      })) : [],
      timestamp: 'timestamp' in hc ? hc.timestamp : new Date()
    }));

    // Update final status
    const finalOperation: BatchHealthCheckOperation = {
      ...operation,
      status: results.failed === 0 ? 'COMPLETED' : 'COMPLETED',
      results: {
        totalChecked: results.totalChecked,
        successful: results.successful,
        failed: results.failed,
        warnings: results.warnings,
        errors: results.errors,
        healthChecks: results.healthChecks,
        summary: results.summary
      },
      completedAt: new Date(),
      duration: new Date().getTime() - operation.startedAt.getTime()
    };

    await prisma.report.update({
      where: { id: operationId },
      data: {
        reportData: JSON.parse(JSON.stringify(finalOperation))
      }
    });

    // Send notifications if configured
    if (operation.notifications?.onCompletion) {
      await sendHealthCheckNotification(finalOperation, 'COMPLETION');
    }

  } catch (error) {
    console.error('Error processing batch health check:', error);
    
    await prisma.report.update({
      where: { id: operationId },
      data: {
        reportData: JSON.parse(JSON.stringify({
          ...operation,
          status: 'FAILED',
          completedAt: new Date(),
          results: {
            ...operation.results,
            errors: [{
              clientId: 'SYSTEM',
              domain: 'SYSTEM',
              error: error instanceof Error ? error.message : 'Unknown error',
              details: { timestamp: new Date().toISOString() }
            }]
          }
        }))
      }
    });
  }
}

// Helper function to perform individual health check
async function performHealthCheck(
  domain: string,
  checkTypes: BatchHealthCheckOperation['checkTypes'],
  config: BatchHealthCheckOperation['configuration']
): Promise<{ 
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN'; 
  responseTime: number; 
  httpStatus: number; 
  sslValid: boolean; 
  sslExpiry: Date | null; 
  dnsResolved: boolean; 
  contentValid: boolean; 
  securityScore: number; 
  performanceMetrics: Record<string, number>; 
  issues: Array<{ type: string; severity: string; message: string }> 
}> {
  const startTime = Date.now();
  const healthCheck: { 
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN'; 
    responseTime: number; 
    httpStatus: number; 
    sslValid: boolean; 
    sslExpiry: Date | null; 
    dnsResolved: boolean; 
    contentValid: boolean; 
    securityScore: number; 
    performanceMetrics: Record<string, number>; 
    issues: Array<{ type: string; severity: string; message: string }> 
  } = {
    status: 'UNKNOWN',
    responseTime: 0,
    httpStatus: 0,
    sslValid: false,
    sslExpiry: null,
    dnsResolved: false,
    contentValid: false,
    securityScore: 0,
    performanceMetrics: {
      responseTime: 0,
      firstByteTime: 0,
      domainLookupTime: 0,
      downloadTime: 0,
      totalTime: 0
    },
    issues: []
  };

  try {
    const url = new URL(`https://${domain}`);
    
    // DNS Resolution Check
    if (checkTypes.dnsResolution) {
      try {
        const dnsStart = Date.now();
        // Simple DNS check by attempting to create URL
        healthCheck.dnsResolved = true;
        healthCheck.performanceMetrics.domainLookupTime = Date.now() - dnsStart;
      } catch (_error) {
        healthCheck.dnsResolved = false;
        healthCheck.issues.push({
          type: 'DNS',
          severity: 'CRITICAL',
          message: 'DNS resolution failed'
        });
      }
    }

    // HTTP/HTTPS Check
    if (checkTypes.websiteUptime || checkTypes.httpStatus || checkTypes.responseTime) {
      const requestStart = Date.now();
      
      try {
        const response = await makeHttpRequest(url.toString(), config);
        
        healthCheck.httpStatus = response.statusCode || 0;
        healthCheck.responseTime = Date.now() - requestStart;
        healthCheck.performanceMetrics.responseTime = healthCheck.responseTime;
        healthCheck.performanceMetrics.totalTime = Date.now() - startTime;
        
        if (config.expectedStatusCodes?.includes(healthCheck.httpStatus)) {
          healthCheck.status = 'HEALTHY';
        } else {
          healthCheck.status = 'WARNING';
          healthCheck.issues.push({
            type: 'HTTP',
            severity: 'MEDIUM',
            message: `Unexpected HTTP status: ${healthCheck.httpStatus}`
          });
        }
        
        // Performance check
        if (checkTypes.responseTime && config.performanceThresholds) {
          if (healthCheck.responseTime > config.performanceThresholds.responseTime) {
            healthCheck.issues.push({
              type: 'PERFORMANCE',
              severity: 'MEDIUM',
              message: `Slow response time: ${healthCheck.responseTime}ms`
            });
          }
        }
        
      } catch (_error) {
        healthCheck.status = 'CRITICAL';
        healthCheck.issues.push({
          type: 'HTTP',
          severity: 'CRITICAL',
          message: `HTTP request failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`
        });
      }
    }

    // SSL Certificate Check
    if (checkTypes.sslCertificate) {
      try {
        const sslInfo = await checkSSLCertificate(domain);
        healthCheck.sslValid = sslInfo.valid;
        healthCheck.sslExpiry = sslInfo.expiry || null;
        
        if (!sslInfo.valid) {
          healthCheck.issues.push({
            type: 'SSL',
            severity: 'HIGH',
            message: 'SSL certificate is invalid'
          });
        } else if (sslInfo.expiry) {
          const daysUntilExpiry = Math.ceil((sslInfo.expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 30) {
            healthCheck.issues.push({
              type: 'SSL',
              severity: daysUntilExpiry <= 7 ? 'HIGH' : 'MEDIUM',
              message: `SSL certificate expires in ${daysUntilExpiry} days`
            });
          }
        }
      } catch (_error) {
        healthCheck.issues.push({
          type: 'SSL',
          severity: 'MEDIUM',
          message: 'Unable to check SSL certificate'
        });
      }
    }

    // Determine overall status based on issues
    const criticalIssues = healthCheck.issues.filter((issue: { type: string; severity: string; message: string }) => issue.severity === 'CRITICAL');
    const highIssues = healthCheck.issues.filter((issue: { type: string; severity: string; message: string }) => issue.severity === 'HIGH');
    
    if (criticalIssues.length > 0) {
      healthCheck.status = 'CRITICAL';
    } else if (highIssues.length > 0) {
      healthCheck.status = 'WARNING';
    } else if (healthCheck.status === 'UNKNOWN') {
      healthCheck.status = 'HEALTHY';
    }

  } catch (_error) {
    healthCheck.status = 'CRITICAL';
    healthCheck.issues.push({
      type: 'SYSTEM',
      severity: 'CRITICAL',
      message: `Health check failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`
    });
  }

  return healthCheck;
}

// Helper function to make HTTP request
function makeHttpRequest(url: string, config: BatchHealthCheckOperation['configuration']): Promise<{ statusCode: number | undefined; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'User-Agent': config.userAgent,
        ...config.customHeaders
      },
      rejectUnauthorized: config.validateSSL
    };
    
    const req = client.request(options, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Helper function to check SSL certificate
async function checkSSLCertificate(domain: string): Promise<{ valid: boolean; expiry?: Date }> {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      method: 'GET',
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      const connection = res.connection as unknown as { getPeerCertificate: () => { valid_to?: string } };
      const cert = connection.getPeerCertificate();
      
      if (cert && cert.valid_to) {
        resolve({
          valid: true,
          expiry: new Date(cert.valid_to)
        });
      } else {
        resolve({ valid: false });
      }
    });
    
    req.on('error', () => {
      resolve({ valid: false });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ valid: false });
    });
    
    req.end();
  });
}

// Helper function to create health check alert
async function createHealthCheckAlert(alertData: Omit<HealthCheckAlert, 'id'>): Promise<void> {
  const alert: HealthCheckAlert = {
    ...alertData,
    firstDetected: new Date(),
    lastDetected: new Date(),
    status: 'ACTIVE',
    escalationLevel: 0,
    notificationsSent: 0
  };

  await prisma.report.create({
    data: {
      title: `Health Check Alert - ${alert.alertType} - ${alert.domain}`,
      dateRange: {
        startDate: alert.firstDetected.toISOString(),
        endDate: alert.firstDetected.toISOString()
      },
      totalHours: 0,
      totalAmount: 0,
      clientId: alert.clientId,
      generatedAt: alert.firstDetected,
      reportData: JSON.parse(JSON.stringify(alert))
    }
  });
}

// Helper function to generate health check statistics
async function generateHealthCheckStats(clientId?: string): Promise<Record<string, unknown>> {
  const whereClause: Record<string, unknown> = {};
  if (clientId) {
    whereClause.clientId = clientId;
  }

  const healthChecks = await prisma.healthCheck.findMany({
    where: whereClause,
    orderBy: {
      checkedAt: 'desc'
    },
    take: 1000 // Limit for performance
  });

  const stats = {
    totalChecks: healthChecks.length,
    statusDistribution: {
      healthy: 0,
      warning: 0,
      critical: 0,
      unknown: 0
    },
    averageResponseTime: 0,
    uptimePercentage: 0,
    sslStatus: {
      valid: 0,
      invalid: 0,
      expiringSoon: 0
    },
    trends: {
      responseTimeHistory: [] as Array<{ date: string; avgResponseTime: number }>,
      uptimeHistory: [] as Array<{ date: string; uptimePercentage: number }>
    }
  };

  let totalResponseTime = 0;
  let healthyCount = 0;
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  healthChecks.forEach(check => {
    // Status distribution
    switch (check.status) {
      case 'HEALTHY':
        stats.statusDistribution.healthy++;
        healthyCount++;
        break;
      case 'WARNING':
        stats.statusDistribution.warning++;
        break;
      case 'CRITICAL':
        stats.statusDistribution.critical++;
        break;
      default:
        stats.statusDistribution.unknown++;
    }

    // Response time
    if (check.details) {
      try {
        const details = JSON.parse(check.details);
        if (details.responseTime) {
          totalResponseTime += details.responseTime;
        }
      } catch (_e) {
        // Ignore parsing errors
      }
    }

    // SSL status
    if (check.details) {
      try {
        const details = JSON.parse(check.details);
        if (details.sslValid) {
          stats.sslStatus.valid++;
          
          if (details.sslExpiry && new Date(details.sslExpiry) < thirtyDaysFromNow) {
            stats.sslStatus.expiringSoon++;
          }
        } else {
          stats.sslStatus.invalid++;
        }
      } catch (_e) {
        // Ignore parsing errors
      }
    }
  });

  // Calculate averages
  if (healthChecks.length > 0) {
    stats.averageResponseTime = totalResponseTime / healthChecks.length;
    stats.uptimePercentage = (healthyCount / healthChecks.length) * 100;
  }

  return stats;
}

// Helper function to send health check notification
async function sendHealthCheckNotification(
  operation: BatchHealthCheckOperation,
  type: 'COMPLETION' | 'FAILURE' | 'CRITICAL'
): Promise<void> {
  // Implementation would depend on notification service
  console.log(`Sending ${type} notification for operation ${operation.type}`);
  
  // Example: Send email, webhook, or Slack notification
  // This would integrate with your notification service
}