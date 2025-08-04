import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import https from 'https';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);
const dnsResolve = promisify(dns.resolve);

interface DomainVerificationResult {
  domain: string;
  isResolvable: boolean;
  hasARecord: boolean;
  hasMXRecord: boolean;
  sslStatus: {
    isValid: boolean;
    expiryDate?: Date;
    issuer?: string;
    daysUntilExpiry?: number;
    error?: string;
  };
  whoisData?: {
    registrar?: string;
    expiryDate?: Date;
    nameservers?: string[];
  };
  recommendedStatus: 'ACTIVE_SHP_REGISTRAR' | 'ACTIVE_NEEDS_LOGIN' | 'AT_RISK' | 'LOST' | 'WASTED_SPACE' | 'UNKNOWN';
  verificationDetails: string;
}

interface BulkVerificationRequest {
  clientIds?: string[];
  domains?: string[];
  checkSSL?: boolean;
  checkWhois?: boolean;
  updateDatabase?: boolean;
}

// GET /api/domain/verification - Get domain verification results
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const clientId = searchParams.get('clientId');
    const type = searchParams.get('type') || 'single'; // 'single', 'bulk', 'history'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (type === 'single' && domain) {
      // Verify single domain
      const result = await verifyDomain(domain);
      return NextResponse.json({ result });
    }

    if (type === 'bulk') {
      // Get bulk verification status
      const skip = (page - 1) * limit;
      
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Domain Verification' }
      };

      if (clientId) {
        whereClause.clientId = clientId;
      }

      const verifications = await prisma.report.findMany({
        where: whereClause,
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: whereClause
      });

      const verificationData = verifications.map(v => {
        if (!v.reportData) {
          throw new Error('Invalid verification data: reportData is null');
        }
        
        const parsedData = typeof v.reportData === 'string' ? JSON.parse(v.reportData) : v.reportData;
        
        return {
          id: v.id,
          domain: parsedData.domain,
          result: parsedData.result,
          verifiedAt: v.generatedAt,
          clientId: v.clientId
        };
      });

      return NextResponse.json({
        verifications: verificationData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'history') {
      // Get verification history for a specific domain or client
      const skip = (page - 1) * limit;
      
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Domain Verification' }
      };

      if (domain) {
        whereClause.reportData = {
          path: ['domain'],
          equals: domain
        };
      }

      if (clientId) {
        whereClause.clientId = clientId;
      }

      const history = await prisma.report.findMany({
        where: whereClause,
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: whereClause
      });

      return NextResponse.json({
        history: history.map(h => {
          if (!h.reportData) {
            throw new Error('Invalid verification history data: reportData is null');
          }
          
          const parsedData = typeof h.reportData === 'string' ? JSON.parse(h.reportData) : h.reportData;
          
          return {
            id: h.id,
            domain: parsedData.domain,
            result: parsedData.result,
            verifiedAt: h.generatedAt,
            clientId: h.clientId
          };
        }),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in domain verification GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/domain/verification - Perform domain verification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'verify_single') {
      const { domain, clientId, updateDatabase = true } = data;

      if (!domain) {
        return NextResponse.json(
          { error: 'Domain is required' },
          { status: 400 }
        );
      }

      const result = await verifyDomain(domain);

      // Store verification result
      const reportRecord = await prisma.report.create({
        data: {
          title: `Domain Verification - ${domain}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: clientId || 'system', // Use system as default if no clientId
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify({
            type: 'DOMAIN_VERIFICATION',
            domain,
            result,
            verifiedBy: session.user.id
          }))
        }
      });

      // Update client verification status if requested and client exists
      if (updateDatabase && clientId) {
        await prisma.client.update({
          where: { id: clientId },
          data: {
            verificationStatus: result.recommendedStatus
          }
        });
      }
      // Create SSL health check if SSL issues found
      if (!result.sslStatus.isValid && clientId) {
        await prisma.healthCheck.create({
          data: {
            checkType: 'SSL_CERTIFICATE',
            status: 'CRITICAL',
            details: result.sslStatus.error || 'SSL certificate validation failed',
            clientId
          }
        });
      }

      return NextResponse.json({
        message: 'Domain verification completed',
        verificationId: reportRecord.id,
        result
      });
    }

    

    if (action === 'verify_bulk') {
      const {
        clientIds,
        domains,
        checkSSL = true,
        checkWhois = false,
        updateDatabase = true
      }: BulkVerificationRequest = data;

      let domainsToVerify: { domain: string; clientId?: string }[] = [];

      // Get domains from client IDs
      if (clientIds && clientIds.length > 0) {
        const clients = await prisma.client.findMany({
          where: {
            id: { in: clientIds }
          },
          select: {
            id: true,
            domainName: true
          }
        });

        domainsToVerify = clients.map(c => ({
          domain: c.domainName,
          clientId: c.id
        }));
      }

      // Add standalone domains
      if (domains && domains.length > 0) {
        domainsToVerify.push(...domains.map(d => ({ domain: d })));
      }

      if (domainsToVerify.length === 0) {
        return NextResponse.json(
          { error: 'No domains specified for verification' },
          { status: 400 }
        );
      }

      const results: Array<{ domain: string; clientId?: string; result: DomainVerificationResult; error?: string }> = [];
      const errors: Array<{ domain: string; error: string }> = [];

      // Process domains in batches to avoid overwhelming external services
      const batchSize = 5;
      for (let i = 0; i < domainsToVerify.length; i += batchSize) {
        const batch = domainsToVerify.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async ({ domain, clientId }) => {
          try {
            const result = await verifyDomain(domain, { checkSSL, checkWhois });
            
            // Store verification result
            await prisma.report.create({
              data: {
                title: `Domain Verification - ${domain}`,
                dateRange: {
                  startDate: new Date().toISOString(),
                  endDate: new Date().toISOString()
                },
                totalHours: 0,
                totalAmount: 0,
                clientId: clientId || 'system', // Use system as default if no clientId
                generatedAt: new Date(),
                reportData: JSON.parse(JSON.stringify({
                  type: 'DOMAIN_VERIFICATION',
                  domain,
                  result,
                  verifiedBy: session.user.id
                }))
              }
            });

            // Update client if requested
            if (updateDatabase && clientId) {
              await prisma.client.update({
                where: { id: clientId },
                data: {
                  verificationStatus: result.recommendedStatus
                }
              });

              // Create health check for SSL issues
              if (!result.sslStatus.isValid) {
                await prisma.healthCheck.create({
                  data: {
                    checkType: 'SSL_CERTIFICATE',
                    status: 'CRITICAL',
                    details: result.sslStatus.error || 'SSL certificate validation failed',
                    clientId
                  }
                });
              }
            }

            return { domain, clientId, result };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ domain, error: errorMessage });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(r => r !== null) as Array<{ domain: string; clientId?: string; result: DomainVerificationResult }>);

        // Add delay between batches
        if (i + batchSize < domainsToVerify.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return NextResponse.json({
        message: 'Bulk domain verification completed',
        summary: {
          total: domainsToVerify.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in domain verification POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to verify a single domain
async function verifyDomain(
  domain: string,
  options: { checkSSL?: boolean; checkWhois?: boolean } = {}
): Promise<DomainVerificationResult> {
  const { checkSSL = true, checkWhois: _checkWhois = false } = options;
  
  const result: DomainVerificationResult = {
    domain,
    isResolvable: false,
    hasARecord: false,
    hasMXRecord: false,
    sslStatus: {
      isValid: false
    },
    recommendedStatus: 'UNKNOWN',
    verificationDetails: ''
  };

  try {
    // Check DNS resolution
    try {
      await dnsLookup(domain);
      result.isResolvable = true;
    } catch (_error) {
      result.verificationDetails += 'Domain does not resolve. ';
    }

    // Check A record
    try {
      const aRecords = await dnsResolve(domain, 'A');
      result.hasARecord = aRecords.length > 0;
    } catch (_error) {
      result.verificationDetails += 'No A record found. ';
    }

    // Check MX record
    try {
      const mxRecords = await dnsResolve(domain, 'MX');
      result.hasMXRecord = mxRecords.length > 0;
    } catch (_error) {
      result.verificationDetails += 'No MX record found. ';
    }

    // Check SSL certificate if requested
    if (checkSSL && result.isResolvable) {
      result.sslStatus = await checkSSLCertificate(domain);
    }

    // Determine recommended status
    if (!result.isResolvable) {
      result.recommendedStatus = 'LOST';
      result.verificationDetails += 'Domain appears to be lost or expired.';
    } else if (!result.hasARecord) {
      result.recommendedStatus = 'WASTED_SPACE';
      result.verificationDetails += 'Domain resolves but has no A record - likely unused.';
    } else if (result.sslStatus.isValid && result.hasARecord) {
      result.recommendedStatus = 'ACTIVE_SHP_REGISTRAR';
      result.verificationDetails += 'Domain appears to be active and properly configured.';
    } else if (result.hasARecord && !result.sslStatus.isValid) {
      result.recommendedStatus = 'ACTIVE_NEEDS_LOGIN';
      result.verificationDetails += 'Domain is active but may need SSL attention.';
    } else {
      result.recommendedStatus = 'AT_RISK';
      result.verificationDetails += 'Domain status is unclear and needs manual review.';
    }

  } catch (error) {
    result.verificationDetails = `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return result;
}

// Helper function to check SSL certificate
async function checkSSLCertificate(domain: string): Promise<DomainVerificationResult['sslStatus']> {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: false // We want to check the cert even if it's invalid
    };

    const req = https.request(options, (res) => {
      const cert = (res.socket as unknown as { getPeerCertificate: () => { valid_from?: string; valid_to?: string; issuer?: { CN?: string } } }).getPeerCertificate();
      
      if (cert && cert.valid_from && cert.valid_to) {
        const expiryDate = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        resolve({
          isValid: daysUntilExpiry > 0,
          expiryDate,
          issuer: cert.issuer?.CN || 'Unknown',
          daysUntilExpiry,
          error: daysUntilExpiry <= 0 ? 'Certificate has expired' : undefined
        });
      } else {
        resolve({
          isValid: false,
          error: 'No valid certificate found'
        });
      }
    });

    req.on('error', (error) => {
      resolve({
        isValid: false,
        error: `SSL check failed: ${error.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        isValid: false,
        error: 'SSL check timed out'
      });
    });

    req.end();
  });
}