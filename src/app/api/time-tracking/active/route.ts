import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/time-tracking/active - Get active timer
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the most recent active timer (entry without end time)
    const activeTimer = await prisma.timeEntry.findFirst({
      where: {
        endTime: null
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
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    if (!activeTimer) {
      return NextResponse.json({ activeTimer: null });
    }

    // Format the response to match the frontend interface
    const formattedTimer = {
      id: activeTimer.id,
      taskTitle: activeTimer.task.title,
      clientName: activeTimer.task.client?.domainName || 'Unknown Client',
      startTime: activeTimer.startTime.toISOString(),
      description: activeTimer.description || ''
    };

    return NextResponse.json({ activeTimer: formattedTimer });
  } catch (error) {
    console.error('Error fetching active timer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active timer' },
      { status: 500 }
    );
  }
}