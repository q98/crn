import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Create a new PrismaClient instance
const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('Creating admin user...');
    
    // Hash the password
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    // Create the admin user
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        password: adminPassword,
        role: 'ADMIN',
      },
    });
    
    console.log('Admin user created successfully:', admin.email);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();