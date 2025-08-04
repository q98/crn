import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Create a new PrismaClient instance for seeding
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting database seed...');

    // Create admin user
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    console.log('Admin user created:', admin.email);

    // Create sample clients
    console.log('Creating sample clients...');
    const clients = [];
    
    const client1 = await prisma.client.create({
      data: {
        domainName: 'example.com',
        cPanelUsername: 'exampleuser',
        diskUsage: '2.5GB',
        verificationStatus: 'ACTIVE_SHP_REGISTRAR',
        registrar: 'GoDaddy',
        notes: 'Main client website',
      },
    });
    clients.push(client1);
    
    const client2 = await prisma.client.create({
      data: {
        domainName: 'clientbusiness.com',
        cPanelUsername: 'clientuser',
        diskUsage: '1.8GB',
        verificationStatus: 'ACTIVE_NEEDS_LOGIN',
        registrar: 'Namecheap',
        notes: 'E-commerce site',
      },
    });
    clients.push(client2);
    
    const client3 = await prisma.client.create({
      data: {
        domainName: 'testsite.org',
        cPanelUsername: 'testadmin',
        diskUsage: '0.9GB',
        verificationStatus: 'AT_RISK',
        registrar: 'Bluehost',
        notes: 'Non-profit organization site',
      },
    });
    clients.push(client3);

    console.log(`Created ${clients.length} sample clients`);

    // Create sample credentials
    console.log('Creating sample credentials...');
    await prisma.credential.create({
      data: {
        service: 'cPanel',
        url: 'https://cpanel.example.com',
        username: 'exampleuser',
        password: 'securepass1', // Not hashing for demo purposes
        notes: 'Main hosting account',
        clientId: client1.id,
      },
    });
    
    await prisma.credential.create({
      data: {
        service: 'WordPress Admin',
        url: 'https://clientbusiness.com/wp-admin',
        username: 'admin',
        password: 'wppassword', // Not hashing for demo purposes
        notes: 'WordPress admin access',
        clientId: client2.id,
      },
    });

    console.log('Created sample credentials');

    // Create sample tasks
    console.log('Creating sample tasks...');
    await prisma.task.create({
      data: {
        title: 'Update WordPress plugins',
        description: 'Update all plugins to the latest version',
        status: 'OPEN',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        clientId: client2.id,
        assignedToId: admin.id,
        createdById: admin.id,
      },
    });
    
    await prisma.task.create({
      data: {
        title: 'Backup database',
        description: 'Perform monthly database backup',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        clientId: client1.id,
        assignedToId: admin.id,
        createdById: admin.id,
      },
    });

    console.log('Created sample tasks');

    // Create sample health checks
    console.log('Creating sample health checks...');
    await prisma.healthCheck.create({
      data: {
        checkType: 'UPTIME',
        status: 'HEALTHY',
        details: 'HTTP 200 OK',
        clientId: client1.id,
      },
    });
    
    await prisma.healthCheck.create({
      data: {
        checkType: 'SSL_CERTIFICATE',
        status: 'WARNING',
        details: 'SSL certificate expires in 15 days',
        clientId: client2.id,
      },
    });
    
    await prisma.healthCheck.create({
      data: {
        checkType: 'UPTIME',
        status: 'CRITICAL',
        details: 'HTTP 500 Internal Server Error',
        clientId: client3.id,
      },
    });

    console.log('Created sample health checks');
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });