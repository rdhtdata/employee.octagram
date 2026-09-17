import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Modal } from '../../components/common/Modal.js';
import { Button } from '../../components/common/Button.js';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Check,
  UserCheck,
  Building2,
  Tag,
  Star,
  MapPin
} from 'lucide-react';
import { User } from '../../types/index.js';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>('');

  // Preview Data
  const [summary, setSummary] = useState<any>(null);
  const [uniqueLeads, setUniqueLeads] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [duplicateResolutions, setDuplicateResolutions] = useState<Record<number, 'KEEP_BOTH' | 'MERGE' | 'SKIP'>>({});
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.users.list()
        .then((res) => setUsersList(res.users || []))
        .catch(() => {});
      if (user?.id) {
        setAssignedUserId(user.id);
      }
    }
  }, [isOpen, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
    }
  };

  const handlePreview = async () => {
    if (selectedFiles.length === 0) return;
    setIsLoading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file));

    try {
      const res = await api.leads.previewImport(formData);
      setSummary(res.summary);
      setUniqueLeads(res.uniqueLeads || []);
      setDuplicates(res.duplicates || []);
      setErrors(res.errors || []);

      // Default all duplicates to 'MERGE'
      const initialResolutions: Record<number, 'KEEP_BOTH' | 'MERGE' | 'SKIP'> = {};
      (res.duplicates || []).forEach((_: any, idx: number) => {
        initialResolutions[idx] = 'MERGE';
      });
      setDuplicateResolutions(initialResolutions);

      setStep('preview');
    } catch (err: any) {
      showToast(err.message || 'Failed to process files', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetAllResolutions = (res: 'KEEP_BOTH' | 'MERGE' | 'SKIP') => {
    const updated: Record<number, 'KEEP_BOTH' | 'MERGE' | 'SKIP'> = {};
    duplicates.forEach((_, idx) => {
      updated[idx] = res;
    });
    setDuplicateResolutions(updated);
  };

  const handleFinalImport = async () => {
    setIsLoading(true);
    setStep('importing');

    const resolvedDuplicates = duplicates.map((dup, idx) => ({
      incoming: dup.incoming,
      resolution: duplicateResolutions[idx] || 'MERGE',
      existingId: dup.existingId,
    }));

    try {
      const res = await api.leads.confirmImport({
        uniqueLeads,
        resolvedDuplicates,
        assignedUserId: assignedUserId || undefined,
      });

      setSummary(res.summary);
      setStep('complete');
      showToast(`Successfully imported ${res.summary?.imported || 0} leads`, 'success');
      onImportComplete();
    } catch (err: any) {
      showToast(err.message || 'Import failed', 'error');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setStep('upload');
    setSummary(null);
    setUniqueLeads([]);
    setDuplicates([]);
    setErrors([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Leads from Excel / CSV"
      subtitle="Upload one or multiple lead spreadsheets (supports standard Octagram lead format)"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs">
        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/50 rounded-xl p-8 text-center transition-colors">
              <UploadCloud className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-200">
                Drag and drop Excel files here, or browse
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Supports .xlsx, .xls, .csv with Business Name, Phone, Email, Rating, Maps URL, Score.
              </p>

              <label className="inline-block mt-4">
                <span className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs">
                  Choose Spreadsheets
                </span>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Selected Files ({selectedFiles.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-zinc-850 rounded-lg border border-zinc-750 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium text-zinc-200 truncate">{file.name}</span>
                      </div>
                      <span className="text-zinc-500 font-mono text-[10px]">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePreview}
                disabled={selectedFiles.length === 0}
                isLoading={isLoading}
              >
                Scan & Validate Leads
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & DUPLICATE RESOLUTION */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-850 text-center">
                <span className="text-[10px] text-zinc-500 block">TOTAL ROWS</span>
                <span className="text-base font-bold text-zinc-100">{summary?.totalRows || 0}</span>
              </div>
              <div className="p-3 bg-emerald-950/20 rounded-lg border border-emerald-900/40 text-center">
                <span className="text-[10px] text-emerald-400 block">NEW LEADS</span>
                <span className="text-base font-bold text-emerald-300">{uniqueLeads.length}</span>
              </div>
              <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-900/40 text-center">
                <span className="text-[10px] text-amber-400 block">DUPLICATES</span>
                <span className="text-base font-bold text-amber-300">{duplicates.length}</span>
              </div>
              <div className="p-3 bg-rose-950/20 rounded-lg border border-rose-900/40 text-center">
                <span className="text-[10px] text-rose-400 block">ERRORS</span>
                <span className="text-base font-bold text-rose-300">{errors.length}</span>
              </div>
            </div>

            {/* Assigned Sales Rep Selection */}
            <div className="p-3.5 bg-zinc-900/90 rounded-xl border border-zinc-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  <span>Assigned Sales Rep</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-900/60 font-medium">
                    Required
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Select which team member will own and handle these imported leads.
                </p>
              </div>

              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-650 rounded-lg text-xs text-zinc-100 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 shrink-0 cursor-pointer"
              >
                <option value="UNASSIGNED">⚪ Leave Unassigned (General Pool)</option>
                {user && (
                  <option value={user.id}>
                    👤 Default: {user.name} ({user.role}) [You]
                  </option>
                )}
                <optgroup label="Team Members">
                  {usersList
                    .filter((u) => u.id !== user?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) — {u.email}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Duplicates Resolution Section */}
            {duplicates.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="font-semibold text-xs text-zinc-200">
                      Duplicate Conflict Resolution ({duplicates.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllResolutions('MERGE')}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[10px] rounded cursor-pointer"
                    >
                      Merge All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllResolutions('KEEP_BOTH')}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[10px] rounded cursor-pointer"
                    >
                      Keep Both All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllResolutions('SKIP')}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[10px] rounded cursor-pointer"
                    >
                      Skip All
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {duplicates.map((dup, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-zinc-100 flex items-center gap-2">
                            <span>{dup.incoming.businessName}</span>
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1 rounded">
                              Matched via {dup.matchedBy}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Existing CRM match: <strong className="text-zinc-300">{dup.existingBusinessName}</strong> ({dup.existingPhone || dup.existingEmail || 'ID match'})
                          </p>
                        </div>

                        {/* Resolution selector */}
                        <select
                          value={duplicateResolutions[idx] || 'MERGE'}
                          onChange={(e) =>
                            setDuplicateResolutions({
                              ...duplicateResolutions,
                              [idx]: e.target.value as any,
                            })
                          }
                          className="px-2 py-1 bg-zinc-850 border border-zinc-750 rounded text-[11px] text-zinc-100 font-medium shrink-0"
                        >
                          <option value="MERGE">Merge missing info</option>
                          <option value="KEEP_BOTH">Keep both (Create copy)</option>
                          <option value="SKIP">Skip incoming lead</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Leads Preview */}
            {uniqueLeads.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid Leads Ready for Import ({uniqueLeads.length})</span>
                </div>
                <div className="max-h-44 overflow-y-auto border border-zinc-800 rounded-lg divide-y divide-zinc-850 bg-zinc-950/50">
                  {uniqueLeads.slice(0, 15).map((lead: any, idx: number) => (
                    <div key={idx} className="p-2.5 text-xs flex items-center justify-between gap-3 hover:bg-zinc-900/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200 truncate">{lead.businessName}</span>
                          {lead.industry && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-900/50 font-medium shrink-0">
                              {lead.industry}
                            </span>
                          )}
                          {lead.leadScore && (
                            <span className={`text-[10px] font-mono px-1 rounded shrink-0 ${
                              lead.leadScore >= 80
                                ? 'bg-amber-950 text-amber-300'
                                : lead.leadScore >= 50
                                ? 'bg-blue-950 text-blue-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              Score: {lead.leadScore}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {lead.category && <span>{lead.category}</span>}
                          {lead.phone && <span className="font-mono text-zinc-300">📞 {lead.phone}</span>}
                          {lead.rating && (
                            <span className="text-amber-400 flex items-center gap-0.5 font-mono">
                              ⭐ {lead.rating} ({lead.totalReviews || 0})
                            </span>
                          )}
                          {lead.googleMapsUrl && <span className="text-emerald-400 text-[10px]">📍 Maps</span>}
                          {lead.websiteUrl && <span className="text-sky-400 text-[10px]">🌐 Website</span>}
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400 shrink-0 font-mono">
                        Row {lead.rawRowIndex || idx + 1}
                      </span>
                    </div>
                  ))}
                  {uniqueLeads.length > 15 && (
                    <div className="p-2 text-center text-[11px] text-zinc-500 bg-zinc-900/30 font-medium">
                      + {uniqueLeads.length - 15} more leads will be imported
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Row Errors Breakdown (if any) */}
            {errors.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Invalid Rows / Skipped ({errors.length})</span>
                </div>
                <div className="max-h-28 overflow-y-auto border border-rose-900/30 rounded-lg divide-y divide-zinc-850 bg-rose-950/10">
                  {errors.slice(0, 10).map((err: any, idx: number) => (
                    <div key={idx} className="p-2 text-xs flex items-center justify-between text-rose-300">
                      <span>Row {err.row}: {err.reason}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{err.file}</span>
                    </div>
                  ))}
                  {errors.length > 10 && (
                    <div className="p-1.5 text-center text-[10px] text-zinc-500">
                      + {errors.length - 10} more rows
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Back to Upload
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinalImport}
                isLoading={isLoading}
              >
                Confirm & Import {uniqueLeads.length + duplicates.length} Leads
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: IMPORTING LOADER */}
        {step === 'importing' && (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 border-2 border-zinc-600 border-t-zinc-100 rounded-full animate-spin mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-100">Importing Leads...</h3>
            <p className="text-xs text-zinc-400">
              Validating, deduplicating, and synchronizing with CRM database.
            </p>
          </div>
        )}

        {/* STEP 4: COMPLETE */}
        {step === 'complete' && (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Import Complete!</h3>
              <p className="text-xs text-zinc-400 mt-1">
                {summary?.imported || 0} leads created, {summary?.merged || 0} merged, {summary?.skipped || 0} skipped.
              </p>
            </div>

            <div className="pt-2">
              <Button variant="primary" size="sm" onClick={onClose}>
                View Leads in CRM
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
