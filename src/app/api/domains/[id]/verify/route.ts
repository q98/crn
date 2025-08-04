import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { whoisService } from '@/lib/whois';

// POST /api/domains/[id]/verify - Manually trigger domain verification
export async function POST(
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
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      }
    });

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    // Check if domain is active
    if (!domain.isActive) {
      return NextResponse.json(
        { error: 'Cannot verify inactive domain' },
        { status: 400 }
      );
    }

    // Perform verification
    const verificationResult = await whoisService.verifyDomain(domain.domainName);

    // Determine if ownership has changed by comparing with previous data
    let ownershipChanged = false;
    if (domain.registrantEmail && verificationResult.data?.registrantEmail) {
      ownershipChanged = domain.registrantEmail !== verificationResult.data.registrantEmail;
    }

    // Update domain with verification results
    const updatedDomain = await prisma.domain.update({
      where: { id },
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

    // Create verification history record
    const historyRecord = await prisma.domainVerificationHistory.create({
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

    // Return verification results
    return NextResponse.json({
      domain: updatedDomain,
      verification: {
        status: verificationResult.status,
        timestamp: new Date().toISOString(),
        responseTime: verificationResult.responseTime,
        ownershipChanged,
        error: verificationResult.error,
        historyId: historyRecord.id
      },
      alerts: {
        ownershipChanged,
        expirationWarning: verificationResult.data?.expirationDate ? 
          new Date(verificationResult.data.expirationDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 : false,
        privacyProtected: verificationResult.status === 'PRIVACY_PROTECTED'
      }
    });

  } catch (error) {
    console.error('Error verifying domain:', error);
    
    // Create failed verification history record
    try {
      const { id: domainId } = await params;
      const session = await getServerSession(authOptions);
      await prisma.domainVerificationHistory.create({
        data: {
          domainId,
          verificationStatus: 'FAILED',
          verificationMethod: 'IP2WHOIS',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          verifiedBy: session?.user?.id || '',
          isAutomated: false,
          responseTime: 0
        }
      });
    } catch (historyError) {
      console.error('Failed to create verification history:', historyError);
    }

    return NextResponse.json(
      { 
        error: 'Domain verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}