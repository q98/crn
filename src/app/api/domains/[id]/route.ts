import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { whoisService } from '@/lib/whois';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Validation schema for updates
const updateDomainSchema = z.object({
  verificationInterval: z.number().min(1).max(365).optional(),
  autoVerify: z.boolean().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
});

// GET /api/domains/[id] - Get specific domain
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        },
        verificationHistory: {
          orderBy: { verifiedAt: 'desc' },
          take: 10
        }
      }
    });

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(domain);

  } catch (error) {
    console.error('Error fetching domain:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domain' },
      { status: 500 }
    );
  }
}

// PATCH /api/domains/[id] - Update domain
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateDomainSchema.parse(body);

    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { id }
    });

    if (!existingDomain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Prisma.DomainUpdateInput = { ...validatedData };
    
    // If verification interval changed, recalculate next verification date
    if (validatedData.verificationInterval && 
        validatedData.verificationInterval !== existingDomain.verificationInterval) {
      updateData.nextVerificationDue = whoisService.calculateNextVerification(
        validatedData.verificationInterval
      );
    }

    // Update domain
    const updatedDomain = await prisma.domain.update({
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

    return NextResponse.json(updatedDomain);

  } catch (error) {
    console.error('Error updating domain:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update domain' },
      { status: 500 }
    );
  }
}

// DELETE /api/domains/[id] - Delete domain
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { id },
      include: {
        verificationHistory: true
      }
    });

    if (!existingDomain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    // Delete domain and related records (cascade should handle verification history)
    await prisma.domain.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: 'Domain deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json(
      { error: 'Failed to delete domain' },
      { status: 500 }
    );
  }
}