import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/billing/utils - Billing utility operations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { operation, clientId, year } = body;

    let result;

    switch (operation) {
      case 'reset-yearly-hours':
        result = await resetYearlyHours(clientId, year);
        break;
      case 'recalculate-billing':
        result = await recalculateBilling(clientId);
        break;
      case 'bulk-year-reset':
        result = await bulkYearReset(year);
        break;
      case 'update-allowance':
        const { newAllowance } = body;
        result = await updateClientAllowance(clientId, newAllowance);
        break;
      case 'generate-overdue-report':
        result = await generateOverdueReport();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      operation,
      success: true,
      result
    });
  } catch (error) {
    console.error('Error in billing utility operation:', error);
    return NextResponse.json(
      { error: 'Failed to execute billing operation' },
      { status: 500 }
    );
  }
}

// Reset yearly hours for a specific client
async function resetYearlyHours(clientId?: string, year?: number) {
  const targetYear = year || new Date().getFullYear();
  
  if (clientId) {
    // Reset specific client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        domainName: true,
        yearlyHoursUsed: true
      }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        yearlyHoursUsed: 0,
        lastYearReset: new Date(`${targetYear}-01-01`)
      }
    });

    return {
      clientId,
      clientName: client.domainName,
      previousHours: client.yearlyHoursUsed,
      resetYear: targetYear
    };
  } else {
    throw new Error('Client ID is required for yearly hours reset');
  }
}

// Recalculate billing for all time entries of a client
async function recalculateBilling(clientId?: string) {
  if (!clientId) {
    throw new Error('Client ID is required for billing recalculation');
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      domainName: true,
      annualHourAllowance: true,
      yearlyHoursUsed: true,
      lastYearReset: true
    }
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Get all time entries for this client
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      task: {
        clientId: clientId
      }
    },
    include: {
      developer: {
        select: {
          hourlyRate: true
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  });

  let cumulativeHours = 0;
  const updates = [];

  for (const entry of timeEntries) {
    const entryHours = (entry.duration || 0) / 60;
    const hourlyRate = entry.hourlyRate || entry.developer?.hourlyRate || 75;
    
    // Calculate billing based on cumulative hours
    const remainingFreeHours = Math.max(0, client.annualHourAllowance - cumulativeHours);
    const freeHoursUsed = Math.min(entryHours, remainingFreeHours);
    const billableHours = Math.max(0, entryHours - freeHoursUsed);
    
    const isWithinAllowance = billableHours === 0;
    const billingStatus = isWithinAllowance ? 'PENDING' : 'PENDING';
    const billableAmount = billableHours * hourlyRate;
    const developerAmount = entryHours * hourlyRate;
    
    updates.push({
      id: entry.id,
              billingStatus: billingStatus as 'PENDING' | 'BILLED' | 'PAID' | 'WRITTEN_OFF',
      billableAmount,
      developerAmount,
      isWithinAllowance
    });
    
    cumulativeHours += entryHours;
  }

  // Apply updates
  for (const update of updates) {
    await prisma.timeEntry.update({
      where: { id: update.id },
      data: {
        billingStatus: update.billingStatus,
        billableAmount: update.billableAmount,
        developerAmount: update.developerAmount,
        isWithinAllowance: update.isWithinAllowance
      }
    });
  }

  // Update client's yearly hours
  await prisma.client.update({
    where: { id: clientId },
    data: {
      yearlyHoursUsed: cumulativeHours
    }
  });

  return {
    clientId,
    clientName: client.domainName,
    entriesUpdated: updates.length,
    totalHours: cumulativeHours,
    freeHours: Math.min(cumulativeHours, client.annualHourAllowance),
    billableHours: Math.max(0, cumulativeHours - client.annualHourAllowance)
  };
}

// Bulk reset yearly hours for all clients
async function bulkYearReset(year?: number) {
  const targetYear = year || new Date().getFullYear();
  const resetDate = new Date(`${targetYear}-01-01`);
  
  // Get all clients that need year reset
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { lastYearReset: null },
        {
          lastYearReset: {
            lt: resetDate
          }
        }
      ]
    },
    select: {
      id: true,
      domainName: true,
      yearlyHoursUsed: true
    }
  });

  const resetResults = [];
  
  for (const client of clients) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        yearlyHoursUsed: 0,
        lastYearReset: resetDate
      }
    });
    
    resetResults.push({
      clientId: client.id,
      clientName: client.domainName,
      previousHours: client.yearlyHoursUsed
    });
  }

  return {
    resetYear: targetYear,
    clientsReset: resetResults.length,
    clients: resetResults
  };
}

// Update client's annual hour allowance
async function updateClientAllowance(clientId: string, newAllowance: number) {
  if (!clientId || newAllowance === undefined) {
    throw new Error('Client ID and new allowance are required');
  }

  if (newAllowance < 0) {
    throw new Error('Allowance cannot be negative');
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      domainName: true,
      annualHourAllowance: true,
      yearlyHoursUsed: true
    }
  });

  if (!client) {
    throw new Error('Client not found');
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      annualHourAllowance: newAllowance
    }
  });

  // Recalculate billing if the new allowance affects current year
  const needsRecalculation = client.yearlyHoursUsed > 0;
  let recalculationResult = null;
  
  if (needsRecalculation) {
    recalculationResult = await recalculateBilling(clientId);
  }

  return {
    clientId,
    clientName: client.domainName,
    previousAllowance: client.annualHourAllowance,
    newAllowance,
    yearlyHoursUsed: client.yearlyHoursUsed,
    recalculationPerformed: needsRecalculation,
    recalculationResult
  };
}

// Generate overdue invoices report
async function generateOverdueReport() {
  const today = new Date();
  
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: {
        in: ['SENT']
      },
      dueDate: {
        lt: today
      }
    },
    include: {
      client: {
        select: {
          id: true,
          domainName: true,
          cPanelUsername: true
        }
      }
    },
    orderBy: {
      dueDate: 'asc'
    }
  });

  // Update overdue invoices status
  const overdueIds = overdueInvoices.map(inv => inv.id);
  if (overdueIds.length > 0) {
    await prisma.invoice.updateMany({
      where: {
        id: {
          in: overdueIds
        }
      },
      data: {
        status: 'OVERDUE'
      }
    });
  }

  const overdueData = overdueInvoices.map(invoice => {
    const daysPastDue = Math.floor((today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.client.id,
      clientName: invoice.client.domainName,
      amount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      daysPastDue,
      urgency: daysPastDue > 60 ? 'HIGH' : daysPastDue > 30 ? 'MEDIUM' : 'LOW'
    };
  });

  const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return {
    overdueCount: overdueInvoices.length,
    totalOverdueAmount,
    invoices: overdueData,
    summary: {
      high: overdueData.filter(inv => inv.urgency === 'HIGH').length,
      medium: overdueData.filter(inv => inv.urgency === 'MEDIUM').length,
      low: overdueData.filter(inv => inv.urgency === 'LOW').length
    }
  };
}