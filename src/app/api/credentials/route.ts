import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const credentials = await prisma.credential.findMany({
      include: {
        client: {
          select: {
            id: true,
            domainName: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(credentials);
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, url, username, password, pin, securityQuestions, notes, clientId } = body;

    const credential = await prisma.credential.create({
      data: {
        service,
        url,
        username,
        password,
        pin,
        securityQuestions,
        notes,
        clientId
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

    return NextResponse.json(credential, { status: 201 });
  } catch (error) {
    console.error('Error creating credential:', error);
    return NextResponse.json(
      { error: 'Failed to create credential' },
      { status: 500 }
    );
  }
}