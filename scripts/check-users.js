import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      include: {
        tasks: true,
        timeEntries: true
      }
    });

    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log(`\n${user.name} (${user.email}):`);
      console.log(`  - Role: ${user.role}`);
      console.log(`  - Tasks: ${user.tasks.length}`);
      console.log(`  - Time entries: ${user.timeEntries.length}`);
    });
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();