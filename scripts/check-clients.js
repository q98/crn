import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClients() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        credentials: true,
        tasks: true,
        healthChecks: {
          orderBy: {
            checkedAt: 'desc'
          },
          take: 5
        }
      }
    });

    console.log(`Found ${clients.length} clients:`);
    
    clients.forEach(client => {
      console.log(`\n${client.domainName}:`);
      console.log(`  - Credentials: ${client.credentials.length}`);
      console.log(`  - Tasks: ${client.tasks.length}`);
      console.log(`  - Recent health checks: ${client.healthChecks.length}`);
    });
  } catch (error) {
    console.error('Error checking clients:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClients();