import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Lead, User } from '../../types/index.js';
import { PriorityBadge, StatusBadge, Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { sanitizeExternalUrl } from '../../utils/url.js';
import { Drawer } from '../../components/common/Drawer.js';
import { Modal } from '../../components/common/Modal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { ExcelImportModal } from './ExcelImportModal.js';
import {
  Target,
  Kanban,
  List,
  Plus,
  Search,
  UploadCloud,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Star,
  Calendar,
  MessageSquare,
  Building2,
  Send,
  Trash2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Filter,
  X,
  UserCheck,
  Flame,
  Zap,
  Globe,
  SlidersHorizontal,
  RefreshCw,
  Clock,
  ArrowDownUp
} from 'lucide-react';
import { format } from 'date-fns';

interface CRMPageProps {
  initialView?: 'leads' | 'pipeline';
  initialLeadId?: string;
  onNavigate: (path: string) => void;
}

export const CRMPage: React.FC<CRMPageProps> = ({
  initialView = 'leads',
  initialLeadId,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>(initialView === 'pipeline' ? 'pipeline' : 'list');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelineData, setPipelineData] = useState<Record<string, Lead[]>>({});

  useEffect(() => {
    setViewMode(initialView === 'pipeline' ? 'pipeline' : 'list');
  }, [initialView]);

  const [stages, setStages] = useState<string[]>([
    'NEW',
    'CONTACTED',
    'ENGAGED',
    'QUALIFIED',
    'PROPOSAL',
    'NEGOTIATION',
    'WON',
    'LOST',
  ]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Facets
  const [facets, setFacets] = useState<{
    industries: string[];
    categories: string[];
    websiteStatuses: string[];
    totalCount: number;
    hotCount: number;
    warmCount: number;
    coldCount: number;
    unassignedCount: number;
  }>({
    industries: [],
    categories: [],
    websiteStatuses: [],
    totalCount: 0,
    hotCount: 0,
    warmCount: 0,
    coldCount: 0,
    unassignedCount: 0,
  });

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assignedFilter, setAssignedFilter] = useState('ALL');
  const [industryFilter, setIndustryFilter] = useState('ALL');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [websiteFilter, setWebsiteFilter] = useState('ALL');
  const [minRatingFilter, setMinRatingFilter] = useState('ALL');
  const [dateAddedFilter, setDateAddedFilter] = useState('ALL');
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting State - 3-state toggle: field+desc -> field+asc -> null (Deselected / natural default)
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals & Drawers
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Communication & Follow-up in Lead Drawer
  const [commType, setCommType] = useState('CALL');
  const [commContent, setCommContent] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpType, setFollowUpType] = useState('Call');

  const fetchFacets = async () => {
    try {
      const data = await api.leads.getFacets();
      setFacets(data);
    } catch (err) {
      // ignore
    }
  };

  const fetchCRMData = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.crmStatus = statusFilter;
      if (assignedFilter !== 'ALL') params.assignedUserId = assignedFilter;
      if (industryFilter !== 'ALL') params.industry = industryFilter;
      if (qualityFilter !== 'ALL') params.leadQuality = qualityFilter;
      if (websiteFilter !== 'ALL') params.websiteStatus = websiteFilter;
      if (minRatingFilter !== 'ALL') params.minRating = minRatingFilter;
      if (dateAddedFilter !== 'ALL') params.dateAdded = dateAddedFilter;
      if (hasPhoneOnly) params.hasPhone = 'true';
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (sortField) {
        params.sortBy = sortField;
        params.sortOrder = sortOrder;
      }

      const [leadsRes, pipelineRes] = await Promise.all([
        api.leads.list(params),
        api.leads.getPipeline(),
      ]);

      setLeads(leadsRes.leads || []);
      setPipelineData(pipelineRes.pipeline || {});
      if (pipelineRes.stages) setStages(pipelineRes.stages);

      // If initialLeadId provided, select lead
      if (initialLeadId && !selectedLead) {
        api.leads.get(initialLeadId).then(lRes => setSelectedLead(lRes.lead)).catch(() => {});
      }
    } catch (err) {
      showToast('Failed to fetch CRM data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMData();
  }, [
    statusFilter,
    assignedFilter,
    industryFilter,
    qualityFilter,
    websiteFilter,
    minRatingFilter,
    dateAddedFilter,
    hasPhoneOnly,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCRMData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    api.users.list().then(res => setUsersList(res.users || [])).catch(() => {});
    fetchFacets();
  }, []);

  // Quick preset chips handler with toggle / deselect support
  const handleTogglePreset = (presetKey: string) => {
    if (presetKey === 'hot') {
      setQualityFilter(prev => (prev === 'HOT' ? 'ALL' : 'HOT'));
    } else if (presetKey === 'warm') {
      setQualityFilter(prev => (prev === 'WARM' ? 'ALL' : 'WARM'));
    } else if (presetKey === 'my_leads') {
      if (user?.id) {
        setAssignedFilter(prev => (prev === user.id ? 'ALL' : user.id));
      }
    } else if (presetKey === 'unassigned') {
      setAssignedFilter(prev => (prev === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED'));
    } else if (presetKey === 'today') {
      setDateAddedFilter(prev => (prev === 'today' ? 'ALL' : 'today'));
    } else if (presetKey === 'high_rating') {
      setMinRatingFilter(prev => (prev === '4.5' ? 'ALL' : '4.5'));
    } else if (presetKey === 'has_phone') {
      setHasPhoneOnly(prev => !prev);
    } else if (presetKey === 'all') {
      handleResetFilters();
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setAssignedFilter('ALL');
    setIndustryFilter('ALL');
    setQualityFilter('ALL');
    setWebsiteFilter('ALL');
    setMinRatingFilter('ALL');
    setDateAddedFilter('ALL');
    setHasPhoneOnly(false);
    setSortField(null);
    setSortOrder('desc');
  };

  // Toggle sorting on column click with 3-state cycle: DESC -> ASC -> NONE (Deselected)
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        // Deselect sort arrangement on third click
        setSortField(null);
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      // Default to ascending for names/stages, descending for scores/ratings/dates
      if (field === 'businessName' || field === 'industry' || field === 'crmStatus') {
        setSortOrder('asc');
      } else {
        setSortOrder('desc');
      }
    }
  };

  // Helper to render sortable column header
  const renderSortableHeader = (label: string, field: string, className?: string) => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-4 py-3 cursor-pointer select-none hover:bg-zinc-800/80 transition-colors group ${className || ''}`}
        title={`Click to sort by ${label} (Cycle: Descending → Ascending → Deselect)`}
      >
        <div className="flex items-center gap-1.5">
          <span className={isSorted ? 'text-sky-400 font-bold' : 'text-zinc-400 group-hover:text-zinc-200'}>
            {label}
          </span>
          <span className="shrink-0">
            {isSorted ? (
              sortOrder === 'asc' ? (
                <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Friendly names for sort fields
  const sortFieldLabels: Record<string, string> = {
    businessName: 'Business Name',
    leadScore: 'Lead Score',
    rating: 'Star Rating',
    crmStatus: 'CRM Stage',
    createdAt: 'Date Added',
    industry: 'Industry',
  };

  // Active filters count
  const isAnyFilterOrSortActive =
    statusFilter !== 'ALL' ||
    assignedFilter !== 'ALL' ||
    industryFilter !== 'ALL' ||
    qualityFilter !== 'ALL' ||
    websiteFilter !== 'ALL' ||
    minRatingFilter !== 'ALL' ||
    dateAddedFilter !== 'ALL' ||
    hasPhoneOnly ||
    searchQuery.trim().length > 0 ||
    sortField !== null;

  const handleOpenLead = async (lead: Lead) => {
    try {
      const res = await api.leads.get(lead.id);
      setSelectedLead(res.lead);
      if (res.lead.nextFollowUpDate) {
        setNextFollowUpDate(res.lead.nextFollowUpDate.split('T')[0]);
      } else {
        setNextFollowUpDate('');
      }
      setFollowUpType(res.lead.followUpType || 'Call');
    } catch (err) {
      setSelectedLead(lead);
    }
  };

  const handleUpdateStage = async (leadId: string, newStage: string) => {
    try {
      await api.leads.update(leadId, { crmStatus: newStage });
      showToast(`Lead moved to ${newStage.replace('_', ' ')}`, 'success');
      fetchCRMData();
      fetchFacets();
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => (prev ? { ...prev, crmStatus: newStage as any } : null));
      }
    } catch (err) {
      showToast('Failed to update lead stage', 'error');
    }
  };

  const handleReassignLead = async (leadId: string, newAssigneeId: string) => {
    try {
      const updated = await api.leads.update(leadId, {
        assignedUserId: newAssigneeId === 'UNASSIGNED' ? null : newAssigneeId,
      });
      showToast('Assigned sales rep updated', 'success');
      fetchCRMData();
      fetchFacets();
      if (selectedLead?.id === leadId) {
        setSelectedLead(updated.lead);
      }
    } catch (err) {
      showToast('Failed to reassign lead', 'error');
    }
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !nextFollowUpDate) return;
    try {
      const res = await api.leads.update(selectedLead.id, {
        nextFollowUpDate: new Date(nextFollowUpDate).toISOString(),
        followUpType,
      });
      setSelectedLead(res.lead);
      showToast('Follow-up scheduled and task reminder synced', 'success');
      fetchCRMData();
    } catch (err) {
      showToast('Failed to schedule follow-up', 'error');
    }
  };

  const handleLogCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !commContent.trim()) return;
    try {
      await api.clients.addCommunication(selectedLead.id, {
        type: commType,
        content: commContent.trim(),
      });
      const updated = await api.leads.get(selectedLead.id);
      setSelectedLead(updated.lead);
      setCommContent('');
      showToast('Communication logged to activity timeline', 'success');
    } catch (err) {
      showToast('Failed to log communication', 'error');
    }
  };

  // Convert to Client Modal state
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertManagerId, setConvertManagerId] = useState('');
  const [convertIndustry, setConvertIndustry] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  const openConvertModal = (lead: Lead) => {
    setConvertIndustry(lead.industry || lead.category || '');
    setConvertManagerId(lead.assignedUserId || user?.id || '');
    setIsConvertModalOpen(true);
  };

  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      setIsConverting(true);
      const res = await api.leads.convert(selectedLead.id, {
        industry: convertIndustry.trim() || undefined,
        accountManagerId: convertManagerId === 'UNASSIGNED' ? undefined : (convertManagerId || undefined),
      });
      showToast(`${selectedLead.businessName} converted to Client!`, 'success');
      setIsConvertModalOpen(false);
      setSelectedLead(null);
      fetchCRMData();
      fetchFacets();
      onNavigate(`/clients/${res.client.id}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to convert lead', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-sky-400" /> CRM & Lead Pipeline
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Prospecting, sales pipeline, follow-ups, and lead conversion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => {
                setViewMode('list');
                onNavigate('/crm/leads');
              }}
              className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => {
                setViewMode('pipeline');
                onNavigate('/crm/pipeline');
              }}
              className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'pipeline'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            icon={<UploadCloud className="w-3.5 h-3.5 text-emerald-400" />}
            className="flex-1 sm:flex-initial justify-center"
          >
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const event = new CustomEvent('open-quick-action', { detail: { type: 'lead' } });
              window.dispatchEvent(event);
            }}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="flex-1 sm:flex-initial justify-center"
          >
            New Lead
          </Button>
        </div>
      </div>

      {/* FILTER & DISCOVERY HUB */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/80 p-3.5 space-y-3 shadow-xs">
        {/* Row 1: Search & Primary Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search business name, industry, phone, email, notes, locality..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 bg-zinc-850 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Industry Filter Dropdown */}
          <div className="min-w-[150px]">
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-850 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="ALL">🏢 All Industries ({facets.industries.length})</option>
              {facets.industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* CRM Pipeline Stage Dropdown */}
          <div className="min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-850 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="ALL">📊 All Stages</option>
              {stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Sales Rep Dropdown */}
          <div className="min-w-[150px]">
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-850 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="ALL">👥 All Sales Reps</option>
              <option value="UNASSIGNED">⚪ Unassigned ({facets.unassignedCount || 0})</option>
              {user && <option value={user.id}>👤 Assigned to Me ({user.name})</option>}
              {usersList
                .filter((u) => u.id !== user?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
            </select>
          </div>

          {/* Toggle More Filters Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              showAdvancedFilters || isAnyFilterOrSortActive
                ? 'bg-zinc-800 text-sky-400 border-sky-900/60'
                : 'bg-zinc-850 text-zinc-400 border-zinc-750 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>More Filters</span>
          </button>
        </div>

        {/* Row 2: Quick Preset Chips with Toggle / Deselect */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
          <span className="text-[11px] text-zinc-500 font-medium shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Presets:
          </span>

          <button
            type="button"
            onClick={() => handleTogglePreset('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
              !isAnyFilterOrSortActive
                ? 'bg-zinc-200 text-zinc-900 font-semibold shadow-xs'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'
            }`}
          >
            All Leads ({leads.length})
          </button>

          <button
            type="button"
            onClick={() => handleTogglePreset('hot')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              qualityFilter === 'HOT'
                ? 'bg-amber-500 text-zinc-950 font-bold ring-2 ring-amber-400/50'
                : 'bg-zinc-800 text-amber-400 hover:bg-zinc-750'
            }`}
            title="Click to toggle / deselect"
          >
            <Flame className="w-3 h-3" />
            <span>🔥 Hot Leads ({facets.hotCount || 0})</span>
            {qualityFilter === 'HOT' && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
          </button>

          <button
            type="button"
            onClick={() => handleTogglePreset('warm')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              qualityFilter === 'WARM'
                ? 'bg-blue-500 text-zinc-950 font-bold ring-2 ring-blue-400/50'
                : 'bg-zinc-800 text-blue-400 hover:bg-zinc-750'
            }`}
            title="Click to toggle / deselect"
          >
            <Zap className="w-3 h-3" />
            <span>⚡ Warm Leads ({facets.warmCount || 0})</span>
            {qualityFilter === 'WARM' && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
          </button>

          {user && (
            <button
              type="button"
              onClick={() => handleTogglePreset('my_leads')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                assignedFilter === user.id
                  ? 'bg-sky-500 text-zinc-950 font-bold ring-2 ring-sky-400/50'
                  : 'bg-zinc-800 text-sky-400 hover:bg-zinc-750'
              }`}
              title="Click to toggle / deselect"
            >
              <UserCheck className="w-3 h-3" />
              <span>👤 My Leads</span>
              {assignedFilter === user.id && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTogglePreset('today')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              dateAddedFilter === 'today'
                ? 'bg-emerald-500 text-zinc-950 font-bold ring-2 ring-emerald-400/50'
                : 'bg-zinc-800 text-emerald-300 hover:bg-zinc-750'
            }`}
            title="Click to toggle / deselect"
          >
            <Clock className="w-3 h-3" />
            <span>📅 Added Today</span>
            {dateAddedFilter === 'today' && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
          </button>

          <button
            type="button"
            onClick={() => handleTogglePreset('unassigned')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              assignedFilter === 'UNASSIGNED'
                ? 'bg-zinc-200 text-zinc-900 font-bold ring-2 ring-zinc-400/50'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
            }`}
            title="Click to toggle / deselect"
          >
            <span>⚪ Unassigned ({facets.unassignedCount || 0})</span>
            {assignedFilter === 'UNASSIGNED' && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
          </button>

          <button
            type="button"
            onClick={() => handleTogglePreset('high_rating')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              minRatingFilter === '4.5'
                ? 'bg-amber-400 text-zinc-950 font-bold ring-2 ring-amber-300/50'
                : 'bg-zinc-800 text-amber-300 hover:bg-zinc-750'
            }`}
            title="Click to toggle / deselect"
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>Top Rated 4.5+ ★</span>
            {minRatingFilter === '4.5' && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
          </button>

          <button
            type="button"
            onClick={() => handleTogglePreset('has_phone')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              hasPhoneOnly
                ? 'bg-emerald-500 text-zinc-950 font-bold ring-2 ring-emerald-400/50'
                : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-750'
            }`}
            title="Click to toggle / deselect"
          >
            <Phone className="w-3 h-3" />
            <span>Has Phone</span>
            {hasPhoneOnly && <X className="w-3 h-3 ml-0.5 opacity-75 hover:opacity-100" />}
          </button>

          {isAnyFilterOrSortActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0 flex items-center gap-1 ml-auto"
              title="Reset all filters and arrangement to default"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          )}
        </div>

        {/* Row 3: Advanced Collapsible Filters */}
        {showAdvancedFilters && (
          <div className="pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Date Added Filter */}
            <div>
              <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                Date Added to System
              </label>
              <select
                value={dateAddedFilter}
                onChange={(e) => setDateAddedFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
              >
                <option value="ALL">All Time</option>
                <option value="today">Today</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
              </select>
            </div>

            {/* Lead Quality / Score Range */}
            <div>
              <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                Lead Score / Quality
              </label>
              <select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
              >
                <option value="ALL">All Scores</option>
                <option value="HOT">🔥 HOT (80 - 100)</option>
                <option value="WARM">⚡ WARM (50 - 79)</option>
                <option value="COLD">❄️ COLD (0 - 49)</option>
              </select>
            </div>

            {/* Minimum Star Rating */}
            <div>
              <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                Minimum Rating
              </label>
              <select
                value={minRatingFilter}
                onChange={(e) => setMinRatingFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
              >
                <option value="ALL">All Ratings</option>
                <option value="4.8">⭐⭐⭐⭐⭐ 4.8+ Stars</option>
                <option value="4.5">⭐⭐⭐⭐ 4.5+ Stars</option>
                <option value="4.0">⭐⭐⭐⭐ 4.0+ Stars</option>
                <option value="3.5">⭐⭐⭐ 3.5+ Stars</option>
              </select>
            </div>

            {/* Website Status */}
            <div>
              <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1">
                Website Presence
              </label>
              <select
                value={websiteFilter}
                onChange={(e) => setWebsiteFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
              >
                <option value="ALL">All Website Statuses</option>
                <option value="No Website">❌ No Website (Opportunity)</option>
                <option value="Instagram">📸 Social / Instagram</option>
                <option value="Has Website">🌐 Has Website</option>
              </select>
            </div>
          </div>
        )}

        {/* Row 4: Active Filter Tags Ribbon (Deselect Any Filter Individually) */}
        {isAnyFilterOrSortActive && (
          <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-zinc-500 font-medium mr-1">Active Filters:</span>

            {/* Dismissible Sort Arrangement */}
            {sortField && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800/80 font-medium">
                <ArrowDownUp className="w-3 h-3 text-sky-400" />
                <span>
                  Sorted by: <strong>{sortFieldLabels[sortField] || sortField}</strong> ({sortOrder.toUpperCase()})
                </span>
                <button
                  type="button"
                  onClick={() => setSortField(null)}
                  className="p-0.5 hover:bg-sky-900 rounded cursor-pointer text-sky-300 hover:text-white ml-0.5"
                  title="Deselect sorting arrangement"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Search tag */}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>Search: "{searchQuery.trim()}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Remove search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Industry tag */}
            {industryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>Industry: {industryFilter}</span>
                <button
                  type="button"
                  onClick={() => setIndustryFilter('ALL')}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Deselect industry"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Stage tag */}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>Stage: {statusFilter}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Deselect stage"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Rep tag */}
            {assignedFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>
                  Rep: {assignedFilter === 'UNASSIGNED' ? 'Unassigned' : usersList.find(u => u.id === assignedFilter)?.name || 'Selected Rep'}
                </span>
                <button
                  type="button"
                  onClick={() => setAssignedFilter('ALL')}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Deselect rep filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Quality Score tag */}
            {qualityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-900/60">
                <span>Score: {qualityFilter}</span>
                <button
                  type="button"
                  onClick={() => setQualityFilter('ALL')}
                  className="p-0.5 hover:bg-amber-900 rounded cursor-pointer text-amber-300 hover:text-white"
                  title="Deselect score filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Rating tag */}
            {minRatingFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>Rating: {minRatingFilter}+ ★</span>
                <button
                  type="button"
                  onClick={() => setMinRatingFilter('ALL')}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Deselect rating filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Date Added tag */}
            {dateAddedFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-900/60">
                <span>Date: {dateAddedFilter === 'today' ? 'Today' : dateAddedFilter}</span>
                <button
                  type="button"
                  onClick={() => setDateAddedFilter('ALL')}
                  className="p-0.5 hover:bg-emerald-900 rounded cursor-pointer text-emerald-300 hover:text-white"
                  title="Deselect date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Phone Only tag */}
            {hasPhoneOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>Has Phone Only</span>
                <button
                  type="button"
                  onClick={() => setHasPhoneOnly(false)}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Deselect phone filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Website Status tag */}
            {websiteFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                <span>Website: {websiteFilter}</span>
                <button
                  type="button"
                  onClick={() => setWebsiteFilter('ALL')}
                  className="p-0.5 hover:bg-zinc-700 rounded cursor-pointer text-zinc-400 hover:text-zinc-100"
                  title="Deselect website filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Clear All Link */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* CONTENT: PIPELINE KANBAN VIEW OR LIST VIEW */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : viewMode === 'pipeline' ? (
        /* KANBAN BOARD */
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 min-h-[500px] no-scrollbar touch-pan-x snap-x snap-mandatory">
          {stages.map((stage) => {
            const stageLeads = pipelineData[stage] || [];
            return (
              <div
                key={stage}
                className="w-[82vw] sm:w-72 shrink-0 bg-zinc-900/40 border border-zinc-850 rounded-xl p-3 flex flex-col gap-3 snap-center"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{stage}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-400 font-mono">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Stage Lead Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[650px] pr-1">
                  {stageLeads.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-zinc-600 italic">
                      No leads in {stage.toLowerCase()}
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => handleOpenLead(lead)}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 rounded-lg shadow-xs transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-sky-400 transition-colors leading-snug">
                            {lead.businessName}
                          </h4>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 font-medium ${
                              lead.leadScore >= 80
                                ? 'bg-amber-950 text-amber-300 border border-amber-900/60'
                                : lead.leadScore >= 50
                                ? 'bg-blue-950 text-blue-300 border border-blue-900/60'
                                : 'bg-zinc-850 text-zinc-400'
                            }`}
                          >
                            ★ {lead.leadScore}
                          </span>
                        </div>

                        {lead.industry && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/60 text-sky-400 border border-sky-900/40 inline-block">
                            {lead.industry}
                          </span>
                        )}

                        {lead.category && lead.category !== lead.industry && (
                          <p className="text-[11px] text-zinc-400 truncate">{lead.category}</p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-850">
                          <span>{lead.assignedUser?.name || '⚪ Unassigned'}</span>
                          {lead.rating && (
                            <span className="flex items-center gap-0.5 text-amber-400 font-mono">
                              <Star className="w-2.5 h-2.5 fill-amber-400" />
                              {lead.rating} ({lead.totalReviews || 0})
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden shadow-xs">
          {leads.length === 0 ? (
            <EmptyState
              icon={<Target className="w-5 h-5" />}
              title="No CRM leads found matching filters"
              description="Try adjusting your filters or upload new Excel lead spreadsheets."
              actionLabel="Reset Filters"
              onAction={handleResetFilters}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    {renderSortableHeader('Business & Industry', 'businessName')}
                    <th className="px-4 py-3">Phone Number</th>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3">Website Status</th>
                    {renderSortableHeader('Rating & Reviews', 'rating')}
                    <th className="px-4 py-3">Web & Maps</th>
                    {renderSortableHeader('Lead Score', 'leadScore')}
                    {renderSortableHeader('CRM Stage', 'crmStatus')}
                    {renderSortableHeader('Date Added', 'createdAt')}
                    <th className="px-4 py-3">Assigned Rep</th>
                    <th className="px-4 py-3">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => handleOpenLead(lead)}
                      className="hover:bg-zinc-850/40 transition-colors cursor-pointer group"
                    >
                      {/* Business & Industry */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 group-hover:text-sky-400 transition-colors">
                            {lead.businessName}
                          </span>
                          {lead.industry && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-900/50 font-medium shrink-0">
                              {lead.industry}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-xs">
                          {lead.category || 'General Prospect'}
                        </div>
                        {lead.address && (
                          <div className="text-[10px] text-zinc-500 truncate max-w-xs mt-0.5 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{lead.address}</span>
                          </div>
                        )}
                      </td>

                      {/* Phone Number */}
                      <td className="px-4 py-3 text-zinc-300">
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-mono text-zinc-200 hover:text-sky-400 flex items-center gap-1.5"
                          >
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{lead.phone}</span>
                          </a>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">Not Listed</span>
                        )}
                      </td>

                      {/* Email Address */}
                      <td className="px-4 py-3">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-sky-400 hover:underline flex items-center gap-1.5 font-mono truncate max-w-[190px]"
                          >
                            <Mail className="w-3 h-3 shrink-0 text-sky-400/80" />
                            <span className="truncate">{lead.email}</span>
                          </a>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">Not Listed</span>
                        )}
                      </td>

                      {/* Website Status */}
                      <td className="px-4 py-3">
                        {lead.websiteStatus ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium inline-block border ${
                              lead.websiteStatus.toLowerCase().includes('no website') ||
                              lead.websiteStatus.toLowerCase().includes('not listed') ||
                              lead.websiteStatus.toLowerCase().includes('none')
                                ? 'bg-rose-950/40 text-rose-400 border-rose-900/50'
                                : lead.websiteStatus.toLowerCase().includes('instagram') ||
                                  lead.websiteStatus.toLowerCase().includes('social')
                                ? 'bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-900/50'
                                : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50'
                            }`}
                          >
                            {lead.websiteStatus}
                          </span>
                        ) : lead.websiteUrl ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium inline-block bg-emerald-950/40 text-emerald-300 border border-emerald-900/50">
                            Has Website
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Rating & Reviews */}
                      <td className="px-4 py-3">
                        {lead.rating ? (
                          <div className="flex items-center gap-1.5 text-amber-400 font-mono">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                            <span className="font-semibold">{lead.rating}</span>
                            <span className="text-zinc-500 text-[10px]">({lead.totalReviews || 0})</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Web & Maps Links */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {lead.googleMapsUrl && (
                            <a
                              href={sanitizeExternalUrl(lead.googleMapsUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/50 rounded text-[10px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <MapPin className="w-2.5 h-2.5" /> Maps
                            </a>
                          )}
                          {lead.websiteUrl && (
                            <a
                              href={sanitizeExternalUrl(lead.websiteUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-0.5 bg-sky-950/60 hover:bg-sky-900/60 text-sky-400 border border-sky-900/50 rounded text-[10px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <Globe className="w-2.5 h-2.5" /> Site
                            </a>
                          )}
                          {!lead.googleMapsUrl && !lead.websiteUrl && (
                            <span className="text-zinc-600 text-[10px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Lead Score */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border inline-block ${
                            lead.leadScore >= 80
                              ? 'bg-amber-950/60 text-amber-300 border-amber-900/60'
                              : lead.leadScore >= 50
                              ? 'bg-blue-950/60 text-blue-300 border-blue-900/60'
                              : 'bg-zinc-850 text-zinc-400 border-zinc-750'
                          }`}
                        >
                          {lead.leadScore >= 80 ? '🔥 ' : lead.leadScore >= 50 ? '⚡ ' : '❄️ '}
                          {lead.leadScore}
                        </span>
                      </td>

                      {/* CRM Stage */}
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.crmStatus} size="xs" />
                      </td>

                      {/* Date Added */}
                      <td className="px-4 py-3 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                        {lead.createdAt ? (
                          <span title={format(new Date(lead.createdAt), 'yyyy-MM-dd HH:mm:ss')}>
                            {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Assigned Rep */}
                      <td className="px-4 py-3 text-zinc-300">
                        {lead.assignedUser ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-semibold flex items-center justify-center text-zinc-300">
                              {lead.assignedUser.name.charAt(0)}
                            </span>
                            <span className="truncate">{lead.assignedUser.name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic text-[11px]">⚪ Unassigned</span>
                        )}
                      </td>

                      {/* Next Action */}
                      <td className="px-4 py-3">
                        {lead.nextFollowUpDate ? (
                          <span className="text-[11px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
                            {lead.followUpType || 'Call'}: {format(new Date(lead.nextFollowUpDate), 'dd MMM')}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[11px]">None set</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LEAD DETAIL SLIDE-OVER DRAWER */}
      <Drawer
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.businessName || 'Lead Profile'}
        subtitle={`CRM Stage: ${selectedLead?.crmStatus} • Score: ${selectedLead?.leadScore || 50}`}
        width="xl"
      >
        {selectedLead && (
          <div className="space-y-6 text-xs">
            {/* Header Stage Switcher, Reassign & Convert to Client */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-850/60 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400">Stage:</span>
                  <select
                    value={selectedLead.crmStatus}
                    onChange={(e) => handleUpdateStage(selectedLead.id, e.target.value)}
                    className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium cursor-pointer"
                  >
                    {stages.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400">Rep:</span>
                  <select
                    value={selectedLead.assignedUserId || 'UNASSIGNED'}
                    onChange={(e) => handleReassignLead(selectedLead.id, e.target.value)}
                    className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium cursor-pointer"
                  >
                    <option value="UNASSIGNED">⚪ Unassigned</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedLead.convertedClientId && selectedLead.crmStatus !== 'WON' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openConvertModal(selectedLead)}
                  icon={<Building2 className="w-3.5 h-3.5" />}
                >
                  Convert to Client
                </Button>
              ) : (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-900/50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Converted Client
                </span>
              )}
            </div>

            {/* Profile Overview Details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-850">
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Industry</span>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-900/50 font-medium inline-block">
                  {selectedLead.industry || 'General Industry'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Category</span>
                <p className="text-zinc-200">{selectedLead.category || 'General'}</p>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Phone Number</span>
                {selectedLead.phone ? (
                  <a href={`tel:${selectedLead.phone}`} className="text-zinc-200 font-mono text-xs hover:text-sky-400">
                    {selectedLead.phone}
                  </a>
                ) : (
                  <p className="text-zinc-500">Not listed</p>
                )}
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Email Address</span>
                {selectedLead.email ? (
                  <a href={`mailto:${selectedLead.email}`} className="text-zinc-200 hover:text-sky-400">
                    {selectedLead.email}
                  </a>
                ) : (
                  <p className="text-zinc-500">Not listed</p>
                )}
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Rating & Reviews</span>
                {selectedLead.rating ? (
                  <p className="text-amber-400 font-mono flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{selectedLead.rating}</span>
                    <span className="text-zinc-500 text-[10px]">({selectedLead.totalReviews || 0} reviews)</span>
                  </p>
                ) : (
                  <p className="text-zinc-500">—</p>
                )}
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Website</span>
                {selectedLead.websiteUrl ? (
                  <a
                    href={sanitizeExternalUrl(selectedLead.websiteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline flex items-center gap-1"
                  >
                    Open Website <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-zinc-500">{selectedLead.websiteStatus || 'No website'}</span>
                )}
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Date Added</span>
                <p className="text-zinc-200 font-mono">
                  {selectedLead.createdAt
                    ? format(new Date(selectedLead.createdAt), 'dd MMM yyyy, HH:mm')
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5 font-medium">Lead Quality Score</span>
                <p className="text-zinc-200 font-mono font-bold">
                  {selectedLead.leadScore >= 80 ? '🔥 Hot ' : selectedLead.leadScore >= 50 ? '⚡ Warm ' : '❄️ Cold '}
                  ({selectedLead.leadScore}/100)
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500 block mb-0.5 font-medium">Locality / Address</span>
                <p className="text-zinc-200 leading-relaxed">{selectedLead.address || 'Address not listed'}</p>
                {selectedLead.googleMapsUrl && (
                  <a
                    href={sanitizeExternalUrl(selectedLead.googleMapsUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/50 font-medium text-xs transition-colors"
                  >
                    <MapPin className="w-3 h-3" /> View Location on Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* Next Follow-Up Scheduler */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-3">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Schedule Next Follow-up
              </label>

              <form onSubmit={handleScheduleFollowUp} className="flex gap-2">
                <select
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value)}
                  className="px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                >
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>

                <input
                  type="date"
                  required
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                />

                <Button variant="secondary" size="sm" type="submit">
                  Save Follow-up
                </Button>
              </form>
            </div>

            {/* Communications & Activity History */}
            <div className="space-y-3 pt-2">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" /> Communications History
              </label>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedLead.communications && selectedLead.communications.length > 0 ? (
                  selectedLead.communications.map((c) => (
                    <div key={c.id} className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-850 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-200">
                          [{c.type}] {c.subject || 'Note'}
                        </span>
                        <span className="text-zinc-500 font-mono text-[10px]">
                          {format(new Date(c.occurredAt), 'dd MMM HH:mm')}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-snug">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-[11px] italic">No communication history logged yet.</p>
                )}
              </div>

              {/* Log Communication Form */}
              <form onSubmit={handleLogCommunication} className="flex gap-2">
                <select
                  value={commType}
                  onChange={(e) => setCommType(e.target.value)}
                  className="px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                >
                  <option value="CALL">Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="NOTE">Note</option>
                </select>

                <input
                  type="text"
                  placeholder="Record summary of call or conversation..."
                  value={commContent}
                  onChange={(e) => setCommContent(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />

                <Button variant="primary" size="sm" type="submit">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </Drawer>

      {/* Excel Lead Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          fetchCRMData();
          fetchFacets();
        }}
      />

      {/* Convert to Client Confirmation & Assignment Modal */}
      {selectedLead && (
        <Modal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          title={`Convert "${selectedLead.businessName}" to Active Client`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmConvert} className="space-y-4 text-xs">
            <p className="text-zinc-400 leading-relaxed">
              Converting this lead will mark it as <strong className="text-emerald-400 font-semibold">WON</strong> and create an active Client workspace for contracts, tasks, timeline, and account management.
            </p>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Industry / Category</label>
              <input
                type="text"
                placeholder="e.g. Dental Clinic"
                value={convertIndustry}
                onChange={(e) => setConvertIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Assigned Account Manager *</label>
              <select
                value={convertManagerId}
                onChange={(e) => setConvertManagerId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Myself ({user?.name})</option>
                <option value="UNASSIGNED">⚪ Leave Unassigned</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsConvertModalOpen(false)} disabled={isConverting}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isConverting} icon={<Building2 className="w-3.5 h-3.5" />}>
                Confirm & Open Client Workspace
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
