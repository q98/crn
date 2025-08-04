import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/health/[id] - Get a specific health check
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
    const healthCheck = await prisma.healthCheck.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!healthCheck) {
      return NextResponse.json({ error: 'Health check not found' }, { status: 404 });
    }

    return NextResponse.json(healthCheck);
  } catch (error) {
    console.error('Error fetching health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/health/[id] - Update a specific health check
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
    const { checkType, status, details, clientId } = body;

    const healthCheck = await prisma.healthCheck.update({
      where: { id },
      data: {
        checkType,
        status,
        details,
        clientId,
        checkedAt: new Date(),
      },
    });

    return NextResponse.json(healthCheck);
  } catch (error) {
    console.error('Error updating health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/health/[id] - Delete a specific health check
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
    // Check if health check exists
    const existingHealthCheck = await prisma.healthCheck.findUnique({
      where: { id },
    });

    if (!existingHealthCheck) {
      return NextResponse.json({ error: 'Health check not found' }, { status: 404 });
    }

    // Delete the health check
    await prisma.healthCheck.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Health check deleted successfully' });
  } catch (error) {
    console.error('Error deleting health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}