const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcryptjs');

async function updateUserPassword() {
  const prisma = new PrismaClient();
  
  try {
    // Hash the password 'password'
    const hashedPassword = await bcrypt.hash('password', 12);
    
    // Find the user and update their password
    const user = await prisma.user.findFirst();
    
    if (!user) {
      console.log('No user found in database');
      return;
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    
    console.log(`Updated password for user: ${user.email}`);
    console.log('Password is now properly hashed and should work with login');
    
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserPassword();