import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/credentials/[id] - Get a specific credential
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
    const credential = await prisma.credential.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json(credential);
  } catch (error) {
    console.error('Error fetching credential:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/credentials/[id] - Update a specific credential
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
    const { service, url, username, password, pin, securityQuestions, notes, clientId } = body;

    const credential = await prisma.credential.update({
      where: { id },
      data: {
        service,
        url,
        username,
        password,
        pin,
        securityQuestions,
        notes,
        clientId,
      },
    });

    return NextResponse.json(credential);
  } catch (error) {
    console.error('Error updating credential:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/credentials/[id] - Delete a specific credential
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
    // Check if credential exists
    const existingCredential = await prisma.credential.findUnique({
      where: { id },
    });

    if (!existingCredential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    // Delete the credential
    await prisma.credential.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Error deleting credential:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}