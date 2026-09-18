import React from 'react';
import { Sidebar } from './Sidebar.js';
import { X, LayoutDashboard, CheckSquare, Target, Calendar, Building2 } from 'lucide-react';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentPath,
  onNavigate,
}) => {
  return (
    <>
      {/* Mobile Drawer Backdrop & Sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-zinc-950 shadow-2xl flex flex-col z-10">
            <div className="absolute top-3 right-3">
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Sidebar currentPath={currentPath} onNavigate={onNavigate} onCloseMobile={onClose} />
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar for rapid thumb access */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-900 z-40 flex items-center justify-around px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        {[
          { path: '/', label: 'Home', icon: LayoutDashboard, exact: true },
          { path: '/tasks', label: 'Tasks', icon: CheckSquare, exact: false },
          { path: '/crm/leads', label: 'CRM', icon: Target, exact: false },
          { path: '/clients', label: 'Clients', icon: Building2, exact: false },
          { path: '/calendar', label: 'Calendar', icon: Calendar, exact: false },
        ].map((item) => {
          const isActive = item.exact
            ? currentPath === item.path
            : currentPath.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-zinc-100 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300 active:scale-95'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-zinc-800 text-sky-400' : 'bg-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
