import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/health - Get all health checks
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const healthChecks = await prisma.healthCheck.findMany({
      include: {
        client: {
          select: {
            id: true,
            domainName: true,
          },
        },
      },
      orderBy: {
        checkedAt: 'desc',
      },
    });

    return NextResponse.json(healthChecks);
  } catch (error) {
    console.error('Error fetching health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/health - Create a new health check
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { checkType, status, details, clientId } = body;

    // Validate required fields
    if (!checkType || !status || !clientId) {
      return NextResponse.json(
        { error: 'Missing required fields: checkType, status, clientId' },
        { status: 400 }
      );
    }

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const healthCheck = await prisma.healthCheck.create({
      data: {
        checkType,
        status,
        details,
        clientId,
      },
      include: {
        client: {
          select: {
            id: true,
            domainName: true,
          },
        },
      },
    });

    return NextResponse.json(healthCheck, { status: 201 });
  } catch (error) {
    console.error('Error creating health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}