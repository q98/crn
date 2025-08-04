import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ScheduledRotationData {
  type: string;
  credentialIds: string[];
  frequency: string;
  nextRotationDate: string;
  rotationType: string;
  passwordOptions?: Record<string, unknown>;
  userId: string;
}
import { encrypt } from '@/lib/encryption';
import crypto from 'crypto';

interface BulkRotationRequest {
  credentialIds: string[];
  rotationType: 'GENERATE_NEW' | 'UPDATE_EXISTING';
  passwordOptions?: {
    length: number;
    includeUppercase: boolean;
    includeLowercase: boolean;
    includeNumbers: boolean;
    includeSymbols: boolean;
    excludeSimilar: boolean;
  };
  newPasswords?: { [credentialId: string]: string };
  scheduleRotation?: {
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    nextRotationDate: string;
  };
}

interface RotationResult {
  success: boolean;
  rotated: number;
  failed: number;
  results: Array<{
    credentialId: string;
    service: string;
    success: boolean;
    error?: string;
    newPassword?: string;
  }>;
}

// POST /api/credentials/bulk-rotate - Rotate multiple credentials
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      credentialIds,
      rotationType,
      passwordOptions,
      newPasswords,
      scheduleRotation
    }: BulkRotationRequest = await request.json();

    // Validate input
    if (!credentialIds || credentialIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one credential ID is required' },
        { status: 400 }
      );
    }

    if (!['GENERATE_NEW', 'UPDATE_EXISTING'].includes(rotationType)) {
      return NextResponse.json(
        { error: 'Invalid rotation type' },
        { status: 400 }
      );
    }

    if (rotationType === 'UPDATE_EXISTING' && !newPasswords) {
      return NextResponse.json(
        { error: 'New passwords are required for UPDATE_EXISTING rotation type' },
        { status: 400 }
      );
    }

    // Get credentials to rotate
    const credentials = await prisma.credential.findMany({
      where: {
        id: {
          in: credentialIds
        }
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

    if (credentials.length === 0) {
      return NextResponse.json(
        { error: 'No credentials found' },
        { status: 404 }
      );
    }

    const result: RotationResult = {
      success: true,
      rotated: 0,
      failed: 0,
      results: []
    };

    // Process each credential
    for (const credential of credentials) {
      try {
        let newPassword: string;

        if (rotationType === 'GENERATE_NEW') {
          // Generate new password
          newPassword = generatePassword(passwordOptions || {
            length: 16,
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: true,
            excludeSimilar: true
          });
        } else {
          // Use provided password
          newPassword = newPasswords![credential.id];
          if (!newPassword) {
            result.results.push({
              credentialId: credential.id,
              service: credential.service,
              success: false,
              error: 'No new password provided for this credential'
            });
            result.failed++;
            continue;
          }
        }

        // Encrypt the new password
        const encryptedPassword = encrypt(newPassword);

        // Update the credential
        await prisma.credential.update({
          where: {
            id: credential.id
          },
          data: {
            password: encryptedPassword,
            updatedAt: new Date()
          }
        });

        // Create rotation history record
        await prisma.importHistory.create({
          data: {
            title: `Password Rotation - ${credential.service}`,
            type: 'CREDENTIAL',
            status: 'SUCCESS',
            fileName: `rotation_${credential.service}_${new Date().toISOString().split('T')[0]}.log`,
            importedCount: 1,
            errorCount: 0,
            warningCount: 0,
            importData: { importedIds: [credential.id] },
            importedById: session.user.id,
            importedAt: new Date()
          }
        });

        result.results.push({
          credentialId: credential.id,
          service: credential.service,
          success: true,
          newPassword: rotationType === 'GENERATE_NEW' ? newPassword : undefined
        });
        result.rotated++;

      } catch (error) {
        result.results.push({
          credentialId: credential.id,
          service: credential.service,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failed++;
      }
    }

    // Schedule future rotation if requested
    if (scheduleRotation && result.rotated > 0) {
      try {
        const nextRotationDate = new Date(scheduleRotation.nextRotationDate);
        
        await prisma.report.create({
          data: {
            title: `Scheduled Password Rotation - ${scheduleRotation.frequency}`,
            dateRange: {
              startDate: new Date().toISOString(),
              endDate: nextRotationDate.toISOString()
            },
            totalHours: 0,
            totalAmount: 0,
            clientId: 'SYSTEM',
            generatedAt: new Date(),
            reportData: {
              type: 'SCHEDULED_ROTATION',
              credentialIds: credentials.filter((_, index) => result.results[index].success).map(c => c.id),
              frequency: scheduleRotation.frequency,
              nextRotationDate: nextRotationDate.toISOString(),
              rotationType,
              passwordOptions,
              userId: session.user.id
            }
          }
        });
      } catch (scheduleError) {
        console.error('Error scheduling rotation:', scheduleError);
        // Don't fail the entire operation if scheduling fails
      }
    }

    if (result.failed > 0) {
      result.success = false;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error rotating credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/credentials/bulk-rotate - Get rotation history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    // Get rotation history
    const rotations = await prisma.importHistory.findMany({
      where: {
        importedById: session.user.id,
        title: {
          startsWith: 'Password Rotation'
        }
      },
      orderBy: {
        importedAt: 'desc'
      },
      skip,
      take: limit
    });

    const totalCount = await prisma.importHistory.count({
      where: {
        importedById: session.user.id,
        title: {
          startsWith: 'Password Rotation'
        }
      }
    });

    // Get scheduled rotations
    const scheduledRotations = await prisma.report.findMany({
      where: {
        title: {
          startsWith: 'Scheduled Password Rotation'
        },
        reportData: {
          path: 'userId',
          equals: session.user.id
        }
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    const rotationHistory = rotations.map(rotation => ({
      id: rotation.id,
      title: rotation.title,
      credentialCount: rotation.importedCount,
      rotatedAt: rotation.importedAt,
      status: rotation.status
    }));

    const scheduledRotationsList = scheduledRotations.map(schedule => {
      const data = schedule.reportData as unknown as ScheduledRotationData;
      return {
        id: schedule.id,
        frequency: data.frequency,
        credentialCount: data.credentialIds?.length || 0,
        nextRotationDate: new Date(data.nextRotationDate),
        createdAt: schedule.generatedAt
      };
    });

    return NextResponse.json({
      rotationHistory,
      scheduledRotations: scheduledRotationsList,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching rotation history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate secure passwords
function generatePassword(options: {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
}): string {
  let charset = '';
  
  if (options.includeLowercase) {
    charset += options.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (options.includeUppercase) {
    charset += options.excludeSimilar ? 'ABCDEFGHJKMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (options.includeNumbers) {
    charset += options.excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (options.includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }
  
  if (charset === '') {
    throw new Error('At least one character type must be selected');
  }
  
  let password = '';
  for (let i = 0; i < options.length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}