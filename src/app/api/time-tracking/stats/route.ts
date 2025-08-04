import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/time-tracking/stats - Get time tracking statistics
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get time entries for different periods
    const [todayEntries, weekEntries, monthEntries, activeTimers] = await Promise.all([
      // Today's entries
      prisma.timeEntry.findMany({
        where: {
          startTime: {
            gte: today
          },
          endTime: {
            not: null
          }
        },
        select: {
          duration: true,
          billableAmount: true,
          isWithinAllowance: true
        }
      }),
      
      // This week's entries
      prisma.timeEntry.findMany({
        where: {
          startTime: {
            gte: weekStart
          },
          endTime: {
            not: null
          }
        },
        select: {
          duration: true,
          billableAmount: true,
          isWithinAllowance: true
        }
      }),
      
      // This month's entries
      prisma.timeEntry.findMany({
        where: {
          startTime: {
            gte: monthStart
          },
          endTime: {
            not: null
          }
        },
        select: {
          duration: true,
          billableAmount: true,
          isWithinAllowance: true
        }
      }),
      
      // Active timers (entries without end time)
      prisma.timeEntry.count({
        where: {
          endTime: null
        }
      })
    ]);

    // Calculate statistics
    const calculateStats = (entries: Array<{ duration: number | null; billableAmount: number | null; isWithinAllowance: boolean }>) => {
      const totalMinutes = entries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
      const billableMinutes = entries
        .filter(entry => !entry.isWithinAllowance)
        .reduce((sum, entry) => sum + (entry.duration || 0), 0);
      const totalEarnings = entries.reduce((sum, entry) => sum + (entry.billableAmount || 0), 0);
      
      return {
        totalHours: totalMinutes / 60,
        billableHours: billableMinutes / 60,
        totalEarnings
      };
    };

    const todayStats = calculateStats(todayEntries);
    const weekStats = calculateStats(weekEntries);
    const monthStats = calculateStats(monthEntries);

    const stats = {
      totalHoursToday: todayStats.totalHours,
      totalHoursWeek: weekStats.totalHours,
      totalHoursMonth: monthStats.totalHours,
      billableHoursToday: todayStats.billableHours,
      billableHoursWeek: weekStats.billableHours,
      billableHoursMonth: monthStats.billableHours,
      activeTimers,
      totalEarningsMonth: monthStats.totalEarnings
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching time tracking stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time tracking stats' },
      { status: 500 }
    );
  }
}