import { prisma } from '../prisma.js';

export interface LogActivityParams {
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSIGN' | 'CONVERT' | 'IMPORT' | 'PAYMENT_RECORDED' | 'TASK_COMPLETED';
  entityType: 'CLIENT' | 'LEAD' | 'TASK' | 'PAYMENT' | 'EXPENSE' | 'TICKET' | 'MEETING' | 'USER' | 'COMMUNICATION';
  entityId?: string;
  details: Record<string, any> | string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'plainpassword',
  'passwordhash',
  'token',
  'secret',
  'currentpassword',
  'newpassword',
  'refreshtoken',
  'authorization',
]);

function sanitizeDetails(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDetails(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logActivity = async (params: LogActivityParams) => {
  try {
    const sanitized = typeof params.details === 'object' && params.details !== null
      ? sanitizeDetails(params.details)
      : params.details;

    const detailsStr = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
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
