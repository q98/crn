import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/clients/[id] - Get a specific client
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
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        credentials: true,
        tasks: true,
        healthChecks: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id] - Update a specific client
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
    const { domainName, cPanelUsername, diskUsage, verificationStatus, registrar, notes } = body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        domainName,
        cPanelUsername,
        diskUsage,
        verificationStatus,
        registrar,
        notes,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Delete a specific client
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
    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id },
      include: {
        credentials: true,
        tasks: true,
        healthChecks: true,
      },
    });

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Delete related records first (cascade delete)
    await prisma.$transaction(async (tx) => {
      // Delete health checks
      await tx.healthCheck.deleteMany({
        where: { clientId: id },
      });

      // Delete time entries for client tasks
      await tx.timeEntry.deleteMany({
        where: {
          task: {
            clientId: id,
          },
        },
      });

      // Delete tasks
      await tx.task.deleteMany({
        where: { clientId: id },
      });

      // Delete credentials
      await tx.credential.deleteMany({
        where: { clientId: id },
      });

      // Finally delete the client
      await tx.client.delete({
        where: { id },
      });
    });

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}