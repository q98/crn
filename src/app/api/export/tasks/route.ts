import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../lib/prisma';
import { TaskStatus, Priority } from '@prisma/client';

interface ExportFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  clientDomain?: string[];
  assignedTo?: string[];
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  hasTimeEntries?: boolean;
  minDuration?: number; // in minutes
  maxDuration?: number; // in minutes
}

interface TaskExportData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  clientDomain: string;
  assignedToEmail: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  totalTimeSpent: number; // in hours
  timeEntriesCount: number;
  estimatedHours: number | null;
  actualVsEstimated: string; // percentage or N/A
  billableHours: number;
  tags: string;
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

    // Fetch tasks with related data
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            domainName: true
          }
        },
        assignedTo: {
          select: {
            email: true,
            name: true
          }
        },
        timeEntries: {
          select: {
            duration: true,
            isBilled: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            timeEntries: true
          }
        }
      },
      orderBy: [
        { client: { domainName: 'asc' } },
        { createdAt: 'desc' }
      ]
    });

    // Transform data for export
    const exportData: TaskExportData[] = tasks.map((task) => {
      const totalMinutes = task.timeEntries.reduce((total, entry) => {
        return total + (entry.duration || 0);
      }, 0);
      
      const billableMinutes = task.timeEntries
        .filter(entry => entry.isBilled)
        .reduce((total, entry) => {
          return total + (entry.duration || 0);
        }, 0);

      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
      const billableHours = Math.round((billableMinutes / 60) * 100) / 100;
      
      let actualVsEstimated = 'N/A';
      if (task.estimatedHours && task.estimatedHours > 0) {
        const percentage = Math.round((totalHours / task.estimatedHours) * 100);
        actualVsEstimated = `${percentage}%`;
      }

      // Parse tags from description or notes (assuming they're stored as #tag format)
      const tags = extractTags(task.description || '');

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        clientDomain: task.client?.domainName || 'Unknown',
        assignedToEmail: task.assignedTo?.email || null,
        assignedToName: task.assignedTo?.name || null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        totalTimeSpent: totalHours,
        timeEntriesCount: task._count.timeEntries,
        estimatedHours: task.estimatedHours,
        actualVsEstimated: actualVsEstimated,
        billableHours: billableHours,
        tags: tags.join(', ')
      };
    });

    // Calculate summary statistics
    const summary = {
      totalTasks: exportData.length,
      completedTasks: exportData.filter(t => t.status === 'COMPLETED').length,
      totalHoursLogged: exportData.reduce((sum, t) => sum + t.totalTimeSpent, 0),
      totalBillableHours: exportData.reduce((sum, t) => sum + t.billableHours, 0),
      averageTaskDuration: exportData.length > 0 
        ? Math.round((exportData.reduce((sum, t) => sum + t.totalTimeSpent, 0) / exportData.length) * 100) / 100
        : 0
    };

    // Generate response based on format
    if (format === 'json') {
      return NextResponse.json({
        data: exportData,
        summary: summary,
        metadata: {
          totalRecords: exportData.length,
          exportedAt: new Date().toISOString(),
          filters: filters
        }
      });
    } else {
      // Generate CSV
      const csv = generateCSV(exportData, summary);
      const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

  } catch (error) {
    console.error('Task export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function parseFilters(searchParams: URLSearchParams): ExportFilters {
  const filters: ExportFilters = {};

  // Status filter
  const statusParam = searchParams.get('status');
  if (statusParam) {
    filters.status = statusParam.split(',') as TaskStatus[];
  }

  // Priority filter
  const priorityParam = searchParams.get('priority');
  if (priorityParam) {
    filters.priority = priorityParam.split(',') as Priority[];
  }

  // Client domain filter
  const clientParam = searchParams.get('clientDomain');
  if (clientParam) {
    filters.clientDomain = clientParam.split(',');
  }

  // Assigned to filter
  const assignedParam = searchParams.get('assignedTo');
  if (assignedParam) {
    filters.assignedTo = assignedParam.split(',');
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

  // Due date filters
  const dueDateFrom = searchParams.get('dueDateFrom');
  if (dueDateFrom) {
    filters.dueDateFrom = dueDateFrom;
  }

  const dueDateTo = searchParams.get('dueDateTo');
  if (dueDateTo) {
    filters.dueDateTo = dueDateTo;
  }

  // Boolean filters
  const hasTimeEntries = searchParams.get('hasTimeEntries');
  if (hasTimeEntries !== null) {
    filters.hasTimeEntries = hasTimeEntries === 'true';
  }

  // Duration filters
  const minDuration = searchParams.get('minDuration');
  if (minDuration) {
    filters.minDuration = parseInt(minDuration);
  }

  const maxDuration = searchParams.get('maxDuration');
  if (maxDuration) {
    filters.maxDuration = parseInt(maxDuration);
  }

  return filters;
}

function buildWhereClause(filters: ExportFilters) {
  const where: Record<string, unknown> = {};

  // Status filter
  if (filters.status && filters.status.length > 0) {
    where.status = {
      in: filters.status
    };
  }

  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
    where.priority = {
      in: filters.priority
    };
  }

  // Client domain filter
  if (filters.clientDomain && filters.clientDomain.length > 0) {
    where.client = {
      domainName: {
        in: filters.clientDomain
      }
    };
  }

  // Assigned to filter
  if (filters.assignedTo && filters.assignedTo.length > 0) {
    where.assignedTo = {
      email: {
        in: filters.assignedTo
      }
    };
  }

  // Date range filters
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {} as Record<string, unknown>;
    if (filters.dateFrom) {
      (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
  }

  // Due date filters
  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {} as Record<string, unknown>;
    if (filters.dueDateFrom) {
      (where.dueDate as Record<string, unknown>).gte = new Date(filters.dueDateFrom);
    }
    if (filters.dueDateTo) {
      (where.dueDate as Record<string, unknown>).lte = new Date(filters.dueDateTo + 'T23:59:59.999Z');
    }
  }

  // Time entries filter
  if (filters.hasTimeEntries !== undefined) {
    if (filters.hasTimeEntries) {
      where.timeEntries = {
        some: {}
      };
    } else {
      where.timeEntries = {
        none: {}
      };
    }
  }

  // Duration filters (requires aggregation, handled in post-processing)
  // Note: For complex duration filters, we'd need to use raw SQL or post-process

  return where;
}

function extractTags(text: string): string[] {
  const tagRegex = /#(\w+)/g;
  const tags: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

function generateCSV(data: TaskExportData[], summary: {
  totalTasks: number;
  completedTasks: number;
  totalHoursLogged: number;
  totalBillableHours: number;
  averageTaskDuration: number;
}): string {
  if (data.length === 0) {
    return 'No data to export';
  }

  // CSV headers
  const headers = [
    'ID',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Due Date',
    'Client Domain',
    'Assigned To Email',
    'Assigned To Name',
    'Created At',
    'Updated At',
    'Completed At',
    'Total Time Spent (Hours)',
    'Time Entries Count',
    'Estimated Hours',
    'Actual vs Estimated',
    'Billable Hours',
    'Tags'
  ];

  // Generate CSV content
  const csvContent = [headers.join(',')];
  
  data.forEach(row => {
    const csvRow = [
      escapeCSVField(row.id),
      escapeCSVField(row.title),
      escapeCSVField(row.description || ''),
      escapeCSVField(row.status),
      escapeCSVField(row.priority),
      escapeCSVField(row.dueDate || ''),
      escapeCSVField(row.clientDomain),
      escapeCSVField(row.assignedToEmail || ''),
      escapeCSVField(row.assignedToName || ''),
      escapeCSVField(row.createdAt),
      escapeCSVField(row.updatedAt),
      escapeCSVField(row.completedAt || ''),
      row.totalTimeSpent.toString(),
      row.timeEntriesCount.toString(),
      (row.estimatedHours || '').toString(),
      escapeCSVField(row.actualVsEstimated),
      row.billableHours.toString(),
      escapeCSVField(row.tags)
    ];
    csvContent.push(csvRow.join(','));
  });

  // Add summary section
  csvContent.push('');
  csvContent.push('SUMMARY');
  csvContent.push(`Total Tasks,${summary.totalTasks}`);
  csvContent.push(`Completed Tasks,${summary.completedTasks}`);
  csvContent.push(`Total Hours Logged,${summary.totalHoursLogged}`);
  csvContent.push(`Total Billable Hours,${summary.totalBillableHours}`);
  csvContent.push(`Average Task Duration,${summary.averageTaskDuration}`);

  return csvContent.join('\n');
}

function escapeCSVField(field: string): string {
  // Escape fields that contain commas, quotes, or newlines
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}