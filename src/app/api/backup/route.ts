import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

interface BackupData {
  clients: Record<string, unknown>[];
  credentials: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  healthChecks: Record<string, unknown>[];
  timeEntries: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  metadata: {
    exportedAt: string;
    exportedBy: string;
    version: string;
    totalRecords: number;
  };
}

// POST /api/backup - Create a backup
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { includeCredentials = false, format = 'json' } = await request.json();

    // Get all data for the user
    const clients = await prisma.client.findMany({
      include: {
        credentials: includeCredentials,
        tasks: true,
        healthChecks: true
      }
    });

    const credentials = includeCredentials ? await prisma.credential.findMany({
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      }
    }) : [];

    const tasks = await prisma.task.findMany({
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        timeEntries: true
      }
    });

    const healthChecks = await prisma.healthCheck.findMany({
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      }
    });

    const timeEntries = await prisma.timeEntry.findMany({
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        },
        developer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const invoices = await prisma.invoice.findMany({
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      }
    });

    const reports = await prisma.report.findMany();

    // Decrypt credentials if included
    const processedCredentials = includeCredentials ? credentials.map(cred => ({
      ...cred,
      password: decrypt(cred.password) // Decrypt for backup
    })) : [];

    const backupData: BackupData = {
      clients,
      credentials: processedCredentials,
      tasks,
      healthChecks,
      timeEntries,
      invoices,
      reports,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.email || 'Unknown',
        version: '1.0.0',
        totalRecords: clients.length + credentials.length + tasks.length + healthChecks.length + timeEntries.length + invoices.length + reports.length
      }
    };

    // Create backup record
    const backup = await prisma.importHistory.create({
      data: {
        title: `System Backup - ${new Date().toISOString()}`,
        type: 'CLIENT', // Using CLIENT as closest type
        status: 'SUCCESS',
        fileName: `backup_${new Date().toISOString().split('T')[0]}.${format}`,
        importedCount: backupData.metadata.totalRecords,
        errorCount: 0,
        warningCount: 0,
        importData: {},
        importedById: session.user.id,
        importedAt: new Date()
      }
    });

    if (format === 'csv') {
      // For CSV format, we'll create separate CSV files for each entity type
      const csvData = {
        clients: convertToCSV(clients),
        tasks: convertToCSV(tasks),
        healthChecks: convertToCSV(healthChecks),
        timeEntries: convertToCSV(timeEntries),
        invoices: convertToCSV(invoices)
      };

      return NextResponse.json({
        message: 'Backup created successfully',
        backupId: backup.id,
        format: 'csv',
        data: csvData,
        metadata: backupData.metadata
      });
    }

    return NextResponse.json({
      message: 'Backup created successfully',
      backupId: backup.id,
      format: 'json',
      data: backupData
    });

  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/backup - Get backup history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    // Get backup history (using ImportHistory with backup-related titles)
    const backups = await prisma.importHistory.findMany({
      where: {
        importedById: session.user.id,
        title: {
          contains: 'Backup'
        }
      },
      include: {
        importedBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        importedAt: 'desc'
      },
      skip,
      take: limit
    });

    const totalCount = await prisma.importHistory.count({
      where: {
        importedById: session.user.id,
        title: {
          contains: 'Backup'
        }
      }
    });

    const backupHistory = backups.map(backup => ({
      id: backup.id,
      title: backup.title,
      fileName: backup.fileName,
      recordCount: backup.importedCount,
      createdAt: backup.importedAt,
      createdBy: {
        name: backup.importedBy.name || 'Unknown',
        email: backup.importedBy.email
      }
    }));

    return NextResponse.json({
      backups: backupHistory,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching backup history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to convert data to CSV format
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]).filter(key => typeof data[0][key] !== 'object' || data[0][key] === null);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value.toString();
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}