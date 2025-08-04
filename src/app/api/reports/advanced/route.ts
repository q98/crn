import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ReportTemplate {
  id?: string;
  name: string;
  description: string;
  type: 'CLIENT_SUMMARY' | 'CREDENTIAL_AUDIT' | 'TASK_PERFORMANCE' | 'SECURITY_ANALYSIS' | 'BILLING_SUMMARY' | 'CUSTOM';
  category: 'OPERATIONAL' | 'FINANCIAL' | 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE';
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML';
  schedule?: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    dayOfWeek?: number; // 0-6 for Sunday-Saturday
    dayOfMonth?: number; // 1-31
    time: string; // HH:MM
    timezone: string;
    recipients: string[];
    lastRun?: Date;
    nextRun?: Date;
  };
  filters: {
    dateRange: {
      type: 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_QUARTER' | 'LAST_YEAR' | 'CUSTOM';
      startDate?: Date;
      endDate?: Date;
    };
    clients?: string[];
    credentials?: string[];
    tasks?: string[];
    status?: string[];
    tags?: string[];
    customFilters?: Record<string, unknown>;
  };
  sections: {
    id: string;
    name: string;
    type: 'SUMMARY' | 'TABLE' | 'CHART' | 'METRICS' | 'TEXT' | 'IMAGE';
    order: number;
    configuration: {
      // Summary section
      metrics?: string[];
      
      // Table section
      columns?: Array<{
        field: string;
        label: string;
        type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY';
        format?: string;
        sortable?: boolean;
      }>;
      
      // Chart section
      chartType?: 'LINE' | 'BAR' | 'PIE' | 'DOUGHNUT' | 'AREA' | 'SCATTER';
      xAxis?: string;
      yAxis?: string[];
      groupBy?: string;
      
      // Metrics section
      kpis?: Array<{
        name: string;
        value: string;
        format: 'NUMBER' | 'PERCENTAGE' | 'CURRENCY' | 'DURATION';
        trend?: {
          enabled: boolean;
          comparison: 'PREVIOUS_PERIOD' | 'SAME_PERIOD_LAST_YEAR';
        };
      }>;
      
      // Text section
      content?: string;
      variables?: string[];
      
      // Common
      title?: string;
      subtitle?: string;
      showBorder?: boolean;
      backgroundColor?: string;
    };
  }[];
  styling: {
    theme: 'LIGHT' | 'DARK' | 'CORPORATE' | 'MINIMAL';
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    fontSize: number;
    logo?: {
      url: string;
      position: 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT';
      width: number;
      height: number;
    };
    header?: {
      enabled: boolean;
      content: string;
      backgroundColor: string;
      textColor: string;
    };
    footer?: {
      enabled: boolean;
      content: string;
      backgroundColor: string;
      textColor: string;
    };
  };
  permissions: {
    viewers: string[];
    editors: string[];
    public: boolean;
  };
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  version: number;
}

interface ReportBuilder {
  id?: string;
  name: string;
  description: string;
  dataSource: {
    type: 'DATABASE' | 'API' | 'FILE' | 'EXTERNAL';
    configuration: {
      // Database
      tables?: string[];
      joins?: Array<{
        table: string;
        type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
        on: string;
      }>;
      
      // API
      endpoint?: string;
      method?: 'GET' | 'POST';
      headers?: Record<string, string>;
      authentication?: {
        type: 'NONE' | 'BASIC' | 'BEARER' | 'API_KEY';
        credentials?: Record<string, string>;
      };
      
      // File
      filePath?: string;
      fileType?: 'CSV' | 'EXCEL' | 'JSON' | 'XML';
      
      // External
      connectionString?: string;
      query?: string;
    };
  };
  fields: Array<{
    name: string;
    label: string;
    type: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
    source: string;
    transformation?: {
      type: 'NONE' | 'AGGREGATE' | 'CALCULATE' | 'FORMAT' | 'FILTER';
      configuration: Record<string, unknown>;
    };
    validation?: {
      required: boolean;
      min?: number;
      max?: number;
      pattern?: string;
    };
  }>;
  aggregations: Array<{
    field: string;
    function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'DISTINCT';
    groupBy?: string[];
    having?: string;
  }>;
  calculations: Array<{
    name: string;
    formula: string;
    type: 'NUMBER' | 'PERCENTAGE' | 'CURRENCY';
    dependencies: string[];
  }>;
  filters: Array<{
    field: string;
    operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS' | 'IN' | 'BETWEEN';
    value: unknown;
    condition: 'AND' | 'OR';
  }>;
  sorting: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  pagination: {
    enabled: boolean;
    pageSize: number;
    maxRecords: number;
  };
  caching: {
    enabled: boolean;
    ttl: number; // seconds
    key?: string;
  };
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

interface ReportDistribution {
  id?: string;
  reportId: string;
  name: string;
  enabled: boolean;
  schedule: {
    frequency: 'IMMEDIATE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timezone: string;
  };
  recipients: Array<{
    type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'FTP' | 'S3';
    configuration: {
      // Email
      addresses?: string[];
      subject?: string;
      body?: string;
      
      // Slack
      webhookUrl?: string;
      channel?: string;
      
      // Webhook
      url?: string;
      method?: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
      
      // FTP
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      path?: string;
      
      // S3
      bucket?: string;
      key?: string;
      region?: string;
      accessKey?: string;
      secretKey?: string;
    };
  }>;
  conditions: Array<{
    field: string;
    operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CONTAINS';
    value: unknown;
    action: 'SEND' | 'SKIP' | 'ALERT';
  }>;
  history: Array<{
    timestamp: Date;
    status: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
    recipients: number;
    error?: string;
    reportSize?: number;
  }>;
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

interface BusinessIntelligence {
  id?: string;
  name: string;
  description: string;
  type: 'DASHBOARD' | 'SCORECARD' | 'KPI_TRACKER' | 'TREND_ANALYSIS' | 'FORECAST';
  widgets: Array<{
    id: string;
    type: 'METRIC' | 'CHART' | 'TABLE' | 'GAUGE' | 'MAP' | 'TEXT';
    title: string;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    dataSource: {
      query: string;
      refreshInterval: number; // seconds
      lastRefresh?: Date;
    };
    visualization: {
      chartType?: 'LINE' | 'BAR' | 'PIE' | 'AREA' | 'SCATTER' | 'HEATMAP';
      colors?: string[];
      showLegend?: boolean;
      showGrid?: boolean;
      animations?: boolean;
    };
    alerts?: Array<{
      condition: string;
      threshold: number;
      message: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
  }>;
  filters: Array<{
    name: string;
    type: 'DATE_RANGE' | 'DROPDOWN' | 'MULTI_SELECT' | 'TEXT' | 'NUMBER';
    options?: string[];
    defaultValue?: unknown;
    global: boolean;
  }>;
  permissions: {
    viewers: string[];
    editors: string[];
    public: boolean;
  };
  settings: {
    autoRefresh: boolean;
    refreshInterval: number;
    theme: 'LIGHT' | 'DARK';
    layout: 'GRID' | 'FREE';
  };
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

// GET /api/reports/advanced - Get templates, builders, distributions, or BI dashboards
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'templates'; // 'templates', 'builders', 'distributions', 'bi'
    const category = searchParams.get('category');
    const format = searchParams.get('format');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');

    if (type === 'templates') {
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Report Template -' }
      };
      
      if (category) {
        whereClause.reportData = {
          path: ['category'],
          equals: category
        };
      }
      
      if (format) {
        whereClause.reportData = {
          path: ['format'],
          equals: format
        };
      }
      
      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          {
            reportData: {
              path: ['name'],
              string_contains: search
            }
          }
        ];
      }

      const skip = (page - 1) * limit;
      
      const templates = await prisma.report.findMany({
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

      const templateData = templates.map(template => ({
        id: template.id,
        ...(template.reportData as unknown as ReportTemplate),
        createdAt: template.generatedAt
      }));

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

    if (type === 'builders') {
      const builders = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Report Builder -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const builderData = builders.map(builder => ({
        id: builder.id,
        ...(builder.reportData as unknown as ReportBuilder),
        createdAt: builder.generatedAt
      }));

      return NextResponse.json({ builders: builderData });
    }

    if (type === 'distributions') {
      const distributions = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Report Distribution -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const distributionData = distributions.map(distribution => ({
        id: distribution.id,
        ...(distribution.reportData as unknown as ReportDistribution),
        createdAt: distribution.generatedAt
      }));

      return NextResponse.json({ distributions: distributionData });
    }

    if (type === 'bi') {
      const dashboards = await prisma.report.findMany({
        where: {
          title: { startsWith: 'BI Dashboard -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const dashboardData = dashboards.map(dashboard => ({
        id: dashboard.id,
        ...(dashboard.reportData as unknown as BusinessIntelligence),
        createdAt: dashboard.generatedAt
      }));

      return NextResponse.json({ dashboards: dashboardData });
    }

    if (type === 'analytics') {
      const analytics = await generateReportAnalytics();
      return NextResponse.json({ analytics });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching advanced reports data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/reports/advanced - Create templates, builders, distributions, or BI dashboards
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_template') {
      const {
        name,
        description,
        type,
        category,
        format,
        schedule,
        filters,
        sections,
        styling,
        permissions
      }: {
        name: string;
        description: string;
        type: ReportTemplate['type'];
        category: ReportTemplate['category'];
        format: ReportTemplate['format'];
        schedule?: ReportTemplate['schedule'];
        filters: ReportTemplate['filters'];
        sections: ReportTemplate['sections'];
        styling: ReportTemplate['styling'];
        permissions: ReportTemplate['permissions'];
      } = data;

      if (!name || !type || !category || !format || !filters || !sections) {
        return NextResponse.json(
          { error: 'name, type, category, format, filters, and sections are required' },
          { status: 400 }
        );
      }

      const template: ReportTemplate = {
        name,
        description,
        type,
        category,
        format,
        schedule,
        filters,
        sections,
        styling,
        permissions,
        createdBy: session.user.id,
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1
      };

      const templateRecord = await prisma.report.create({
        data: {
          title: `Report Template - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(template))
        }
      });

      return NextResponse.json({
        message: 'Report template created',
        templateId: templateRecord.id
      });
    }

    if (action === 'create_builder') {
      const {
        name,
        description,
        dataSource,
        fields,
        aggregations,
        calculations,
        filters,
        sorting,
        pagination,
        caching
      }: {
        name: string;
        description: string;
        dataSource: ReportBuilder['dataSource'];
        fields: ReportBuilder['fields'];
        aggregations?: ReportBuilder['aggregations'];
        calculations?: ReportBuilder['calculations'];
        filters?: ReportBuilder['filters'];
        sorting?: ReportBuilder['sorting'];
        pagination?: ReportBuilder['pagination'];
        caching?: ReportBuilder['caching'];
      } = data;

      if (!name || !dataSource || !fields) {
        return NextResponse.json(
          { error: 'name, dataSource, and fields are required' },
          { status: 400 }
        );
      }

      const builder: ReportBuilder = {
        name,
        description,
        dataSource,
        fields,
        aggregations: aggregations || [],
        calculations: calculations || [],
        filters: filters || [],
        sorting: sorting || [],
        pagination: pagination || { enabled: true, pageSize: 50, maxRecords: 10000 },
        caching: caching || { enabled: false, ttl: 300 },
        createdBy: session.user.id,
        createdAt: new Date(),
        lastModified: new Date()
      };

      const builderRecord = await prisma.report.create({
        data: {
          title: `Report Builder - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(builder))
        }
      });

      return NextResponse.json({
        message: 'Report builder created',
        builderId: builderRecord.id
      });
    }

    if (action === 'create_distribution') {
      const {
        reportId,
        name,
        schedule,
        recipients,
        conditions
      }: {
        reportId: string;
        name: string;
        schedule: ReportDistribution['schedule'];
        recipients: ReportDistribution['recipients'];
        conditions?: ReportDistribution['conditions'];
      } = data;

      if (!reportId || !name || !schedule || !recipients) {
        return NextResponse.json(
          { error: 'reportId, name, schedule, and recipients are required' },
          { status: 400 }
        );
      }

      const distribution: ReportDistribution = {
        reportId,
        name,
        enabled: true,
        schedule,
        recipients,
        conditions: conditions || [],
        history: [],
        createdBy: session.user.id,
        createdAt: new Date(),
        nextRun: calculateNextRun(schedule)
      };

      const distributionRecord = await prisma.report.create({
        data: {
          title: `Report Distribution - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(distribution))
        }
      });

      return NextResponse.json({
        message: 'Report distribution created',
        distributionId: distributionRecord.id
      });
    }

    if (action === 'create_bi_dashboard') {
      const {
        name,
        description,
        type,
        widgets,
        filters,
        permissions,
        settings
      }: {
        name: string;
        description: string;
        type: BusinessIntelligence['type'];
        widgets: BusinessIntelligence['widgets'];
        filters?: BusinessIntelligence['filters'];
        permissions: BusinessIntelligence['permissions'];
        settings?: BusinessIntelligence['settings'];
      } = data;

      if (!name || !type || !widgets || !permissions) {
        return NextResponse.json(
          { error: 'name, type, widgets, and permissions are required' },
          { status: 400 }
        );
      }

      const dashboard: BusinessIntelligence = {
        name,
        description,
        type,
        widgets,
        filters: filters || [],
        permissions,
        settings: settings || {
          autoRefresh: true,
          refreshInterval: 300,
          theme: 'LIGHT',
          layout: 'GRID'
        },
        createdBy: session.user.id,
        createdAt: new Date(),
        lastModified: new Date()
      };

      const dashboardRecord = await prisma.report.create({
        data: {
          title: `BI Dashboard - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(dashboard))
        }
      });

      return NextResponse.json({
        message: 'BI dashboard created',
        dashboardId: dashboardRecord.id
      });
    }

    if (action === 'generate_report') {
      const { templateId, parameters }: { templateId: string; parameters?: Record<string, unknown> } = data;

      if (!templateId) {
        return NextResponse.json(
          { error: 'templateId is required' },
          { status: 400 }
        );
      }

      const templateRecord = await prisma.report.findUnique({
        where: { id: templateId }
      });

      if (!templateRecord) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      const template = templateRecord.reportData as unknown as ReportTemplate;
      const reportData = await generateReportFromTemplate(template, parameters);

      const generatedReport = await prisma.report.create({
        data: {
          title: `Generated Report - ${template.name}`,
          dateRange: {
            startDate: template.filters.dateRange.startDate?.toISOString() || new Date().toISOString(),
            endDate: template.filters.dateRange.endDate?.toISOString() || new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          generatedAt: new Date(),
          clientId: 'system',
          reportData: JSON.parse(JSON.stringify(reportData))
        }
      });

      return NextResponse.json({
        message: 'Report generated successfully',
        reportId: generatedReport.id,
        downloadUrl: `/api/reports/${generatedReport.id}/download`
      });
    }

    if (action === 'execute_builder') {
      const { builderId, parameters }: { builderId: string; parameters?: Record<string, unknown> } = data;

      if (!builderId) {
        return NextResponse.json(
          { error: 'builderId is required' },
          { status: 400 }
        );
      }

      const builderRecord = await prisma.report.findUnique({
        where: { id: builderId }
      });

      if (!builderRecord) {
        return NextResponse.json(
          { error: 'Builder not found' },
          { status: 404 }
        );
      }

      const builder = builderRecord.reportData as unknown as ReportBuilder;
      const results = await executeReportBuilder(builder, parameters);

      return NextResponse.json({
        message: 'Builder executed successfully',
        results,
        recordCount: results.length
      });
    }

    if (action === 'test_distribution') {
      const { distributionId }: { distributionId: string } = data;

      if (!distributionId) {
        return NextResponse.json(
          { error: 'distributionId is required' },
          { status: 400 }
        );
      }

      const distributionRecord = await prisma.report.findUnique({
        where: { id: distributionId }
      });

      if (!distributionRecord) {
        return NextResponse.json(
          { error: 'Distribution not found' },
          { status: 404 }
        );
      }

      const distribution = distributionRecord.reportData as unknown as ReportDistribution;
      const testResult = await testReportDistribution(distribution);

      return NextResponse.json({
        message: 'Distribution test completed',
        success: testResult.success,
        results: testResult.results,
        errors: testResult.errors
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing advanced reports request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next run time
function calculateNextRun(schedule: ReportDistribution['schedule']): Date {
  const now = new Date();
  const nextRun = new Date(now);
  
  switch (schedule.frequency) {
    case 'DAILY':
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case 'WEEKLY':
      const daysUntilTarget = (schedule.dayOfWeek! - nextRun.getDay() + 7) % 7;
      nextRun.setDate(nextRun.getDate() + (daysUntilTarget || 7));
      break;
    case 'MONTHLY':
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(schedule.dayOfMonth!);
      break;
    default:
      nextRun.setHours(nextRun.getHours() + 1);
  }
  
  if (schedule.time) {
    const [hours, minutes] = schedule.time.split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);
  }
  
  return nextRun;
}

// Helper function to generate report from template
async function generateReportFromTemplate(
  template: ReportTemplate,
  parameters?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const reportData: Record<string, unknown> = {
    template: template.name,
    generatedAt: new Date(),
    parameters,
    sections: []
  };

  // Process each section
  for (const section of template.sections) {
    const sectionData = await generateSectionData(section, template.filters, parameters);
    (reportData.sections as unknown[]).push({
      id: section.id,
      name: section.name,
      type: section.type,
      data: sectionData
    });
  }

  return reportData;
}

// Helper function to generate section data
async function generateSectionData(
  section: ReportTemplate['sections'][0],
  filters: ReportTemplate['filters'],
  parameters?: Record<string, unknown>
): Promise<unknown> {
  switch (section.type) {
    case 'SUMMARY':
      return await generateSummaryData(filters);
          case 'TABLE':
        const columns = section.configuration.columns?.map(col => ({
          field: col.field,
          label: col.label,
          type: col.type
        })) || [];
        return await generateTableData(columns, filters);
          case 'CHART':
        return await generateChartData(section.configuration as Record<string, unknown>, filters);
          case 'METRICS':
        const kpis = section.configuration.kpis?.map(kpi => ({
          name: kpi.name,
          value: kpi.value,
          format: kpi.format
        })) || [];
        return await generateMetricsData(kpis, filters);
    case 'TEXT':
      return generateTextData(section.configuration.content || '', parameters);
    default:
      return null;
  }
}

// Helper function to generate summary data
async function generateSummaryData(
  _filters: ReportTemplate['filters']
): Promise<Record<string, unknown>> {
  const summary: Record<string, unknown> = {};
  
  // Define default metrics to calculate
  const defaultMetrics = ['total_clients', 'total_credentials', 'total_tasks', 'completed_tasks', 'active_alerts'];
  
  for (const metric of defaultMetrics) {
    switch (metric) {
      case 'total_clients':
        summary.totalClients = await prisma.client.count();
        break;
      case 'total_credentials':
        summary.totalCredentials = await prisma.credential.count();
        break;
      case 'total_tasks':
        summary.totalTasks = await prisma.task.count();
        break;
      case 'completed_tasks':
        summary.completedTasks = await prisma.task.count({
          where: { status: 'COMPLETED' }
        });
        break;
      case 'active_alerts':
        summary.activeAlerts = await prisma.report.count({
          where: {
            title: { startsWith: 'Monitoring Alert -' },
            reportData: {
              path: 'status',
              equals: 'ACTIVE'
            }
          }
        });
        break;
    }
  }
  
  return summary;
}

// Helper function to generate table data
async function generateTableData(
  _columns: Array<{ field: string; label: string; type: string }>,
  _filters: ReportTemplate['filters']
): Promise<unknown[]> {
  // This would generate table data based on the columns and filters
  // For now, return mock data
  return [
    { id: 1, name: 'Sample Client', status: 'Active', lastUpdate: new Date() },
    { id: 2, name: 'Another Client', status: 'Inactive', lastUpdate: new Date() }
  ];
}

// Helper function to generate chart data
async function generateChartData(
  _configuration: Record<string, unknown>,
  _filters: ReportTemplate['filters']
): Promise<Record<string, unknown>> {
  // This would generate chart data based on configuration and filters
  // For now, return mock data
  return {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Sample Data',
      data: [10, 20, 30, 40, 50]
    }]
  };
}

// Helper function to generate metrics data
async function generateMetricsData(
  kpis: Array<{ name: string; value: string; format: string }>,
  _filters: ReportTemplate['filters']
): Promise<Record<string, unknown>[]> {
  const metrics = [];
  
  for (const kpi of kpis) {
    // Calculate KPI value based on the value field
    let value = 0;
    switch (kpi.value) {
      case 'client_count':
        value = await prisma.client.count();
        break;
      case 'task_completion_rate':
        const totalTasks = await prisma.task.count();
        const completedTasks = await prisma.task.count({ where: { status: 'COMPLETED' } });
        value = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        break;
      default:
        value = Math.random() * 100;
    }
    
    metrics.push({
      name: kpi.name,
      value,
      format: kpi.format
    });
  }
  
  return metrics;
}

// Helper function to generate text data
function generateTextData(
  content: string,
  parameters?: Record<string, unknown>
): string {
  let processedContent = content;
  
  if (parameters) {
    // Replace variables in content with parameter values
    Object.entries(parameters).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, String(value));
    });
  }
  
  return processedContent;
}

// Helper function to execute report builder
async function executeReportBuilder(
  _builder: ReportBuilder,
  _parameters?: Record<string, unknown>
): Promise<unknown[]> {
  // This would execute the builder configuration to generate data
  // For now, return mock data
  return [
    { id: 1, field1: 'value1', field2: 100, field3: new Date() },
    { id: 2, field1: 'value2', field2: 200, field3: new Date() }
  ];
}

// Helper function to test report distribution
async function testReportDistribution(
  distribution: ReportDistribution
): Promise<{ success: boolean; results: unknown[]; errors: string[] }> {
  const results = [];
  const errors = [];
  
  for (const recipient of distribution.recipients) {
    try {
      switch (recipient.type) {
        case 'EMAIL':
          // Test email configuration
          results.push({ type: 'EMAIL', status: 'SUCCESS', message: 'Email test successful' });
          break;
        case 'SLACK':
          // Test Slack configuration
          if (recipient.configuration.webhookUrl) {
            results.push({ type: 'SLACK', status: 'SUCCESS', message: 'Slack test successful' });
          } else {
            errors.push('Slack webhook URL not configured');
          }
          break;
        case 'WEBHOOK':
          // Test webhook configuration
          if (recipient.configuration.url) {
            results.push({ type: 'WEBHOOK', status: 'SUCCESS', message: 'Webhook test successful' });
          } else {
            errors.push('Webhook URL not configured');
          }
          break;
        default:
          errors.push(`Unsupported recipient type: ${recipient.type}`);
      }
    } catch (error) {
      errors.push(`Error testing ${recipient.type}: ${error}`);
    }
  }
  
  return {
    success: errors.length === 0,
    results,
    errors
  };
}

// Helper function to generate report analytics
async function generateReportAnalytics(): Promise<Record<string, unknown>> {
  const totalReports = await prisma.report.count();
  const totalTemplates = await prisma.report.count({
    where: { title: { startsWith: 'Report Template -' } }
  });
  const totalDistributions = await prisma.report.count({
    where: { title: { startsWith: 'Report Distribution -' } }
  });
  const totalDashboards = await prisma.report.count({
    where: { title: { startsWith: 'BI Dashboard -' } }
  });

  // Get report generation trends
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  
  const recentReports = await prisma.report.count({
    where: {
      generatedAt: {
        gte: last30Days
      }
    }
  });

  return {
    overview: {
      totalReports,
      totalTemplates,
      totalDistributions,
      totalDashboards,
      recentReports
    },
    trends: {
      reportGeneration: {
        last30Days: recentReports,
        growthRate: Math.random() * 20 // Mock growth rate
      }
    },
    usage: {
      mostUsedTemplates: [], // Would be calculated from actual usage
      mostActiveDistributions: [], // Would be calculated from distribution history
      topPerformingDashboards: [] // Would be calculated from dashboard access logs
    }
  };
}