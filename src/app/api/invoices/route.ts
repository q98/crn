import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/invoices - Get all invoices
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    const whereClause: { clientId?: string; status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' } = {};
    
    if (clientId) {
      whereClause.clientId = clientId;
    }
    
    if (status) {
      whereClause.status = status as 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            domainName: true,
            annualHourAllowance: true,
            yearlyHoursUsed: true
          }
        }
      },
      orderBy: {
        generatedAt: 'desc'
      },
      take: limit ? parseInt(limit) : undefined
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST /api/invoices - Generate a new invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      startDate,
      endDate,
      dueDate,
      notes
    }: {
      clientId: string;
      startDate: string;
      endDate: string;
      dueDate?: string;
      notes?: string;
    } = body;

    // Validate required fields
    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Client ID, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Get client information
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
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Get billable time entries for the period
    const billableTimeEntries = await prisma.timeEntry.findMany({
      where: {
        task: {
          clientId: clientId
        },
        billingStatus: 'PENDING',
        isBilled: false,
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true
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
        startTime: 'asc'
      }
    });

    if (billableTimeEntries.length === 0) {
      return NextResponse.json(
        { error: 'No billable time entries found for the specified period' },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalHours = billableTimeEntries.reduce(
      (sum, entry) => sum + ((entry.duration || 0) / 60),
      0
    );
    
    const totalAmount = billableTimeEntries.reduce(
      (sum, entry) => sum + (entry.billableAmount || 0),
      0
    );

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Calculate due date (30 days from generation if not provided)
    const calculatedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        totalHours,
        totalAmount,
        billingPeriod: {
          startDate: startDate,
          endDate: endDate
        },
        dueDate: calculatedDueDate,
        timeEntries: billableTimeEntries.map(entry => entry.id),
        notes,
        status: 'DRAFT'
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

    // Mark time entries as billed
    await prisma.timeEntry.updateMany({
      where: {
        id: {
          in: billableTimeEntries.map(entry => entry.id)
        }
      },
      data: {
        isBilled: true,
        billingStatus: 'BILLED'
      }
    });

    return NextResponse.json({
      invoice,
      timeEntries: billableTimeEntries,
      summary: {
        totalHours,
        totalAmount,
        entryCount: billableTimeEntries.length
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}

// Helper function to generate unique invoice number
async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get the count of invoices this month
  const startOfMonth = new Date(currentYear, new Date().getMonth(), 1);
  const endOfMonth = new Date(currentYear, new Date().getMonth() + 1, 0);
  
  const monthlyInvoiceCount = await prisma.invoice.count({
    where: {
      generatedAt: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });
  
  const invoiceSequence = String(monthlyInvoiceCount + 1).padStart(3, '0');
  return `INV-${currentYear}${currentMonth}-${invoiceSequence}`;
}