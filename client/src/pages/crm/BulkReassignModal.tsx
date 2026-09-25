import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Modal } from '../../components/common/Modal.js';
import { Button } from '../../components/common/Button.js';
import { User } from '../../types/index.js';
import { getStageLabel } from './CRMPage.js';
import { Users, ArrowRight, UserCheck, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface BulkReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  usersList: User[];
  stages: string[];
  selectedLeadIds: string[];
  initialSourceRepId?: string;
}

export const BulkReassignModal: React.FC<BulkReassignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  usersList,
  stages,
  selectedLeadIds,
  initialSourceRepId,
}) => {
  const { showToast } = useNotification();

  const [mode, setMode] = useState<'selected' | 'transfer_all'>(
    selectedLeadIds.length > 0 ? 'selected' : 'transfer_all'
  );

  // Selected leads mode target
  const [selectedTargetRepId, setSelectedTargetRepId] = useState<string>('UNASSIGNED');

  // Transfer all mode parameters
  const [sourceRepId, setSourceRepId] = useState<string>('UNASSIGNED');
  const [transferTargetRepId, setTransferTargetRepId] = useState<string>('UNASSIGNED');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (selectedLeadIds.length > 0) {
        setMode('selected');
      } else {
        setMode('transfer_all');
      }

      if (initialSourceRepId && initialSourceRepId !== 'ALL') {
        setSourceRepId(initialSourceRepId);
      } else {
        setSourceRepId('UNASSIGNED');
      }

      if (usersList.length > 0) {
        setSelectedTargetRepId(usersList[0].id);
        const nextUser = usersList.find(u => u.id !== initialSourceRepId) || usersList[0];
        setTransferTargetRepId(nextUser.id);
      }
    }
  }, [isOpen, selectedLeadIds.length, initialSourceRepId, usersList]);

  // Fetch count preview for Transfer All mode
  useEffect(() => {
    if (!isOpen || mode !== 'transfer_all') return;

    let isMounted = true;
    setIsLoadingPreview(true);

    const params: Record<string, string> = {};
    if (sourceRepId !== 'ALL') {
      params.assignedUserId = sourceRepId;
    }
    if (stageFilter !== 'ALL') {
      params.crmStatus = stageFilter;
    }

    api.leads.list(params)
      .then((res) => {
        if (isMounted) {
          setPreviewCount(res.leads?.length ?? 0);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPreviewCount(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, sourceRepId, stageFilter]);

  const handleSelectedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLeadIds.length === 0) {
      showToast('No leads selected', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const targetUserId = selectedTargetRepId === 'UNASSIGNED' ? null : selectedTargetRepId;
      const res = await api.leads.bulkReassign({
        leadIds: selectedLeadIds,
        targetUserId,
      });

      showToast(res.message || `Successfully reassigned ${res.count} leads.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to reassign leads.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferAllSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sourceRepId === transferTargetRepId) {
      showToast('Source and destination sales rep must be different.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const targetUserId = transferTargetRepId === 'UNASSIGNED' ? null : transferTargetRepId;
      const res = await api.leads.bulkReassign({
        fromUserId: sourceRepId,
        crmStatus: stageFilter,
        targetUserId,
      });

      showToast(res.message || `Successfully transferred ${res.count} leads.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to transfer leads.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSourceRepName = (id: string) => {
    if (id === 'UNASSIGNED') return 'Unassigned Leads';
    if (id === 'ALL') return 'All Leads (Any Rep)';
    const found = usersList.find((u) => u.id === id);
    return found ? `${found.name} (${found.role})` : 'Selected Rep';
  };

  const getTargetRepName = (id: string) => {
    if (id === 'UNASSIGNED') return 'Unassigned Pool';
    const found = usersList.find((u) => u.id === id);
    return found ? `${found.name} (${found.role})` : 'Selected Rep';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reassign Sales Rep for Leads"
      subtitle="Reassign selected leads or transfer all leads from one sales rep to another."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Tab Selection */}
        <div className="flex bg-zinc-850 p-1 rounded-lg border border-zinc-750 text-xs">
          <button
            type="button"
            onClick={() => setMode('selected')}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'selected'
                ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Reassign Selected ({selectedLeadIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('transfer_all')}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'transfer_all'
                ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Transfer by Sales Rep</span>
          </button>
        </div>

        {mode === 'selected' ? (
          /* MODE 1: REASSIGN SELECTED LEADS */
          <form onSubmit={handleSelectedSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-zinc-850/70 rounded-lg border border-zinc-750 space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-200 font-medium">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>
                  {selectedLeadIds.length} lead{selectedLeadIds.length === 1 ? '' : 's'} selected for reassignment
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Choose the sales representative who will take ownership of these selected leads.
              </p>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Assign Selected Leads To *
              </label>
              <select
                value={selectedTargetRepId}
                onChange={(e) => setSelectedTargetRepId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="UNASSIGNED">⚪ Unassigned (Remove Assigned Rep)</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmitting}
                disabled={selectedLeadIds.length === 0}
                icon={<UserCheck className="w-3.5 h-3.5" />}
              >
                Reassign {selectedLeadIds.length} Leads
              </Button>
            </div>
          </form>
        ) : (
          /* MODE 2: TRANSFER ALL LEADS OF A PARTICULAR REP */
          <form onSubmit={handleTransferAllSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-zinc-850/70 rounded-lg border border-zinc-750 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Transfer Rule</span>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {isLoadingPreview ? (
                    'Calculating...'
                  ) : previewCount !== null ? (
                    `${previewCount} matching leads`
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Move all leads currently assigned to one rep over to another rep in bulk.
              </p>
            </div>

            {/* Source Rep */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                1. Transfer Leads From (Current Rep) *
              </label>
              <select
                value={sourceRepId}
                onChange={(e) => setSourceRepId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="UNASSIGNED">⚪ Unassigned Leads</option>
                <option value="ALL">🌐 All Leads (Regardless of Rep)</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Stage Filter */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                2. Pipeline Stage Filter (Optional)
              </label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="ALL">📊 All Stages</option>
                {stages.map((st) => (
                  <option key={st} value={st}>
                    {getStageLabel(st)}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Rep */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                3. Transfer To (New Assigned Rep) *
              </label>
              <select
                value={transferTargetRepId}
                onChange={(e) => setTransferTargetRepId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="UNASSIGNED">⚪ Unassigned (Remove Assigned Rep)</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary preview block */}
            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-[11px] text-zinc-300 flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Transferring from <strong>{getSourceRepName(sourceRepId)}</strong> to{' '}
                <strong>{getTargetRepName(transferTargetRepId)}</strong>
                {stageFilter !== 'ALL' && ` in stage ${stageFilter}`}.
              </span>
            </div>

            {sourceRepId === transferTargetRepId && (
              <div className="p-2 rounded bg-amber-950/30 border border-amber-900/50 text-[11px] text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Source and destination sales reps must be different.</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmitting}
                disabled={sourceRepId === transferTargetRepId || previewCount === 0}
                icon={<UserCheck className="w-3.5 h-3.5" />}
              >
                Transfer {previewCount !== null ? `${previewCount} Leads` : 'Leads'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
