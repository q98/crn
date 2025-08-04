import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';



// GET /api/import/history - Get import history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type') as 'CLIENT' | 'CREDENTIAL' | 'TASK' | null;

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Record<string, unknown> = {
      importedById: session.user.id
    };

    if (type) {
      whereClause.type = type;
    }

    // Get import history from the new ImportHistory model
    const imports = await prisma.importHistory.findMany({
      where: whereClause,
      include: {
        importedBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        importedAt: 'desc'
      },
      skip,
      take: limit
    });

    const totalCount = await prisma.importHistory.count({
      where: whereClause
    });

    // Transform to response format
    const importHistory = imports.map(importRecord => ({
      id: importRecord.id,
      title: importRecord.title,
      type: importRecord.type as 'CLIENT' | 'CREDENTIAL' | 'TASK',
      status: importRecord.status as 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'ROLLED_BACK',
      importedCount: importRecord.importedCount,
      errorCount: importRecord.errorCount,
      warningCount: importRecord.warningCount,
      fileName: importRecord.fileName,
      importedAt: importRecord.importedAt,
      rolledBackAt: importRecord.rolledBackAt || undefined,
      canRollback: importRecord.status === 'SUCCESS' && !importRecord.rolledBackAt && importRecord.importData && Array.isArray(importRecord.importData) && importRecord.importData.length > 0,
      importedBy: {
        name: importRecord.importedBy?.name || 'Unknown',
        email: importRecord.importedBy?.email || 'Unknown'
      }
    }));

    return NextResponse.json({
      history: importHistory,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching import history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/import/history - Rollback an import
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { importId } = await request.json();

    if (!importId) {
      return NextResponse.json(
        { error: 'Import ID is required' },
        { status: 400 }
      );
    }

    // Find the import record
    const importRecord = await prisma.importHistory.findUnique({
      where: {
        id: importId,
        importedById: session.user.id
      }
    });

    if (!importRecord) {
      return NextResponse.json(
        { error: 'Import record not found' },
        { status: 404 }
      );
    }

    // Check if rollback is possible
    if (importRecord.status !== 'SUCCESS' || importRecord.rolledBackAt) {
      return NextResponse.json(
        { error: 'Import cannot be rolled back' },
        { status: 400 }
      );
    }

    if (!importRecord.importData || !Array.isArray(importRecord.importData) || importRecord.importData.length === 0) {
      return NextResponse.json(
        { error: 'No imported records to rollback' },
        { status: 400 }
      );
    }

    // Perform rollback based on import type
    let deletedCount = 0;
    const importedIds = importRecord.importData as string[];

    try {
      await prisma.$transaction(async (tx) => {
        switch (importRecord.type) {
          case 'CLIENT':
            // Delete clients and their related data
            await tx.credential.deleteMany({
              where: {
                clientId: {
                  in: importedIds
                }
              }
            });
            await tx.task.deleteMany({
              where: {
                clientId: {
                  in: importedIds
                }
              }
            });
            await tx.healthCheck.deleteMany({
              where: {
                clientId: {
                  in: importedIds
                }
              }
            });
            const clientResult = await tx.client.deleteMany({
              where: {
                id: {
                  in: importedIds
                }
              }
            });
            deletedCount = clientResult.count;
            break;

          case 'CREDENTIAL':
            const credentialResult = await tx.credential.deleteMany({
              where: {
                id: {
                  in: importedIds
                }
              }
            });
            deletedCount = credentialResult.count;
            break;

          case 'TASK':
            // Delete time entries first
            await tx.timeEntry.deleteMany({
              where: {
                taskId: {
                  in: importedIds
                }
              }
            });
            const taskResult = await tx.task.deleteMany({
              where: {
                id: {
                  in: importedIds
                }
              }
            });
            deletedCount = taskResult.count;
            break;

          default:
            throw new Error(`Unsupported import type: ${importRecord.type}`);
        }

        // Update the import record to mark as rolled back
        await tx.importHistory.update({
          where: {
            id: importId
          },
          data: {
            status: 'ROLLED_BACK',
            rolledBackAt: new Date()
          }
        });
      });

      return NextResponse.json({
        message: 'Import successfully rolled back',
        deletedCount,
        importType: importRecord.type
      });

    } catch (rollbackError) {
      console.error('Error during rollback transaction:', rollbackError);
      return NextResponse.json(
        { error: 'Failed to rollback import' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error rolling back import:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}