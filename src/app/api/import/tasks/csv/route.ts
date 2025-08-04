import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { parse } from 'csv-parse';
import { TaskStatus, Priority } from '@prisma/client';

interface TaskImportRow {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  clientDomain?: string;
  assignedToEmail?: string;
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

const VALID_TASK_STATUSES = Object.values(TaskStatus);

const VALID_PRIORITIES = Object.values(Priority);

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
      const records: TaskImportRow[] = [];
      const errors: ImportResult['errors'] = [];
      let rowNumber = 0;

      // Parse CSV with proper options <mcreference link="https://csv.js.org/parse/api/" index="5">5</mcreference>
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
          const parsedRecord = record as TaskImportRow;
          rowNumber++;
          
          // Validate required fields
          if (!parsedRecord.title || parsedRecord.title.trim() === '') {
            errors.push({
              row: rowNumber,
              error: 'Task title is required',
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          // Validate task status if provided
          if (parsedRecord.status && 
              !VALID_TASK_STATUSES.includes(parsedRecord.status as TaskStatus)) {
            errors.push({
              row: rowNumber,
              error: `Invalid task status: ${parsedRecord.status}. Valid values: ${VALID_TASK_STATUSES.join(', ')}`,
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          // Validate priority if provided
          if (parsedRecord.priority && 
              !VALID_PRIORITIES.includes(parsedRecord.priority as Priority)) {
            errors.push({
              row: rowNumber,
              error: `Invalid priority: ${parsedRecord.priority}. Valid values: ${VALID_PRIORITIES.join(', ')}`,
              data: parsedRecord as unknown as Record<string, unknown>
            });
            continue;
          }

          // Validate due date format if provided
          if (parsedRecord.dueDate && parsedRecord.dueDate.trim() !== '') {
            const dueDate = new Date(parsedRecord.dueDate.trim());
            if (isNaN(dueDate.getTime())) {
              errors.push({
                row: rowNumber,
                error: 'Invalid due date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS',
                data: parsedRecord as unknown as Record<string, unknown>
              });
              continue;
            }
          }

          // Validate email format if provided
          if (parsedRecord.assignedToEmail && parsedRecord.assignedToEmail.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(parsedRecord.assignedToEmail.trim())) {
              errors.push({
                row: rowNumber,
                error: 'Invalid email format for assigned user',
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
          const result = await processTaskImport(records, errors, session.user.id);
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

async function processTaskImport(
  records: TaskImportRow[], 
  validationErrors: ImportResult['errors'],
  createdById: string
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
  
  // Get all users for email matching
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true
    }
  });

  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    try {
      // Find client if domain is provided
      let clientId: string | null = null;
      if (record.clientDomain && record.clientDomain.trim() !== '') {
        const client = clients.find((c) => c.domainName === record.clientDomain);
        clientId = client?.id || null;
        
        if (!clientId) {
          result.warnings.push(
            `Row ${i + 1}: Client domain '${record.clientDomain}' not found, task will be created without client association`
          );
        }
      }

      // Find assigned user if email is provided
      let assignedToId: string | null = null;
      if (record.assignedToEmail && record.assignedToEmail.trim() !== '') {
        const assignedUser = users.find((u) => u.email === record.assignedToEmail);
        assignedToId = assignedUser?.id || null;
        
        if (!assignedToId) {
          result.warnings.push(
            `Row ${i + 1}: User email '${record.assignedToEmail}' not found, task will be created unassigned`
          );
        }
      }

      // Parse due date if provided
      let dueDate: Date | null = null;
      if (record.dueDate && record.dueDate.trim() !== '') {
        dueDate = new Date(record.dueDate.trim());
      }

      // Set completion date if status is COMPLETED
      let completedAt: Date | null = null;
      if (record.status === 'COMPLETED') {
        completedAt = new Date();
      }

      // Create task record
      await prisma.task.create({
        data: {
          title: record.title.trim(),
          description: record.description?.trim() || null,
          status: (record.status as TaskStatus) || 'OPEN',
          priority: (record.priority as Priority) || 'MEDIUM',
          dueDate,
          completedAt,
          clientId,
          assignedToId,
          createdById
        }
      });

      result.imported++;
    } catch (error) {
      console.error(`Error importing task '${record.title}':`, error);
      result.errors.push({
        row: i + 1,
        error: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  const csvTemplate = `title,description,status,priority,dueDate,clientDomain,assignedToEmail
"Update website content","Update the homepage content with new product information","OPEN","HIGH","2024-12-31","example.com","developer@company.com"
"Fix contact form","Contact form is not sending emails properly","IN_PROGRESS","URGENT","2024-12-15","test-site.org","admin@company.com"
"SEO optimization","Improve website SEO rankings and meta tags","OPEN","MEDIUM","2025-01-15","example.com",""`;

  return new NextResponse(csvTemplate, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="task_import_template.csv"'
    }
  });
}