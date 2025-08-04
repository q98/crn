import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { whoisService } from '@/lib/whois';
import { z } from 'zod';
import { Prisma, DomainVerificationStatus } from '@prisma/client';

interface VerificationDetail {
  domainId: string;
  domainName: string;
  status: 'success' | 'failed';
  verificationStatus?: DomainVerificationStatus;
  ownershipChanged?: boolean;
  responseTime?: number;
  error?: string;
}

// Validation schema
const bulkVerifySchema = z.object({
  domainIds: z.array(z.string()).min(1).max(50), // Limit to 50 domains per batch
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal')
});

// POST /api/domains/bulk-verify - Verify multiple domains
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { domainIds, priority } = bulkVerifySchema.parse(body);

    // Fetch domains to verify
    const domains = await prisma.domain.findMany({
      where: {
        id: { in: domainIds },
        isActive: true
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

    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No active domains found for verification' },
        { status: 404 }
      );
    }

    // Track verification results
    const results = {
      total: domains.length,
      successful: 0,
      failed: 0,
      details: [] as VerificationDetail[]
    };

    // Process domains with rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const rateLimitDelay = priority === 'high' ? 500 : priority === 'normal' ? 1000 : 2000;

    for (const domain of domains) {
      try {
        // Perform verification
        const verificationResult = await whoisService.verifyDomain(domain.domainName);

        // Determine if ownership has changed
        let ownershipChanged = false;
        if (domain.registrantEmail && verificationResult.data?.registrantEmail) {
          ownershipChanged = domain.registrantEmail !== verificationResult.data.registrantEmail;
        }

        // Update domain
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
            nextVerificationDue: whoisService.calculateNextVerification(domain.verificationInterval),
            ownershipChanged
          }
        });

        // Create verification history
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
            isAutomated: true,
            responseTime: verificationResult.responseTime
          }
        });

        results.successful++;
        results.details.push({
          domainId: domain.id,
          domainName: domain.domainName,
          status: 'success',
          verificationStatus: verificationResult.status,
          ownershipChanged,
          responseTime: verificationResult.responseTime
        });

      } catch (error) {
        console.error(`Verification failed for domain ${domain.domainName}:`, error);
        
        // Create failed verification history
        try {
          await prisma.domainVerificationHistory.create({
            data: {
              domainId: domain.id,
              verificationStatus: 'FAILED',
              verificationMethod: 'IP2WHOIS',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              verifiedBy: session.user.id,
              isAutomated: true,
              responseTime: 0
            }
          });
        } catch (historyError) {
          console.error('Failed to create verification history:', historyError);
        }

        results.failed++;
        results.details.push({
          domainId: domain.id,
          domainName: domain.domainName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Rate limiting delay between requests
      if (domains.indexOf(domain) < domains.length - 1) {
        await delay(rateLimitDelay);
      }
    }

    return NextResponse.json({
      message: `Bulk verification completed: ${results.successful} successful, ${results.failed} failed`,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in bulk verification:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Bulk verification failed' },
      { status: 500 }
    );
  }
}

// GET /api/domains/bulk-verify - Get domains due for verification
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const clientId = searchParams.get('clientId');

    // Build where clause
    const where: Prisma.DomainWhereInput = {
      isActive: true,
      autoVerify: true,
      nextVerificationDue: {
        lte: new Date()
      }
    };

    if (clientId) {
      where.clientId = clientId;
    }

    // Get domains due for verification
    const domainsDue = await prisma.domain.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      },
      orderBy: { nextVerificationDue: 'asc' },
      take: limit
    });

    return NextResponse.json({
      domains: domainsDue,
      count: domainsDue.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching domains due for verification:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains due for verification' },
      { status: 500 }
    );
  }
}