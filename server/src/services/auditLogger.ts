import { prisma } from '../prisma.js';

export interface LogActivityParams {
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSIGN' | 'CONVERT' | 'IMPORT' | 'PAYMENT_RECORDED' | 'TASK_COMPLETED';
  entityType: 'CLIENT' | 'LEAD' | 'TASK' | 'PAYMENT' | 'EXPENSE' | 'TICKET' | 'MEETING' | 'USER' | 'COMMUNICATION';
  entityId?: string;
  details: Record<string, any> | string;
}

export const logActivity = async (params: LogActivityParams) => {
  try {
    const detailsStr = typeof params.details === 'string' ? params.details : JSON.stringify(params.details);
    return await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: detailsStr,
      }
    });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
};
