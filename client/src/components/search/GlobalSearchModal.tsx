import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import { Search, Building2, Target, CheckSquare, Calendar, Ticket, User, ArrowRight, Loader2 } from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../common/Badge.js';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Global key listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Handled in Layout
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.search.query(query);
        setResults(res.results || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation through search results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: any) => {
    onNavigate(item.url);
    onClose();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CLIENT':
        return <Building2 className="w-4 h-4 text-emerald-400" />;
      case 'LEAD':
        return <Target className="w-4 h-4 text-sky-400" />;
      case 'TASK':
        return <CheckSquare className="w-4 h-4 text-amber-400" />;
      case 'MEETING':
        return <Calendar className="w-4 h-4 text-purple-400" />;
      case 'TICKET':
        return <Ticket className="w-4 h-4 text-rose-400" />;
      case 'EMPLOYEE':
        return <User className="w-4 h-4 text-zinc-400" />;
      default:
        return <Search className="w-4 h-4 text-zinc-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xs" onClick={onClose} />

      {/* Search Palette Container */}
      <div
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search clients, leads, tasks, meetings, tickets, team..."
            className="flex-1 bg-transparent border-none text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />
          ) : (
            <kbd className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-750">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div className="p-6 text-center text-xs text-zinc-500 space-y-1">
              <p>Type at least 2 characters to search across Octagram operations.</p>
              <div className="flex justify-center gap-2 pt-2 text-[11px] text-zinc-600 font-mono">
                <span>[Clients]</span>
                <span>[Leads]</span>
                <span>[Tasks]</span>
                <span>[Meetings]</span>
                <span>[Tickets]</span>
              </div>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}-${index}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-850'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-md bg-zinc-850 border border-zinc-750/60 shrink-0">
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-100 truncate">{item.title}</span>
                          <span className="text-[10px] font-mono uppercase text-zinc-500 bg-zinc-850 px-1 rounded">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.priority && <PriorityBadge priority={item.priority} size="xs" />}
                      {item.badge && <StatusBadge status={item.badge} size="xs" />}
                      <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-zinc-300' : 'text-transparent'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-zinc-950/60 border-t border-zinc-850 text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Octagram Search</span>
        </div>
      </div>
    </div>
  );
};
