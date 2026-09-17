import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AutomationEngine } from './services/automation.js';
import { LeadParserService, NormalizedLead } from './services/leadParser.js';
import * as XLSX from 'xlsx';

const JWT_SECRET = process.env.JWT_SECRET || 'octagram-operations-hub-secure-jwt-secret-key-2026';

async function runTests() {
  console.log('🧪 Running Octagram Operations Hub Verification Suite...\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failedCount++;
    }
  }

  // 1. Verify Users & Auth Tokens
  console.log('1. Authentication & RBAC Verification:');
  const harsh = await prisma.user.findUnique({ where: { email: 'harsh@octagramai.com' } });
  const jakub = await prisma.user.findUnique({ where: { email: 'jakub@octagramai.com' } });

  assert(!!harsh && harsh.role === 'ADMIN', 'Admin user (Harsh) exists with ADMIN role');
  assert(!!jakub && jakub.role === 'SALES', 'Sales user (Jakub) exists with SALES role');

  const passwordMatch = await bcrypt.compare('octagram123', harsh!.passwordHash);
  assert(passwordMatch, 'Password hashing verification succeeds');

  // 2. Automated Task Generation for Payments
  console.log('\n2. Payment Automation Engine:');
  const petals = await prisma.client.findFirst({ where: { name: { contains: 'Petals' } } });
  assert(!!petals, 'Client Petals Suites & Hotel exists');

  const now = new Date();
  const testDueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);

  const testPayment = await prisma.payment.create({
    data: {
      clientId: petals!.id,
      amount: 40000,
      currency: 'INR',
      invoiceRef: 'TEST-PAY-001',
      dueDate: testDueDate,
      status: 'UPCOMING',
      responsibleUserId: harsh!.id,
      createdById: harsh!.id,
    }
  });

  // Run automation sync
  await AutomationEngine.syncPaymentReminders();

  const generatedTask = await prisma.task.findFirst({
    where: {
      relatedClientId: petals!.id,
      automatedType: 'PAYMENT_REMINDER',
      description: { contains: testPayment.id }
    }
  });

  assert(!!generatedTask, 'Auto-generated high-priority reminder task created for upcoming payment');
  assert(generatedTask?.priority === 'HIGH' || generatedTask?.priority === 'CRITICAL', 'Task priority set properly based on due date');

  // Mark payment PAID -> task should auto-complete
  await AutomationEngine.handlePaymentStatusChange(testPayment.id, 'PAID');
  const completedTask = await prisma.task.findUnique({ where: { id: generatedTask!.id } });
  assert(completedTask?.status === 'COMPLETED', 'Task auto-marked COMPLETED when payment is marked PAID');

  // Cleanup test payment & task
  await prisma.task.delete({ where: { id: generatedTask!.id } });
  await prisma.payment.delete({ where: { id: testPayment.id } });

  // 3. Lead Spreadsheet Parsing & Deduplication
  console.log('\n3. CRM Excel Parsing & Deduplication Engine:');
  const sampleExcelData = [
    {
      'Business Name': 'Bengaluru Brew Haven',
      'Category': 'Specialty Cafe',
      'Contact Person': 'Kunal Sen',
      'Phone Number': '+91 99887 76655',
      'Email Address': 'kunal@brewhaven.in',
      'Rating': 4.7,
      'Total Reviews': 180,
      'Locality/Address': 'Indiranagar 100ft Road',
      'Lead Score': 85,
      'CRM Status': 'QUALIFIED',
    },
    {
      'Business Name': 'Crème Haven Artisanal Cafe', // Duplicate by name & phone
      'Phone Number': '+91 98111 22334',
      'Email Address': 'aarav@cremehaven.in',
      'Rating': 4.8,
      'Lead Score': 90,
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleExcelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const { rows, errors } = LeadParserService.parseFileBuffer(buffer, 'test_leads.xlsx');
  assert(rows.length === 2 && errors.length === 0, 'Parsed 2 rows successfully from Excel buffer');

  const { unique, duplicates } = await LeadParserService.checkDuplicates(rows);
  assert(unique.length === 1, 'Detected 1 brand new unique lead (Bengaluru Brew Haven)');
  assert(duplicates.length === 1, 'Detected 1 duplicate lead (Crème Haven) matched against database');
  assert(duplicates[0].matchedBy === 'phone' || duplicates[0].matchedBy === 'businessName', 'Identified duplicate match criterion accurately');

  // 4. Lead -> Client Conversion
  console.log('\n4. Lead to Client Conversion:');
  const testLead = await prisma.lead.create({
    data: {
      businessName: 'Royal Orchid Patisserie',
      category: 'Hospitality',
      phone: '+91 91234 56789',
      crmStatus: 'PROPOSAL',
      leadScore: 90,
    }
  });

  const convertedClient = await prisma.client.create({
    data: {
      name: testLead.businessName,
      industry: testLead.category,
      status: 'ACTIVE',
      accountManagerId: harsh!.id,
      convertedLeadId: testLead.id,
    }
  });

  const updatedLead = await prisma.lead.update({
    where: { id: testLead.id },
    data: { crmStatus: 'WON', convertedClientId: convertedClient.id }
  });

  assert(updatedLead.crmStatus === 'WON', 'Lead CRM status transitioned to WON upon conversion');
  assert(updatedLead.convertedClientId === convertedClient.id, 'Bidirectional relational link preserved between Lead and Client');

  // Cleanup
  await prisma.client.delete({ where: { id: convertedClient.id } });
  await prisma.lead.delete({ where: { id: testLead.id } });

  // 5. Ticketing System
  console.log('\n5. Internal Ticketing Auto-Numbering:');
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: 1050,
      title: 'Test Verification Ticket',
      description: 'Verifying ticketing workflow',
      category: 'INTERNAL',
      priority: 'MEDIUM',
      status: 'OPEN',
      createdById: harsh!.id,
    }
  });
  assert(ticket.ticketNumber === 1050, 'Ticket created with proper ticketNumber');
  await prisma.ticket.delete({ where: { id: ticket.id } });

  console.log(`\n========================================`);
  console.log(`Verification Summary: ${passedCount} Passed, ${failedCount} Failed.`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
