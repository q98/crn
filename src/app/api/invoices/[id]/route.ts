import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/invoices/[id] - Get a specific invoice
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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            domainName: true,
            cPanelUsername: true,
            registrar: true,
            annualHourAllowance: true,
            yearlyHoursUsed: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Get the time entries included in this invoice
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        id: {
          in: Array.isArray(invoice.timeEntries) ? invoice.timeEntries as string[] : []
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
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    return NextResponse.json({
      ...invoice,
      timeEntries
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/[id] - Update a specific invoice
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
      status,
      dueDate,
      notes,
      sentAt,
      paidAt
    }: {
      status?: string;
      dueDate?: string;
      notes?: string;
      sentAt?: string | null;
      paidAt?: string | null;
    } = body;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: {
      status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
      sentAt?: Date | null;
      paidAt?: Date | null;
      dueDate?: Date;
      notes?: string;
    } = {};
    if (status !== undefined) {
      updateData.status = status as 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
      
      // Auto-set timestamps based on status
      if (status === 'SENT' && !existingInvoice.sentAt) {
        updateData.sentAt = new Date();
      }
      if (status === 'PAID' && !existingInvoice.paidAt) {
        updateData.paidAt = new Date();
      }
    }
    
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (notes !== undefined) updateData.notes = notes;
    if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;
    if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      }
    });

    // If invoice is marked as paid, update time entries status
    if (status === 'PAID' && existingInvoice.status !== 'PAID') {
      await prisma.timeEntry.updateMany({
        where: {
          id: {
            in: Array.isArray(existingInvoice.timeEntries) ? existingInvoice.timeEntries as string[] : []
          }
        },
        data: {
          billingStatus: 'PAID'
        }
      });
    }

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// DELETE /api/invoices/[id] - Delete a specific invoice
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
    
    // Get invoice details before deletion
    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft invoices can be deleted' },
        { status: 400 }
      );
    }

    // Reset time entries billing status
    await prisma.timeEntry.updateMany({
      where: {
        id: {
          in: Array.isArray(invoice.timeEntries) ? invoice.timeEntries as string[] : []
        }
      },
      data: {
        isBilled: false,
        billingStatus: 'PENDING'
      }
    });

    // Delete the invoice
    await prisma.invoice.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: 'Invoice deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}