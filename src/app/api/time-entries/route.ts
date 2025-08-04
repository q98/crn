import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/time-entries - Get all time entries
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const clientId = searchParams.get('clientId');
    const developerId = searchParams.get('developerId');
    const billingStatus = searchParams.get('billingStatus');

    const whereClause: {
      taskId?: string;
      developerId?: string;
      billingStatus?: 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF';
      task?: {
        clientId: string;
      };
    } = {};
    
    if (taskId) {
      whereClause.taskId = taskId;
    }
    
    if (developerId) {
      whereClause.developerId = developerId;
    }
    
    if (billingStatus) {
      whereClause.billingStatus = billingStatus as 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF';
    }
    
    if (clientId) {
      whereClause.task = {
        clientId: clientId
      };
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        task: {
          include: {
            client: {
              select: {
                id: true,
                domainName: true,
                annualHourAllowance: true,
                yearlyHoursUsed: true
              }
            }
          }
        },
        developer: {
          select: {
            id: true,
            name: true,
            email: true,
            hourlyRate: true
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    return NextResponse.json(timeEntries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time entries' },
      { status: 500 }
    );
  }
}

// POST /api/time-entries - Create a new time entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      description,
      startTime,
      endTime,
      duration,
      taskId,
      developerId,
      hourlyRate
    }: {
      description?: string;
      startTime: string;
      endTime?: string;
      duration?: number;
      taskId: string;
      developerId?: string;
      hourlyRate?: number;
    } = body;

    // Validate required fields
    if (!taskId || !startTime) {
      return NextResponse.json(
        { error: 'Task ID and start time are required' },
        { status: 400 }
      );
    }

    // Get task and client information for billing calculations
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: {
          select: {
            id: true,
            domainName: true,
            annualHourAllowance: true,
            yearlyHoursUsed: true,
            lastYearReset: true
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Get developer information
    const developer = developerId ? await prisma.user.findUnique({
      where: { id: developerId },
      select: {
        id: true,
        name: true,
        hourlyRate: true
      }
    }) : null;

    // Calculate duration if not provided
    let calculatedDuration = duration;
    if (!calculatedDuration && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      calculatedDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
    }

    // Calculate billing information
    if (!task.client) {
      throw new Error('Client not found for this task');
    }
    const billingInfo = await calculateBillingInfo(
      task.client,
      calculatedDuration || 0,
      hourlyRate || developer?.hourlyRate || 75 // Default rate
    );

    // Create the time entry
    const timeEntry = await prisma.timeEntry.create({
      data: {
        description,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        duration: calculatedDuration,
        taskId,
        developerId,
        hourlyRate: hourlyRate || developer?.hourlyRate || 75,
        billingStatus: billingInfo.billingStatus as 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF',
        billableAmount: billingInfo.billableAmount,
        developerAmount: billingInfo.developerAmount,
        isWithinAllowance: billingInfo.isWithinAllowance
      },
      include: {
        task: {
          include: {
            client: {
              select: {
                id: true,
                domainName: true
              }
            }
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

    // Update client's yearly hours used if applicable
    if (task.client && calculatedDuration) {
      await updateClientYearlyHours(task.client.id, calculatedDuration);
    }

    return NextResponse.json(timeEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return NextResponse.json(
      { error: 'Failed to create time entry' },
      { status: 500 }
    );
  }
}

// Helper function to calculate billing information
async function calculateBillingInfo(
  client: {
    annualHourAllowance: number;
    yearlyHoursUsed: number;
    lastYearReset?: Date | null;
  },
  durationMinutes: number,
  hourlyRate: number
) {
  const durationHours = durationMinutes / 60;
  const currentYear = new Date().getFullYear();
  
  // Check if we need to reset yearly hours (new calendar year)
  const needsYearReset = !client.lastYearReset || 
    new Date(client.lastYearReset).getFullYear() < currentYear;
  
  const currentYearlyHours = needsYearReset ? 0 : client.yearlyHoursUsed;
  const remainingFreeHours = Math.max(0, client.annualHourAllowance - currentYearlyHours);
  
  // Determine how much of this time entry is within the free allowance
  const freeHoursUsed = Math.min(durationHours, remainingFreeHours);
  const billableHours = Math.max(0, durationHours - freeHoursUsed);
  
  const isWithinAllowance = billableHours === 0;
      const billingStatus = isWithinAllowance ? 'PENDING' : 'PENDING';
  const billableAmount = billableHours * hourlyRate;
  const developerAmount = durationHours * hourlyRate; // Developer always gets paid for all hours
  
  return {
    billingStatus,
    billableAmount,
    developerAmount,
    isWithinAllowance
  };
}

// Helper function to update client's yearly hours
async function updateClientYearlyHours(clientId: string, durationMinutes: number) {
  const currentYear = new Date().getFullYear();
  const durationHours = durationMinutes / 60;
  
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      yearlyHoursUsed: true,
      lastYearReset: true
    }
  });
  
  if (!client) return;
  
  // Check if we need to reset yearly hours (new calendar year)
  const needsYearReset = !client.lastYearReset || 
    new Date(client.lastYearReset).getFullYear() < currentYear;
  
  const newYearlyHours = needsYearReset ? durationHours : client.yearlyHoursUsed + durationHours;
  
  await prisma.client.update({
    where: { id: clientId },
    data: {
      yearlyHoursUsed: newYearlyHours,
      lastYearReset: needsYearReset ? new Date() : client.lastYearReset
    }
  });
}