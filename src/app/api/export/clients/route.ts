import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../lib/prisma';
import { VerificationStatus } from '@prisma/client';

interface ExportFilters {
  verificationStatus?: VerificationStatus[];
  registrar?: string[];
  dateFrom?: string;
  dateTo?: string;
  hasCredentials?: boolean;
  hasTasks?: boolean;
  minHoursUsed?: number;
  maxHoursUsed?: number;
}

interface ClientExportData {
  domainName: string;
  cPanelUsername: string | null;
  diskUsage: string | null;
  verificationStatus: string;
  registrar: string | null;
  notes: string | null;
  annualHourAllowance: number;
  yearlyHoursUsed: number;
  createdAt: string;
  updatedAt: string;
  credentialsCount: number;
  tasksCount: number;
  completedTasksCount: number;
  totalTimeSpent: number; // in hours
  lastActivity: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const filters = parseFilters(searchParams);

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: csv, json' },
        { status: 400 }
      );
    }

    // Build where clause for filtering
    const whereClause = buildWhereClause(filters);

    // Fetch clients with related data
    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
        credentials: {
          select: { id: true }
        },
        tasks: {
          select: {
            id: true,
            status: true,
            timeEntries: {
              select: {
                duration: true
              }
            }
          }
        },
        _count: {
          select: {
            credentials: true,
            tasks: true
          }
        }
      },
      orderBy: {
        domainName: 'asc'
      }
    });

    // Transform data for export
    const exportData: ClientExportData[] = clients.map(client => {
      const completedTasks = client.tasks.filter(task => task.status === 'COMPLETED');
      const totalMinutes = client.tasks.reduce((total, task) => {
        return total + task.timeEntries.reduce((taskTotal, entry) => {
          return taskTotal + (entry.duration || 0);
        }, 0);
      }, 0);
      
      const lastTaskDate = client.tasks.length > 0 
        ? client.tasks.reduce((latest, task) => {
            const taskDate = new Date(task.timeEntries.length > 0 
              ? Math.max(...task.timeEntries.map(() => Date.now())) 
              : 0);
            return taskDate > latest ? taskDate : latest;
          }, new Date(0))
        : null;

      return {
        domainName: client.domainName,
        cPanelUsername: client.cPanelUsername,
        diskUsage: client.diskUsage,
        verificationStatus: client.verificationStatus,
        registrar: client.registrar,
        notes: client.notes,
        annualHourAllowance: client.annualHourAllowance,
        yearlyHoursUsed: client.yearlyHoursUsed,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
        credentialsCount: client._count.credentials,
        tasksCount: client._count.tasks,
        completedTasksCount: completedTasks.length,
        totalTimeSpent: Math.round((totalMinutes / 60) * 100) / 100, // Convert to hours with 2 decimal places
        lastActivity: lastTaskDate ? lastTaskDate.toISOString() : null
      };
    });

    // Generate response based on format
    if (format === 'json') {
      return NextResponse.json({
        data: exportData,
        metadata: {
          totalRecords: exportData.length,
          exportedAt: new Date().toISOString(),
          filters: filters
        }
      });
    } else {
      // Generate CSV
      const csv = generateCSV(exportData);
      const filename = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

  } catch (error: unknown) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function parseFilters(searchParams: URLSearchParams): ExportFilters {
  const filters: ExportFilters = {};

  // Verification status filter
  const statusParam = searchParams.get('verificationStatus');
  if (statusParam) {
    filters.verificationStatus = statusParam.split(',') as VerificationStatus[];
  }

  // Registrar filter
  const registrarParam = searchParams.get('registrar');
  if (registrarParam) {
    filters.registrar = registrarParam.split(',');
  }

  // Date range filters
  const dateFrom = searchParams.get('dateFrom');
  if (dateFrom) {
    filters.dateFrom = dateFrom;
  }

  const dateTo = searchParams.get('dateTo');
  if (dateTo) {
    filters.dateTo = dateTo;
  }

  // Boolean filters
  const hasCredentials = searchParams.get('hasCredentials');
  if (hasCredentials !== null) {
    filters.hasCredentials = hasCredentials === 'true';
  }

  const hasTasks = searchParams.get('hasTasks');
  if (hasTasks !== null) {
    filters.hasTasks = hasTasks === 'true';
  }

  // Hours used filters
  const minHours = searchParams.get('minHoursUsed');
  if (minHours) {
    filters.minHoursUsed = parseFloat(minHours);
  }

  const maxHours = searchParams.get('maxHoursUsed');
  if (maxHours) {
    filters.maxHoursUsed = parseFloat(maxHours);
  }

  return filters;
}

function buildWhereClause(filters: ExportFilters) {
  const where: Record<string, unknown> = {};

  // Verification status filter
  if (filters.verificationStatus && filters.verificationStatus.length > 0) {
    where.verificationStatus = {
      in: filters.verificationStatus
    };
  }

  // Registrar filter
  if (filters.registrar && filters.registrar.length > 0) {
    where.registrar = {
      in: filters.registrar
    };
  }

  // Date range filters
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) {
      dateFilter.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      dateFilter.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    where.createdAt = dateFilter;
  }

  // Credentials filter
  if (filters.hasCredentials !== undefined) {
    if (filters.hasCredentials) {
      where.credentials = {
        some: {}
      };
    } else {
      where.credentials = {
        none: {}
      };
    }
  }

  // Tasks filter
  if (filters.hasTasks !== undefined) {
    if (filters.hasTasks) {
      where.tasks = {
        some: {}
      };
    } else {
      where.tasks = {
        none: {}
      };
    }
  }

  // Hours used filters
  if (filters.minHoursUsed !== undefined || filters.maxHoursUsed !== undefined) {
    const hoursFilter: Record<string, number> = {};
    if (filters.minHoursUsed !== undefined) {
      hoursFilter.gte = filters.minHoursUsed;
    }
    if (filters.maxHoursUsed !== undefined) {
      hoursFilter.lte = filters.maxHoursUsed;
    }
    where.yearlyHoursUsed = hoursFilter;
  }

  return where;
}

function generateCSV(data: ClientExportData[]): string {
  if (data.length === 0) {
    return 'No data to export';
  }

  // CSV headers
  const headers = [
    'Domain Name',
    'cPanel Username',
    'Disk Usage',
    'Verification Status',
    'Registrar',
    'Notes',
    'Annual Hour Allowance',
    'Yearly Hours Used',
    'Created At',
    'Updated At',
    'Credentials Count',
    'Tasks Count',
    'Completed Tasks Count',
    'Total Time Spent (Hours)',
    'Last Activity'
  ];

  // Generate CSV content
  const csvContent = [headers.join(',')];
  
  data.forEach(row => {
    const csvRow = [
      escapeCSVField(row.domainName),
      escapeCSVField(row.cPanelUsername || ''),
      escapeCSVField(row.diskUsage || ''),
      escapeCSVField(row.verificationStatus),
      escapeCSVField(row.registrar || ''),
      escapeCSVField(row.notes || ''),
      row.annualHourAllowance.toString(),
      row.yearlyHoursUsed.toString(),
      escapeCSVField(row.createdAt),
      escapeCSVField(row.updatedAt),
      row.credentialsCount.toString(),
      row.tasksCount.toString(),
      row.completedTasksCount.toString(),
      row.totalTimeSpent.toString(),
      escapeCSVField(row.lastActivity || '')
    ];
    csvContent.push(csvRow.join(','));
  });

  return csvContent.join('\n');
}

function escapeCSVField(field: string): string {
  // Escape fields that contain commas, quotes, or newlines
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}