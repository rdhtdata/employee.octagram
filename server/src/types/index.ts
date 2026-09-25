import { Request } from 'express';

export type UserRole = 'DEV' | 'ADMIN' | 'SALES';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type TaskRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'DEMO_DISCOVERY' | 'ENGAGED' | 'NEGOTIATION' | 'WON' | 'LOST';
export type PaymentStatus = 'UPCOMING' | 'DUE' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketCategory = 'CLIENT' | 'INTERNAL' | 'TECHNICAL' | 'SALES' | 'ADMIN';
