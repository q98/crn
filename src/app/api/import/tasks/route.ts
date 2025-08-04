import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';

interface TaskImportRow {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  clientDomain?: string;
  assignedToEmail?: string;
  createdByEmail?: string;
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

const VALID_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// POST /api/import/tasks - Import tasks from CSV
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
    
    let records: TaskImportRow[];
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

    // Get all clients and users for lookups
    const clients = await prisma.client.findMany({
      select: { id: true, domainName: true }
    });
    const clientMap = new Map(clients.map(c => [c.domainName.toLowerCase(), c.id]));

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    const userMap = new Map(users.map(u => [u.email.toLowerCase(), u.id]));

    // Get current user as default creator
    const currentUser = users.find(u => u.email === session.user?.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 400 });
    }

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 because CSV rows start at 1 and we skip header

      try {
        // Validate required fields
        if (!row.title || row.title.trim() === '') {
          result.errors.push({
            row: rowNumber,
            error: 'Task title is required',
            data: row as unknown as Record<string, unknown>
          });
          continue;
        }

        // Validate status
        let status = 'OPEN'; // default
        if (row.status && row.status.trim() !== '') {
          const statusUpper = row.status.toUpperCase();
          if (VALID_TASK_STATUSES.includes(statusUpper)) {
            status = statusUpper;
          } else {
            result.warnings.push({
              row: rowNumber,
              warning: `Invalid status '${row.status}'. Using default 'OPEN'. Valid values: ${VALID_TASK_STATUSES.join(', ')}`,
              data: row as unknown as Record<string, unknown>
            });
          }
        }

        // Validate priority
        let priority = 'MEDIUM'; // default
        if (row.priority && row.priority.trim() !== '') {
          const priorityUpper = row.priority.toUpperCase();
          if (VALID_PRIORITIES.includes(priorityUpper)) {
            priority = priorityUpper;
          } else {
            result.warnings.push({
              row: rowNumber,
              warning: `Invalid priority '${row.priority}'. Using default 'MEDIUM'. Valid values: ${VALID_PRIORITIES.join(', ')}`,
              data: row as unknown as Record<string, unknown>
            });
          }
        }

        // Parse due date
        let dueDate: Date | null = null;
        if (row.dueDate && row.dueDate.trim() !== '') {
          try {
            dueDate = new Date(row.dueDate.trim());
            if (isNaN(dueDate.getTime())) {
              result.warnings.push({
                row: rowNumber,
                warning: `Invalid due date format '${row.dueDate}'. Expected format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS`,
                data: row as unknown as Record<string, unknown>
            });
              dueDate = null;
            }
          } catch {
            result.warnings.push({
              row: rowNumber,
              warning: `Invalid due date format '${row.dueDate}'. Expected format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS`,
              data: row as unknown as Record<string, unknown>
              });
            dueDate = null;
          }
        }

        // Find client by domain name
        let clientId: string | null = null;
        if (row.clientDomain && row.clientDomain.trim() !== '') {
          const domain = row.clientDomain.trim().toLowerCase();
          clientId = clientMap.get(domain) || null;
          
          if (!clientId) {
            result.warnings.push({
              row: rowNumber,
              warning: `Client domain '${row.clientDomain}' not found. Task will be created without client association.`,
              data: row as unknown as Record<string, unknown>
              });
          }
        }

        // Find assigned user
        let assignedToId: string | null = null;
        if (row.assignedToEmail && row.assignedToEmail.trim() !== '') {
          const email = row.assignedToEmail.trim().toLowerCase();
          assignedToId = userMap.get(email) || null;
          
          if (!assignedToId) {
            result.warnings.push({
              row: rowNumber,
              warning: `User with email '${row.assignedToEmail}' not found. Task will be created unassigned.`,
              data: row as unknown as Record<string, unknown>
              });
          }
        }

        // Find creator user
        let createdById = currentUser.id; // default to current user
        if (row.createdByEmail && row.createdByEmail.trim() !== '') {
          const email = row.createdByEmail.trim().toLowerCase();
          const creatorId = userMap.get(email);
          
          if (creatorId) {
            createdById = creatorId;
          } else {
            result.warnings.push({
              row: rowNumber,
              warning: `Creator with email '${row.createdByEmail}' not found. Using current user as creator.`,
              data: row as unknown as Record<string, unknown>
          });
          }
        }

        // Create task
        const task = await prisma.task.create({
          data: {
            title: row.title.trim(),
            description: row.description?.trim() || null,
            status: status as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
            priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
            dueDate,
            clientId,
            assignedToId,
            createdById
          }
        });

        result.imported++;
        result.importedIds.push(task.id);

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
        title: `Task Import - ${file.name}`,
        type: 'TASK',
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
    console.error('Error importing tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/import/tasks - Get import template
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const csvTemplate = [
      'title,description,status,priority,dueDate,clientDomain,assignedToEmail,createdByEmail',
      'Update website content,Update the homepage content and images,OPEN,HIGH,2024-02-15,example.com,developer@company.com,manager@company.com',
      'Fix contact form,Contact form is not sending emails properly,IN_PROGRESS,URGENT,2024-02-10,test-site.org,developer@company.com,',
      'SEO optimization,Optimize website for search engines,OPEN,MEDIUM,2024-03-01,example.com,,manager@company.com'
    ].join('\n');

    return new NextResponse(csvTemplate, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="task_import_template.csv"'
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