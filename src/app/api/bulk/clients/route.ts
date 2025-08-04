import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../lib/prisma';
import { VerificationStatus } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
const BulkUpdateSchema = z.object({
  operation: z.enum(['update', 'delete', 'verify', 'updateAllowance']),
  clientIds: z.array(z.string()).min(1, 'At least one client ID is required'),
  data: z.object({
    verificationStatus: z.nativeEnum(VerificationStatus).optional(),
    registrar: z.string().optional(),
    annualHourAllowance: z.number().min(0).optional(),
    notes: z.string().optional(),
    cPanelUsername: z.string().optional(),
    diskUsage: z.string().optional()
  }).optional()
});

const BulkCreateSchema = z.object({
  operation: z.literal('create'),
  clients: z.array(z.object({
    domainName: z.string().min(1, 'Domain name is required'),
    cPanelUsername: z.string().optional(),
    diskUsage: z.string().optional(),
    verificationStatus: z.nativeEnum(VerificationStatus).default('UNKNOWN'),
    registrar: z.string().optional(),
    notes: z.string().optional(),
    annualHourAllowance: z.number().min(0).default(40),
    yearlyHoursUsed: z.number().min(0).default(0)
  })).min(1, 'At least one client is required')
});

interface BulkOperationResult {
  success: boolean;
  operation: string;
  totalRequested: number;
  successful: number;
  failed: number;
  errors: Array<{
    id?: string;
    domainName?: string;
    error: string;
  }>;
  results?: unknown[];
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

    // Check permissions for bulk operations
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Insufficient permissions for bulk operations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const operation = body.operation;

    let result: BulkOperationResult;

    switch (operation) {
      case 'create':
        result = await handleBulkCreate(body);
        break;
      case 'update':
      case 'verify':
      case 'updateAllowance':
        result = await handleBulkUpdate(body);
        break;
      case 'delete':
        result = await handleBulkDelete(body);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid operation. Supported operations: create, update, delete, verify, updateAllowance' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Bulk operation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleBulkCreate(body: Record<string, unknown>): Promise<BulkOperationResult> {
  const validatedData = BulkCreateSchema.parse(body);
  const { clients } = validatedData;

  const result: BulkOperationResult = {
    success: true,
    operation: 'create',
    totalRequested: clients.length,
    successful: 0,
    failed: 0,
    errors: [],
    results: []
  };

  // Check for duplicate domain names in the request
  const domainNames = clients.map(c => c.domainName.toLowerCase());
  const duplicates = domainNames.filter((name, index) => domainNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    result.success = false;
    result.errors.push({
      error: `Duplicate domain names in request: ${duplicates.join(', ')}`
    });
    return result;
  }

  // Check for existing clients
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

  // Process each client
  for (const clientData of clients) {
    try {
      if (existingDomains.has(clientData.domainName.toLowerCase())) {
        result.failed++;
        result.errors.push({
          domainName: clientData.domainName,
          error: 'Client with this domain name already exists'
        });
        continue;
      }

      const newClient = await prisma.client.create({
        data: clientData
      });

      result.successful++;
      result.results?.push({
        id: newClient.id,
        domainName: newClient.domainName,
        status: 'created'
      });

    } catch (error) {
      result.failed++;
      result.errors.push({
        domainName: clientData.domainName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

async function handleBulkUpdate(body: Record<string, unknown>): Promise<BulkOperationResult> {
  const validatedData = BulkUpdateSchema.parse(body);
  const { operation, clientIds, data } = validatedData;

  const result: BulkOperationResult = {
    success: true,
    operation,
    totalRequested: clientIds.length,
    successful: 0,
    failed: 0,
    errors: [],
    results: []
  };

  // Verify clients exist
  const existingClients = await prisma.client.findMany({
    where: {
      id: {
        in: clientIds
      }
    },
    select: {
      id: true,
      domainName: true
    }
  });

  const existingIds = new Set(existingClients.map(c => c.id));
  const missingIds = clientIds.filter(id => !existingIds.has(id));

  // Add errors for missing clients
  missingIds.forEach(id => {
    result.failed++;
    result.errors.push({
      id,
      error: 'Client not found'
    });
  });

  // Prepare update data based on operation
  let updateData: Record<string, unknown> = {};
  
  switch (operation) {
    case 'verify':
      updateData = { verificationStatus: 'VERIFIED' };
      break;
    case 'updateAllowance':
      if (!data?.annualHourAllowance) {
        result.success = false;
        result.errors.push({
          error: 'Annual hour allowance is required for updateAllowance operation'
        });
        return result;
      }
      updateData = { annualHourAllowance: data.annualHourAllowance };
      break;
    case 'update':
      updateData = data || {};
      break;
  }

  // Process valid clients
  for (const client of existingClients) {
    try {
      const updatedClient = await prisma.client.update({
        where: { id: client.id },
        data: updateData
      });

      result.successful++;
      result.results?.push({
        id: updatedClient.id,
        domainName: updatedClient.domainName,
        status: 'updated'
      });

    } catch (error) {
      result.failed++;
      result.errors.push({
        id: client.id,
        domainName: client.domainName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

async function handleBulkDelete(body: Record<string, unknown>): Promise<BulkOperationResult> {
  const validatedData = BulkUpdateSchema.parse(body);
  const { clientIds } = validatedData;

  const result: BulkOperationResult = {
    success: true,
    operation: 'delete',
    totalRequested: clientIds.length,
    successful: 0,
    failed: 0,
    errors: [],
    results: []
  };

  // Check for dependencies before deletion
  const clientsWithDependencies = await prisma.client.findMany({
    where: {
      id: {
        in: clientIds
      }
    },
    include: {
      _count: {
        select: {
          credentials: true,
          tasks: true,
          healthChecks: true
        }
      }
    }
  });

  // Process each client
  for (const client of clientsWithDependencies) {
    try {
      // Check if client has dependencies
      const hasDependencies = 
        client._count.credentials > 0 || 
        client._count.tasks > 0 || 
        client._count.healthChecks > 0;

      if (hasDependencies) {
        result.failed++;
        result.errors.push({
          id: client.id,
          domainName: client.domainName,
          error: `Cannot delete client with existing dependencies (${client._count.credentials} credentials, ${client._count.tasks} tasks, ${client._count.healthChecks} health checks)`
        });
        continue;
      }

      await prisma.client.delete({
        where: { id: client.id }
      });

      result.successful++;
      result.results?.push({
        id: client.id,
        domainName: client.domainName,
        status: 'deleted'
      });

    } catch (error) {
      result.failed++;
      result.errors.push({
        id: client.id,
        domainName: client.domainName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Handle clients that don't exist
  const existingIds = new Set(clientsWithDependencies.map(c => c.id));
  const missingIds = clientIds.filter(id => !existingIds.has(id));
  
  missingIds.forEach(id => {
    result.failed++;
    result.errors.push({
      id,
      error: 'Client not found'
    });
  });

  result.success = result.failed === 0;
  return result;
}

// GET endpoint for bulk operation templates and validation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'template') {
      return NextResponse.json({
        bulkCreate: {
          operation: 'create',
          clients: [
            {
              domainName: 'example.com',
              cPanelUsername: 'example_user',
              diskUsage: '1.2 GB',
              verificationStatus: 'PENDING',
              registrar: 'GoDaddy',
              notes: 'New client setup',
              annualHourAllowance: 40,
              yearlyHoursUsed: 0
            }
          ]
        },
        bulkUpdate: {
          operation: 'update',
          clientIds: ['client-id-1', 'client-id-2'],
          data: {
            verificationStatus: 'VERIFIED',
            registrar: 'Namecheap',
            annualHourAllowance: 50
          }
        },
        bulkVerify: {
          operation: 'verify',
          clientIds: ['client-id-1', 'client-id-2']
        },
        bulkDelete: {
          operation: 'delete',
          clientIds: ['client-id-1', 'client-id-2']
        }
      });
    }

    return NextResponse.json({
      supportedOperations: [
        {
          name: 'create',
          description: 'Create multiple clients',
          requiredFields: ['clients'],
          permissions: ['ADMIN', 'MANAGER']
        },
        {
          name: 'update',
          description: 'Update multiple clients',
          requiredFields: ['clientIds', 'data'],
          permissions: ['ADMIN', 'MANAGER']
        },
        {
          name: 'verify',
          description: 'Verify multiple clients',
          requiredFields: ['clientIds'],
          permissions: ['ADMIN', 'MANAGER']
        },
        {
          name: 'updateAllowance',
          description: 'Update annual hour allowance for multiple clients',
          requiredFields: ['clientIds', 'data.annualHourAllowance'],
          permissions: ['ADMIN', 'MANAGER']
        },
        {
          name: 'delete',
          description: 'Delete multiple clients (only if no dependencies)',
          requiredFields: ['clientIds'],
          permissions: ['ADMIN', 'MANAGER']
        }
      ]
    });

  } catch (error) {
    console.error('Bulk operations info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}