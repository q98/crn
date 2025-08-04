import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as tls from 'tls';

interface SSLCertificate {
  id?: string;
  clientId: string;
  domain: string;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  serialNumber: string;
  signatureAlgorithm: string;
  keySize?: number;
  isWildcard: boolean;
  subjectAltNames: string[];
  status: 'VALID' | 'EXPIRED' | 'EXPIRING_SOON' | 'INVALID' | 'UNREACHABLE';
  daysUntilExpiry: number;
  lastChecked: Date;
  autoRenewal: boolean;
  renewalProvider?: string;
  renewalConfig?: Record<string, unknown>;
  alertThresholds: {
    warning: number; // days before expiry
    critical: number; // days before expiry
  };
  createdAt?: Date;
  updatedAt?: Date;
}

interface SSLAlert {
  id?: string;
  certificateId: string;
  clientId: string;
  domain: string;
  alertType: 'EXPIRING_WARNING' | 'EXPIRING_CRITICAL' | 'EXPIRED' | 'INVALID' | 'RENEWAL_FAILED';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

interface SSLMonitoringStats {
  totalCertificates: number;
  validCertificates: number;
  expiredCertificates: number;
  expiringSoonCertificates: number;
  unreachableCertificates: number;
  activeAlerts: number;
  autoRenewalEnabled: number;
  certificatesByProvider: Record<string, number>;
  expiryDistribution: {
    next7Days: number;
    next30Days: number;
    next90Days: number;
    beyond90Days: number;
  };
}

// GET /api/ssl/monitoring - Get SSL certificate monitoring data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'certificates'; // 'certificates', 'alerts', 'stats'
    const clientId = searchParams.get('clientId');
    const domain = searchParams.get('domain');
    const status = searchParams.get('status');
    const expiring = searchParams.get('expiring'); // 'soon', 'critical'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (type === 'certificates') {
      // Get SSL certificates
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'SSL Certificate -' }
      };
      
      if (clientId) {
        whereClause.clientId = clientId;
      }
      
      if (domain) {
        whereClause.reportData = {
          path: ['domain'],
          string_contains: domain
        };
      }
      
      if (status) {
        whereClause.reportData = {
          ...whereClause.reportData as object,
          path: ['status'],
          equals: status
        };
      }

      const skip = (page - 1) * limit;
      
      const certificates = await prisma.report.findMany({
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

      let certificateData = certificates.map(c => ({
        id: c.id,
        ...(c.reportData as unknown as SSLCertificate),
        lastChecked: c.generatedAt
      }));

      // Filter by expiring status if requested
      if (expiring === 'soon') {
        certificateData = certificateData.filter(cert => 
          cert.daysUntilExpiry <= 30 && cert.daysUntilExpiry > 7
        );
      } else if (expiring === 'critical') {
        certificateData = certificateData.filter(cert => 
          cert.daysUntilExpiry <= 7
        );
      }

      return NextResponse.json({
        certificates: certificateData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'alerts') {
      // Get SSL alerts
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'SSL Alert -' }
      };
      
      if (clientId) {
        whereClause.clientId = clientId;
      }

      const skip = (page - 1) * limit;
      
      const alerts = await prisma.report.findMany({
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

      const alertData = alerts.map(a => ({
        id: a.id,
        ...(a.reportData as unknown as SSLAlert),
        createdAt: a.generatedAt
      }));

      return NextResponse.json({
        alerts: alertData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'stats') {
      // Get SSL monitoring statistics
      const stats = await generateSSLMonitoringStats();
      return NextResponse.json({ stats });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching SSL monitoring data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/ssl/monitoring - Manage SSL certificate monitoring
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'check_certificate') {
      const { domain, clientId }: { domain: string; clientId?: string } = data;

      if (!domain) {
        return NextResponse.json(
          { error: 'Domain is required' },
          { status: 400 }
        );
      }

      try {
        const certificateInfo = await checkSSLCertificate(domain);
        
        // Store or update certificate information
        const existingCert = await prisma.report.findFirst({
          where: {
            title: `SSL Certificate - ${domain}`,
            ...(clientId && { clientId })
          }
        });

        let certRecord;
        if (existingCert) {
          certRecord = await prisma.report.update({
            where: { id: existingCert.id },
            data: {
              generatedAt: new Date(),
              reportData: JSON.parse(JSON.stringify({
                ...certificateInfo,
                lastChecked: new Date()
              }))
            }
          });
        } else {
          certRecord = await prisma.report.create({
            data: {
              title: `SSL Certificate - ${domain}`,
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString()
              },
              totalHours: 0,
              totalAmount: 0,
              clientId: clientId || 'system',
              generatedAt: new Date(),
              reportData: JSON.parse(JSON.stringify({
                ...certificateInfo,
                lastChecked: new Date()
              }))
            }
          });
        }

        // Check if alerts need to be created
        await checkAndCreateSSLAlerts(certRecord.id, certificateInfo, clientId);

        return NextResponse.json({
          message: 'SSL certificate checked successfully',
          certificate: {
            id: certRecord.id,
            ...certificateInfo
          }
        });

      } catch (error) {
        return NextResponse.json(
          { 
            error: 'Failed to check SSL certificate',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    }

    if (action === 'bulk_check') {
      const { domains, clientId }: { domains: string[]; clientId?: string } = data;

      if (!domains || domains.length === 0) {
        return NextResponse.json(
          { error: 'Domains array is required' },
          { status: 400 }
        );
      }

      const results = [];
      const errors = [];

      for (const domain of domains) {
        try {
          const certificateInfo = await checkSSLCertificate(domain);
          
          // Store certificate information
          const certRecord = await prisma.report.create({
            data: {
              title: `SSL Certificate - ${domain}`,
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString()
              },
              totalHours: 0,
              totalAmount: 0,
              clientId: clientId || 'system',
              generatedAt: new Date(),
              reportData: JSON.parse(JSON.stringify({
                ...certificateInfo,
                lastChecked: new Date()
              }))
            }
          });

          await checkAndCreateSSLAlerts(certRecord.id, certificateInfo, clientId);

          results.push({
            domain,
            certificateId: certRecord.id,
            status: certificateInfo.status,
            daysUntilExpiry: certificateInfo.daysUntilExpiry
          });

        } catch (error) {
          errors.push({
            domain,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        message: 'Bulk SSL certificate check completed',
        summary: {
          total: domains.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors
      });
    }

    if (action === 'auto_scan') {
      // Auto-scan all client domains for SSL certificates
      const clients = await prisma.client.findMany({
        select: {
          id: true,
          domainName: true
        }
      });

      const results = [];
      const errors = [];

      for (const client of clients) {
        if (client.domainName) {
          try {
            const certificateInfo = await checkSSLCertificate(client.domainName);
            
            // Update or create certificate record
            const existingCert = await prisma.report.findFirst({
              where: {
                title: `SSL Certificate - ${client.domainName}`,
                clientId: client.id
              }
            });

            let certRecord;
            if (existingCert) {
              certRecord = await prisma.report.update({
                where: { id: existingCert.id },
                data: {
                  generatedAt: new Date(),
                  reportData: JSON.parse(JSON.stringify({
                    ...certificateInfo,
                    lastChecked: new Date()
                  }))
                }
              });
            } else {
              certRecord = await prisma.report.create({
                data: {
                  title: `SSL Certificate - ${client.domainName}`,
                  dateRange: {
                    startDate: new Date().toISOString(),
                    endDate: new Date().toISOString()
                  },
                  totalHours: 0,
                  totalAmount: 0,
                  clientId: client.id,
                  generatedAt: new Date(),
                  reportData: JSON.parse(JSON.stringify({
                    ...certificateInfo,
                    lastChecked: new Date()
                  }))
                }
              });
            }

            await checkAndCreateSSLAlerts(certRecord.id, certificateInfo, client.id);

            results.push({
              clientId: client.id,
              domain: client.domainName,
              certificateId: certRecord.id,
              status: certificateInfo.status
            });

          } catch (error) {
            errors.push({
              clientId: client.id,
              domain: client.domainName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      return NextResponse.json({
        message: 'Auto SSL scan completed',
        summary: {
          total: clients.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors
      });
    }

    if (action === 'resolve_alert') {
      const { alertId }: { alertId: string } = data;

      if (!alertId) {
        return NextResponse.json(
          { error: 'alertId is required' },
          { status: 400 }
        );
      }

      // Get the alert
      const alert = await prisma.report.findUnique({
        where: { id: alertId }
      });

      if (!alert || !alert.title.startsWith('SSL Alert -')) {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }

      // Update alert as resolved
      const alertData = alert.reportData as unknown as SSLAlert;
      await prisma.report.update({
        where: { id: alertId },
        data: {
          reportData: JSON.parse(JSON.stringify({
            ...alertData,
            isResolved: true,
            resolvedAt: new Date(),
            resolvedBy: session.user.id
          }))
        }
      });

      return NextResponse.json({
        message: 'Alert resolved successfully'
      });
    }

    if (action === 'configure_auto_renewal') {
      const {
        certificateId,
        enabled,
        provider,
        config
      }: {
        certificateId: string;
        enabled: boolean;
        provider?: string;
        config?: Record<string, unknown>;
      } = data;

      if (!certificateId) {
        return NextResponse.json(
          { error: 'certificateId is required' },
          { status: 400 }
        );
      }

      // Get the certificate
      const certificate = await prisma.report.findUnique({
        where: { id: certificateId }
      });

      if (!certificate || !certificate.title.startsWith('SSL Certificate -')) {
        return NextResponse.json(
          { error: 'Certificate not found' },
          { status: 404 }
        );
      }

      // Update auto-renewal configuration
      const certData = certificate.reportData as unknown as SSLCertificate;
      await prisma.report.update({
        where: { id: certificateId },
        data: {
          reportData: JSON.parse(JSON.stringify({
            ...certData,
            autoRenewal: enabled,
            renewalProvider: provider,
            renewalConfig: config,
            updatedAt: new Date()
          }))
        }
      });

      return NextResponse.json({
        message: 'Auto-renewal configuration updated successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing SSL monitoring request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to check SSL certificate
async function checkSSLCertificate(domain: string): Promise<SSLCertificate> {
  return new Promise((resolve, reject) => {
    const options = {
      host: domain,
      port: 443,
      servername: domain,
      rejectUnauthorized: false
    };

    const socket = tls.connect(options, () => {
      const certificate = socket.getPeerCertificate(true);
      
      if (!certificate || Object.keys(certificate).length === 0) {
        socket.destroy();
        reject(new Error('No certificate found'));
        return;
      }

      const now = new Date();
      const validFrom = new Date(certificate.valid_from);
      const validTo = new Date(certificate.valid_to);
      const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: SSLCertificate['status'];
      if (now > validTo) {
        status = 'EXPIRED';
      } else if (daysUntilExpiry <= 7) {
        status = 'EXPIRING_SOON';
      } else if (now < validFrom) {
        status = 'INVALID';
      } else {
        status = 'VALID';
      }

      const subjectAltNames = certificate.subjectaltname
        ? certificate.subjectaltname.split(', ').map(name => name.replace('DNS:', ''))
        : [];

      const isWildcard = certificate.subject.CN?.startsWith('*.') || 
        subjectAltNames.some(name => name.startsWith('*.'));

      const sslCertificate: SSLCertificate = {
        clientId: '', // Will be set by caller
        domain,
        issuer: certificate.issuer.CN || certificate.issuer.O || 'Unknown',
        subject: certificate.subject.CN || domain,
        validFrom,
        validTo,
        fingerprint: certificate.fingerprint,
        serialNumber: certificate.serialNumber,
        signatureAlgorithm: (certificate as { sigalg?: string }).sigalg || 'Unknown',
        keySize: certificate.bits,
        isWildcard,
        subjectAltNames,
        status,
        daysUntilExpiry,
        lastChecked: now,
        autoRenewal: false,
        alertThresholds: {
          warning: 30,
          critical: 7
        }
      };

      socket.destroy();
      resolve(sslCertificate);
    });

    socket.on('error', (error) => {
      reject(new Error(`SSL connection failed: ${error.message}`));
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('SSL connection timeout'));
    });
  });
}

// Helper function to check and create SSL alerts
async function checkAndCreateSSLAlerts(
  certificateId: string,
  certificate: SSLCertificate,
  clientId?: string
): Promise<void> {
  const alerts: Partial<SSLAlert>[] = [];

  // Check for expiry alerts
  if (certificate.status === 'EXPIRED') {
    alerts.push({
      certificateId,
      clientId: clientId || certificate.clientId,
      domain: certificate.domain,
      alertType: 'EXPIRED',
      message: `SSL certificate for ${certificate.domain} has expired`,
      severity: 'CRITICAL',
      isResolved: false,
      createdAt: new Date(),
      metadata: {
        expiredDate: certificate.validTo,
        daysExpired: Math.abs(certificate.daysUntilExpiry)
      }
    });
  } else if (certificate.daysUntilExpiry <= certificate.alertThresholds.critical) {
    alerts.push({
      certificateId,
      clientId: clientId || certificate.clientId,
      domain: certificate.domain,
      alertType: 'EXPIRING_CRITICAL',
      message: `SSL certificate for ${certificate.domain} expires in ${certificate.daysUntilExpiry} days`,
      severity: 'HIGH',
      isResolved: false,
      createdAt: new Date(),
      metadata: {
        expiryDate: certificate.validTo,
        daysUntilExpiry: certificate.daysUntilExpiry
      }
    });
  } else if (certificate.daysUntilExpiry <= certificate.alertThresholds.warning) {
    alerts.push({
      certificateId,
      clientId: clientId || certificate.clientId,
      domain: certificate.domain,
      alertType: 'EXPIRING_WARNING',
      message: `SSL certificate for ${certificate.domain} expires in ${certificate.daysUntilExpiry} days`,
      severity: 'MEDIUM',
      isResolved: false,
      createdAt: new Date(),
      metadata: {
        expiryDate: certificate.validTo,
        daysUntilExpiry: certificate.daysUntilExpiry
      }
    });
  }

  // Check for invalid certificate
  if (certificate.status === 'INVALID') {
    alerts.push({
      certificateId,
      clientId: clientId || certificate.clientId,
      domain: certificate.domain,
      alertType: 'INVALID',
      message: `SSL certificate for ${certificate.domain} is invalid`,
      severity: 'HIGH',
      isResolved: false,
      createdAt: new Date(),
      metadata: {
        validFrom: certificate.validFrom,
        validTo: certificate.validTo
      }
    });
  }

  // Create alert records
  for (const alert of alerts) {
    // Check if similar alert already exists and is not resolved
    const existingAlert = await prisma.report.findFirst({
      where: {
        title: `SSL Alert - ${alert.domain}`,
        clientId: alert.clientId,
        reportData: {
          path: 'alertType',
          equals: alert.alertType
        }
      }
    });

    if (!existingAlert) {
      await prisma.report.create({
        data: {
          title: `SSL Alert - ${alert.domain}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: alert.clientId || 'system',
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(alert))
        }
      });
    }
  }
}

// Helper function to generate SSL monitoring statistics
async function generateSSLMonitoringStats(): Promise<SSLMonitoringStats> {
  const certificates = await prisma.report.findMany({
    where: {
      title: { startsWith: 'SSL Certificate -' }
    }
  });

  const certificateData = certificates.map(c => c.reportData as unknown as SSLCertificate);
  
  const totalCertificates = certificateData.length;
  const validCertificates = certificateData.filter(c => c.status === 'VALID').length;
  const expiredCertificates = certificateData.filter(c => c.status === 'EXPIRED').length;
  const expiringSoonCertificates = certificateData.filter(c => c.status === 'EXPIRING_SOON').length;
  const unreachableCertificates = certificateData.filter(c => c.status === 'UNREACHABLE').length;
  const autoRenewalEnabled = certificateData.filter(c => c.autoRenewal).length;

  // Count active alerts
  const activeAlerts = await prisma.report.count({
    where: {
      title: { startsWith: 'SSL Alert -' },
      reportData: {
        path: 'isResolved',
        equals: false
      }
    }
  });

  // Group by issuer (provider)
  const certificatesByProvider: Record<string, number> = {};
  for (const cert of certificateData) {
    const provider = cert.issuer || 'Unknown';
    certificatesByProvider[provider] = (certificatesByProvider[provider] || 0) + 1;
  }

  // Expiry distribution
  const expiryDistribution = {
    next7Days: 0,
    next30Days: 0,
    next90Days: 0,
    beyond90Days: 0
  };

  for (const cert of certificateData) {
    if (cert.daysUntilExpiry <= 7) {
      expiryDistribution.next7Days++;
    } else if (cert.daysUntilExpiry <= 30) {
      expiryDistribution.next30Days++;
    } else if (cert.daysUntilExpiry <= 90) {
      expiryDistribution.next90Days++;
    } else {
      expiryDistribution.beyond90Days++;
    }
  }

  return {
    totalCertificates,
    validCertificates,
    expiredCertificates,
    expiringSoonCertificates,
    unreachableCertificates,
    activeAlerts,
    autoRenewalEnabled,
    certificatesByProvider,
    expiryDistribution
  };
}