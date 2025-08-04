import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { whoisService } from '@/lib/whois';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Validation schemas
const createDomainSchema = z.object({
  domainName: z.string().min(1, 'Domain name is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  verificationInterval: z.number().min(1).max(365).optional().default(30),
  autoVerify: z.boolean().optional().default(true),
  notes: z.string().optional()
});

const querySchema = z.object({
  clientId: z.string().optional(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'OWNERSHIP_CHANGED', 'PRIVACY_PROTECTED']).optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 100)).optional()
});

// GET /api/domains - List domains with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.DomainWhereInput = {};
    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.status) {
      where.verificationStatus = query.status;
    }

    // Get domains with pagination
    const [domains, total] = await Promise.all([
      prisma.domain.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              domainName: true
            }
          },
          verificationHistory: {
            orderBy: { verifiedAt: 'desc' },
            take: 1
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.domain.count({ where })
    ]);

    return NextResponse.json({
      domains,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}

// POST /api/domains - Create new domain for verification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createDomainSchema.parse(body);

    // Validate domain format
    if (!whoisService.isValidDomain(validatedData.domainName)) {
      return NextResponse.json(
        { error: 'Invalid domain name format' },
        { status: 400 }
      );
    }

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Check if domain already exists
    const existingDomain = await prisma.domain.findUnique({
      where: { domainName: validatedData.domainName.toLowerCase() }
    });

    if (existingDomain) {
      return NextResponse.json(
        { error: 'Domain already exists in the system' },
        { status: 409 }
      );
    }

    // Create domain
    const domain = await prisma.domain.create({
      data: {
        domainName: validatedData.domainName.toLowerCase(),
        clientId: validatedData.clientId,
        verificationInterval: validatedData.verificationInterval,
        autoVerify: validatedData.autoVerify,
        notes: validatedData.notes,
        nextVerificationDue: whoisService.calculateNextVerification(validatedData.verificationInterval)
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

    // Trigger initial verification if autoVerify is enabled
    if (validatedData.autoVerify) {
      // Note: In a production environment, this should be queued for background processing
      // For now, we'll do it synchronously but with a timeout
      try {
        const verificationResult = await whoisService.verifyDomain(domain.domainName);
        
        // Update domain with verification results
        await prisma.domain.update({
          where: { id: domain.id },
          data: {
            verificationStatus: verificationResult.status,
            whoisData: verificationResult.data?.whoisData ? JSON.parse(JSON.stringify(verificationResult.data.whoisData)) : null,
            registrantName: verificationResult.data?.registrantName,
            registrantEmail: verificationResult.data?.registrantEmail,
            registrantOrg: verificationResult.data?.registrantOrg,
            registrar: verificationResult.data?.registrar,
            creationDate: verificationResult.data?.creationDate,
            expirationDate: verificationResult.data?.expirationDate,
            lastUpdated: verificationResult.data?.lastUpdated,
            nameservers: verificationResult.data?.nameservers ? JSON.parse(JSON.stringify(verificationResult.data.nameservers)) : null,
            dnssec: verificationResult.data?.dnssec,
            lastVerified: new Date(),
            nextVerificationDue: whoisService.calculateNextVerification(validatedData.verificationInterval)
          }
        });

        // Create verification history record
        await prisma.domainVerificationHistory.create({
          data: {
            domainId: domain.id,
            verificationStatus: verificationResult.status,
            whoisData: verificationResult.data?.whoisData ? JSON.parse(JSON.stringify(verificationResult.data.whoisData)) : null,
            registrantName: verificationResult.data?.registrantName,
            registrantEmail: verificationResult.data?.registrantEmail,
            registrar: verificationResult.data?.registrar,
            expirationDate: verificationResult.data?.expirationDate,
            verificationMethod: 'IP2WHOIS',
            errorMessage: verificationResult.error,
            verifiedBy: session.user.id,
            isAutomated: false,
            responseTime: verificationResult.responseTime
          }
        });

      } catch (verificationError) {
        console.error('Initial verification failed:', verificationError);
        // Domain is still created, but verification failed
      }
    }

    return NextResponse.json(domain, { status: 201 });

  } catch (error) {
    console.error('Error creating domain:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 }
    );
  }
}