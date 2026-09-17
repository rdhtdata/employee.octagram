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
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-900 z-40 flex items-center justify-around px-2">
        <button
          onClick={() => onNavigate('/')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] ${
            currentPath === '/' ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>
        <button
          onClick={() => onNavigate('/tasks')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] ${
            currentPath.startsWith('/tasks') ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Tasks</span>
        </button>
        <button
          onClick={() => onNavigate('/crm/leads')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] ${
            currentPath.startsWith('/crm') ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>CRM</span>
        </button>
        <button
          onClick={() => onNavigate('/clients')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] ${
            currentPath.startsWith('/clients') ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Clients</span>
        </button>
        <button
          onClick={() => onNavigate('/calendar')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] ${
            currentPath.startsWith('/calendar') ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendar</span>
        </button>
      </nav>
    </>
  );
};
