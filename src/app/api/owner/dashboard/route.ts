import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/owner/dashboard - Get owner dashboard metrics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    let startDate: Date;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'ytd':
        startDate = startOfYear;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch all necessary data
    const [clients, tasks, timeEntries, invoices] = await Promise.all([
      prisma.client.findMany({
        select: {
          id: true,
          domainName: true,
          annualHourAllowance: true,
          yearlyHoursUsed: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.task.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          clientId: true,
          createdAt: true,
          updatedAt: true,
          estimatedHours: true,
        },
      }),
      prisma.timeEntry.findMany({
        where: {
          startTime: {
            gte: startDate,
            lte: now,
          },
        },
        select: {
          id: true,
          duration: true,
          billableAmount: true,
          developerAmount: true,
          isWithinAllowance: true,
          billingStatus: true,
          startTime: true,
          task: {
            select: {
              clientId: true,
              client: {
                select: {
                  id: true,
                  domainName: true,
                },
              },
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          generatedAt: {
            gte: startDate,
            lte: now,
          },
        },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          generatedAt: true,
          clientId: true,
        },
      }),
    ]);

    // Calculate business metrics
    const totalRevenue = timeEntries.reduce((sum, entry) => sum + (entry.billableAmount || 0), 0);
    const totalCosts = timeEntries.reduce((sum, entry) => sum + (entry.developerAmount || 0), 0);
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Monthly revenue calculation
    const monthlyTimeEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= startOfMonth && entryDate <= endOfMonth;
    });
    const monthlyRevenue = monthlyTimeEntries.reduce((sum, entry) => sum + (entry.billableAmount || 0), 0);

    // Client analysis
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const activeClients = clients.filter(client => {
      const lastActivity = new Date(client.updatedAt);
      return lastActivity > thirtyDaysAgo;
    }).length;

    const atRiskClients = clients.filter(client => {
      const lastActivity = new Date(client.updatedAt);
      return lastActivity < sixtyDaysAgo;
    }).length;

    // Task analysis
    const openTasks = tasks.filter(task => 
      ['pending', 'in_progress'].includes(task.status.toLowerCase())
    ).length;

    const completedTasksThisMonth = tasks.filter(task => {
      if (task.status.toLowerCase() !== 'completed') return false;
      const completedDate = new Date(task.updatedAt);
      return completedDate >= startOfMonth && completedDate <= endOfMonth;
    }).length;

    const urgentTasks = tasks.filter(task => 
      task.priority === 'urgent' && ['pending', 'in_progress'].includes(task.status.toLowerCase())
    ).length;

    // Revenue trends (last 6 months)
    const revenueTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthEntries = timeEntries.filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entryDate >= monthStart && entryDate <= monthEnd;
      });
      
      const monthRevenue = monthEntries.reduce((sum, entry) => sum + (entry.billableAmount || 0), 0);
      
      revenueTrends.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue,
        hours: monthEntries.reduce((sum, entry) => sum + ((entry.duration || 0) / 60), 0),
      });
    }

    // Top clients by revenue
    const clientRevenue = new Map<string, { name: string; revenue: number; hours: number; tasks: number }>();
    
    timeEntries.forEach(entry => {
      if (entry.task?.client) {
        const clientId = entry.task.client.id;
        const clientName = entry.task.client.domainName || 'Unknown';
        const current = clientRevenue.get(clientId) || { name: clientName, revenue: 0, hours: 0, tasks: 0 };
        
        current.revenue += entry.billableAmount || 0;
        current.hours += (entry.duration || 0) / 60;
        clientRevenue.set(clientId, current);
      }
    });

    // Add task counts
    tasks.forEach(task => {
      if (task.clientId) {
        const current = clientRevenue.get(task.clientId);
        if (current) {
          current.tasks += 1;
        }
      }
    });

    const topClients = Array.from(clientRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Recent activity
    const recentTasks = tasks
      .filter(task => {
        const taskDate = new Date(task.updatedAt);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return taskDate > sevenDaysAgo;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    // Invoice statistics
    const invoiceStats = {
      total: invoices.length,
      paid: invoices.filter(inv => inv.status === 'PAID').length,
      pending: invoices.filter(inv => inv.status === 'SENT').length,
      overdue: invoices.filter(inv => inv.status === 'OVERDUE').length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paidAmount: invoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.totalAmount, 0),
    };

    // Health indicators
    const healthIndicators = {
      cashFlow: invoiceStats.paidAmount / (invoiceStats.totalAmount || 1) * 100,
      clientRetention: (clients.length - atRiskClients) / clients.length * 100,
      taskCompletion: completedTasksThisMonth / (completedTasksThisMonth + openTasks || 1) * 100,
      profitability: profitMargin,
    };

    const dashboardData = {
      metrics: {
        totalRevenue,
        monthlyRevenue,
        totalClients: clients.length,
        activeClients,
        atRiskClients,
        openTasks,
        urgentTasks,
        completedTasksThisMonth,
        profitMargin,
        averageProjectValue: clients.length > 0 ? totalRevenue / clients.length : 0,
        totalHours: timeEntries.reduce((sum, entry) => sum + ((entry.duration || 0) / 60), 0),
      },
      trends: {
        revenue: revenueTrends,
        growth: revenueTrends.length >= 2 ? 
          ((revenueTrends[revenueTrends.length - 1].revenue - revenueTrends[revenueTrends.length - 2].revenue) / 
           (revenueTrends[revenueTrends.length - 2].revenue || 1)) * 100 : 0,
      },
      topClients,
      recentActivity: recentTasks.map(task => ({
        id: task.id,
        type: task.status.toLowerCase() === 'completed' ? 'task_completed' : 'task_created',
        description: task.title,
        date: new Date(task.updatedAt).toLocaleDateString(),
        priority: task.priority,
      })),
      invoices: invoiceStats,
      health: healthIndicators,
      timeRange,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error fetching owner dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}