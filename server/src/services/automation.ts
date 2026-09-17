import { prisma } from '../prisma.js';

export function advanceRecurrenceDate(date: Date, recurrence: string): Date {
  const next = new Date(date);
  switch (recurrence?.toUpperCase()) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export class AutomationEngine {
  /**
   * Scans recurring payments and expenses. If the latest record in a recurring series is PAID,
   * automatically generates the next UPCOMING cycle payment/expense and advances to the next period.
   */
  static async ensureUpcomingRecurringCycles() {
    try {
      const now = new Date();

      // 1. Process recurring payments
      const recurringPayments = await prisma.payment.findMany({
        where: {
          recurrence: { not: 'NONE' },
          status: { not: 'CANCELLED' },
        },
        include: { client: true },
        orderBy: { dueDate: 'asc' },
      });

      const paymentSeries = new Map<string, typeof recurringPayments>();
      for (const p of recurringPayments) {
        const key = `${p.clientId}_${p.recurrence}_${p.amount}`;
        if (!paymentSeries.has(key)) {
          paymentSeries.set(key, []);
        }
        paymentSeries.get(key)!.push(p);
      }

      for (const [, series] of paymentSeries.entries()) {
        series.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const latest = series[series.length - 1];

        // Check if there is already an active/pending future payment in this series
        const hasPending = series.some(
          (p) => p.status === 'UPCOMING' || p.status === 'DUE' || p.status === 'OVERDUE' || p.status === 'PARTIALLY_PAID'
        );

        if (!hasPending && latest.status === 'PAID') {
          let nextDueDate = advanceRecurrenceDate(new Date(latest.dueDate), latest.recurrence);

          // If nextDueDate is still far behind the current date, advance to current/next cycle
          while (nextDueDate < now && Math.abs(now.getTime() - nextDueDate.getTime()) > 30 * 24 * 60 * 60 * 1000) {
            nextDueDate = advanceRecurrenceDate(nextDueDate, latest.recurrence);
          }

          const existingNext = await prisma.payment.findFirst({
            where: {
              clientId: latest.clientId,
              amount: latest.amount,
              dueDate: nextDueDate,
              status: { not: 'CANCELLED' },
            },
          });

          if (!existingNext) {
            await prisma.payment.create({
              data: {
                clientId: latest.clientId,
                amount: latest.amount,
                currency: latest.currency,
                invoiceRef: latest.invoiceRef ? `${latest.invoiceRef.replace(/ \(Rec\)$/, '')} (Rec)` : null,
                dueDate: nextDueDate,
                status: 'UPCOMING',
                recurrence: latest.recurrence,
                responsibleUserId: latest.responsibleUserId || latest.client?.accountManagerId,
                createdById: latest.createdById,
                notes: `Recurring ${latest.recurrence} income cycle following ${new Date(latest.dueDate).toISOString().split('T')[0]} payment.`,
              },
            });
          }
        }
      }

      // 2. Process recurring expenses
      const recurringExpenses = await prisma.expense.findMany({
        where: {
          recurrence: { not: 'NONE' },
          status: { not: 'CANCELLED' },
        },
        orderBy: { dueDate: 'asc' },
      });

      const expenseSeries = new Map<string, typeof recurringExpenses>();
      for (const e of recurringExpenses) {
        const key = `${e.vendor}_${e.recurrence}_${e.amount}_${e.relatedClientId || 'general'}`;
        if (!expenseSeries.has(key)) {
          expenseSeries.set(key, []);
        }
        expenseSeries.get(key)!.push(e);
      }

      for (const [, series] of expenseSeries.entries()) {
        series.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const latest = series[series.length - 1];

        const hasPending = series.some(
          (e) => e.status === 'UPCOMING' || e.status === 'OVERDUE'
        );

        if (!hasPending && latest.status === 'PAID') {
          let nextDueDate = advanceRecurrenceDate(new Date(latest.dueDate), latest.recurrence);

          while (nextDueDate < now && Math.abs(now.getTime() - nextDueDate.getTime()) > 30 * 24 * 60 * 60 * 1000) {
            nextDueDate = advanceRecurrenceDate(nextDueDate, latest.recurrence);
          }

          const existingNext = await prisma.expense.findFirst({
            where: {
              vendor: latest.vendor,
              amount: latest.amount,
              dueDate: nextDueDate,
              status: { not: 'CANCELLED' },
            },
          });

          if (!existingNext) {
            await prisma.expense.create({
              data: {
                vendor: latest.vendor,
                category: latest.category,
                amount: latest.amount,
                currency: latest.currency,
                dueDate: nextDueDate,
                status: 'UPCOMING',
                recurrence: latest.recurrence,
                relatedClientId: latest.relatedClientId,
                responsibleUserId: latest.responsibleUserId,
                createdById: latest.createdById,
                notes: `Recurring ${latest.recurrence} expense cycle following ${new Date(latest.dueDate).toISOString().split('T')[0]} expense.`,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error('Error ensuring recurring cycles:', err);
    }
  }

  /**
   * Generates or synchronizes payment reminder tasks for upcoming/overdue payments.
   * Informs Account Holder under their tasks and Admin Team under group tasks.
   */
  static async syncPaymentReminders() {
    // First ensure all recurring payments have their next upcoming instance generated
    await AutomationEngine.ensureUpcomingRecurringCycles();

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    // Fetch all admins to add as collaborators / group task members
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true }
    });

    // 1. Find all active/pending/overdue payments
    const payments = await prisma.payment.findMany({
      where: {
        status: { in: ['UPCOMING', 'DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
      include: {
        client: true,
        responsibleUser: true,
      }
    });

    for (const payment of payments) {
      const isOverdue = payment.dueDate < now;
      const isDueSoon = payment.dueDate <= sevenDaysFromNow;

      // Update payment status to OVERDUE if past due date and not already marked
      if (isOverdue && payment.status !== 'OVERDUE') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'OVERDUE' }
        });
      }

      // Check if we need to create or escalate a task
      const existingTask = await prisma.task.findFirst({
        where: {
          relatedClientId: payment.clientId,
          automatedType: 'PAYMENT_REMINDER',
          description: { contains: payment.id }
        }
      });

      const recLabel = payment.recurrence && payment.recurrence !== 'NONE' ? ` [${payment.recurrence}]` : '';
      const taskTitle = isOverdue 
        ? `🔴 Overdue Income Due — ${payment.client.name}${recLabel}` 
        : isDueSoon
          ? `💰 Collect Payment — ${payment.client.name}${recLabel}`
          : `📅 Upcoming Payment Due — ${payment.client.name}${recLabel}`;

      const priority = isOverdue ? 'CRITICAL' : isDueSoon ? 'HIGH' : 'MEDIUM';
      const assigneeId = payment.responsibleUserId || payment.client.accountManagerId || payment.createdById;

      if (!existingTask) {
        // Create collaborative group task assigned to Account Holder
        await prisma.task.create({
          data: {
            title: taskTitle,
            description: `Payment of ${payment.currency === 'INR' ? '₹' : '$'}${payment.amount.toLocaleString()} scheduled for ${payment.dueDate.toISOString().split('T')[0]}${recLabel}. [Payment ID: ${payment.id}]`,
            priority,
            status: 'TODO',
            deadline: payment.dueDate,
            createdById: payment.createdById,
            assignedUserId: assigneeId,
            relatedClientId: payment.clientId,
            automatedType: 'PAYMENT_REMINDER',
            isPersonal: false,
            collaborators: {
              create: adminUsers
                .filter(a => a.id !== assigneeId)
                .map(a => ({ userId: a.id }))
            }
          }
        });

        // Notify Account Holder
        if (assigneeId && (isDueSoon || isOverdue)) {
          await prisma.notification.create({
            data: {
              userId: assigneeId,
              type: 'PAYMENT_DUE',
              title: isOverdue ? 'Payment Overdue' : 'Upcoming Payment Collection',
              message: `Payment of ${payment.currency === 'INR' ? '₹' : '$'}${payment.amount.toLocaleString()} for ${payment.client.name} is ${isOverdue ? 'overdue' : 'due soon'}.`,
              linkUrl: `/clients/${payment.clientId}?tab=finances`,
            }
          });
        }

        // Notify Admins
        if (isDueSoon || isOverdue) {
          for (const admin of adminUsers) {
            if (admin.id !== assigneeId) {
              await prisma.notification.create({
                data: {
                  userId: admin.id,
                  type: 'PAYMENT_DUE',
                  title: isOverdue ? `[Group Task] Overdue Payment — ${payment.client.name}` : `[Group Task] Payment Due — ${payment.client.name}`,
                  message: `Payment of ${payment.currency === 'INR' ? '₹' : '$'}${payment.amount.toLocaleString()} for ${payment.client.name} due on ${payment.dueDate.toISOString().split('T')[0]}.`,
                  linkUrl: `/clients/${payment.clientId}?tab=finances`,
                }
              });
            }
          }
        }
      } else if (isOverdue && existingTask.status !== 'COMPLETED' && existingTask.priority !== 'CRITICAL') {
        // Escalate existing task
        await prisma.task.update({
          where: { id: existingTask.id },
          data: {
            priority: 'CRITICAL',
            title: taskTitle,
          }
        });
      }
    }
  }

  /**
   * When a payment is marked as PAID or CANCELLED:
   * - Automatically completes linked reminder tasks.
   * - Spawns the next recurring cycle payment if recurrence is enabled.
   */
  static async handlePaymentStatusChange(paymentId: string, newStatus: string) {
    if (newStatus === 'PAID' || newStatus === 'CANCELLED') {
      const linkedTasks = await prisma.task.findMany({
        where: {
          automatedType: 'PAYMENT_REMINDER',
          description: { contains: paymentId },
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        }
      });

      for (const task of linkedTasks) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        });
      }
    }

    // Rollover for recurring payments when marked as PAID
    if (newStatus === 'PAID') {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { client: true }
      });

      if (payment && payment.recurrence && payment.recurrence !== 'NONE') {
        const nextDueDate = advanceRecurrenceDate(payment.dueDate, payment.recurrence);

        // Check if next cycle already exists to prevent duplicate creation
        const existingNext = await prisma.payment.findFirst({
          where: {
            clientId: payment.clientId,
            amount: payment.amount,
            dueDate: nextDueDate,
            recurrence: payment.recurrence,
            status: { not: 'CANCELLED' }
          }
        });

        if (!existingNext) {
          await prisma.payment.create({
            data: {
              clientId: payment.clientId,
              amount: payment.amount,
              currency: payment.currency,
              invoiceRef: payment.invoiceRef ? `${payment.invoiceRef} (Rec)` : null,
              dueDate: nextDueDate,
              status: 'UPCOMING',
              recurrence: payment.recurrence,
              responsibleUserId: payment.responsibleUserId || payment.client?.accountManagerId,
              createdById: payment.createdById,
              notes: `Recurring ${payment.recurrence} income cycle generated following ${payment.dueDate.toISOString().split('T')[0]} payment.`,
            }
          });

          await AutomationEngine.syncPaymentReminders();
        }
      }
    }
  }

  /**
   * Generates or synchronizes expense reminder tasks for upcoming/overdue expenses.
   */
  static async syncExpenseReminders() {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true }
    });

    const expenses = await prisma.expense.findMany({
      where: {
        status: { in: ['UPCOMING', 'OVERDUE'] },
      },
      include: {
        client: true,
        responsibleUser: true,
      }
    });

    for (const expense of expenses) {
      const isOverdue = expense.dueDate < now;
      const isDueSoon = expense.dueDate <= sevenDaysFromNow;

      if (isOverdue && expense.status !== 'OVERDUE') {
        await prisma.expense.update({
          where: { id: expense.id },
          data: { status: 'OVERDUE' }
        });
      }

      if (isDueSoon || isOverdue) {
        const existingTask = await prisma.task.findFirst({
          where: {
            automatedType: 'EXPENSE_REMINDER',
            description: { contains: expense.id }
          }
        });

        const recLabel = expense.recurrence && expense.recurrence !== 'NONE' ? ` [${expense.recurrence}]` : '';
        const clientLabel = expense.client ? ` — ${expense.client.name}` : '';
        const taskTitle = isOverdue
          ? `🔴 Overdue Expense: Pay ${expense.vendor}${clientLabel}${recLabel}`
          : `💳 Pay Expense: ${expense.vendor}${clientLabel}${recLabel}`;

        const priority = isOverdue ? 'CRITICAL' : 'HIGH';
        const assigneeId = expense.responsibleUserId || expense.client?.accountManagerId || expense.createdById;

        if (!existingTask) {
          await prisma.task.create({
            data: {
              title: taskTitle,
              description: `Expense of ${expense.currency === 'INR' ? '₹' : '$'}${expense.amount.toLocaleString()} for ${expense.vendor} (${expense.category}) due on ${expense.dueDate.toISOString().split('T')[0]}${recLabel}.${clientLabel ? ` Linked to Client: ${expense.client?.name}` : ''} [Expense ID: ${expense.id}]`,
              priority,
              status: 'TODO',
              deadline: expense.dueDate,
              createdById: expense.createdById,
              assignedUserId: assigneeId,
              relatedClientId: expense.relatedClientId || null,
              automatedType: 'EXPENSE_REMINDER',
              isPersonal: false,
              collaborators: {
                create: adminUsers
                  .filter(a => a.id !== assigneeId)
                  .map(a => ({ userId: a.id }))
              }
            }
          });
        }
      }
    }
  }

  /**
   * When an expense is marked as PAID or CANCELLED:
   * - Completes linked reminder tasks.
   * - Spawns next recurring cycle expense if recurrence is set.
   */
  static async handleExpenseStatusChange(expenseId: string, newStatus: string) {
    if (newStatus === 'PAID' || newStatus === 'CANCELLED') {
      const linkedTasks = await prisma.task.findMany({
        where: {
          automatedType: 'EXPENSE_REMINDER',
          description: { contains: expenseId },
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        }
      });

      for (const task of linkedTasks) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        });
      }
    }

    if (newStatus === 'PAID') {
      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: { client: true }
      });

      if (expense && expense.recurrence && expense.recurrence !== 'NONE') {
        const nextDueDate = advanceRecurrenceDate(expense.dueDate, expense.recurrence);

        const existingNext = await prisma.expense.findFirst({
          where: {
            vendor: expense.vendor,
            relatedClientId: expense.relatedClientId,
            dueDate: nextDueDate,
            recurrence: expense.recurrence,
            status: { not: 'CANCELLED' }
          }
        });

        if (!existingNext) {
          await prisma.expense.create({
            data: {
              vendor: expense.vendor,
              category: expense.category,
              amount: expense.amount,
              currency: expense.currency,
              dueDate: nextDueDate,
              status: 'UPCOMING',
              recurrence: expense.recurrence,
              relatedClientId: expense.relatedClientId,
              responsibleUserId: expense.responsibleUserId,
              createdById: expense.createdById,
              notes: `Recurring ${expense.recurrence} expense cycle generated following ${expense.dueDate.toISOString().split('T')[0]} payment.`,
            }
          });

          await AutomationEngine.syncExpenseReminders();
        }
      }
    }
  }

  /**
   * Synchronize lead follow-up reminder tasks
   */
  static async syncLeadFollowUps() {
    const now = new Date();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(now.getDate() + 2);

    const leads = await prisma.lead.findMany({
      where: {
        nextFollowUpDate: { lte: twoDaysFromNow },
        crmStatus: { notIn: ['WON', 'LOST'] },
        assignedUserId: { not: null }
      }
    });

    for (const lead of leads) {
      if (!lead.nextFollowUpDate || !lead.assignedUserId) continue;

      const existingTask = await prisma.task.findFirst({
        where: {
          relatedLeadId: lead.id,
          automatedType: 'FOLLOWUP_REMINDER',
        }
      });

      const followUpType = lead.followUpType || 'Call';
      const isPast = lead.nextFollowUpDate < now;
      const title = `${isPast ? '🔴 ' : '🟠 '}${followUpType.toUpperCase()} Follow-up — ${lead.businessName}`;

      if (!existingTask) {
        await prisma.task.create({
          data: {
            title,
            description: `Scheduled ${followUpType} follow-up with ${lead.contactName || lead.businessName}. Phone: ${lead.phone || 'N/A'}, Email: ${lead.email || 'N/A'}.`,
            priority: isPast ? 'HIGH' : 'MEDIUM',
            status: 'TODO',
            deadline: lead.nextFollowUpDate,
            createdById: lead.assignedUserId,
            assignedUserId: lead.assignedUserId,
            relatedLeadId: lead.id,
            automatedType: 'FOLLOWUP_REMINDER'
          }
        });

        await prisma.notification.create({
          data: {
            userId: lead.assignedUserId,
            type: 'LEAD_FOLLOWUP',
            title: `Lead Follow-up: ${lead.businessName}`,
            message: `${followUpType} follow-up scheduled for ${lead.businessName} (${lead.nextFollowUpDate.toISOString().split('T')[0]}).`,
            linkUrl: `/crm/leads/${lead.id}`,
          }
        });
      }
    }
  }
}
