export type UserRole = 'DEV' | 'ADMIN' | 'SALES';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
  plainPassword?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    assignedTasks: number;
    assignedLeads: number;
    managedClients: number;
  };
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type TaskRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  createdById: string;
  assignedUserId?: string | null;
  relatedClientId?: string | null;
  relatedLeadId?: string | null;
  relatedMeetingId?: string | null;
  relatedTicketId?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string | null;
  recurrence: TaskRecurrence;
  isPersonal: boolean;
  automatedType?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  creator?: { id: string; name: string; email: string };
  client?: { id: string; name: string; industry?: string };
  lead?: { id: string; businessName: string };
  meeting?: { id: string; title: string };
  ticket?: { id: string; ticketNumber: number; title: string };
  collaborators?: Array<{ user: User }>;
  comments?: TaskComment[];
  _count?: { comments: number };
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string | null };
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'ENGAGED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

export interface Lead {
  id: string;
  businessName: string;
  category?: string | null;
  industry?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteStatus?: string | null;
  websiteUrl?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  leadScore: number;
  crmStatus: LeadStatus;
  assignedUserId?: string | null;
  convertedClientId?: string | null;
  nextFollowUpDate?: string | null;
  followUpType?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: User | null;
  convertedClient?: { id: string; name: string; status: string } | null;
  tasks?: Task[];
  meetings?: Meeting[];
  communications?: Communication[];
  _count?: { tasks: number; communications: number; meetings: number };
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}

export interface ClientNote {
  id: string;
  clientId: string;
  authorId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Client {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  accountManagerId?: string | null;
  convertedLeadId?: string | null;
  createdAt: string;
  updatedAt: string;
  accountManager?: User | null;
  convertedLead?: { id: string; businessName: string; leadScore: number; rating?: number; totalReviews?: number; googleMapsUrl?: string } | null;
  contacts?: ClientContact[];
  notes?: ClientNote[];
  tasks?: Task[];
  meetings?: Meeting[];
  payments?: Payment[];
  expenses?: Expense[];
  tickets?: Ticket[];
  communications?: Communication[];
  documents?: DocumentItem[];
  activities?: ActivityLog[];
  _count?: { tasks: number; meetings: number; tickets: number };
}

export type PaymentStatus = 'UPCOMING' | 'DUE' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';

export interface Payment {
  id: string;
  clientId: string;
  amount: number;
  currency: string;
  invoiceRef?: string | null;
  dueDate: string;
  paymentDate?: string | null;
  status: PaymentStatus;
  recurrence: string;
  responsibleUserId?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  client: { id: string; name: string; industry?: string };
  responsibleUser?: { id: string; name: string; email?: string; avatarUrl?: string | null } | null;
}

export type ExpenseCategory = 'HOSTING' | 'DOMAINS' | 'SOFTWARE' | 'CONTRACTORS' | 'ADVERTISING' | 'OFFICE' | 'OTHER';

export interface Expense {
  id: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate?: string | null;
  status: 'UPCOMING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  recurrence: string;
  relatedClientId?: string | null;
  notes?: string | null;
  responsibleUserId?: string | null;
  createdAt: string;
  client?: { id: string; name: string } | null;
  responsibleUser?: { id: string; name: string; avatarUrl?: string | null } | null;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  relatedClientId?: string | null;
  relatedLeadId?: string | null;
  locationOrLink?: string | null;
  agenda?: string | null;
  summary?: string | null;
  decisions?: string | null;
  createdById: string;
  createdAt: string;
  creator?: { id: string; name: string; email?: string; avatarUrl?: string | null };
  client?: { id: string; name: string };
  lead?: { id: string; businessName: string };
  participants?: Array<{ user?: User | null; externalEmail?: string | null; externalName?: string | null }>;
  tasks?: Task[];
}

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'CLIENT' | 'INTERNAL' | 'TECHNICAL' | 'SALES' | 'ADMIN';

export interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  relatedClientId?: string | null;
  createdById: string;
  assignedUserId?: string | null;
  deadline?: string | null;
  createdAt: string;
  client?: { id: string; name: string };
  assignee?: User | null;
  creator?: { id: string; name: string };
  collaborators?: Array<{ user: User }>;
  comments?: Array<{ id: string; content: string; createdAt: string; author: { id: string; name: string; avatarUrl?: string | null } }>;
  _count?: { comments: number };
}

export interface Communication {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'NOTE';
  subject?: string | null;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  occurredAt: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: UserRole; avatarUrl?: string | null } | null;
}

export interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'MEETING' | 'TASK_DEADLINE' | 'LEAD_FOLLOWUP' | 'PAYMENT_DUE' | 'EXPENSE_DUE';
  start: string;
  end?: string;
  allDay?: boolean;
  status?: string;
  priority?: string;
  relatedEntity?: { id: string; name: string; type: string };
  assignedUser?: { id: string; name: string };
}
