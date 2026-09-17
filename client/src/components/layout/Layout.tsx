import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { MobileNav } from './MobileNav.js';
import { GlobalSearchModal } from '../search/GlobalSearchModal.js';
import { QuickActionModal } from '../quickActions/QuickActionModal.js';
import { ToastContainer } from '../common/ToastContainer.js';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onRefreshData?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPath,
  onNavigate,
  onRefreshData,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<any>('task');

  // Listen for custom trigger events
  useEffect(() => {
    const handleOpenQuickAction = (e: any) => {
      setQuickActionType(e.detail?.type || 'task');
      setIsQuickActionOpen(true);
    };
    window.addEventListener('open-quick-action', handleOpenQuickAction);
    return () => window.removeEventListener('open-quick-action', handleOpenQuickAction);
  }, []);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex shrink-0 h-full">
        <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      </div>

      {/* Mobile Nav & Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenQuickAction={() => {
            setQuickActionType('task');
            setIsQuickActionOpen(true);
          }}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={onNavigate}
        />

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-6 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Modals & Toasts */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
      />

      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        defaultType={quickActionType}
        onSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <ToastContainer />
    </div>
  );
};
