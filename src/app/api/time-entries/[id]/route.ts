import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/time-entries/[id] - Get a specific time entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const timeEntry = await prisma.timeEntry.findUnique({
      where: { id },
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
      }
    });

    if (!timeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(timeEntry);
  } catch (error) {
    console.error('Error fetching time entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time entry' },
      { status: 500 }
    );
  }
}

// PUT /api/time-entries/[id] - Update a specific time entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      description,
      startTime,
      endTime,
      duration,
      hourlyRate,
      billingStatus
    }: {
      description?: string;
      startTime?: string;
      endTime?: string;
      duration?: number;
      hourlyRate?: number;
      billingStatus?: string;
    } = body;

    // Check if time entry exists
    const existingTimeEntry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            client: {
              select: {
                id: true,
                annualHourAllowance: true,
                yearlyHoursUsed: true,
                lastYearReset: true
              }
            }
          }
        }
      }
    });

    if (!existingTimeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    // Calculate new duration if start/end times changed
    let newDuration = duration;
    if (startTime && endTime && !duration) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      newDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
    }

    // Recalculate billing if duration or rate changed
    let billingInfo: {
      billingStatus?: string;
      billableAmount?: number;
      developerAmount?: number;
      isWithinAllowance?: boolean;
    } = {};
    if (newDuration !== existingTimeEntry.duration || hourlyRate !== existingTimeEntry.hourlyRate) {
      const effectiveRate = hourlyRate || existingTimeEntry.hourlyRate || 75;
      if (!existingTimeEntry.task.client) {
        throw new Error('Client not found for this time entry');
      }
      billingInfo = await calculateBillingInfo(
        existingTimeEntry.task.client,
        newDuration || existingTimeEntry.duration || 0,
        effectiveRate,
        existingTimeEntry.duration || 0 // Previous duration to adjust client hours
      );
    }

    // Prepare update data
    const updateData: {
      description?: string;
      startTime?: Date;
      endTime?: Date | null;
      duration?: number;
      hourlyRate?: number;
      billingStatus?: 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF';
      billableAmount?: number;
      developerAmount?: number;
      isWithinAllowance?: boolean;
    } = {};
    if (description !== undefined) updateData.description = description;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
    if (newDuration !== undefined) updateData.duration = newDuration;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
    if (billingStatus !== undefined) updateData.billingStatus = billingStatus as 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF';
    // Note: developerId cannot be updated directly through this endpoint
    
    // Add calculated billing info if recalculated
    if (Object.keys(billingInfo).length > 0) {
              updateData.billingStatus = billingInfo.billingStatus as 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF';
      updateData.billableAmount = billingInfo.billableAmount;
      updateData.developerAmount = billingInfo.developerAmount;
      updateData.isWithinAllowance = billingInfo.isWithinAllowance;
    }

    const updatedTimeEntry = await prisma.timeEntry.update({
      where: { id },
      data: updateData,
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

    // Update client yearly hours if duration changed
    if (newDuration !== existingTimeEntry.duration && existingTimeEntry.task.client) {
      const durationDiff = (newDuration || 0) - (existingTimeEntry.duration || 0);
      if (durationDiff !== 0) {
        await adjustClientYearlyHours(existingTimeEntry.task.client.id, durationDiff);
      }
    }

    return NextResponse.json(updatedTimeEntry);
  } catch (error) {
    console.error('Error updating time entry:', error);
    return NextResponse.json(
      { error: 'Failed to update time entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/time-entries/[id] - Delete a specific time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Get time entry details before deletion for client hour adjustment
    const timeEntry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            client: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (!timeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    // Delete the time entry
    await prisma.timeEntry.delete({
      where: { id }
    });

    // Adjust client yearly hours (subtract the deleted entry's duration)
    if (timeEntry.task.client && timeEntry.duration) {
      await adjustClientYearlyHours(timeEntry.task.client.id, -timeEntry.duration);
    }

    return NextResponse.json(
      { message: 'Time entry deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete time entry' },
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
  hourlyRate: number,
  previousDurationMinutes: number = 0
) {
  const durationHours = durationMinutes / 60;
  const previousDurationHours = previousDurationMinutes / 60;
  const currentYear = new Date().getFullYear();
  
  // Check if we need to reset yearly hours (new calendar year)
  const needsYearReset = !client.lastYearReset || 
    new Date(client.lastYearReset).getFullYear() < currentYear;
  
  // Adjust for previous duration (in case of update)
  let adjustedYearlyHours = needsYearReset ? 0 : client.yearlyHoursUsed - previousDurationHours;
  adjustedYearlyHours = Math.max(0, adjustedYearlyHours);
  
  const remainingFreeHours = Math.max(0, client.annualHourAllowance - adjustedYearlyHours);
  
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

// Helper function to adjust client's yearly hours (for updates/deletions)
async function adjustClientYearlyHours(clientId: string, durationMinutesDiff: number) {
  const currentYear = new Date().getFullYear();
  const durationHoursDiff = durationMinutesDiff / 60;
  
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
  
  const newYearlyHours = needsYearReset ? 
    Math.max(0, durationHoursDiff) : 
    Math.max(0, client.yearlyHoursUsed + durationHoursDiff);
  
  await prisma.client.update({
    where: { id: clientId },
    data: {
      yearlyHoursUsed: newYearlyHours,
      lastYearReset: needsYearReset ? new Date() : client.lastYearReset
    }
  });
}