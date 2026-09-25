const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:5001/api`;
    }
  }
  return '/api';
};

const API_BASE = getApiBase();

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const getToken = (): string | null => {
  return localStorage.getItem('octagram_token');
};

export const apiFetch = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // If unauthorized on protected route, clean token
      if (!endpoint.includes('/auth/login')) {
        localStorage.removeItem('octagram_token');
        localStorage.removeItem('octagram_user');
      }
    }

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      const blob = await response.blob();
      return blob as unknown as T;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = data?.error || `Request failed with status ${response.status}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error occurred. Please check your connection.', 0);
  }
};

export const api = {
  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    getMe: () => apiFetch<{ user: any }>('/auth/me'),
    resetPassword: (payload: { currentPassword?: string; newPassword: string }) =>
      apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Dashboard
  dashboard: {
    get: () => apiFetch('/dashboard'),
  },

  // Users
  users: {
    list: () => apiFetch<{ users: any[] }>('/users'),
    get: (id: string) => apiFetch<{ user: any }>(`/users/${id}`),
    create: (data: any) => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
  },

  // Tasks
  tasks: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ tasks: any[] }>(`/tasks${query}`);
    },
    get: (id: string) => apiFetch<{ task: any }>(`/tasks/${id}`),
    create: (data: any) => apiFetch<{ task: any }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<{ task: any }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
    addComment: (id: string, content: string) =>
      apiFetch(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  },

  // Clients
  clients: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ clients: any[] }>(`/clients${query}`);
    },
    get: (id: string) => apiFetch<{ client: any }>(`/clients/${id}`),
    create: (data: any) => apiFetch<{ client: any }>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<{ client: any }>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/clients/${id}`, { method: 'DELETE' }),
    addContact: (id: string, data: any) => apiFetch(`/clients/${id}/contacts`, { method: 'POST', body: JSON.stringify(data) }),
    addNote: (id: string, data: { content: string; isPinned?: boolean }) =>
      apiFetch(`/clients/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    addCommunication: (id: string, data: any) =>
      apiFetch(`/clients/${id}/communications`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // CRM Leads
  leads: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ leads: any[] }>(`/leads${query}`);
    },
    getPipeline: () => apiFetch<{ pipeline: Record<string, any[]>; stages: string[] }>('/leads/pipeline'),
    get: (id: string) => apiFetch<{ lead: any }>(`/leads/${id}`),
    create: (data: any) => apiFetch<{ lead: any }>('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<{ lead: any }>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/leads/${id}`, { method: 'DELETE' }),
    convert: (id: string, data: { industry?: string; accountManagerId?: string }) =>
      apiFetch(`/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
    getFacets: () =>
      apiFetch<{
        industries: string[];
        categories: string[];
        websiteStatuses: string[];
        totalCount: number;
        hotCount: number;
        warmCount: number;
        coldCount: number;
        unassignedCount: number;
      }>('/leads/meta/facets'),
    previewImport: (formData: FormData) =>
      apiFetch('/leads/import/preview', { method: 'POST', body: formData }),
    confirmImport: (payload: { uniqueLeads: any[]; resolvedDuplicates: any[]; assignedUserId?: string }) =>
      apiFetch('/leads/import/confirm', { method: 'POST', body: JSON.stringify(payload) }),
    bulkReassign: (payload: {
      leadIds?: string[];
      fromUserId?: string | null;
      targetUserId: string | null;
      crmStatus?: string;
    }) =>
      apiFetch<{ success: boolean; count: number; message: string }>('/leads/bulk-reassign', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Accounts & Finance
  accounts: {
    getStats: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ incoming: any; outgoing: any; netBalance: number }>(`/accounts/stats${query}`);
    },
    getPayments: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ payments: any[] }>(`/accounts/payments${query}`);
    },
    createPayment: (data: any) => apiFetch<{ payment: any }>('/accounts/payments', { method: 'POST', body: JSON.stringify(data) }),
    updatePayment: (id: string, data: any) => apiFetch<{ payment: any }>(`/accounts/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePayment: (id: string) => apiFetch(`/accounts/payments/${id}`, { method: 'DELETE' }),

    getExpenses: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ expenses: any[] }>(`/accounts/expenses${query}`);
    },
    createExpense: (data: any) => apiFetch<{ expense: any }>('/accounts/expenses', { method: 'POST', body: JSON.stringify(data) }),
    updateExpense: (id: string, data: any) => apiFetch<{ expense: any }>(`/accounts/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteExpense: (id: string) => apiFetch(`/accounts/expenses/${id}`, { method: 'DELETE' }),
  },

  // Meetings
  meetings: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ meetings: any[] }>(`/meetings${query}`);
    },
    get: (id: string) => apiFetch<{ meeting: any }>(`/meetings/${id}`),
    create: (data: any) => apiFetch<{ meeting: any }>('/meetings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<{ meeting: any }>(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/meetings/${id}`, { method: 'DELETE' }),
  },

  // Calendar
  calendar: {
    getEvents: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ events: any[] }>(`/calendar/events${query}`);
    },
  },

  // Tickets
  tickets: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ tickets: any[] }>(`/tickets${query}`);
    },
    get: (id: string) => apiFetch<{ ticket: any }>(`/tickets/${id}`),
    create: (data: any) => apiFetch<{ ticket: any }>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<{ ticket: any }>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addComment: (id: string, content: string) =>
      apiFetch(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  },

  // Notifications
  notifications: {
    list: () => apiFetch<{ notifications: any[]; unreadCount: number }>('/notifications'),
    markRead: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => apiFetch('/notifications/mark-all-read', { method: 'POST' }),
  },

  // Global Search
  search: {
    query: (q: string) => apiFetch<{ results: any[] }>(`/search?q=${encodeURIComponent(q)}`),
  },

  // Audit
  audit: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch<{ logs: any[]; total: number; limit: number; offset: number }>(`/audit${query}`);
    },
  },

  // Export
  export: {
    downloadCsv: async (entity: string) => {
      const token = getToken();
      const response = await fetch(`${API_BASE}/export/${entity}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `octagram_${entity}_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  },
};
