import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { parse } from 'csv-parse';


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
  duplicates: string[];
}

const VALID_VERIFICATION_STATUSES = [
  'ACTIVE_SHP_REGISTRAR',
  'ACTIVE_NEEDS_LOGIN', 
  'AT_RISK',
  'LOST',
  'WASTED_SPACE',
  'UNKNOWN'
] as const;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      );
    }

    const csvContent = await file.text();
    
    return new Promise<NextResponse>((resolve) => {
      const records: ClientImportRow[] = [];
      const errors: ImportResult['errors'] = [];
      let rowNumber = 0;

      // Parse CSV with proper options <mcreference link="https://csv.js.org/parse/" index="2">2</mcreference>
      parse(csvContent, {
        columns: true, // Use first row as headers
        skip_empty_lines: true,
        trim: true,
        delimiter: ',',
        quote: '"',
        escape: '"'
      })
      .on('readable', function(this: NodeJS.ReadableStream) {
        let record: unknown;
        while ((record = this.read()) !== null) {
          const parsedRecord = record as ClientImportRow;
          rowNumber++;
          
          // Validate required fields
          if (!parsedRecord.domainName || parsedRecord.domainName.trim() === '') {
            errors.push({
              row: rowNumber,
              error: 'Domain name is required',
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          // Validate verification status if provided
          if (parsedRecord.verificationStatus && 
              !VALID_VERIFICATION_STATUSES.includes(parsedRecord.verificationStatus as typeof VALID_VERIFICATION_STATUSES[number])) {
            errors.push({
              row: rowNumber,
              error: `Invalid verification status: ${parsedRecord.verificationStatus}. Valid values: ${VALID_VERIFICATION_STATUSES.join(', ')}`,
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          // Validate annual hour allowance if provided
          if (parsedRecord.annualHourAllowance) {
            const allowance = parseFloat(parsedRecord.annualHourAllowance);
            if (isNaN(allowance) || allowance < 0) {
                          errors.push({
              row: rowNumber,
              error: 'Annual hour allowance must be a positive number',
              data: parsedRecord as unknown as Record<string, unknown>
            });
              continue;
            }
          }

          records.push(parsedRecord);
        }
      })
      .on('error', function(this: NodeJS.ReadableStream, err) {
        resolve(NextResponse.json(
          { error: `CSV parsing error: ${err.message}` },
          { status: 400 }
        ));
      })
      .on('end', async function(this: NodeJS.ReadableStream) {
        try {
          const result = await processClientImport(records, errors, file.name, session.user.id);
          resolve(NextResponse.json(result));
        } catch (error) {
          console.error('Import processing error:', error);
          resolve(NextResponse.json(
            { error: 'Failed to process import' },
            { status: 500 }
          ));
        }
      });
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processClientImport(
  records: ClientImportRow[], 
  validationErrors: ImportResult['errors'],
  fileName: string,
  userId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    errors: [...validationErrors],
    duplicates: []
  };

  const importedClientIds: string[] = [];

  // Check for existing domains to prevent duplicates
  const domainNames = records.map(r => r.domainName.toLowerCase().trim());
  const existingClients = await prisma.client.findMany({
    where: {
      domainName: {
        in: domainNames
      }
    },
    select: {
      domainName: true
    }
  });

  const existingDomains = new Set(existingClients.map(c => c.domainName.toLowerCase()));

  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const domainName = record.domainName.trim();
    
    // Check for duplicates
    if (existingDomains.has(domainName.toLowerCase())) {
      result.duplicates.push(domainName);
      continue;
    }

    try {
      // Create client record
      const client = await prisma.client.create({
        data: {
          domainName,
          cPanelUsername: record.cPanelUsername?.trim() || null,
          diskUsage: record.diskUsage?.trim() || null,
          verificationStatus: (record.verificationStatus as 'ACTIVE_SHP_REGISTRAR' | 'ACTIVE_NEEDS_LOGIN' | 'AT_RISK' | 'LOST' | 'WASTED_SPACE' | 'UNKNOWN') || 'UNKNOWN',
          registrar: record.registrar?.trim() || null,
          notes: record.notes?.trim() || null,
          annualHourAllowance: record.annualHourAllowance ? 
            parseFloat(record.annualHourAllowance as string) : 40,
          yearlyHoursUsed: 0.0
        }
      });

      importedClientIds.push(client.id);
      result.imported++;
      existingDomains.add(domainName.toLowerCase()); // Prevent duplicates within the same import
    } catch (error) {
      console.error(`Error importing client ${domainName}:`, error);
      result.errors.push({
        row: i + 1,
        error: `Failed to create client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: record as unknown as Record<string, unknown>
      });
    }
  }

  // Set success based on whether any records were imported
  result.success = result.imported > 0 || (records.length === 0 && result.errors.length === 0);

  // Create import history record
  const importStatus = result.errors.length === 0 ? 'SUCCESS' : 
                     result.imported > 0 ? 'PARTIAL' : 'FAILED';

  try {
    await prisma.importHistory.create({
      data: {
        title: `Client Import - ${fileName}`,
        type: 'CLIENT',
        status: importStatus,
        fileName,
        importedCount: result.imported,
        errorCount: result.errors.length,
        warningCount: 0,
        canRollback: importedClientIds.length > 0,
        importedById: userId,
        importData: {
          clientIds: importedClientIds,
          duplicates: result.duplicates
        },
        errorDetails: JSON.parse(JSON.stringify({
          errors: result.errors,
          duplicates: result.duplicates.map(domain => ({ domainName: domain }))
        }))
      }
    });
  } catch (error) {
    console.error('Failed to create import history:', error);
    // Don't fail the import if history creation fails
  }

  return result;
}

// GET endpoint to provide CSV template
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const csvTemplate = `domainName,cPanelUsername,diskUsage,verificationStatus,registrar,notes,annualHourAllowance
example.com,cpanel_user,1.2GB,ACTIVE_SHP_REGISTRAR,GoDaddy,Sample client notes,2.0
test-site.org,test_user,500MB,ACTIVE_NEEDS_LOGIN,Namecheap,Another example,3.5`;

  return new NextResponse(csvTemplate, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="client_import_template.csv"'
    }
  });
}