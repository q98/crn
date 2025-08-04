import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';
import { encrypt } from '@/lib/encryption';

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
  importedIds: string[];
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
  warnings: Array<{
    row: number;
    warning: string;
    data?: Record<string, unknown>;
  }>;
}

// POST /api/import/credentials - Import credentials from CSV
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
    
    let records: CredentialImportRow[];
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
      importedIds: [],
      errors: [],
      warnings: []
    };

    // Get all clients for domain lookup
    const clients = await prisma.client.findMany({
      select: { id: true, domainName: true }
    });
    const clientMap = new Map(clients.map(c => [c.domainName.toLowerCase(), c.id]));

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 because CSV rows start at 1 and we skip header

      try {
        // Validate required fields
        if (!row.service || row.service.trim() === '') {
          result.errors.push({
            row: rowNumber,
            error: 'Service name is required',
            data: row as unknown as Record<string, unknown>
          });
          continue;
        }

        if (!row.username || row.username.trim() === '') {
          result.errors.push({
            row: rowNumber,
            error: 'Username is required',
            data: row as unknown as Record<string, unknown>
          });
          continue;
        }

        if (!row.password || row.password.trim() === '') {
          result.errors.push({
            row: rowNumber,
            error: 'Password is required',
            data: row as unknown as Record<string, unknown>
          });
          continue;
        }

        // Find client by domain name
        let clientId: string | null = null;
        if (row.clientDomain && row.clientDomain.trim() !== '') {
          const domain = row.clientDomain.trim().toLowerCase();
          clientId = clientMap.get(domain) || null;
          
          if (!clientId) {
            result.warnings.push({
              row: rowNumber,
              warning: `Client domain '${row.clientDomain}' not found. Credential will be created without client association.`,
              data: row as unknown as Record<string, unknown>
            });
          }
        }

        // Parse security questions if provided
        let securityQuestions = null;
        if (row.securityQuestions && row.securityQuestions.trim() !== '') {
          try {
            // Try to parse as JSON first
            securityQuestions = JSON.parse(row.securityQuestions);
          } catch {
            // If not JSON, treat as plain text and convert to simple object
            securityQuestions = {
              question1: row.securityQuestions.trim()
            };
          }
        }

        // Validate URL format if provided
        let url = row.url?.trim() || null;
        if (url && url !== '') {
          try {
            new URL(url);
          } catch {
            // If URL is invalid, add protocol if missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = 'https://' + url;
              try {
                new URL(url);
              } catch {
                result.warnings.push({
                  row: rowNumber,
                  warning: `Invalid URL format: ${row.url}. Using as-is.`,
                  data: row as unknown as Record<string, unknown>
                });
                url = row.url?.trim() || '';
              }
            }
          }
        }

        // Encrypt the password before storing
        const encryptedPassword = encrypt(row.password.trim());

        // Create credential
        const credential = await prisma.credential.create({
          data: {
            service: row.service.trim(),
            url,
            username: row.username.trim(),
            password: encryptedPassword,
            pin: row.pin?.trim() || null,
            securityQuestions,
            notes: row.notes?.trim() || null,
            clientId
          }
        });

        result.imported++;
        result.importedIds.push(credential.id);

      } catch (error) {
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          data: row as unknown as Record<string, unknown>
        });
      }
    }

    // Determine import status
    let importStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    if (result.errors.length === 0) {
      importStatus = 'SUCCESS';
    } else if (result.imported > 0) {
      importStatus = 'PARTIAL';
    } else {
      importStatus = 'FAILED';
    }

    // Create import history record
    await prisma.importHistory.create({
      data: {
        title: `Credential Import - ${file.name}`,
        type: 'CREDENTIAL',
        status: importStatus,
        fileName: file.name,
        importedCount: result.imported,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        importData: JSON.parse(JSON.stringify(result.importedIds)),
        errorDetails: (result.errors.length > 0 || result.warnings.length > 0) ? JSON.parse(JSON.stringify({
          errors: result.errors,
          warnings: result.warnings
        })) : null,
        importedById: session.user.id,
        importedAt: new Date()
      }
    });

    if (result.errors.length > 0) {
      result.success = false;
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error importing credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/import/credentials - Get import template
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const csvTemplate = [
      'service,url,username,password,pin,securityQuestions,notes,clientDomain',
      'cPanel,https://cpanel.example.com,admin,SecurePass123,1234,"{\"question1\": \"What is your pet name?\", \"answer1\": \"Fluffy\"}",Admin panel access,example.com',
      'WordPress,https://example.com/wp-admin,wpuser,WpPass456,,"What is your favorite color?",WordPress admin,example.com',
      'FTP,ftp.example.com,ftpuser,FtpPass789,,,,example.com'
    ].join('\n');

    return new NextResponse(csvTemplate, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="credential_import_template.csv"'
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