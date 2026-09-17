import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning all demo data and resetting Octagram Operations Hub database...');

  // 1. Wipe all operational records
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.document.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskCollaborator.deleteMany();
  await prisma.task.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  console.log('✨ All demo records removed.');

  // 2. Password hashes
  const adminPasswordHash = await bcrypt.hash('zidane123', 10);
  const salesPasswordHash = await bcrypt.hash('octagram123', 10);

  // 3. Create requested accounts
  const harsh = await prisma.user.create({
    data: {
      email: 'harsh@octagramai.com',
      passwordHash: adminPasswordHash,
      name: 'Harsh Tripathi',
      role: 'ADMIN',
      department: 'Leadership & Operations',
      isActive: true,
    }
  });

  const vishnu = await prisma.user.create({
    data: {
      email: 'vishnu@octagramai.com',
      passwordHash: adminPasswordHash,
      name: 'Vishnu',
      role: 'ADMIN',
      department: 'Leadership & Operations',
      isActive: true,
    }
  });

  const sanjana = await prisma.user.create({
    data: {
      email: 'sanjana@octagramai.com',
      passwordHash: adminPasswordHash,
      name: 'Sanjana',
      role: 'ADMIN',
      department: 'Leadership & Operations',
      isActive: true,
    }
  });

  const sumaiya = await prisma.user.create({
    data: {
      email: 'sumaiya@octagramai.com',
      passwordHash: salesPasswordHash,
      name: 'Sumaiya',
      role: 'SALES',
      department: 'Sales & Outreach',
      isActive: true,
    }
  });

  console.log('✅ Created authorized accounts:');
  console.log('   - Admin: harsh@octagramai.com (Password: zidane123)');
  console.log('   - Admin: vishnu@octagramai.com (Password: zidane123)');
  console.log('   - Admin: sanjana@octagramai.com (Password: zidane123)');
  console.log('   - Sales: sumaiya@octagramai.com (Password: octagram123)');
  console.log('🚀 Database is now clean with 0 dummy records and ready for live operational use.');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
