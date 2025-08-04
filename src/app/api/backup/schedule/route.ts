import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ScheduledBackupData {
  type: string;
  name: string;
  frequency: string;
  time: string;
  includeCredentials: boolean;
  format: string;
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
  userId: string;
}

// POST /api/backup/schedule - Create a scheduled backup
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      frequency,
      time,
      includeCredentials = false,
      format = 'json',
      enabled = true
    } = await request.json();

    // Validate required fields
    if (!name || !frequency || !time) {
      return NextResponse.json(
        { error: 'Name, frequency, and time are required' },
        { status: 400 }
      );
    }

    // Validate frequency
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Frequency must be DAILY, WEEKLY, or MONTHLY' },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return NextResponse.json(
        { error: 'Time must be in HH:MM format (24-hour)' },
        { status: 400 }
      );
    }

    // Calculate next run time
    const nextRun = calculateNextRun(frequency, time);

    // Create scheduled backup record
    // We'll store this in a JSON field in the Report model for now
    const scheduledBackup = await prisma.report.create({
      data: {
        title: `Scheduled Backup: ${name}`,
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: nextRun.toISOString()
        },
        totalHours: 0,
        totalAmount: 0,
        clientId: 'SYSTEM',
        generatedAt: new Date(),
        reportData: {
          type: 'SCHEDULED_BACKUP',
          name,
          frequency,
          time,
          includeCredentials,
          format,
          enabled,
          nextRun: nextRun.toISOString(),
          userId: session.user.id
        }
      }
    });

    return NextResponse.json({
      message: 'Scheduled backup created successfully',
      schedule: {
        id: scheduledBackup.id,
        name,
        frequency,
        time,
        includeCredentials,
        format,
        enabled,
        nextRun,
        createdAt: scheduledBackup.generatedAt
      }
    });

  } catch (error) {
    console.error('Error creating scheduled backup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/backup/schedule - Get scheduled backups
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get scheduled backups from Report model
    const schedules = await prisma.report.findMany({
      where: {
        title: {
          startsWith: 'Scheduled Backup:'
        },
        clientId: session.user.id
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    const scheduledBackups = schedules.map(schedule => {
      const data = schedule.reportData as unknown as ScheduledBackupData;
      return {
        id: schedule.id,
        name: data.name,
        frequency: data.frequency,
        time: data.time,
        includeCredentials: data.includeCredentials,
        format: data.format,
        enabled: data.enabled,
        nextRun: new Date(data.nextRun),
        lastRun: data.lastRun ? new Date(data.lastRun) : undefined,
        createdAt: schedule.generatedAt,
        updatedAt: schedule.generatedAt
      };
    });

    return NextResponse.json({
      schedules: scheduledBackups
    });

  } catch (error) {
    console.error('Error fetching scheduled backups:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/backup/schedule - Update a scheduled backup
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      id,
      name,
      frequency,
      time,
      includeCredentials,
      format,
      enabled
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // Find the existing schedule
    const existingSchedule = await prisma.report.findFirst({
      where: {
        id,
        title: {
          startsWith: 'Scheduled Backup:'
        },
        clientId: session.user.id
      }
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Scheduled backup not found' },
        { status: 404 }
      );
    }

    const existingData = existingSchedule.reportData as unknown as ScheduledBackupData;
    const nextRun = calculateNextRun(frequency || existingData.frequency, time || existingData.time);

    // Update the schedule
    const updatedSchedule = await prisma.report.update({
      where: { id },
      data: {
        title: `Scheduled Backup: ${name || existingData.name}`,
        dateRange: {
          startDate: (existingSchedule.dateRange as { startDate?: string })?.startDate || new Date().toISOString(),
          endDate: nextRun.toISOString()
        },
        reportData: {
          ...existingData,
          name: name || existingData.name,
          frequency: frequency || existingData.frequency,
          time: time || existingData.time,
          includeCredentials: includeCredentials !== undefined ? includeCredentials : existingData.includeCredentials,
          format: format || existingData.format,
          enabled: enabled !== undefined ? enabled : existingData.enabled,
          nextRun: nextRun.toISOString()
        }
      }
    });

    const data = updatedSchedule.reportData as unknown as ScheduledBackupData;
    return NextResponse.json({
      message: 'Scheduled backup updated successfully',
      schedule: {
        id: updatedSchedule.id,
        name: data.name,
        frequency: data.frequency,
        time: data.time,
        includeCredentials: data.includeCredentials,
        format: data.format,
        enabled: data.enabled,
        nextRun: new Date(data.nextRun),
        lastRun: data.lastRun ? new Date(data.lastRun) : undefined,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating scheduled backup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/backup/schedule - Delete a scheduled backup
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // Find and delete the schedule
    const deletedSchedule = await prisma.report.deleteMany({
      where: {
        id,
        title: {
          startsWith: 'Scheduled Backup:'
        },
        clientId: session.user.id
      }
    });

    if (deletedSchedule.count === 0) {
      return NextResponse.json(
        { error: 'Scheduled backup not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Scheduled backup deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting scheduled backup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next run time
function calculateNextRun(frequency: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const nextRun = new Date();
  
  nextRun.setHours(hours, minutes, 0, 0);
  
  // If the time has already passed today, move to the next occurrence
  if (nextRun <= now) {
    switch (frequency) {
      case 'DAILY':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'WEEKLY':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'MONTHLY':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
  }
  
  return nextRun;
}