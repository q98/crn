import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';

interface ClientImportRow {
  domainName: string;
  cPanelUsername?: string;
  diskUsage?: string;
  verificationStatus?: string;
  registrar?: string;
  notes?: string;
  annualHourAllowance?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
  duplicates: Array<{
    row: number;
    domainName: string;
  }>;
}

const VALID_VERIFICATION_STATUSES = [
  'ACTIVE_SHP_REGISTRAR',
  'ACTIVE_NEEDS_LOGIN',
  'AT_RISK',
  'LOST',
  'WASTED_SPACE',
  'UNKNOWN'
] as const;

// POST /api/import/clients - Import clients from CSV
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    const csvContent = await file.text();
    
    let records: ClientImportRow[];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (parseError) {
      return NextResponse.json({ 
        error: 'Invalid CSV format', 
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      errors: [],
      duplicates: []
    };

    // Check for existing domains to prevent duplicates
    const existingDomains = await prisma.client.findMany({
      select: { domainName: true }
    });
    const existingDomainSet = new Set(existingDomains.map(c => c.domainName.toLowerCase()));

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 because CSV rows start at 1 and we skip header

      try {
        // Validate required fields
        if (!row.domainName || row.domainName.trim() === '') {
          result.errors.push({
          row: rowNumber,
          error: 'Domain name is required',
          data: row as unknown as Record<string, unknown>
        });
          continue;
        }

        const domainName = row.domainName.trim();

        // Check for duplicates
        if (existingDomainSet.has(domainName.toLowerCase())) {
          result.duplicates.push({
            row: rowNumber,
            domainName
          });
          continue;
        }

        // Validate verification status
        let verificationStatus = 'UNKNOWN';
        if (row.verificationStatus) {
          const status = row.verificationStatus.toUpperCase();
          if (VALID_VERIFICATION_STATUSES.includes(status as typeof VALID_VERIFICATION_STATUSES[number])) {
            verificationStatus = status;
          } else {
            result.errors.push({
              row: rowNumber,
              error: `Invalid verification status: ${row.verificationStatus}. Valid values: ${VALID_VERIFICATION_STATUSES.join(', ')}`,
              data: row as unknown as Record<string, unknown>
            });
            continue;
          }
        }

        // Validate annual hour allowance
        let annualHourAllowance = 2.0; // default
        if (row.annualHourAllowance) {
          const allowance = parseFloat(row.annualHourAllowance);
          if (isNaN(allowance) || allowance < 0) {
            result.errors.push({
              row: rowNumber,
              error: 'Annual hour allowance must be a positive number',
              data: row as unknown as Record<string, unknown>
            });
            continue;
          }
          annualHourAllowance = allowance;
        }

        // Create client
        await prisma.client.create({
          data: {
            domainName,
            cPanelUsername: row.cPanelUsername?.trim() || null,
            diskUsage: row.diskUsage?.trim() || null,
            verificationStatus: verificationStatus as 'ACTIVE_SHP_REGISTRAR' | 'ACTIVE_NEEDS_LOGIN' | 'AT_RISK' | 'LOST' | 'WASTED_SPACE' | 'UNKNOWN',
            registrar: row.registrar?.trim() || null,
            notes: row.notes?.trim() || null,
            annualHourAllowance
          }
        });

        // Add to existing domains set to prevent duplicates within the same import
        existingDomainSet.add(domainName.toLowerCase());
        result.imported++;

      } catch (error) {
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          data: row as unknown as Record<string, unknown>
        });
      }
    }

    // Create import history record
    await prisma.report.create({
      data: {
        title: `Client Import - ${new Date().toISOString()}`,
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        },
        totalHours: 0,
        totalAmount: 0,
        clientId: 'SYSTEM', // Special ID for system-generated reports
        generatedAt: new Date(),
        reportData: JSON.parse(JSON.stringify({
          type: 'CLIENT_IMPORT',
          imported: result.imported,
          errors: result.errors,
          duplicates: result.duplicates
        }))
      }
    });

    if (result.errors.length > 0 || result.duplicates.length > 0) {
      result.success = false;
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error importing clients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/import/clients - Get import template
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const csvTemplate = [
      'domainName,cPanelUsername,diskUsage,verificationStatus,registrar,notes,annualHourAllowance',
      'example.com,example_user,1.2GB,ACTIVE_SHP_REGISTRAR,GoDaddy,Sample client notes,2.0',
      'test-site.org,test_user,500MB,ACTIVE_NEEDS_LOGIN,Namecheap,Another example,3.5'
    ].join('\n');

    return new NextResponse(csvTemplate, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="client_import_template.csv"'
      }
    });

  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}