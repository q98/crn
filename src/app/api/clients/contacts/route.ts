import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Type guard functions
function isContact(obj: unknown): obj is Contact {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'clientId' in obj &&
    'name' in obj &&
    'email' in obj &&
    'role' in obj &&
    'isPrimary' in obj &&
    'isActive' in obj &&
    'preferredContactMethod' in obj
  );
}

function isCommunicationLog(obj: unknown): obj is CommunicationLog {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'contactId' in obj &&
    'clientId' in obj &&
    'type' in obj &&
    'direction' in obj &&
    'summary' in obj &&
    'followUpRequired' in obj &&
    'performedBy' in obj &&
    'performedAt' in obj
  );
}

interface Contact {
  id?: string;
  clientId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
  lastContactDate?: Date;
  preferredContactMethod: 'EMAIL' | 'PHONE' | 'SLACK' | 'TEAMS' | 'OTHER';
  timezone?: string;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

interface CommunicationLog {
  id?: string;
  contactId: string;
  clientId: string;
  type: 'EMAIL' | 'PHONE' | 'MEETING' | 'SLACK' | 'TEAMS' | 'OTHER';
  direction: 'INBOUND' | 'OUTBOUND';
  subject?: string;
  summary: string;
  duration?: number; // in minutes
  outcome?: string;
  followUpRequired: boolean;
  followUpDate?: Date;
  attachments?: string[];
  tags?: string[];
  performedBy: string;
  performedAt: Date;
  metadata?: Record<string, unknown>;
}

interface ContactSummary {
  contact: Contact;
  communicationStats: {
    totalCommunications: number;
    lastCommunication?: Date;
    communicationBreakdown: Record<string, number>;
    averageResponseTime?: number; // in hours
    followUpsPending: number;
  };
  relationshipScore: number; // 0-100 based on communication frequency and recency
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// GET /api/clients/contacts - Get contacts and communication data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'contacts'; // 'contacts', 'communications', 'summary'
    const clientId = searchParams.get('clientId');
    const contactId = searchParams.get('contactId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');

    if (type === 'contacts') {
      // Get contacts for client(s)
      const whereClause: Record<string, unknown> = {};
      
      if (clientId) {
        whereClause.clientId = clientId;
      }
      
      if (!includeInactive) {
        whereClause.isActive = true;
      }
      
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { role: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } }
        ];
      }

      const skip = (page - 1) * limit;
      
      // Since we don't have a Contact model, we'll store contacts in the Report model
      const contactWhereClause: Record<string, unknown> = {
        title: { startsWith: 'Contact -' },
        ...(clientId && { clientId })
      };
      
      if (search) {
        contactWhereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { reportData: { path: '$.email', string_contains: search } },
          { reportData: { path: '$.role', string_contains: search } }
        ];
      }
      
      const contacts = await prisma.report.findMany({
        where: contactWhereClause,
        orderBy: {
          generatedAt: 'desc'
        },
        skip,
        take: limit
      });

      const totalCount = await prisma.report.count({
        where: {
          title: { startsWith: 'Contact -' },
          ...(clientId && { clientId })
        }
      });

      const contactData = contacts.map(c => {
        if (!isContact(c.reportData)) {
          throw new Error('Invalid contact data structure');
        }
        return {
          id: c.id,
          ...(c.reportData as Contact),
          createdAt: c.generatedAt
        };
      }).filter(c => includeInactive || c.isActive);

      return NextResponse.json({
        contacts: contactData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'communications') {
      // Get communication logs
      const whereClause: Record<string, unknown> = {
        title: { startsWith: 'Communication -' }
      };
      
      if (clientId) {
        whereClause.clientId = clientId;
      }
      
      if (contactId) {
        whereClause.reportData = {
          path: '$.contactId',
          equals: contactId
        };
      }

      const skip = (page - 1) * limit;
      
      const communications = await prisma.report.findMany({
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

      const communicationData = communications.map(c => {
        if (!isCommunicationLog(c.reportData)) {
          throw new Error('Invalid communication data structure');
        }
        return {
          id: c.id,
          ...(c.reportData as CommunicationLog),
          performedAt: c.generatedAt
        };
      });

      return NextResponse.json({
        communications: communicationData,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      });
    }

    if (type === 'summary') {
      // Get contact summaries with communication stats
      const contacts = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Contact -' },
          ...(clientId && { clientId })
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const summaries: ContactSummary[] = [];
      
      for (const contactRecord of contacts) {
        if (!isContact(contactRecord.reportData)) {
          continue; // Skip invalid contact data
        }
        const contact = {
          id: contactRecord.id,
          ...(contactRecord.reportData as Contact),
          createdAt: contactRecord.generatedAt
        };

        // Get communication logs for this contact
        const communications = await prisma.report.findMany({
          where: {
            title: { startsWith: 'Communication -' },
            reportData: {
              path: '$.contactId',
              equals: contact.id
            }
          },
          orderBy: {
            generatedAt: 'desc'
          }
        });

        const communicationData = communications.map(c => {
          if (!isCommunicationLog(c.reportData)) {
            return null; // Skip invalid communication data
          }
          return {
            ...(c.reportData as CommunicationLog),
            performedAt: c.generatedAt
          };
        }).filter(Boolean) as CommunicationLog[];

        const summary = generateContactSummary(contact, communicationData);
        summaries.push(summary);
      }

      // Sort by relationship score
      summaries.sort((a, b) => b.relationshipScore - a.relationshipScore);

      return NextResponse.json({
        summaries: summaries.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total: summaries.length,
          pages: Math.ceil(summaries.length / limit)
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/clients/contacts - Create contacts and log communications
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create_contact') {
      const {
        clientId,
        name,
        email,
        phone,
        role,
        department,
        isPrimary = false,
        isActive = true,
        notes,
        preferredContactMethod = 'EMAIL',
        timezone,
        socialProfiles
      }: Partial<Contact> = data;

      if (!clientId || !name || !email || !role) {
        return NextResponse.json(
          { error: 'clientId, name, email, and role are required' },
          { status: 400 }
        );
      }

      // Verify client exists
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, domainName: true }
      });

      if (!client) {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        );
      }

      // Check if email already exists for this client
      const existingContact = await prisma.report.findFirst({
        where: {
          title: { startsWith: 'Contact -' },
          clientId,
          reportData: {
            path: '$.email',
            equals: email
          }
        }
      });

      if (existingContact) {
        return NextResponse.json(
          { error: 'Contact with this email already exists for this client' },
          { status: 409 }
        );
      }

      // If this is set as primary, unset other primary contacts
      if (isPrimary) {
        const primaryContacts = await prisma.report.findMany({
          where: {
            title: { startsWith: 'Contact -' },
            clientId,
            reportData: {
              path: '$.isPrimary',
              equals: true
            }
          }
        });

        // Update existing primary contacts
        for (const contact of primaryContacts) {
          if (!isContact(contact.reportData)) {
            continue; // Skip invalid contact data
          }
          const contactData = contact.reportData;
          await prisma.report.update({
            where: { id: contact.id },
            data: {
              reportData: JSON.parse(JSON.stringify({
                ...(contactData as Contact),
                isPrimary: false
              }))
            }
          });
        }
      }

      // Create the contact
      const contactRecord = await prisma.report.create({
        data: {
          title: `Contact - ${name}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: 0,
          totalAmount: 0,
          clientId,
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify({
            type: 'CONTACT',
            clientId,
            name,
            email,
            phone,
            role,
            department,
            isPrimary,
            isActive,
            notes,
            preferredContactMethod,
            timezone,
            socialProfiles,
            createdBy: session.user.id
          }))
        }
      });

      return NextResponse.json({
        message: 'Contact created successfully',
        contactId: contactRecord.id,
        contact: {
          id: contactRecord.id,
          ...(contactRecord.reportData as unknown as Contact)
        }
      });
    }

    if (action === 'log_communication') {
      const {
        contactId,
        clientId,
        type,
        direction,
        subject,
        summary,
        duration,
        outcome,
        followUpRequired = false,
        followUpDate,
        attachments = [],
        tags = [],
        metadata = {}
      }: Partial<CommunicationLog> = data;

      if (!contactId || !clientId || !type || !direction || !summary) {
        return NextResponse.json(
          { error: 'contactId, clientId, type, direction, and summary are required' },
          { status: 400 }
        );
      }

      // Verify contact exists
      const contact = await prisma.report.findUnique({
        where: { id: contactId }
      });

      if (!contact || !contact.title.startsWith('Contact -')) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        );
      }

      // Log the communication
      const communicationRecord = await prisma.report.create({
        data: {
          title: `Communication - ${type}`,
          dateRange: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString()
          },
          totalHours: duration ? duration / 60 : 0,
          totalAmount: 0,
          clientId,
          generatedAt: new Date(),
          reportData: JSON.parse(JSON.stringify({
            type: 'COMMUNICATION',
            contactId,
            clientId,
            communicationType: type,
            direction,
            subject,
            summary,
            duration,
            outcome,
            followUpRequired,
            followUpDate: followUpDate ? new Date(followUpDate) : undefined,
            attachments,
            tags,
            metadata,
            performedBy: session.user.id,
            performedAt: new Date()
          }))
        }
      });

      // Update contact's last contact date
      if (!isContact(contact.reportData)) {
        return NextResponse.json(
          { error: 'Invalid contact data structure' },
          { status: 400 }
        );
      }
      const contactData = contact.reportData;
      await prisma.report.update({
        where: { id: contactId },
        data: {
          reportData: JSON.parse(JSON.stringify({
            ...(contactData as Contact),
            lastContactDate: new Date()
          }))
        }
      });

      return NextResponse.json({
        message: 'Communication logged successfully',
        communicationId: communicationRecord.id
      });
    }

    if (action === 'bulk_import_contacts') {
      const { contacts }: { contacts: Partial<Contact>[] } = data;

      if (!contacts || contacts.length === 0) {
        return NextResponse.json(
          { error: 'Contacts array is required' },
          { status: 400 }
        );
      }

      const results = [];
      const errors = [];

      for (const contactData of contacts) {
        try {
          const {
            clientId,
            name,
            email,
            phone,
            role,
            department,
            isPrimary = false,
            isActive = true,
            notes,
            preferredContactMethod = 'EMAIL',
            timezone,
            socialProfiles
          } = contactData;

          if (!clientId || !name || !email || !role) {
            errors.push({
              contact: contactData,
              error: 'Missing required fields'
            });
            continue;
          }

          // Verify client exists
          const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { id: true, domainName: true }
          });

          if (!client) {
            errors.push({
              contact: contactData,
              error: 'Client not found'
            });
            continue;
          }

          // Check for duplicate email
          const existingContact = await prisma.report.findFirst({
            where: {
              title: { startsWith: 'Contact -' },
              clientId,
              reportData: {
                path: '$.email',
                equals: email
              }
            }
          });

          if (existingContact) {
            errors.push({
              contact: contactData,
              error: 'Contact with this email already exists'
            });
            continue;
          }

          // Create the contact
          const contactRecord = await prisma.report.create({
            data: {
              title: `Contact - ${name}`,
              dateRange: {
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString()
              },
              totalHours: 0,
              totalAmount: 0,
              clientId,
              generatedAt: new Date(),
              reportData: {
                type: 'CONTACT',
                clientId,
                name,
                email,
                phone,
                role,
                department,
                isPrimary,
                isActive,
                notes,
                preferredContactMethod,
                timezone,
                socialProfiles,
                createdBy: session.user.id
              }
            }
          });

          results.push({
            contactId: contactRecord.id,
            name,
            email
          });

        } catch (error) {
          errors.push({
            contact: contactData,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        message: 'Bulk contact import completed',
        summary: {
          total: contacts.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors
      });
    }

    if (action === 'sync_communications') {
      // Sync communications from external sources (placeholder for future integrations)
      const { source, clientId: _clientId }: { source: string; clientId?: string } = data;

      if (!source) {
        return NextResponse.json(
          { error: 'Source is required' },
          { status: 400 }
        );
      }

      // This would integrate with email providers, CRM systems, etc.
      // For now, return a placeholder response
      return NextResponse.json({
        message: `Communication sync from ${source} initiated`,
        status: 'pending',
        note: 'This feature requires integration with external communication platforms'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing contacts request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/clients/contacts - Update contact information
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contactId, ...updateData } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    // Get existing contact
    const existingContact = await prisma.report.findUnique({
      where: { id: contactId }
    });

    if (!existingContact || !existingContact.title.startsWith('Contact -')) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    if (!isContact(existingContact.reportData)) {
      return NextResponse.json(
        { error: 'Invalid contact data structure' },
        { status: 400 }
      );
    }
    const currentData = existingContact.reportData;

    // If email is being updated, check for duplicates
    if (updateData.email && updateData.email !== currentData.email) {
      const duplicateContact = await prisma.report.findFirst({
        where: {
          title: { startsWith: 'Contact -' },
          clientId: currentData.clientId,
          reportData: {
            path: '$.email',
            equals: updateData.email
          },
          id: { not: contactId }
        }
      });

      if (duplicateContact) {
        return NextResponse.json(
          { error: 'Contact with this email already exists for this client' },
          { status: 409 }
        );
      }
    }

    // If setting as primary, unset other primary contacts
    if (updateData.isPrimary && !currentData.isPrimary) {
      const primaryContacts = await prisma.report.findMany({
        where: {
          title: { startsWith: 'Contact -' },
          clientId: currentData.clientId,
          reportData: {
            path: '$.isPrimary',
            equals: true
          },
          id: { not: contactId }
        }
      });

      for (const contact of primaryContacts) {
        if (!isContact(contact.reportData)) {
          continue; // Skip invalid contact data
        }
        const contactData = contact.reportData;
        await prisma.report.update({
          where: { id: contact.id },
          data: {
            reportData: JSON.parse(JSON.stringify({
              ...(contactData as Contact),
              isPrimary: false
            }))
          }
        });
      }
    }

    // Update the contact
    const updatedContact = await prisma.report.update({
      where: { id: contactId },
      data: {
        title: updateData.name ? `Contact - ${updateData.name}` : existingContact.title,
        reportData: JSON.parse(JSON.stringify({
          ...(currentData as Contact),
          ...updateData,
          updatedAt: new Date(),
          updatedBy: session.user.id
        }))
      }
    });

    return NextResponse.json({
      message: 'Contact updated successfully',
      contact: {
        id: updatedContact.id,
        ...(updatedContact.reportData as unknown as Contact)
      }
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/contacts - Delete contact
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    // Verify contact exists
    const contact = await prisma.report.findUnique({
      where: { id: contactId }
    });

    if (!contact || !contact.title.startsWith('Contact -')) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Delete associated communications
    await prisma.report.deleteMany({
      where: {
        title: { startsWith: 'Communication -' },
        reportData: {
          path: '$.contactId',
          equals: contactId
        }
      }
    });

    // Delete the contact
    await prisma.report.delete({
      where: { id: contactId }
    });

    return NextResponse.json({
      message: 'Contact and associated communications deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate contact summary with communication stats
function generateContactSummary(contact: Contact, communications: CommunicationLog[]): ContactSummary {
  const now = new Date();
  const _thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Communication breakdown
  const communicationBreakdown: Record<string, number> = {};
  for (const comm of communications) {
    communicationBreakdown[comm.type] = (communicationBreakdown[comm.type] || 0) + 1;
  }
  
  // Last communication date
  const lastCommunication = communications.length > 0 ? communications[0].performedAt : undefined;
  
  // Calculate average response time (simplified)
  let averageResponseTime: number | undefined;
  const responseTimes = [];
  
  for (let i = 0; i < communications.length - 1; i++) {
    const current = communications[i];
    const next = communications[i + 1];
    
    if (current.direction === 'OUTBOUND' && next.direction === 'INBOUND') {
      const responseTime = (current.performedAt.getTime() - next.performedAt.getTime()) / (1000 * 60 * 60); // hours
      if (responseTime > 0 && responseTime < 168) { // Within a week
        responseTimes.push(responseTime);
      }
    }
  }
  
  if (responseTimes.length > 0) {
    averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }
  
  // Count pending follow-ups
  const followUpsPending = communications.filter(c => 
    c.followUpRequired && 
    (!c.followUpDate || c.followUpDate > now)
  ).length;
  
  // Calculate relationship score (0-100)
  let relationshipScore = 0;
  
  // Base score from total communications (max 30 points)
  relationshipScore += Math.min(communications.length * 3, 30);
  
  // Recency bonus (max 40 points)
  if (lastCommunication) {
    const daysSinceLastComm = Math.floor((now.getTime() - lastCommunication.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastComm <= 7) {
      relationshipScore += 40;
    } else if (daysSinceLastComm <= 30) {
      relationshipScore += 25;
    } else if (daysSinceLastComm <= 60) {
      relationshipScore += 10;
    }
  }
  
  // Communication diversity bonus (max 15 points)
  const uniqueCommTypes = Object.keys(communicationBreakdown).length;
  relationshipScore += Math.min(uniqueCommTypes * 3, 15);
  
  // Response time bonus (max 10 points)
  if (averageResponseTime && averageResponseTime <= 24) {
    relationshipScore += 10;
  } else if (averageResponseTime && averageResponseTime <= 48) {
    relationshipScore += 5;
  }
  
  // Primary contact bonus (max 5 points)
  if (contact.isPrimary) {
    relationshipScore += 5;
  }
  
  relationshipScore = Math.min(relationshipScore, 100);
  
  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (!lastCommunication || (now.getTime() - lastCommunication.getTime()) > 60 * 24 * 60 * 60 * 1000) {
    riskLevel = 'HIGH';
  } else if ((now.getTime() - lastCommunication.getTime()) > 30 * 24 * 60 * 60 * 1000) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }
  
  return {
    contact,
    communicationStats: {
      totalCommunications: communications.length,
      lastCommunication,
      communicationBreakdown,
      averageResponseTime,
      followUpsPending
    },
    relationshipScore,
    riskLevel
  };
}