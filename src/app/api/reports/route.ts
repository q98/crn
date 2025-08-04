import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// GET /api/reports - Get all reports
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return a combination of real data and report templates
    // In a real application, you might have a separate reports table
    const reports = [
      {
        id: '1',
        name: 'Client Activity Summary',
        type: 'Client Activity',
        description: 'Overview of all client activities and interactions',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
      {
        id: '2',
        name: 'Website Health Status',
        type: 'Health Check',
        description: 'Current health status of all monitored websites',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
      {
        id: '3',
        name: 'Time Tracking Summary',
        type: 'Time Tracking',
        description: 'Summary of time spent on tasks and projects',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
      {
        id: '4',
        name: 'SSL Certificate Expiry',
        type: 'Security',
        description: 'SSL certificate expiration dates and status',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
      {
        id: '5',
        name: 'Task Completion Summary',
        type: 'Task Management',
        description: 'Overview of completed and pending tasks',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
      {
        id: '6',
        name: 'Client Billing Summary',
        type: 'Billing',
        description: 'Billing information and payment status',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
      {
        id: '7',
        name: 'Website Performance Metrics',
        type: 'Performance',
        description: 'Performance metrics for all monitored websites',
        createdAt: new Date().toISOString(),
        status: 'Generated',
      },
    ];

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/reports - Create a new report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, description } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type' },
        { status: 400 }
      );
    }

    // For now, just return a mock report since we don't have a reports table
    // In a real application, you would save this to the database
    const report = {
      id: Date.now().toString(),
      name,
      type,
      description: description || '',
      createdAt: new Date().toISOString(),
      status: 'Generated',
    };

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}