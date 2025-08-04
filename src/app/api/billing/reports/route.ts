import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/billing/reports - Get billing reports and analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const clientId = searchParams.get('clientId');
    const developerId = searchParams.get('developerId');

    // Default to current month if no dates provided
    const defaultStartDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const defaultEndDate = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    let reportData;

    switch (reportType) {
      case 'summary':
        reportData = await generateSummaryReport(defaultStartDate, defaultEndDate, clientId, developerId);
        break;
      case 'client-breakdown':
        reportData = await generateClientBreakdown(defaultStartDate, defaultEndDate, clientId);
        break;
      case 'developer-payment':
        reportData = await generateDeveloperPaymentReport(defaultStartDate, defaultEndDate, developerId);
        break;
      case 'allowance-tracking':
        reportData = await generateAllowanceTrackingReport(clientId);
        break;
      case 'revenue-analysis':
        reportData = await generateRevenueAnalysis(defaultStartDate, defaultEndDate);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      reportType,
      dateRange: {
        startDate: defaultStartDate,
        endDate: defaultEndDate
      },
      generatedAt: new Date(),
      data: reportData
    });
  } catch (error) {
    console.error('Error generating billing report:', error);
    return NextResponse.json(
      { error: 'Failed to generate billing report' },
      { status: 500 }
    );
  }
}

// Generate billing summary report
interface WhereClause {
  startTime: {
    gte: Date;
    lte: Date;
  };
  task?: { clientId: string };
  developerId?: string;
}

async function generateSummaryReport(
  startDate: Date,
  endDate: Date,
  clientId?: string | null,
  developerId?: string | null
) {
  const whereClause: WhereClause = {
    startTime: {
      gte: startDate,
      lte: endDate
    }
  };

  if (clientId) {
    whereClause.task = { clientId };
  }

  if (developerId) {
    whereClause.developerId = developerId;
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
          hourlyRate: true
        }
      }
    }
  });

  const totalHours = timeEntries.reduce((sum, entry) => sum + ((entry.duration || 0) / 60), 0);
  const totalBillableAmount = timeEntries.reduce((sum, entry) => sum + (entry.billableAmount || 0), 0);
  const totalDeveloperAmount = timeEntries.reduce((sum, entry) => sum + (entry.developerAmount || 0), 0);
  const freeHours = timeEntries.filter(entry => entry.isWithinAllowance).reduce((sum, entry) => sum + ((entry.duration || 0) / 60), 0);
  const billableHours = totalHours - freeHours;

  const billingStatusBreakdown = {
    pending: timeEntries.filter(entry => entry.billingStatus === 'PENDING').length,
    billed: timeEntries.filter(entry => entry.billingStatus === 'BILLED').length,
    paid: timeEntries.filter(entry => entry.billingStatus === 'PAID').length,
    writtenOff: timeEntries.filter(entry => entry.billingStatus === 'WRITTEN_OFF').length
  };

  return {
    summary: {
      totalEntries: timeEntries.length,
      totalHours,
      freeHours,
      billableHours,
      totalBillableAmount,
      totalDeveloperAmount,
      averageHourlyRate: totalHours > 0 ? totalDeveloperAmount / totalHours : 0
    },
    billingStatusBreakdown,
    profitMargin: totalBillableAmount - totalDeveloperAmount
  };
}

// Generate client breakdown report
interface ClientBreakdownItem {
  clientId: string;
  clientName: string;
  totalHours: number;
  freeHours: number;
  billableHours: number;
  totalBillableAmount: number;
  totalDeveloperAmount: number;
  entryCount: number;
  annualHourAllowance: number;
  yearlyHoursUsed: number;
}

async function generateClientBreakdown(
  startDate: Date,
  endDate: Date,
  clientId?: string | null
) {
  const whereClause: WhereClause = {
    startTime: {
      gte: startDate,
      lte: endDate
    }
  };

  if (clientId) {
    whereClause.task = { clientId };
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
      }
    }
  });

  const clientBreakdown = timeEntries.reduce((acc: Record<string, ClientBreakdownItem>, entry) => {
    if (!entry.task.client) return acc;
    
    const clientId = entry.task.client.id;
    const clientName = entry.task.client.domainName;
    
    if (!acc[clientId]) {
      acc[clientId] = {
        clientId,
        clientName,
        totalHours: 0,
        freeHours: 0,
        billableHours: 0,
        totalBillableAmount: 0,
        totalDeveloperAmount: 0,
        entryCount: 0,
        annualHourAllowance: entry.task.client.annualHourAllowance,
        yearlyHoursUsed: entry.task.client.yearlyHoursUsed
      };
    }
    
    const hours = (entry.duration || 0) / 60;
    acc[clientId].totalHours += hours;
    acc[clientId].entryCount += 1;
    acc[clientId].totalBillableAmount += entry.billableAmount || 0;
    acc[clientId].totalDeveloperAmount += entry.developerAmount || 0;
    
    if (entry.isWithinAllowance) {
      acc[clientId].freeHours += hours;
    } else {
      acc[clientId].billableHours += hours;
    }
    
    return acc;
  }, {} as Record<string, ClientBreakdownItem>);

  return Object.values(clientBreakdown).sort((a, b) => b.totalBillableAmount - a.totalBillableAmount);
}

// Generate developer payment report
interface DeveloperBreakdownItem {
  developerId: string;
  developerName: string;
  email: string;
  hourlyRate: number | null;
  totalHours: number;
  totalAmount: number;
  entryCount: number;
  clientBreakdown: Record<string, { hours: number; amount: number; entries: number; }>;
}

async function generateDeveloperPaymentReport(
  startDate: Date,
  endDate: Date,
  developerId?: string | null
) {
  const whereClause: WhereClause = {
    startTime: {
      gte: startDate,
      lte: endDate
    }
  };

  if (developerId) {
    whereClause.developerId = developerId;
  }

  const timeEntries = await prisma.timeEntry.findMany({
    where: whereClause,
    include: {
      developer: {
        select: {
          id: true,
          name: true,
          email: true,
          hourlyRate: true
        }
      },
      task: {
        include: {
          client: {
            select: {
              id: true,
              domainName: true
            }
          }
        }
      }
    }
  });

  const developerBreakdown = timeEntries.reduce((acc: Record<string, DeveloperBreakdownItem>, entry) => {
    if (!entry.developer) return acc;
    
    const devId = entry.developer.id;
    const devName = entry.developer.name;
    
    if (!acc[devId]) {
      acc[devId] = {
        developerId: devId,
        developerName: devName,
        email: entry.developer.email,
        hourlyRate: entry.developer.hourlyRate,
        totalHours: 0,
        totalAmount: 0,
        entryCount: 0,
        clientBreakdown: {}
      };
    }
    
    const hours = (entry.duration || 0) / 60;
    acc[devId].totalHours += hours;
    acc[devId].totalAmount += entry.developerAmount || 0;
    acc[devId].entryCount += 1;
    
    // Client breakdown for this developer
    if (entry.task.client) {
      const clientName = entry.task.client.domainName;
      if (!acc[devId].clientBreakdown[clientName]) {
        acc[devId].clientBreakdown[clientName] = {
          hours: 0,
          amount: 0,
          entries: 0
        };
      }
      acc[devId].clientBreakdown[clientName].hours += hours;
      acc[devId].clientBreakdown[clientName].amount += entry.developerAmount || 0;
      acc[devId].clientBreakdown[clientName].entries += 1;
    }
    
    return acc;
  }, {} as Record<string, DeveloperBreakdownItem>);

  return Object.values(developerBreakdown).sort((a, b) => b.totalAmount - a.totalAmount);
}

// Generate allowance tracking report
async function generateAllowanceTrackingReport(clientId?: string | null) {
  const whereClause: { id?: string } = {};
  if (clientId) {
    whereClause.id = clientId;
  }

  const clients = await prisma.client.findMany({
    where: whereClause,
    select: {
      id: true,
      domainName: true,
      annualHourAllowance: true,
      yearlyHoursUsed: true,
      lastYearReset: true,
      createdAt: true
    }
  });

  const currentYear = new Date().getFullYear();

  const allowanceData = clients.map(client => {
    const remainingHours = Math.max(0, client.annualHourAllowance - client.yearlyHoursUsed);
    const usagePercentage = (client.yearlyHoursUsed / client.annualHourAllowance) * 100;
    const needsYearReset = !client.lastYearReset || new Date(client.lastYearReset).getFullYear() < currentYear;
    
    return {
      clientId: client.id,
      clientName: client.domainName,
      annualHourAllowance: client.annualHourAllowance,
      yearlyHoursUsed: needsYearReset ? 0 : client.yearlyHoursUsed,
      remainingHours: needsYearReset ? client.annualHourAllowance : remainingHours,
      usagePercentage: needsYearReset ? 0 : usagePercentage,
      status: needsYearReset ? 'NEEDS_RESET' : 
              usagePercentage >= 100 ? 'EXCEEDED' :
              usagePercentage >= 80 ? 'WARNING' : 'NORMAL',
      lastYearReset: client.lastYearReset,
      needsYearReset
    };
  });

  return allowanceData.sort((a, b) => b.usagePercentage - a.usagePercentage);
}

// Generate revenue analysis report
async function generateRevenueAnalysis(startDate: Date, endDate: Date) {
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      startTime: {
        gte: startDate,
        lte: endDate
      }
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
      }
    }
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      generatedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      client: {
        select: {
          id: true,
          domainName: true
        }
      }
    }
  });

  const totalRevenue = timeEntries.reduce((sum, entry) => sum + (entry.billableAmount || 0), 0);
  const totalCosts = timeEntries.reduce((sum, entry) => sum + (entry.developerAmount || 0), 0);
  const grossProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const invoiceStats = {
    total: invoices.length,
    draft: invoices.filter(inv => inv.status === 'DRAFT').length,
    sent: invoices.filter(inv => inv.status === 'SENT').length,
    paid: invoices.filter(inv => inv.status === 'PAID').length,
    overdue: invoices.filter(inv => inv.status === 'OVERDUE').length,
    totalInvoiceAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    paidAmount: invoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.totalAmount, 0)
  };

  return {
    revenue: {
      totalRevenue,
      totalCosts,
      grossProfit,
      profitMargin
    },
    invoices: invoiceStats,
    metrics: {
      averageHourlyRate: timeEntries.length > 0 ? totalRevenue / timeEntries.reduce((sum, entry) => sum + ((entry.duration || 0) / 60), 0) : 0,
      totalBillableHours: timeEntries.reduce((sum, entry) => sum + ((entry.duration || 0) / 60), 0),
      averageInvoiceAmount: invoices.length > 0 ? invoiceStats.totalInvoiceAmount / invoices.length : 0
    }
  };
}