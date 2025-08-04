import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import crypto from 'crypto';

// Type guard function
function isBulkCredentialOperation(obj: unknown): obj is BulkCredentialOperation {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'status' in obj &&
    'targetCredentials' in obj &&
    'operations' in obj &&
    'results' in obj &&
    'startedAt' in obj &&
    'performedBy' in obj
  );
}

function isCredentialAuditLog(obj: unknown): obj is CredentialAuditLog {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'credentialId' in obj &&
    'action' in obj &&
    'performedBy' in obj &&
    'timestamp' in obj
  );
}

function isCredentialPolicy(obj: unknown): obj is CredentialPolicy {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'description' in obj &&
    'enabled' in obj &&
    'rules' in obj &&
    'appliesTo' in obj &&
    'createdBy' in obj &&
    'createdAt' in obj &&
    'lastModified' in obj
  );
}

interface BulkCredentialOperation {
  id?: string;
  type: 'ROTATE' | 'UPDATE' | 'VALIDATE' | 'AUDIT' | 'EXPIRE' | 'BACKUP';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  targetCredentials: string[]; // Credential IDs
  filters?: {
    clientIds?: string[];
    credentialTypes?: string[];
    tags?: string[];
    lastRotatedBefore?: Date;
    expiresWithin?: number; // days
    weakPasswords?: boolean;
    duplicatePasswords?: boolean;
  };
  operations: {
    rotatePasswords?: {
      passwordLength: number;
      includeSymbols: boolean;
      includeNumbers: boolean;
      includeUppercase: boolean;
      includeLowercase: boolean;
      excludeSimilar: boolean;
      customPattern?: string;
    };
    updateFields?: Record<string, unknown>;
    validationRules?: string[];
    backupBeforeChange?: boolean;
    notifyClients?: boolean;
    scheduleExpiry?: {
      expiryDate: Date;
      warningDays: number[];
    };
  };
  results: {
    totalProcessed: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{
      credentialId: string;
      error: string;
      details?: Record<string, unknown>;
    }>;
    changes: Array<{
      credentialId: string;
      oldValues: Record<string, unknown>;
      newValues: Record<string, unknown>;
      timestamp: Date;
    }>;
    generatedPasswords?: Array<{
      credentialId: string;
      newPassword: string;
      strength: 'WEAK' | 'MEDIUM' | 'STRONG' | 'VERY_STRONG';
    }>;
  };
  schedule?: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    nextRun?: Date;
    lastRun?: Date;
  };
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  performedBy: string;
  metadata?: Record<string, unknown>;
}

interface CredentialAuditLog {
  id?: string;
  credentialId: string;
  action: 'CREATED' | 'UPDATED' | 'ROTATED' | 'ACCESSED' | 'VALIDATED' | 'EXPIRED' | 'DELETED';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedBy: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface CredentialPolicy {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  rules: {
    passwordPolicy?: {
      minLength: number;
      maxLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
      prohibitCommon: boolean;
      prohibitPersonalInfo: boolean;
      maxAge: number; // days
      historyCount: number; // prevent reuse of last N passwords
    };
    rotationPolicy?: {
      mandatory: boolean;
      frequency: number; // days
      warningDays: number[];
      autoRotate: boolean;
      notifyOnRotation: boolean;
    };
    accessPolicy?: {
      requireMFA: boolean;
      allowedIPs?: string[];
      allowedTimeRanges?: Array<{
        start: string;
        end: string;
        days: number[]; // 0-6 for Sunday-Saturday
      }>;
      maxConcurrentSessions: number;
      sessionTimeout: number; // minutes
    };
    auditPolicy?: {
      logAllAccess: boolean;
      logFailedAttempts: boolean;
      retentionDays: number;
      alertOnSuspiciousActivity: boolean;
    };
  };
  appliesTo: {
    credentialTypes?: string[];
    clientIds?: string[];
    tags?: string[];
    all?: boolean;
  };
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

// GET /api/credentials/bulk - Get bulk operations, audit logs, and policies
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'operations'; // 'operations', 'audit', 'policies', 'analysis'
    const status = searchParams.get('status');
    const credentialId = searchParams.get('credentialId');
    const clientId = searchParams.get('clientId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (type === 'operations') {
      // Get bulk operations
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Bulk Credential Operation -' }
      };
      
      if (status) {
        whereClause.reportData = {
          path: ['status'],
          equals: status
        };
      }
      
      if (startDate || endDate) {
        whereClause.generatedAt = {};
        if (startDate) {
          (whereClause.generatedAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          (whereClause.generatedAt as Record<string, unknown>).lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;
      
      const operations = await prisma.report.findMany({
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

      const operationData = operations.map(op => {
        const parsedData = typeof op.reportData === 'string' ? JSON.parse(op.reportData) : op.reportData;
        
        if (!isBulkCredentialOperation(parsedData)) {
          throw new Error('Invalid bulk credential operation data structure');
        }
        
        return {
          id: op.id,
          ...parsedData,
          startedAt: op.generatedAt
        };
      });

      return NextResponse.json({
        operations: operationData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'audit') {
      // Get audit logs
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Credential Audit Log -' }
      };
      
      if (credentialId) {
        whereClause.reportData = {
          path: ['credentialId'],
          equals: credentialId
        };
      }
      
      if (startDate || endDate) {
        whereClause.generatedAt = {};
        if (startDate) {
          (whereClause.generatedAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          (whereClause.generatedAt as Record<string, unknown>).lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;
      
      const auditLogs = await prisma.report.findMany({
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

      const auditData = auditLogs.map(log => {
        const parsedData = typeof log.reportData === 'string' ? JSON.parse(log.reportData) : log.reportData;
        
        if (!isCredentialAuditLog(parsedData)) {
          throw new Error('Invalid credential audit log data structure');
        }
        
        return {
          id: log.id,
          ...parsedData,
          timestamp: log.generatedAt
        };
      });

      return NextResponse.json({
        auditLogs: auditData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'policies') {
      // Get credential policies
      const policies = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Credential Policy -' }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const policyData = policies.map(policy => {
        const parsedData = typeof policy.reportData === 'string' ? JSON.parse(policy.reportData) : policy.reportData;
        
        if (!isCredentialPolicy(parsedData)) {
          throw new Error('Invalid credential policy data structure');
        }
        
        return {
          id: policy.id,
          ...parsedData,
          createdAt: policy.generatedAt
        };
      });

      return NextResponse.json({ policies: policyData });
    }

    if (type === 'analysis') {
      // Get credential security analysis
      const credentials = await prisma.credential.findMany({
        include: {
          client: {
            select: {
              id: true,
              domainName: true
            }
          }
        },
        ...(clientId && {
          where: {
            clientId
          }
        })
      });

      const analysis = await analyzeCredentialSecurity(credentials);
      
      return NextResponse.json({ analysis });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching bulk credential data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/credentials/bulk - Execute bulk operations, create policies, or log audit events
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'bulk_rotate') {
      const {
        credentialIds,
        filters,
        passwordSettings = {
          passwordLength: 16,
          includeSymbols: true,
          includeNumbers: true,
          includeUppercase: true,
          includeLowercase: true,
          excludeSimilar: true
        },
        backupBeforeChange = true,
        notifyClients = false
      }: {
        credentialIds?: string[];
        filters?: BulkCredentialOperation['filters'];
        passwordSettings?: BulkCredentialOperation['operations']['rotatePasswords'];
        backupBeforeChange?: boolean;
        notifyClients?: boolean;
      } = data;

      // Get target credentials
      const targetCredentials = await getTargetCredentials(credentialIds, filters);
      
      if (targetCredentials.length === 0) {
        return NextResponse.json(
          { error: 'No credentials found matching criteria' },
          { status: 400 }
        );
      }

      // Create bulk operation record
      const operation: BulkCredentialOperation = {
        type: 'ROTATE',
        status: 'PENDING',
        targetCredentials: targetCredentials.map(c => c.id),
        filters,
        operations: {
          rotatePasswords: passwordSettings,
          backupBeforeChange,
          notifyClients
        },
        results: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          errors: [],
          changes: [],
          generatedPasswords: []
        },
        startedAt: new Date(),
        performedBy: session.user.id
      };

      const operationRecord = await prisma.report.create({
        data: {
          title: `Bulk Credential Operation - ROTATE - ${new Date().toISOString()}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: 'system', // Use a default client ID for bulk operations
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(operation))
        }
      });

      // Process rotation asynchronously
      processBulkRotation(operationRecord.id, operation, targetCredentials, session.user.id);

      return NextResponse.json({
        message: 'Bulk rotation started',
        operationId: operationRecord.id,
        targetCount: targetCredentials.length
      });
    }

    if (action === 'bulk_validate') {
      const {
        credentialIds,
        filters,
        validationRules = ['password_strength', 'expiry_check', 'duplicate_check']
      }: {
        credentialIds?: string[];
        filters?: BulkCredentialOperation['filters'];
        validationRules?: string[];
      } = data;

      const targetCredentials = await getTargetCredentials(credentialIds, filters);
      
      const validationResults = await validateCredentials(targetCredentials, validationRules);
      
      return NextResponse.json({
        message: 'Validation completed',
        results: validationResults
      });
    }

    if (action === 'create_policy') {
      const {
        name,
        description,
        rules,
        appliesTo
      }: {
        name: string;
        description: string;
        rules: CredentialPolicy['rules'];
        appliesTo: CredentialPolicy['appliesTo'];
      } = data;

      if (!name || !rules || !appliesTo) {
        return NextResponse.json(
          { error: 'name, rules, and appliesTo are required' },
          { status: 400 }
        );
      }

      const policy: CredentialPolicy = {
        name,
        description,
        enabled: true,
        rules,
        appliesTo,
        createdBy: session.user.id,
        createdAt: new Date(),
        lastModified: new Date()
      };

      const policyRecord = await prisma.report.create({
        data: {
          title: `Credential Policy - ${policy.name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: 'system', // Use a default client ID for policies
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(policy))
        }
      });

      return NextResponse.json({
        message: 'Credential policy created',
        policyId: policyRecord.id
      });
    }

    if (action === 'log_audit') {
      const {
        credentialId,
        action: auditAction,
        oldValues,
        newValues,
        reason,
        metadata
      }: {
        credentialId: string;
        action: CredentialAuditLog['action'];
        oldValues?: Record<string, unknown>;
        newValues?: Record<string, unknown>;
        reason?: string;
        metadata?: Record<string, unknown>;
      } = data;

      if (!credentialId || !auditAction) {
        return NextResponse.json(
          { error: 'credentialId and action are required' },
          { status: 400 }
        );
      }

      const auditLog: CredentialAuditLog = {
        credentialId,
        action: auditAction,
        oldValues,
        newValues,
        performedBy: session.user.id,
        timestamp: new Date(),
        reason,
        metadata
      };

      const auditRecord = await prisma.report.create({
        data: {
          title: `Credential Audit Log - ${auditAction} - ${credentialId}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: 'system', // Use a default client ID for audit logs
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(auditLog))
        }
      });

      return NextResponse.json({
        message: 'Audit log created',
        auditId: auditRecord.id
      });
    }

    if (action === 'schedule_rotation') {
      const {
        credentialIds,
        filters,
        schedule
      }: {
        credentialIds?: string[];
        filters?: BulkCredentialOperation['filters'];
        schedule: BulkCredentialOperation['schedule'];
      } = data;

      if (!schedule) {
        return NextResponse.json(
          { error: 'schedule is required' },
          { status: 400 }
        );
      }

      const targetCredentials = await getTargetCredentials(credentialIds, filters);
      
      const operation: BulkCredentialOperation = {
        type: 'ROTATE',
        status: 'PENDING',
        targetCredentials: targetCredentials.map(c => c.id),
        filters,
        operations: {
          rotatePasswords: {
            passwordLength: 16,
            includeSymbols: true,
            includeNumbers: true,
            includeUppercase: true,
            includeLowercase: true,
            excludeSimilar: true
          }
        },
        results: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          errors: [],
          changes: []
        },
        schedule,
        startedAt: new Date(),
        performedBy: session.user.id
      };

      const operationRecord = await prisma.report.create({
        data: {
          title: `Scheduled Bulk Credential Operation - ROTATE`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId: 'system', // Use a default client ID for scheduled operations
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify(operation))
        }
      });

      return NextResponse.json({
        message: 'Rotation scheduled',
        operationId: operationRecord.id,
        nextRun: schedule.nextRun
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing bulk credential request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get target credentials based on IDs or filters
async function getTargetCredentials(
  credentialIds?: string[],
  filters?: BulkCredentialOperation['filters']
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  const whereClause: Record<string, unknown> = {};

  if (credentialIds && credentialIds.length > 0) {
    whereClause.id = { in: credentialIds };
  } else if (filters) {
    if (filters.clientIds && filters.clientIds.length > 0) {
      whereClause.clientId = { in: filters.clientIds };
    }
    
    if (filters.credentialTypes && filters.credentialTypes.length > 0) {
      whereClause.type = { in: filters.credentialTypes };
    }
    
    if (filters.lastRotatedBefore) {
      whereClause.lastRotated = {
        lt: filters.lastRotatedBefore
      };
    }
    
    // Add other filter conditions as needed
  }

  const credentials = await prisma.credential.findMany({
    where: whereClause,
    include: {
      client: {
        select: {
          id: true,
          domainName: true
        }
      }
    }
  });

  return credentials;
}

// Helper function to process bulk rotation
async function processBulkRotation(
  operationId: string,
  operation: BulkCredentialOperation,
  credentials: Array<{ id: string; [key: string]: unknown }>,
  userId: string
): Promise<void> {
  try {
    // Update status to in progress
    await prisma.report.update({
      where: { id: operationId },
      data: {
        reportData: JSON.parse(JSON.stringify({
          ...operation,
          status: 'IN_PROGRESS'
        }))
      }
    });

    const results = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ credentialId: string; error: string }>,
      changes: [] as Array<{ credentialId: string; oldValues: Record<string, unknown>; newValues: Record<string, unknown>; timestamp: Date }>,
      generatedPasswords: [] as Array<{ credentialId: string; newPassword: string; strength: 'WEAK' | 'MEDIUM' | 'STRONG' | 'VERY_STRONG' }>
    };

    for (const credential of credentials) {
      results.totalProcessed++;
      
      try {
        // Generate new password
        const newPassword = generateSecurePassword(operation.operations.rotatePasswords!);
        const passwordStrength = assessPasswordStrength(newPassword);
        
        // Backup old values if requested
        const oldValues: Record<string, unknown> = {};
        if (operation.operations.backupBeforeChange) {
          if ('password' in credential && typeof credential.password === 'string') {
            oldValues.password = decrypt(credential.password);
          }
        }
        
        // Update credential
        const encryptedPassword = encrypt(newPassword);
        await prisma.credential.update({
          where: { id: credential.id },
          data: {
            password: encryptedPassword
          }
        });
        
        // Record changes
        const newValues = {
          password: '[ENCRYPTED]'
        };
        
        results.changes.push({
          credentialId: credential.id,
          oldValues,
          newValues,
          timestamp: new Date()
        });
        
        results.generatedPasswords.push({
          credentialId: credential.id,
          newPassword,
          strength: passwordStrength
        });
        
        // Log audit event
        await logCredentialAudit({
          credentialId: credential.id,
          action: 'ROTATED',
          oldValues,
          newValues,
          performedBy: userId,
          timestamp: new Date(),
          reason: 'Bulk rotation operation'
        });
        
        results.successful++;
        
      } catch (credentialError) {
        results.failed++;
        results.errors.push({
          credentialId: credential.id,
          error: credentialError instanceof Error ? credentialError.message : 'Unknown error'
        });
      }
    }

    // Update final status
    const finalOperation: BulkCredentialOperation = {
      ...operation,
      status: results.failed === 0 ? 'COMPLETED' : 'COMPLETED',
      results,
      completedAt: new Date(),
      duration: new Date().getTime() - operation.startedAt.getTime()
    };

    await prisma.report.update({
      where: { id: operationId },
      data: {
        reportData: JSON.parse(JSON.stringify(finalOperation))
      }
    });

  } catch (error) {
    console.error('Error processing bulk rotation:', error);
    
    await prisma.report.update({
      where: { id: operationId },
      data: {
        reportData: JSON.parse(JSON.stringify({
          ...operation,
          status: 'FAILED',
          completedAt: new Date(),
          results: {
            ...operation.results,
            errors: [{
              credentialId: 'SYSTEM',
              error: error instanceof Error ? error.message : 'Unknown error'
            }]
          }
        }))
      }
    });
  }
}

// Helper function to generate secure password
function generateSecurePassword(settings: BulkCredentialOperation['operations']['rotatePasswords']): string {
  if (!settings) {
    settings = {
      passwordLength: 16,
      includeSymbols: true,
      includeNumbers: true,
      includeUppercase: true,
      includeLowercase: true,
      excludeSimilar: true
    };
  }

  let charset = '';
  
  if (settings.includeLowercase) {
    charset += settings.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (settings.includeUppercase) {
    charset += settings.excludeSimilar ? 'ABCDEFGHJKMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (settings.includeNumbers) {
    charset += settings.excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (settings.includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (charset === '') {
    throw new Error('At least one character type must be included');
  }

  let password = '';
  for (let i = 0; i < settings.passwordLength; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
}

// Helper function to assess password strength
function assessPasswordStrength(password: string): 'WEAK' | 'MEDIUM' | 'STRONG' | 'VERY_STRONG' {
  let score = 0;
  
  // Length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character types
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // Complexity
  if (password.length >= 20) score += 1;
  
  if (score <= 3) return 'WEAK';
  if (score <= 5) return 'MEDIUM';
  if (score <= 7) return 'STRONG';
  return 'VERY_STRONG';
}

// Helper function to validate credentials
async function validateCredentials(
  credentials: Array<{ id: string; [key: string]: unknown }>,
  rules: string[]
): Promise<Record<string, unknown>> {
  const results = {
    totalValidated: credentials.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    issues: [] as Array<{
      credentialId: string;
      rule: string;
      severity: 'ERROR' | 'WARNING';
      message: string;
    }>
  };

  for (const credential of credentials) {
    let hasErrors = false;
    
    for (const rule of rules) {
      switch (rule) {
        case 'password_strength':
          try {
            if ('password' in credential && typeof credential.password === 'string') {
              const decryptedPassword = decrypt(credential.password);
              const strength = assessPasswordStrength(decryptedPassword);
              
              if (strength === 'WEAK') {
                results.issues.push({
                  credentialId: credential.id,
                  rule: 'password_strength',
                  severity: 'ERROR',
                  message: 'Password is too weak'
                });
                hasErrors = true;
              } else if (strength === 'MEDIUM') {
                results.issues.push({
                  credentialId: credential.id,
                  rule: 'password_strength',
                  severity: 'WARNING',
                  message: 'Password could be stronger'
                });
                results.warnings++;
              }
            }
          } catch (_passwordError) {
            results.issues.push({
              credentialId: credential.id,
              rule: 'password_strength',
              severity: 'ERROR',
              message: 'Unable to decrypt password for validation'
            });
            hasErrors = true;
          }
          break;
          
        case 'expiry_check':
          const expiryDate = (credential as { expiryDate?: Date | string }).expiryDate;
          if (expiryDate) {
            const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 0) {
              results.issues.push({
                credentialId: credential.id,
                rule: 'expiry_check',
                severity: 'ERROR',
                message: 'Credential has expired'
              });
              hasErrors = true;
            } else if (daysUntilExpiry <= 30) {
              results.issues.push({
                credentialId: credential.id,
                rule: 'expiry_check',
                severity: 'WARNING',
                message: `Credential expires in ${daysUntilExpiry} days`
              });
              results.warnings++;
            }
          }
          break;
          
        // Add more validation rules as needed
      }
    }
    
    if (hasErrors) {
      results.failed++;
    } else {
      results.passed++;
    }
  }

  return results;
}

// Helper function to analyze credential security
async function analyzeCredentialSecurity(
  credentials: Array<{ id: string; [key: string]: unknown }>
): Promise<Record<string, unknown>> {
  const analysis = {
    totalCredentials: credentials.length,
    passwordStrengthDistribution: {
      weak: 0,
      medium: 0,
      strong: 0,
      veryStrong: 0
    },
    expiryStatus: {
      expired: 0,
      expiringSoon: 0, // within 30 days
      valid: 0
    },
    rotationStatus: {
      neverRotated: 0,
      rotatedRecently: 0, // within 90 days
      needsRotation: 0 // older than 90 days
    },
    riskFactors: [] as Array<{
      type: string;
      count: number;
      description: string;
    }>,
    recommendations: [] as Array<{
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      action: string;
      description: string;
      affectedCredentials: number;
    }>
  };

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (const credential of credentials) {
    // Analyze password strength
    try {
      if ('password' in credential && typeof credential.password === 'string') {
        const decryptedPassword = decrypt(credential.password);
        const strength = assessPasswordStrength(decryptedPassword);
        
        switch (strength) {
          case 'WEAK':
            analysis.passwordStrengthDistribution.weak++;
            break;
          case 'MEDIUM':
            analysis.passwordStrengthDistribution.medium++;
            break;
          case 'STRONG':
            analysis.passwordStrengthDistribution.strong++;
            break;
          case 'VERY_STRONG':
            analysis.passwordStrengthDistribution.veryStrong++;
            break;
        }
      }
    } catch (_decryptError) {
      // Unable to decrypt, count as weak
      analysis.passwordStrengthDistribution.weak++;
    }

    // Analyze expiry status
    const expiryDate = (credential as { expiryDate?: Date | string }).expiryDate;
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry < now) {
        analysis.expiryStatus.expired++;
      } else if (expiry < thirtyDaysFromNow) {
        analysis.expiryStatus.expiringSoon++;
      } else {
        analysis.expiryStatus.valid++;
      }
    } else {
      analysis.expiryStatus.valid++;
    }

    // Analyze rotation status
    const lastRotated = (credential as { lastRotated?: Date | string }).lastRotated;
    if (!lastRotated) {
      analysis.rotationStatus.neverRotated++;
    } else {
      const rotationDate = new Date(lastRotated);
      if (rotationDate > ninetyDaysAgo) {
        analysis.rotationStatus.rotatedRecently++;
      } else {
        analysis.rotationStatus.needsRotation++;
      }
    }
  }

  // Generate risk factors and recommendations
  if (analysis.passwordStrengthDistribution.weak > 0) {
    analysis.riskFactors.push({
      type: 'WEAK_PASSWORDS',
      count: analysis.passwordStrengthDistribution.weak,
      description: 'Credentials with weak passwords'
    });
    
    analysis.recommendations.push({
      priority: 'HIGH',
      action: 'ROTATE_WEAK_PASSWORDS',
      description: 'Immediately rotate all weak passwords',
      affectedCredentials: analysis.passwordStrengthDistribution.weak
    });
  }

  if (analysis.expiryStatus.expired > 0) {
    analysis.riskFactors.push({
      type: 'EXPIRED_CREDENTIALS',
      count: analysis.expiryStatus.expired,
      description: 'Expired credentials'
    });
    
    analysis.recommendations.push({
      priority: 'HIGH',
      action: 'RENEW_EXPIRED',
      description: 'Renew or remove expired credentials',
      affectedCredentials: analysis.expiryStatus.expired
    });
  }

  if (analysis.rotationStatus.needsRotation > 0) {
    analysis.recommendations.push({
      priority: 'MEDIUM',
      action: 'SCHEDULE_ROTATION',
      description: 'Schedule rotation for credentials not rotated in 90+ days',
      affectedCredentials: analysis.rotationStatus.needsRotation
    });
  }

  return analysis;
}

// Helper function to log credential audit
async function logCredentialAudit(auditData: CredentialAuditLog): Promise<void> {
  await prisma.report.create({
    data: {
      title: `Credential Audit Log - ${auditData.action} - ${auditData.credentialId}`,
      dateRange: {
        startDate: auditData.timestamp.toISOString(),
        endDate: auditData.timestamp.toISOString()
      },
      totalHours: 0,
      totalAmount: 0,
      clientId: 'system', // Use a default client ID for audit logs
      generatedAt: auditData.timestamp,
      reportData: JSON.parse(JSON.stringify(auditData))
    }
  });
}