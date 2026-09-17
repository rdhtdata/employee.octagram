"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding Octagram Operations Hub database...');
    // 1. Clean existing records in relational order
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
    // 2. Create Users
    const passwordHash = await bcryptjs_1.default.hash('octagram123', 10);
    const harsh = await prisma.user.create({
        data: {
            email: 'harsh@octagramai.com',
            passwordHash,
            name: 'Harsh Tripathi',
            role: 'ADMIN',
            department: 'Leadership & Product',
            phone: '+91 98765 43210',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isActive: true,
        }
    });
    const jakub = await prisma.user.create({
        data: {
            email: 'jakub@octagramai.com',
            passwordHash,
            name: 'Jakub Miller',
            role: 'SALES',
            department: 'Design & Sales',
            phone: '+91 98765 43211',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
            isActive: true,
        }
    });
    const nikita = await prisma.user.create({
        data: {
            email: 'nikita@octagramai.com',
            passwordHash,
            name: 'Nikita Sharma',
            role: 'SALES',
            department: 'Outreach & Research',
            phone: '+91 98765 43212',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
            isActive: true,
        }
    });
    console.log('✅ Users created: Harsh (Admin), Jakub (Sales), Nikita (Sales)');
    // 3. Create Clients
    const petals = await prisma.client.create({
        data: {
            name: 'Petals Suites & Hotel',
            industry: 'Hospitality',
            website: 'https://petalshotels.com',
            phone: '+91 80 4123 5678',
            email: 'info@petalshotels.com',
            address: '14/2 MG Road, Bengaluru, Karnataka 560001',
            status: 'ACTIVE',
            accountManagerId: harsh.id,
            contacts: {
                create: [
                    { name: 'Rohan Deshmukh', title: 'Managing Director', email: 'rohan@petalshotels.com', phone: '+91 99000 11223', isPrimary: true },
                    { name: 'Priya Nair', title: 'Operations Manager', email: 'priya@petalshotels.com', phone: '+91 99000 11224', isPrimary: false },
                ]
            },
            notes: {
                create: [
                    { authorId: harsh.id, content: 'Client prefers minimal, luxury aesthetic and wants mobile check-in feature prioritized.', isPinned: true },
                    { authorId: jakub.id, content: 'Annual maintenance contract renewal discussion scheduled for Q4.', isPinned: false },
                ]
            }
        }
    });
    const ranka = await prisma.client.create({
        data: {
            name: 'Ranka Chemical Industries',
            industry: 'Chemical Manufacturing',
            website: 'https://rankachemical.com',
            phone: '+91 80 2345 6789',
            email: 'contact@rankachemical.com',
            address: 'Industrial Suburb, Peenya 2nd Stage, Bengaluru, Karnataka 560058',
            status: 'ACTIVE',
            accountManagerId: harsh.id,
            contacts: {
                create: [
                    { name: 'Suresh Ranka', title: 'Chief Technology Officer', email: 'suresh@rankachemical.com', phone: '+91 98450 33445', isPrimary: true },
                ]
            }
        }
    });
    const bela = await prisma.client.create({
        data: {
            name: 'Bela Ku Bakes',
            industry: 'Food & Beverage',
            website: 'https://belakubakes.in',
            phone: '+91 80 3456 7890',
            email: 'orders@belakubakes.in',
            address: '12th Main, Indiranagar, Bengaluru, Karnataka 560038',
            status: 'ACTIVE',
            accountManagerId: jakub.id,
            contacts: {
                create: [
                    { name: 'Ananya Roy', title: 'Founder & Head Chef', email: 'ananya@belakubakes.in', phone: '+91 97400 55667', isPrimary: true }
                ]
            }
        }
    });
    const kalnad = await prisma.client.create({
        data: {
            name: 'Kalnad Jewels',
            industry: 'Luxury Retail',
            website: 'https://kalnadjewels.com',
            phone: '+91 80 4567 8901',
            email: 'care@kalnadjewels.com',
            address: 'Commercial Street, Tasker Town, Bengaluru, Karnataka 560001',
            status: 'ACTIVE',
            accountManagerId: nikita.id,
            contacts: {
                create: [
                    { name: 'Vikram Kalnad', title: 'Partner', email: 'vikram@kalnadjewels.com', phone: '+91 98800 77889', isPrimary: true }
                ]
            }
        }
    });
    console.log('✅ Clients created');
    // 4. Create Leads (Representative Octagram Excel Leads)
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0);
    const twoDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0);
    const fiveDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 16, 0);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 10, 0);
    const cremeHaven = await prisma.lead.create({
        data: {
            businessName: 'Crème Haven Artisanal Cafe',
            category: 'Cafe & Patisserie',
            contactName: 'Aarav Mehta',
            phone: '+91 98111 22334',
            email: 'aarav@cremehaven.in',
            websiteStatus: 'Needs Revision',
            websiteUrl: 'https://cremehaven.in',
            rating: 4.8,
            totalReviews: 320,
            address: 'Koramangala 4th Block, Bengaluru',
            googleMapsUrl: 'https://maps.google.com/?cid=1234567890123456789',
            leadScore: 88,
            crmStatus: 'QUALIFIED',
            assignedUserId: harsh.id,
            nextFollowUpDate: tomorrow,
            followUpType: 'Call',
            notes: 'High intent. Looking for new custom digital menu system and website revamp.',
        }
    });
    const saffron = await prisma.lead.create({
        data: {
            businessName: 'Saffron Gourmet Kitchen',
            category: 'Fine Dining Restaurant',
            contactName: 'Chef Sanjeev Kapur',
            phone: '+91 98222 33445',
            email: 'sanjeev@saffrongourmet.com',
            websiteStatus: 'No Website',
            websiteUrl: null,
            rating: 4.6,
            totalReviews: 540,
            address: 'Lavelle Road, Bengaluru',
            googleMapsUrl: 'https://maps.google.com/?cid=2345678901234567890',
            leadScore: 82,
            crmStatus: 'PROPOSAL',
            assignedUserId: jakub.id,
            nextFollowUpDate: twoDaysLater,
            followUpType: 'Meeting',
            notes: 'Proposal for bespoke brand website and online booking system submitted.',
        }
    });
    const urbanRoasters = await prisma.lead.create({
        data: {
            businessName: 'Urban Artisan Roasters',
            category: 'Specialty Coffee',
            contactName: 'Tanvi Rao',
            phone: '+91 98333 44556',
            email: 'hello@urbanroasters.coffee',
            websiteStatus: 'Has Website',
            websiteUrl: 'https://urbanroasters.coffee',
            rating: 4.9,
            totalReviews: 780,
            address: 'HSR Layout Sector 3, Bengaluru',
            googleMapsUrl: 'https://maps.google.com/?cid=3456789012345678901',
            leadScore: 94,
            crmStatus: 'NEGOTIATION',
            assignedUserId: nikita.id,
            nextFollowUpDate: fiveDaysLater,
            followUpType: 'Call',
            notes: 'Contract draft sent. Reviewing payment terms and delivery timeline.',
        }
    });
    const apexDental = await prisma.lead.create({
        data: {
            businessName: 'Apex Dental & Orthodontics',
            category: 'Healthcare & Clinic',
            contactName: 'Dr. Ramesh Bhat',
            phone: '+91 98444 55667',
            email: 'contact@apexdental.co.in',
            websiteStatus: 'No Website',
            websiteUrl: null,
            rating: 4.7,
            totalReviews: 190,
            address: 'Jayanagar 4th Block, Bengaluru',
            googleMapsUrl: 'https://maps.google.com/?cid=4567890123456789012',
            leadScore: 68,
            crmStatus: 'CONTACTED',
            assignedUserId: nikita.id,
            nextFollowUpDate: yesterday,
            followUpType: 'Call',
            notes: 'Introductory email sent. Follow-up phone call due.',
        }
    });
    const zenSpa = await prisma.lead.create({
        data: {
            businessName: 'Zenith Spa & Wellness Retreat',
            category: 'Wellness & Spa',
            contactName: 'Meera Sen',
            phone: '+91 98555 66778',
            email: 'relax@zenithspa.in',
            websiteStatus: 'Needs Revision',
            websiteUrl: 'https://zenithspa.in',
            rating: 4.5,
            totalReviews: 120,
            address: 'Whitefield, Bengaluru',
            googleMapsUrl: 'https://maps.google.com/?cid=5678901234567890123',
            leadScore: 72,
            crmStatus: 'NEW',
            assignedUserId: jakub.id,
            notes: 'Recently extracted lead from Bangalore hospitality directory.',
        }
    });
    console.log('✅ Leads created');
    // 5. Create Financial Records (Incoming Payments & Expenses)
    const paymentDueIn2Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const paymentPaid2WeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
    const paymentOverdue5Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5);
    const paymentNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const petalsPayment = await prisma.payment.create({
        data: {
            clientId: petals.id,
            amount: 30000,
            currency: 'INR',
            invoiceRef: 'OCT-2026-089',
            dueDate: paymentDueIn2Days,
            status: 'DUE',
            recurrence: 'MONTHLY',
            responsibleUserId: harsh.id,
            notes: 'Q3 Retainer milestone for Petals Suites web platform & digital concierge.',
            paymentMethod: 'Bank Transfer (NEFT)',
            createdById: harsh.id,
        }
    });
    const rankaPayment = await prisma.payment.create({
        data: {
            clientId: ranka.id,
            amount: 65000,
            currency: 'INR',
            invoiceRef: 'OCT-2026-082',
            dueDate: paymentPaid2WeeksAgo,
            paymentDate: paymentPaid2WeeksAgo,
            status: 'PAID',
            recurrence: 'NONE',
            responsibleUserId: harsh.id,
            notes: 'Full payment for enterprise portal launch milestone.',
            paymentMethod: 'RTGS',
            createdById: harsh.id,
        }
    });
    const kalnadPayment = await prisma.payment.create({
        data: {
            clientId: kalnad.id,
            amount: 45000,
            currency: 'INR',
            invoiceRef: 'OCT-2026-077',
            dueDate: paymentOverdue5Days,
            status: 'OVERDUE',
            recurrence: 'QUARTERLY',
            responsibleUserId: nikita.id,
            notes: 'Catalog maintenance and cloud optimization service fee.',
            paymentMethod: 'Bank Transfer',
            createdById: harsh.id,
        }
    });
    const belaPayment = await prisma.payment.create({
        data: {
            clientId: bela.id,
            amount: 25000,
            currency: 'INR',
            invoiceRef: 'OCT-2026-095',
            dueDate: paymentNextMonth,
            status: 'UPCOMING',
            recurrence: 'MONTHLY',
            responsibleUserId: jakub.id,
            notes: 'Monthly eCommerce maintenance and SEO management.',
            paymentMethod: 'UPI / Direct Debit',
            createdById: harsh.id,
        }
    });
    // Outgoing Expenses
    await prisma.expense.createMany({
        data: [
            {
                vendor: 'Amazon Web Services (AWS)',
                category: 'HOSTING',
                amount: 14200,
                currency: 'INR',
                dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
                status: 'UPCOMING',
                notes: 'Monthly infrastructure servers, S3, and RDS databases.',
                responsibleUserId: harsh.id,
                createdById: harsh.id,
            },
            {
                vendor: 'Figma & Adobe Creative Cloud',
                category: 'SOFTWARE',
                amount: 8500,
                currency: 'INR',
                dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
                paidDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
                status: 'PAID',
                notes: 'Design team seats for 4 designers.',
                responsibleUserId: jakub.id,
                createdById: harsh.id,
            },
            {
                vendor: 'Google Workspace & Domains',
                category: 'DOMAINS',
                amount: 4800,
                currency: 'INR',
                dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 12),
                status: 'UPCOMING',
                notes: 'Octagram organization emails and internal hub domain renewals.',
                responsibleUserId: harsh.id,
                createdById: harsh.id,
            },
            {
                vendor: 'Contract Mobile Engineer',
                category: 'CONTRACTORS',
                amount: 35000,
                currency: 'INR',
                dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8),
                status: 'UPCOMING',
                notes: 'Specialist Flutter module integration contractor payout.',
                responsibleUserId: harsh.id,
                createdById: harsh.id,
            }
        ]
    });
    console.log('✅ Payments and Expenses created');
    // 6. Create Meetings
    const meetingPetals = await prisma.meeting.create({
        data: {
            title: 'Petals Website Redesign & Mobile Experience',
            date: tomorrow,
            startTime: '14:00',
            endTime: '15:00',
            relatedClientId: petals.id,
            locationOrLink: 'https://meet.google.com/oct-petal-sync',
            agenda: '1. Review mobile navigation UI\n2. Discuss room booking funnel speed\n3. Review SEO architecture\n4. Confirm launch timeline',
            summary: 'Agreed on minimalism design language. Jakub to finish revised mobile mockups by Friday.',
            decisions: '1. Launch scheduled for October 15th\n2. Dark/light theme support included\n3. Payment integration with Razorpay',
            createdById: harsh.id,
            participants: {
                create: [
                    { userId: harsh.id },
                    { userId: jakub.id },
                    { userId: nikita.id },
                    { externalEmail: 'rohan@petalshotels.com', externalName: 'Rohan Deshmukh' }
                ]
            }
        }
    });
    const meetingRanka = await prisma.meeting.create({
        data: {
            title: 'Ranka Chemical - Quarterly Operations Review',
            date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3),
            startTime: '16:00',
            endTime: '17:00',
            relatedClientId: ranka.id,
            locationOrLink: 'Octagram Boardroom / Hybrid Meet',
            agenda: 'Quarterly analytics review, API throughput metrics, and Q4 feature roadmap.',
            createdById: harsh.id,
            participants: {
                create: [
                    { userId: harsh.id },
                    { externalEmail: 'suresh@rankachemical.com', externalName: 'Suresh Ranka' }
                ]
            }
        }
    });
    console.log('✅ Meetings created');
    // 7. Create Relational Tasks (including Automated Payment Reminder)
    const taskPetalsPayment = await prisma.task.create({
        data: {
            title: 'Collect payment — Petals Suites & Hotel',
            description: `Payment of ₹30,000 due on ${paymentDueIn2Days.toISOString().split('T')[0]}. [Payment ID: ${petalsPayment.id}]`,
            priority: 'HIGH',
            status: 'TODO',
            deadline: paymentDueIn2Days,
            createdById: harsh.id,
            assignedUserId: harsh.id,
            relatedClientId: petals.id,
            automatedType: 'PAYMENT_REMINDER',
        }
    });
    const taskKalnadOverdue = await prisma.task.create({
        data: {
            title: '🔴 Overdue Payment Collection — Kalnad Jewels',
            description: `Overdue payment of ₹45,000 since ${paymentOverdue5Days.toISOString().split('T')[0]}. Follow up with Vikram Kalnad. [Payment ID: ${kalnadPayment.id}]`,
            priority: 'CRITICAL',
            status: 'TODO',
            deadline: paymentOverdue5Days,
            createdById: harsh.id,
            assignedUserId: nikita.id,
            relatedClientId: kalnad.id,
            automatedType: 'PAYMENT_REMINDER',
        }
    });
    const taskProposal = await prisma.task.create({
        data: {
            title: 'Prepare Petals website proposal',
            description: 'Draft comprehensive scope document including mobile checkout flow and performance metrics.',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            deadline: tomorrow,
            createdById: harsh.id,
            assignedUserId: harsh.id,
            relatedClientId: petals.id,
            relatedMeetingId: meetingPetals.id,
            collaborators: {
                create: [
                    { userId: jakub.id },
                    { userId: nikita.id },
                ]
            },
            comments: {
                create: [
                    { authorId: jakub.id, content: '@Harsh I have updated the Figma prototypes with the somber minimalist theme.' },
                    { authorId: harsh.id, content: 'Excellent, incorporating the responsive wireframes into the final client deck.' },
                ]
            }
        }
    });
    const taskJakubDesign = await prisma.task.create({
        data: {
            title: 'Homepage redesign & asset export',
            description: 'Finalize high-resolution vector assets and clean up typography scale for Petals Suites.',
            priority: 'MEDIUM',
            status: 'IN_PROGRESS',
            deadline: tomorrow,
            createdById: harsh.id,
            assignedUserId: jakub.id,
            relatedClientId: petals.id,
        }
    });
    const taskNikitaLeads = await prisma.task.create({
        data: {
            title: 'Lead research - Bengaluru specialty cafes',
            description: 'Compile top 50 specialty coffee outlets with review ratings and verify active phone numbers.',
            priority: 'MEDIUM',
            status: 'TODO',
            deadline: fiveDaysLater,
            createdById: harsh.id,
            assignedUserId: nikita.id,
        }
    });
    const taskRankaRevision = await prisma.task.create({
        data: {
            title: 'Client revision — Ranka Chemical portal',
            description: 'Implement export to CSV on customer ledger view and update SSL certificates.',
            priority: 'HIGH',
            status: 'TODO',
            deadline: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0), // Today
            createdById: harsh.id,
            assignedUserId: harsh.id,
            relatedClientId: ranka.id,
        }
    });
    const taskFollowUpCreme = await prisma.task.create({
        data: {
            title: '🟠 CALL Follow-up — Crème Haven Artisanal Cafe',
            description: 'Follow up with Aarav Mehta regarding the digital menu platform proposal.',
            priority: 'HIGH',
            status: 'TODO',
            deadline: tomorrow,
            createdById: harsh.id,
            assignedUserId: harsh.id,
            relatedLeadId: cremeHaven.id,
            automatedType: 'FOLLOWUP_REMINDER',
        }
    });
    const taskPersonalAnalytics = await prisma.task.create({
        data: {
            title: 'Review website analytics & conversion rates',
            description: 'Analyze monthly traffic flow and inbound lead generation stats.',
            priority: 'LOW',
            status: 'TODO',
            isPersonal: true,
            createdById: harsh.id,
            assignedUserId: harsh.id,
        }
    });
    console.log('✅ Tasks created');
    // 8. Create Tickets
    const ticket1001 = await prisma.ticket.create({
        data: {
            ticketNumber: 1001,
            title: 'Petals Suites contact form submission failure',
            description: 'Guest inquiries submitted on the suite booking inquiry form are encountering a 504 timeout.',
            category: 'CLIENT',
            priority: 'HIGH',
            status: 'OPEN',
            relatedClientId: petals.id,
            createdById: jakub.id,
            assignedUserId: harsh.id,
            deadline: tomorrow,
            comments: {
                create: [
                    { authorId: jakub.id, content: 'Noticed this morning when testing the production contact endpoint.' },
                    { authorId: harsh.id, content: 'Checking SMTP relay service configuration now.' },
                ]
            }
        }
    });
    const ticket1002 = await prisma.ticket.create({
        data: {
            ticketNumber: 1002,
            title: 'Update client SSL certificates across subdomains',
            description: 'Automate Let\'s Encrypt certificate renewal hooks for hub.octagramai.com and client staging endpoints.',
            category: 'TECHNICAL',
            priority: 'CRITICAL',
            status: 'RESOLVED',
            createdById: harsh.id,
            assignedUserId: harsh.id,
        }
    });
    const ticket1003 = await prisma.ticket.create({
        data: {
            ticketNumber: 1003,
            title: 'Bela Ku Bakes product catalog bulk upload script',
            description: 'Add CSV import functionality for seasonal bakery menu items.',
            category: 'INTERNAL',
            priority: 'MEDIUM',
            status: 'IN_PROGRESS',
            relatedClientId: bela.id,
            createdById: jakub.id,
            assignedUserId: jakub.id,
            deadline: fiveDaysLater,
        }
    });
    console.log('✅ Tickets created');
    // 9. Communications History
    await prisma.communication.createMany({
        data: [
            {
                relatedClientId: petals.id,
                authorId: harsh.id,
                type: 'EMAIL',
                subject: 'Website proposal & delivery milestones sent',
                content: 'Sent detailed scope document with pricing breakdown for Phase 1.',
                direction: 'OUTBOUND',
                occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 20),
            },
            {
                relatedClientId: petals.id,
                authorId: harsh.id,
                type: 'CALL',
                subject: 'Phone call with MD Rohan Deshmukh',
                content: 'Discussed design preferences. Rohan confirmed enthusiasm for minimal, fast loading experience.',
                direction: 'OUTBOUND',
                occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 11, 0),
            },
            {
                relatedLeadId: cremeHaven.id,
                authorId: harsh.id,
                type: 'WHATSAPP',
                subject: 'Introductory portfolio shared',
                content: 'Shared Octagram case studies and restaurant digital architecture overview.',
                direction: 'OUTBOUND',
                occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 16, 45),
            }
        ]
    });
    // 10. Notifications
    await prisma.notification.createMany({
        data: [
            {
                userId: harsh.id,
                type: 'PAYMENT_DUE',
                title: 'Payment Due in 2 Days',
                message: 'Payment of ₹30,000 for Petals Suites & Hotel is due on ' + paymentDueIn2Days.toISOString().split('T')[0],
                linkUrl: `/clients/${petals.id}?tab=payments`,
                isRead: false,
            },
            {
                userId: harsh.id,
                type: 'MEETING_REMINDER',
                title: 'Meeting Tomorrow: Petals Website Redesign',
                message: 'Scheduled at 14:00 with Rohan Deshmukh, Jakub, and Nikita.',
                linkUrl: `/calendar?meetingId=${meetingPetals.id}`,
                isRead: false,
            },
            {
                userId: jakub.id,
                type: 'TASK_ASSIGNED',
                title: 'Harsh assigned you a task',
                message: 'Homepage redesign & asset export (Due tomorrow)',
                linkUrl: `/tasks?taskId=${taskJakubDesign.id}`,
                isRead: false,
            },
            {
                userId: nikita.id,
                type: 'PAYMENT_DUE',
                title: '🔴 Critical: Overdue Payment Collection',
                message: 'Kalnad Jewels payment of ₹45,000 is 5 days overdue.',
                linkUrl: `/tasks?taskId=${taskKalnadOverdue.id}`,
                isRead: false,
            },
        ]
    });
    // 11. Activity Logs
    await prisma.activityLog.createMany({
        data: [
            {
                userId: harsh.id,
                action: 'PAYMENT_RECORDED',
                entityType: 'PAYMENT',
                entityId: rankaPayment.id,
                details: JSON.stringify({ client: 'Ranka Chemical Industries', amount: 65000, status: 'Paid' }),
                createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14),
            },
            {
                userId: harsh.id,
                action: 'CREATE',
                entityType: 'CLIENT',
                entityId: petals.id,
                details: JSON.stringify({ name: 'Petals Suites & Hotel', industry: 'Hospitality' }),
                createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
            },
            {
                userId: jakub.id,
                action: 'STATUS_CHANGE',
                entityType: 'LEAD',
                entityId: saffron.id,
                details: JSON.stringify({ lead: 'Saffron Gourmet Kitchen', stage: 'PROPOSAL' }),
                createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
            },
            {
                userId: harsh.id,
                action: 'CREATE',
                entityType: 'TASK',
                entityId: taskPetalsPayment.id,
                details: JSON.stringify({ title: 'Collect payment — Petals Suites & Hotel', priority: 'HIGH' }),
                createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
            },
        ]
    });
    console.log('✅ Database seeded with production-quality Octagram operational records!');
}
main()
    .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
