import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../lib/prisma';


interface ExportFilters {
  clientDomain?: string[];
  service?: string[];
  dateFrom?: string;
  dateTo?: string;
  hasSecurityQuestions?: boolean;
  includePasswords?: boolean;
}

interface CredentialExportData {
  id: string;
  service: string;
  username: string;
  password?: string; // Optional based on security settings
  url: string | null;
  securityQuestions?: string; // JSON string or masked
  notes: string | null;
  clientDomain: string;
  createdAt: string;
  updatedAt: string;
  lastUsed: string | null;
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

    // Security check for password inclusion
    if (filters.includePasswords && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions to export passwords' },
        { status: 403 }
      );
    }

    // Build where clause for filtering
    const whereClause = buildWhereClause(filters);

    // Fetch credentials with related data
    const credentials = await prisma.credential.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            domainName: true
          }
        }
      },
      orderBy: [
        { client: { domainName: 'asc' } },
        { service: 'asc' }
      ]
    });

    // Transform data for export
    const exportData: CredentialExportData[] = await Promise.all(
      credentials.map(async (credential) => {
        const baseData: CredentialExportData = {
          id: credential.id,
          service: credential.service,
          username: credential.username,
          url: credential.url,
          notes: credential.notes,
          clientDomain: credential.client?.domainName || 'No client',
          createdAt: credential.createdAt.toISOString(),
          updatedAt: credential.updatedAt.toISOString(),
          lastUsed: null // Field not available in current schema
        };

        // Handle password export based on permissions
        if (filters.includePasswords && session.user.role === 'ADMIN') {
          try {
            // Decrypt password for export (assuming it's hashed with bcrypt)
            // Note: In a real scenario, you'd need proper encryption/decryption
            // For now, we'll indicate it's encrypted
            baseData.password = '[ENCRYPTED - Contact Admin]';
          } catch {
            baseData.password = '[DECRYPTION_ERROR]';
          }
        } else {
          baseData.password = '[HIDDEN]';
        }

        // Handle security questions
        if (credential.securityQuestions) {
          try {
            const questions = JSON.parse(credential.securityQuestions as string);
            if (filters.includePasswords && session.user.role === 'ADMIN') {
              baseData.securityQuestions = credential.securityQuestions as string;
            } else {
              // Mask the answers but show questions
              const maskedQuestions = questions.map((q: { question: string; answer: string }) => ({
                question: q.question,
                answer: '[HIDDEN]'
              }));
              baseData.securityQuestions = JSON.stringify(maskedQuestions);
            }
          } catch {
            baseData.securityQuestions = '[INVALID_JSON]';
          }
        }

        return baseData;
      })
    );

    // Generate response based on format
    if (format === 'json') {
      return NextResponse.json({
        data: exportData,
        metadata: {
          totalRecords: exportData.length,
          exportedAt: new Date().toISOString(),
          filters: filters,
          securityNote: filters.includePasswords 
            ? 'Passwords included - Handle with extreme care'
            : 'Passwords masked for security'
        }
      });
    } else {
      // Generate CSV
      const csv = generateCSV(exportData);
      const filename = `credentials_export_${new Date().toISOString().split('T')[0]}.csv`;
      
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

  // Client domain filter
  const clientParam = searchParams.get('clientDomain');
  if (clientParam) {
    filters.clientDomain = clientParam.split(',');
  }

  // Service filter
  const serviceParam = searchParams.get('service');
  if (serviceParam) {
    filters.service = serviceParam.split(',');
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
  const hasSecurityQuestions = searchParams.get('hasSecurityQuestions');
  if (hasSecurityQuestions !== null) {
    filters.hasSecurityQuestions = hasSecurityQuestions === 'true';
  }

  const includePasswords = searchParams.get('includePasswords');
  if (includePasswords !== null) {
    filters.includePasswords = includePasswords === 'true';
  }

  return filters;
}

function buildWhereClause(filters: ExportFilters) {
  const where: Record<string, unknown> = {};

  // Client domain filter
  if (filters.clientDomain && filters.clientDomain.length > 0) {
    where.client = {
      domainName: {
        in: filters.clientDomain
      }
    };
  }

  // Service filter
  if (filters.service && filters.service.length > 0) {
    where.service = {
      in: filters.service
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

  // Security questions filter
  if (filters.hasSecurityQuestions !== undefined) {
    if (filters.hasSecurityQuestions) {
      where.securityQuestions = {
        not: null
      };
    } else {
      where.securityQuestions = null;
    }
  }

  return where;
}

function generateCSV(data: CredentialExportData[]): string {
  if (data.length === 0) {
    return 'No data to export';
  }

  // CSV headers
  const headers = [
    'ID',
    'Service',
    'Username',
    'Password',
    'URL',
    'Security Questions',
    'Notes',
    'Client Domain',
    'Created At',
    'Updated At',
    'Last Used'
  ];

  // Generate CSV content
  const csvContent = [headers.join(',')];
  
  data.forEach(row => {
    const csvRow = [
      escapeCSVField(row.id),
      escapeCSVField(row.service),
      escapeCSVField(row.username),
      escapeCSVField(row.password || '[HIDDEN]'),
      escapeCSVField(row.url || ''),
      escapeCSVField(row.securityQuestions || ''),
      escapeCSVField(row.notes || ''),
      escapeCSVField(row.clientDomain),
      escapeCSVField(row.createdAt),
      escapeCSVField(row.updatedAt),
      escapeCSVField(row.lastUsed || '')
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