import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Search, Plus, Bell, Menu, Check, ExternalLink } from 'lucide-react';
import { Button } from '../common/Button.js';
import { formatDistanceToNow } from 'date-fns';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenQuickAction: () => void;
  onToggleMobileMenu: () => void;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenQuickAction,
  onToggleMobileMenu,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notification popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    if (notification.linkUrl) {
      onNavigate(notification.linkUrl);
    }
  };

  return (
    <header className="h-14 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Mobile Toggle & Global Search trigger */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center justify-between gap-3 w-full max-w-xs px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-xs text-zinc-400 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            <span className="truncate">Search clients, tasks, leads...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded border border-zinc-750">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: + Create Action, Notifications, User */}
      <div className="flex items-center gap-2.5">
        {/* Global + Create Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenQuickAction}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          <span className="hidden sm:inline">Create</span>
        </Button>

        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => {
              if (!showNotifications) {
                fetchNotifications();
              }
              setShowNotifications(!showNotifications);
            }}
            className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-zinc-950 animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-[-40px] sm:right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-xs sm:max-w-none sm:w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden text-zinc-100 animate-in fade-in-50 duration-150">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-rose-950 text-rose-400 border border-rose-800/60">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-850">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    No notifications yet. You're all caught up!
                  </div>
                ) : (
                  notifications.slice(0, 15).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 text-xs transition-colors hover:bg-zinc-850/60 cursor-pointer flex items-start gap-2.5 ${
                        !n.isRead ? 'bg-zinc-850/30' : 'opacity-70'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          !n.isRead ? 'bg-sky-400' : 'bg-transparent'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-medium text-zinc-200 truncate">{n.title}</p>
                          <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-[11px] mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
