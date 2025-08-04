import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAllData() {
  try {
    console.log('Starting comprehensive data seed...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });

    console.log('Admin user created:', admin.email);

    // Create sample clients
    const clients = [];
    
    const client1 = await prisma.client.upsert({
      where: { domainName: 'example.com' },
      update: {},
      create: {
        domainName: 'example.com',
        cPanelUsername: 'exampleuser',
        diskUsage: '2.5GB',
        verificationStatus: 'ACTIVE_SHP_REGISTRAR',
        registrar: 'GoDaddy',
        notes: 'Main client website',
        annualHourAllowance: 2.0,
        yearlyHoursUsed: 0.5
      }
    });
    clients.push(client1);
    
    const client2 = await prisma.client.upsert({
      where: { domainName: 'clientbusiness.com' },
      update: {},
      create: {
        domainName: 'clientbusiness.com',
        cPanelUsername: 'clientuser',
        diskUsage: '1.8GB',
        verificationStatus: 'ACTIVE_NEEDS_LOGIN',
        registrar: 'Namecheap',
        notes: 'E-commerce site',
        annualHourAllowance: 5.0,
        yearlyHoursUsed: 1.2
      }
    });
    clients.push(client2);

    console.log(`Created ${clients.length} sample clients`);

    // Create sample credentials
    await prisma.credential.upsert({
      where: { id: 'credential-1' },
      update: {},
      create: {
        id: 'credential-1',
        service: 'cPanel',
        url: 'https://cpanel.example.com',
        username: 'exampleuser',
        password: 'securepass1',
        notes: 'Main hosting account',
        clientId: client1.id
      }
    });
    
    await prisma.credential.upsert({
      where: { id: 'credential-2' },
      update: {},
      create: {
        id: 'credential-2',
        service: 'WordPress Admin',
        url: 'https://clientbusiness.com/wp-admin',
        username: 'admin',
        password: 'wppassword',
        notes: 'WordPress admin access',
        clientId: client2.id
      }
    });

    console.log('Created sample credentials');

    // Create sample tasks
    await prisma.task.upsert({
      where: { id: 'task-1' },
      update: {},
      create: {
        id: 'task-1',
        title: 'Update WordPress plugins',
        description: 'Update all plugins to the latest version',
        status: 'OPEN',
        priority: 'HIGH',
        estimatedHours: 1.5,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        clientId: client2.id,
        assignedToId: admin.id,
        createdById: admin.id
      }
    });
    
    await prisma.task.upsert({
      where: { id: 'task-2' },
      update: {},
      create: {
        id: 'task-2',
        title: 'Backup database',
        description: 'Perform monthly database backup',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        estimatedHours: 0.5,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        clientId: client1.id,
        assignedToId: admin.id,
        createdById: admin.id
      }
    });

    console.log('Created sample tasks');

    // Create sample health checks
    await prisma.healthCheck.create({
      data: {
        checkType: 'HTTP_STATUS',
        status: 'SUCCESS',
        details: 'HTTP 200 OK',
        clientId: client1.id
      }
    });
    
    await prisma.healthCheck.create({
      data: {
        checkType: 'SSL_CERTIFICATE',
        status: 'WARNING',
        details: 'SSL certificate expires in 15 days',
        clientId: client2.id
      }
    });

    console.log('Created sample health checks');
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAllData();