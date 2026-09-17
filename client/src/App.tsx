import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { NotificationProvider } from './context/NotificationContext.js';
import { Layout } from './components/layout/Layout.js';
import { Login } from './pages/auth/Login.js';
import { Dashboard } from './pages/dashboard/Dashboard.js';
import { TasksPage } from './pages/tasks/TasksPage.js';
import { CRMPage } from './pages/crm/CRMPage.js';
import { ClientsPage } from './pages/clients/ClientsPage.js';
import { ClientWorkspacePage } from './pages/clients/ClientWorkspacePage.js';
import { AccountsPage } from './pages/accounts/AccountsPage.js';
import { CalendarPage } from './pages/calendar/CalendarPage.js';
import { TicketsPage } from './pages/tickets/TicketsPage.js';
import { TeamPage } from './pages/team/TeamPage.js';
import { AdminPage } from './pages/admin/AdminPage.js';
import { ProfilePage } from './pages/profile/ProfilePage.js';
import { TableSkeleton } from './components/common/Skeleton.js';
import { ToastContainer } from './components/common/ToastContainer.js';

const AppContent: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname + window.location.search);

  // Sync state with browser URL
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-10 h-10 border-2 border-zinc-700 border-t-zinc-100 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading Octagram Hub...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <>
        <ToastContainer />
        <Login onLoginSuccess={() => navigate('/')} />
      </>
    );
  }

  // Parse path and query params
  const [pathOnly, searchOnly] = currentPath.split('?');
  const searchParams = new URLSearchParams(searchOnly || '');

  const renderCurrentPage = () => {
    // Tasks
    if (pathOnly === '/tasks') {
      return <TasksPage key="tasks-page" initialTaskId={searchParams.get('taskId') || undefined} />;
    }

    // CRM
    if (pathOnly === '/crm/leads') {
      return <CRMPage key="crm-page" initialView="leads" initialLeadId={searchParams.get('leadId') || undefined} onNavigate={navigate} />;
    }
    if (pathOnly === '/crm/pipeline') {
      return <CRMPage key="crm-page" initialView="pipeline" initialLeadId={searchParams.get('leadId') || undefined} onNavigate={navigate} />;
    }
    if (pathOnly.startsWith('/crm/leads/')) {
      const leadId = pathOnly.replace('/crm/leads/', '');
      return <CRMPage key="crm-page" initialView="leads" initialLeadId={leadId} onNavigate={navigate} />;
    }

    // Clients
    if (pathOnly === '/clients') {
      return <ClientsPage key="clients-page" onNavigate={navigate} />;
    }
    if (pathOnly.startsWith('/clients/')) {
      const clientId = pathOnly.replace('/clients/', '');
      const initialTab = searchParams.get('tab') || 'overview';
      return <ClientWorkspacePage key={`client-${clientId}`} clientId={clientId} initialTab={initialTab} onNavigate={navigate} />;
    }

    // Accounts
    if (pathOnly === '/accounts') {
      return <AccountsPage key="accounts-page" initialTab="overview" onNavigate={navigate} />;
    }
    if (pathOnly === '/accounts/incoming') {
      return <AccountsPage key="accounts-page" initialTab="incoming" onNavigate={navigate} />;
    }
    if (pathOnly === '/accounts/future_incoming') {
      return <AccountsPage key="accounts-page" initialTab="future_incoming" onNavigate={navigate} />;
    }
    if (pathOnly === '/accounts/outgoing') {
      return <AccountsPage key="accounts-page" initialTab="outgoing" onNavigate={navigate} />;
    }

    // Calendar
    if (pathOnly === '/calendar') {
      return <CalendarPage key="calendar-page" initialMeetingId={searchParams.get('meetingId') || undefined} onNavigate={navigate} />;
    }

    // Tickets
    if (pathOnly === '/tickets') {
      return <TicketsPage key="tickets-page" initialTicketId={searchParams.get('ticketId') || undefined} />;
    }

    // Team
    if (pathOnly === '/team') {
      return <TeamPage key="team-page" initialUserId={searchParams.get('userId') || undefined} />;
    }

    // Admin
    if (pathOnly === '/admin/users') {
      return <AdminPage key="admin-page" initialTab="users" onNavigate={navigate} />;
    }
    if (pathOnly === '/admin/audit') {
      return <AdminPage key="admin-page" initialTab="audit" onNavigate={navigate} />;
    }
    if (pathOnly === '/admin/settings') {
      return <AdminPage key="admin-page" initialTab="settings" onNavigate={navigate} />;
    }

    // Profile
    if (pathOnly === '/profile') {
      return <ProfilePage key="profile-page" />;
    }

    // Default: Dashboard
    return (
      <Dashboard
        key="dashboard-page"
        onNavigate={navigate}
        onOpenQuickAction={(type) => {
          const event = new CustomEvent('open-quick-action', { detail: { type: type || 'task' } });
          window.dispatchEvent(event);
        }}
      />
    );
  };

  return (
    <Layout currentPath={currentPath} onNavigate={navigate}>
      {renderCurrentPage()}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
