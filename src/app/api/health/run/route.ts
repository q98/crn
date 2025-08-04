import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface HealthCheckRequest {
  domains: string[];
  createClientIfNotExists?: boolean;
}

interface HealthCheckResult {
  domain: string;
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  responseTime: number;
  statusCode: number | null;
  sslValid: boolean;
  error?: string;
  timestamp: string;
}

// POST /api/health/run - Run health checks for specified domains
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: HealthCheckRequest = await request.json();
    const { domains, createClientIfNotExists = true } = body;

    if (!domains || domains.length === 0) {
      return NextResponse.json(
        { error: 'At least one domain is required' },
        { status: 400 }
      );
    }

    const results: HealthCheckResult[] = [];

    for (const domain of domains) {
      try {
        // Check if client exists for this domain
        let client = await prisma.client.findFirst({
          where: { domainName: domain }
        });

        // Create client if it doesn't exist and createClientIfNotExists is true
        if (!client && createClientIfNotExists) {
          client = await prisma.client.create({
            data: {
              domainName: domain,
              verificationStatus: 'PENDING',
              notes: `Auto-created for health check on ${new Date().toISOString()}`
            }
          });
        }

        if (!client) {
          results.push({
            domain,
            status: 'ERROR',
            responseTime: 0,
            statusCode: null,
            sslValid: false,
            error: 'Client not found and auto-creation disabled',
            timestamp: new Date().toISOString()
          });
          continue;
        }

        // Perform the actual health check
        const healthCheckResult = await performHealthCheck(domain);
        
        // Save health check result to database
        await prisma.healthCheck.create({
          data: {
            checkType: 'UPTIME',
            status: healthCheckResult.status === 'HEALTHY' ? 'HEALTHY' : 
                   healthCheckResult.status === 'WARNING' ? 'WARNING' : 'CRITICAL',
            details: JSON.stringify({
              responseTime: healthCheckResult.responseTime,
              statusCode: healthCheckResult.statusCode,
              sslValid: healthCheckResult.sslValid,
              error: healthCheckResult.error
            }),
            clientId: client.id
          }
        });

        results.push(healthCheckResult);
      } catch (error) {
        console.error(`Error checking domain ${domain}:`, error);
        results.push({
          domain,
          status: 'ERROR',
          responseTime: 0,
          statusCode: null,
          sslValid: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error running health checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to perform actual health check
async function performHealthCheck(domain: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  let url = domain;
  
  // Add protocol if not present
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${domain}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SHP Health Monitor/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Check SSL validity (basic check)
    const sslValid = url.startsWith('https://') && response.ok;

    // Determine status based on response
    let status: 'HEALTHY' | 'WARNING' | 'ERROR';
    if (response.ok) {
      status = responseTime < 1000 ? 'HEALTHY' : 'WARNING';
    } else {
      status = 'ERROR';
    }

    return {
      domain,
      status,
      responseTime,
      statusCode: response.status,
      sslValid,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      domain,
      status: 'ERROR',
      responseTime,
      statusCode: null,
      sslValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}