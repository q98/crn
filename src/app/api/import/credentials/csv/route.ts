import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { parse } from 'csv-parse';
import bcrypt from 'bcryptjs';

interface CredentialImportRow {
  service: string;
  url?: string;
  username: string;
  password: string;
  pin?: string;
  securityQuestions?: string;
  notes?: string;
  clientDomain?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
  warnings: string[];
}

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
      const records: CredentialImportRow[] = [];
      const errors: ImportResult['errors'] = [];
      let rowNumber = 0;

      // Parse CSV with proper options <mcreference link="https://www.npmjs.com/package/csv-parse" index="1">1</mcreference>
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
          const parsedRecord = record as CredentialImportRow;
          rowNumber++;
          
          // Validate required fields
          if (!parsedRecord.service || parsedRecord.service.trim() === '') {
            errors.push({
              row: rowNumber,
              error: 'Service name is required',
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          if (!parsedRecord.username || parsedRecord.username.trim() === '') {
            errors.push({
              row: rowNumber,
              error: 'Username is required',
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          if (!parsedRecord.password || parsedRecord.password.trim() === '') {
            errors.push({
              row: rowNumber,
              error: 'Password is required',
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          // Validate URL format if provided
          if (parsedRecord.url && parsedRecord.url.trim() !== '') {
            try {
              new URL(parsedRecord.url.trim());
            } catch {
              errors.push({
                row: rowNumber,
                error: 'Invalid URL format',
                data: parsedRecord as unknown as Record<string, unknown>
              });
              continue;
            }
          }

          // Validate security questions JSON if provided
          if (parsedRecord.securityQuestions && parsedRecord.securityQuestions.trim() !== '') {
            try {
              JSON.parse(parsedRecord.securityQuestions.trim());
            } catch {
              errors.push({
                row: rowNumber,
                error: 'Security questions must be valid JSON format',
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
          const result = await processCredentialImport(records, errors);
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

async function processCredentialImport(
  records: CredentialImportRow[], 
  validationErrors: ImportResult['errors']
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    errors: [...validationErrors],
    warnings: []
  };

  // Get all clients for domain matching
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      domainName: true
    }
  });
  
  const clientMap = new Map(clients.map(c => [c.domainName.toLowerCase(), c.id]));

  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    try {
      // Find client if domain is provided
      let clientId: string | null = null;
      if (record.clientDomain && record.clientDomain.trim() !== '') {
        const domain = record.clientDomain.trim().toLowerCase();
        clientId = clientMap.get(domain) || null;
        
        if (!clientId) {
          result.warnings.push(
            `Row ${i + 1}: Client domain '${record.clientDomain}' not found, credential will be created without client association`
          );
        }
      }

      // Encrypt password using bcrypt for secure storage
      const hashedPassword = await bcrypt.hash(record.password.trim(), 12);

      // Parse security questions if provided
      let securityQuestions = null;
      if (record.securityQuestions && record.securityQuestions.trim() !== '') {
        try {
          securityQuestions = JSON.parse(record.securityQuestions.trim());
        } catch {
          // This should have been caught in validation, but just in case
          securityQuestions = null;
        }
      }

      // Create credential record
      await prisma.credential.create({
        data: {
          service: record.service.trim(),
          url: record.url?.trim() || null,
          username: record.username.trim(),
          password: hashedPassword,
          pin: record.pin?.trim() || null,
          securityQuestions: securityQuestions ? 
            JSON.parse(JSON.stringify(securityQuestions)) : null,
          notes: record.notes?.trim() || null,
          clientId
        }
      });

      result.imported++;
    } catch (error) {
      console.error(`Error importing credential for ${record.service}:`, error);
      result.errors.push({
        row: i + 1,
        error: `Failed to create credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: record as unknown as Record<string, unknown>
      });
    }
  }

  // Set success based on whether any records were imported
  result.success = result.imported > 0 || (records.length === 0 && result.errors.length === 0);

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

  const csvTemplate = `service,url,username,password,pin,securityQuestions,notes,clientDomain
"cPanel","https://cpanel.example.com","admin_user","secure_password123","1234","{\"question1\": \"What is your pet's name?\", \"answer1\": \"Fluffy\"}","Main cPanel access","example.com"
"FTP","ftp://ftp.example.com","ftp_user","ftp_pass456","","","FTP access for file uploads","example.com"
"Email Admin","https://mail.example.com","admin@example.com","email_pass789","","","Email administration panel","example.com"`;

  return new NextResponse(csvTemplate, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="credential_import_template.csv"'
    }
  });
}