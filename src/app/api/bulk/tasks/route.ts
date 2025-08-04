import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '../../../../lib/prisma';
import { TaskStatus, Priority } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
const BulkUpdateSchema = z.object({
  operation: z.enum(['update', 'delete', 'complete', 'assign', 'updateStatus', 'updatePriority']),
  taskIds: z.array(z.string()).min(1, 'At least one task ID is required'),
  data: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    assignedToId: z.string().optional(),
    dueDate: z.string().optional(),
    estimatedHours: z.number().min(0).optional(),
    description: z.string().optional()
  }).optional()
});

const BulkCreateSchema = z.object({
  operation: z.literal('create'),
  tasks: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    status: z.nativeEnum(TaskStatus).default('OPEN'),
    priority: z.nativeEnum(Priority).default('MEDIUM'),
    dueDate: z.string().optional(),
    clientId: z.string().min(1, 'Client ID is required'),
    assignedToId: z.string().optional(),
    estimatedHours: z.number().min(0).optional()
  })).min(1, 'At least one task is required')
});

interface BulkOperationResult {
  success: boolean;
  operation: string;
  totalRequested: number;
  successful: number;
  failed: number;
  errors: Array<{
    id?: string;
    title?: string;
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

    const body = await request.json();
    const operation = body.operation;

    let result: BulkOperationResult;

    switch (operation) {
      case 'create':
        result = await handleBulkCreate(body);
        break;
      case 'update':
      case 'complete':
      case 'assign':
      case 'updateStatus':
      case 'updatePriority':
        result = await handleBulkUpdate(body);
        break;
      case 'delete':
        result = await handleBulkDelete(body);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid operation. Supported operations: create, update, delete, complete, assign, updateStatus, updatePriority' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Bulk task operation error:', error);
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
  const { tasks } = validatedData;

  const result: BulkOperationResult = {
    success: true,
    operation: 'create',
    totalRequested: tasks.length,
    successful: 0,
    failed: 0,
    errors: [],
    results: []
  };

  // Validate client IDs exist
  const clientIds = [...new Set(tasks.map(t => t.clientId))];
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

  const validClientIds = new Set(existingClients.map(c => c.id));

  // Validate assigned user IDs if provided
  const assignedUserIds = tasks
    .map(t => t.assignedToId)
    .filter(id => id !== undefined) as string[];
  
  const existingUsers = assignedUserIds.length > 0 ? await prisma.user.findMany({
    where: {
      id: {
        in: assignedUserIds
      }
    },
    select: {
      id: true,
      email: true
    }
  }) : [];

  const validUserIds = new Set(existingUsers.map(u => u.id));

  // Process each task
  for (const taskData of tasks) {
    try {
      // Validate client exists
      if (!validClientIds.has(taskData.clientId)) {
        result.failed++;
        result.errors.push({
          title: taskData.title,
          error: 'Invalid client ID'
        });
        continue;
      }

      // Validate assigned user if provided
      if (taskData.assignedToId && !validUserIds.has(taskData.assignedToId)) {
        result.failed++;
        result.errors.push({
          title: taskData.title,
          error: 'Invalid assigned user ID'
        });
        continue;
      }

      // Parse due date if provided
      let dueDate: Date | undefined;
      if (taskData.dueDate) {
        dueDate = new Date(taskData.dueDate);
        if (isNaN(dueDate.getTime())) {
          result.failed++;
          result.errors.push({
            title: taskData.title,
            error: 'Invalid due date format'
          });
          continue;
        }
      }

      const newTask = await prisma.task.create({
        data: {
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          dueDate: dueDate,
          clientId: taskData.clientId,
          assignedToId: taskData.assignedToId,
          estimatedHours: taskData.estimatedHours,
          createdById: 'system'
        },
        include: {
          client: {
            select: {
              domainName: true
            }
          },
          assignedTo: {
            select: {
              email: true
            }
          }
        }
      });

      result.successful++;
      result.results?.push({
        id: newTask.id,
        title: newTask.title,
        clientDomain: newTask.client?.domainName || 'No client',
        assignedTo: newTask.assignedTo?.email,
        status: 'created'
      });

    } catch (error) {
      result.failed++;
      result.errors.push({
        title: taskData.title,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

async function handleBulkUpdate(body: Record<string, unknown>): Promise<BulkOperationResult> {
  const validatedData = BulkUpdateSchema.parse(body);
  const { operation, taskIds, data } = validatedData;

  const result: BulkOperationResult = {
    success: true,
    operation,
    totalRequested: taskIds.length,
    successful: 0,
    failed: 0,
    errors: [],
    results: []
  };

  // Verify tasks exist and user has permission
  const existingTasks = await prisma.task.findMany({
    where: {
      id: {
        in: taskIds
      }
    },
    include: {
      client: {
        select: {
          domainName: true
        }
      },
      assignedTo: {
        select: {
          email: true
        }
      }
    }
  });

  const existingIds = new Set(existingTasks.map(t => t.id));
  const missingIds = taskIds.filter(id => !existingIds.has(id));

  // Add errors for missing tasks
  missingIds.forEach(id => {
    result.failed++;
    result.errors.push({
      id,
      error: 'Task not found'
    });
  });

  // Prepare update data based on operation
  let updateData: Record<string, unknown> = {};
  
  switch (operation) {
    case 'complete':
      updateData = { 
        status: 'COMPLETED',
        completedAt: new Date()
      };
      break;
    case 'assign':
      if (!data?.assignedToId) {
        result.success = false;
        result.errors.push({
          error: 'Assigned user ID is required for assign operation'
        });
        return result;
      }
      // Validate user exists
      const user = await prisma.user.findUnique({
        where: { id: data.assignedToId }
      });
      if (!user) {
        result.success = false;
        result.errors.push({
          error: 'Invalid assigned user ID'
        });
        return result;
      }
      updateData = { assignedToId: data.assignedToId };
      break;
    case 'updateStatus':
      if (!data?.status) {
        result.success = false;
        result.errors.push({
          error: 'Status is required for updateStatus operation'
        });
        return result;
      }
      updateData = { status: data.status };
      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
      break;
    case 'updatePriority':
      if (!data?.priority) {
        result.success = false;
        result.errors.push({
          error: 'Priority is required for updatePriority operation'
        });
        return result;
      }
      updateData = { priority: data.priority };
      break;
    case 'update':
      updateData = { ...data } as Record<string, unknown>;
      if (data?.dueDate) {
        const dueDate = new Date(data.dueDate);
        if (isNaN(dueDate.getTime())) {
          result.success = false;
          result.errors.push({
            error: 'Invalid due date format'
          });
          return result;
        }
        updateData.dueDate = dueDate;
      }
      if (data?.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
      break;
  }

  // Process valid tasks
  for (const task of existingTasks) {
    try {
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: updateData,
        include: {
          client: {
            select: {
              domainName: true
            }
          },
          assignedTo: {
            select: {
              email: true
            }
          }
        }
      });

      result.successful++;
      result.results?.push({
        id: updatedTask.id,
        title: updatedTask.title,
        clientDomain: updatedTask.client?.domainName || 'No client',
        assignedTo: updatedTask.assignedTo?.email,
        status: 'updated'
      });

    } catch (error) {
      result.failed++;
      result.errors.push({
        id: task.id,
        title: task.title,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

async function handleBulkDelete(body: Record<string, unknown>): Promise<BulkOperationResult> {
  const validatedData = BulkUpdateSchema.parse(body);
  const { taskIds } = validatedData;

  const result: BulkOperationResult = {
    success: true,
    operation: 'delete',
    totalRequested: taskIds.length,
    successful: 0,
    failed: 0,
    errors: [],
    results: []
  };

  // Check for dependencies before deletion
  const tasksWithDependencies = await prisma.task.findMany({
    where: {
      id: {
        in: taskIds
      }
    },
    include: {
      client: {
        select: {
          domainName: true
        }
      },
      _count: {
        select: {
          timeEntries: true
        }
      }
    }
  });

  // Process each task
  for (const task of tasksWithDependencies) {
    try {
      // Check if task has time entries
      if (task._count.timeEntries > 0) {
        result.failed++;
        result.errors.push({
          id: task.id,
          title: task.title,
          error: `Cannot delete task with existing time entries (${task._count.timeEntries} entries)`
        });
        continue;
      }

      await prisma.task.delete({
        where: { id: task.id }
      });

      result.successful++;
      result.results?.push({
        id: task.id,
        title: task.title,
        clientDomain: task.client?.domainName || 'No client',
        status: 'deleted'
      });

    } catch (error) {
      result.failed++;
      result.errors.push({
        id: task.id,
        title: task.title,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Handle tasks that don't exist
  const existingIds = new Set(tasksWithDependencies.map(t => t.id));
  const missingIds = taskIds.filter(id => !existingIds.has(id));
  
  missingIds.forEach(id => {
    result.failed++;
    result.errors.push({
      id,
      error: 'Task not found'
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
          tasks: [
            {
              title: 'Example Task',
              description: 'Task description',
              status: 'TODO',
              priority: 'MEDIUM',
              dueDate: '2024-12-31T23:59:59.000Z',
              clientId: 'client-id-here',
              assignedToId: 'user-id-here',
              estimatedHours: 2
            }
          ]
        },
        bulkUpdate: {
          operation: 'update',
          taskIds: ['task-id-1', 'task-id-2'],
          data: {
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            assignedToId: 'user-id-here'
          }
        },
        bulkComplete: {
          operation: 'complete',
          taskIds: ['task-id-1', 'task-id-2']
        },
        bulkAssign: {
          operation: 'assign',
          taskIds: ['task-id-1', 'task-id-2'],
          data: {
            assignedToId: 'user-id-here'
          }
        },
        bulkDelete: {
          operation: 'delete',
          taskIds: ['task-id-1', 'task-id-2']
        }
      });
    }

    return NextResponse.json({
      supportedOperations: [
        {
          name: 'create',
          description: 'Create multiple tasks',
          requiredFields: ['tasks'],
          permissions: ['ALL']
        },
        {
          name: 'update',
          description: 'Update multiple tasks',
          requiredFields: ['taskIds', 'data'],
          permissions: ['ALL']
        },
        {
          name: 'complete',
          description: 'Mark multiple tasks as completed',
          requiredFields: ['taskIds'],
          permissions: ['ALL']
        },
        {
          name: 'assign',
          description: 'Assign multiple tasks to a user',
          requiredFields: ['taskIds', 'data.assignedToId'],
          permissions: ['ALL']
        },
        {
          name: 'updateStatus',
          description: 'Update status of multiple tasks',
          requiredFields: ['taskIds', 'data.status'],
          permissions: ['ALL']
        },
        {
          name: 'updatePriority',
          description: 'Update priority of multiple tasks',
          requiredFields: ['taskIds', 'data.priority'],
          permissions: ['ALL']
        },
        {
          name: 'delete',
          description: 'Delete multiple tasks (only if no time entries)',
          requiredFields: ['taskIds'],
          permissions: ['ALL']
        }
      ]
    });

  } catch (error: unknown) {
    console.error('Bulk task operations info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}