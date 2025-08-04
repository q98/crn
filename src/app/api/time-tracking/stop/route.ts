import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/time-tracking/stop - Stop active timer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { timerId } = body;

    // If timerId is provided, stop specific timer, otherwise stop the most recent active timer
    const whereClause: { id?: string; endTime: null } = timerId 
      ? { id: timerId, endTime: null }
      : { endTime: null };

    // Find the active timer
    const activeTimer = await prisma.timeEntry.findFirst({
      where: whereClause,
      include: {
        task: {
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
        },
        developer: {
          select: {
            id: true,
            name: true,
            hourlyRate: true
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    if (!activeTimer) {
      return NextResponse.json(
        { error: 'No active timer found' },
        { status: 404 }
      );
    }

    const endTime = new Date();
    const startTime = new Date(activeTimer.startTime);
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes

    // Calculate billing information
    const client = activeTimer.task.client;
    if (!client) {
      throw new Error('Client not found for this task');
    }

    const hourlyRate = activeTimer.hourlyRate || activeTimer.developer?.hourlyRate || 75;
    const billingInfo = await calculateBillingInfo(client, duration, hourlyRate);

    // Update the time entry with end time and billing info
    const updatedTimeEntry = await prisma.timeEntry.update({
      where: { id: activeTimer.id },
      data: {
        endTime,
        duration,
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
            name: true
          }
        }
      }
    });

    // Update client's yearly hours used if not within allowance
    if (!billingInfo.isWithinAllowance) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          yearlyHoursUsed: {
            increment: duration / 60 // Convert minutes to hours
          }
        }
      });
    }

    return NextResponse.json({
      message: 'Timer stopped successfully',
      timeEntry: updatedTimeEntry,
      duration: duration,
      billingInfo
    });
  } catch (error) {
    console.error('Error stopping timer:', error);
    return NextResponse.json(
      { error: 'Failed to stop timer' },
      { status: 500 }
    );
  }
}

// Helper function to calculate billing information
async function calculateBillingInfo(
  client: {
    id: string;
    domainName: string;
    annualHourAllowance: number;
    yearlyHoursUsed: number;
    lastYearReset: Date | null;
  },
  durationMinutes: number,
  hourlyRate: number
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const durationHours = durationMinutes / 60;
  
  // Check if we need to reset yearly hours (new calendar year)
  let yearlyHoursUsed = client.yearlyHoursUsed;
  if (!client.lastYearReset || new Date(client.lastYearReset).getFullYear() < currentYear) {
    yearlyHoursUsed = 0;
    // Update the client's year reset date
    await prisma.client.update({
      where: { id: client.id },
      data: {
        yearlyHoursUsed: 0,
        lastYearReset: now
      }
    });
  }
  
  const totalHoursAfterThis = yearlyHoursUsed + durationHours;
  const isWithinAllowance = totalHoursAfterThis <= client.annualHourAllowance;
  
  let billableAmount = 0;
  let developerAmount = 0;
  
  if (!isWithinAllowance) {
    // Calculate billable amount (only for hours exceeding allowance)
    const billableHours = Math.max(0, totalHoursAfterThis - client.annualHourAllowance);
    const actualBillableHours = Math.min(billableHours, durationHours);
    
    billableAmount = actualBillableHours * hourlyRate;
    developerAmount = actualBillableHours * hourlyRate * 0.7; // 70% to developer
  }
  
  return {
    isWithinAllowance,
    billableAmount,
    developerAmount,
    billingStatus: isWithinAllowance ? 'WRITTEN_OFF' : 'PENDING'
  };
}