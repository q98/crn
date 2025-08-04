import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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

  console.log('Admin user created:', admin);

  // Create sample client
  const client = await prisma.client.upsert({
    where: { domainName: 'example.com' },
    update: {},
    create: {
      domainName: 'example.com',
      cPanelUsername: 'example_user',
      diskUsage: '1.2 GB',
      verificationStatus: 'ACTIVE_SHP_REGISTRAR',
      registrar: 'GoDaddy',
      notes: 'Sample client for testing',
      annualHourAllowance: 2.0,
      yearlyHoursUsed: 0.5
    }
  });

  console.log('Sample client created:', client);

  // Create sample task
  const task = await prisma.task.create({
    data: {
      title: 'Sample Task',
      description: 'This is a sample task for testing',
      status: 'OPEN',
      priority: 'MEDIUM',
      estimatedHours: 2.0,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      clientId: client.id,
      assignedToId: admin.id,
      createdById: admin.id
    }
  });

  console.log('Sample task created:', task);

  // Create sample credential
  const credential = await prisma.credential.create({
    data: {
      service: 'cPanel',
      url: 'https://example.com:2083',
      username: 'example_user',
      password: 'encrypted_password_here',
      pin: '1234',
      securityQuestions: {
        question1: 'What is your favorite color?',
        answer1: 'blue'
      },
      notes: 'Sample credential for testing',
      clientId: client.id
    }
  });

  console.log('Sample credential created:', credential);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });