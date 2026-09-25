import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Expense, User, Client } from '../../types/index.js';
import { Calendar, Trash2, CheckCircle2, AlertCircle, Save, Repeat } from 'lucide-react';

interface ExpenseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: Expense | null;
  usersList?: User[];
  clientsList?: Client[];
  onDeleteSuccess?: () => void;
}

export const ExpenseEditModal: React.FC<ExpenseEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  expense,
  usersList = [],
  clientsList = [],
  onDeleteSuccess,
}) => {
  const { showToast } = useNotification();

  const [vendor, setVendor] = useState<string>('');
  const [category, setCategory] = useState<string>('SOFTWARE');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [dueDate, setDueDate] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [status, setStatus] = useState<string>('UPCOMING');
  const [recurrence, setRecurrence] = useState<string>('NONE');
  const [relatedClientId, setRelatedClientId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && expense) {
      setVendor(expense.vendor || '');
      setCategory(expense.category || 'SOFTWARE');
      setAmount(expense.amount ? String(expense.amount) : '');
      setCurrency(expense.currency || 'INR');
      setDueDate(expense.dueDate ? new Date(expense.dueDate).toISOString().split('T')[0] : '');
      const rawPaidDate = (expense as any).paidDate || (expense as any).paymentDate;
      setPaymentDate(rawPaidDate ? new Date(rawPaidDate).toISOString().split('T')[0] : '');
      setStatus(expense.status || 'UPCOMING');
      setRecurrence(expense.recurrence || 'NONE');
      setRelatedClientId(expense.relatedClientId || '');
      setNotes(expense.notes || '');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, expense]);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    if (newStatus === 'PAID' && !paymentDate) {
      setPaymentDate(new Date().toISOString().split('T')[0]);
    } else if (newStatus !== 'PAID' && status === 'PAID') {
      setPaymentDate('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;

    if (!vendor.trim()) {
      showToast('Please enter a vendor or service name.', 'warning');
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToast('Please enter a valid expense amount.', 'warning');
      return;
    }

    if (!dueDate) {
      showToast('Please enter a valid due date.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.accounts.updateExpense(expense.id, {
        vendor: vendor.trim(),
        category,
        amount: Number(amount),
        currency,
        dueDate,
        paymentDate: paymentDate || null,
        status,
        recurrence,
        relatedClientId: relatedClientId || null,
        notes: notes.trim() || null,
      });

      showToast('Expense updated successfully.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update expense.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    try {
      setIsDeleting(true);
      await api.accounts.deleteExpense(expense.id);
      showToast('Expense deleted successfully.', 'success');
      if (onDeleteSuccess) {
        onDeleteSuccess();
      } else {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense.', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!expense) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modify Expense — ${expense.vendor}`}
      subtitle={`Expense ID: ${expense.id.slice(0, 8)}...`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Delete Confirmation Banner */}
        {showDeleteConfirm && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 rounded-xl space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-rose-300 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to permanently delete this expense?</span>
            </div>
            <p className="text-[11px] text-rose-200 leading-relaxed">
              This will remove the expense record of {currency === 'INR' ? '₹' : '$'}
              {Number(amount || 0).toLocaleString()} for {vendor}.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="xs"
                type="button"
                onClick={handleDelete}
                isLoading={isDeleting}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}

        {/* Vendor & Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Vendor / Payee *</label>
            <input
              type="text"
              required
              placeholder="e.g. AWS, Figma, Vercel"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="SOFTWARE">💻 Software & Subscriptions</option>
              <option value="HOSTING">☁️ Cloud & Hosting</option>
              <option value="HARDWARE">🖥️ Hardware & Equipment</option>
              <option value="OFFICE">🏢 Office & Supplies</option>
              <option value="MARKETING">📢 Marketing & Ads</option>
              <option value="SALARY">👥 Payroll & Contractors</option>
              <option value="LEGAL">⚖️ Legal & Compliance</option>
              <option value="OTHER">Other Expense</option>
            </select>
          </div>
        </div>

        {/* Amount & Currency */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-zinc-300 font-medium mb-1">Amount *</label>
            <input
              type="number"
              required
              min="1"
              step="any"
              placeholder="e.g. 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono text-sm focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-2.5 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
          </div>
        </div>

        {/* Status & Recurrence */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Status *</label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500 cursor-pointer font-medium"
            >
              <option value="UPCOMING">🔵 Upcoming</option>
              <option value="PAID">🟢 Paid</option>
              <option value="OVERDUE">🔴 Overdue</option>
              <option value="CANCELLED">⚪ Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Recurrence Schedule</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="NONE">One-time Expense</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly Subscription</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Annual Renewal</option>
            </select>
          </div>
        </div>

        {/* Due Date & Paid Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>Due Date *</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Date Paid</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              placeholder="Leave empty if unpaid"
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Related Client (Optional) */}
        {clientsList.length > 0 && (
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Related Client (Optional)</label>
            <select
              value={relatedClientId}
              onChange={(e) => setRelatedClientId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="">🏢 General Octagram Expense (No specific client)</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-zinc-300 font-medium mb-1">Notes</label>
          <textarea
            rows={2}
            placeholder="Invoice reference, purpose, or approval details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <Button
            variant="danger"
            size="sm"
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSubmitting || isDeleting || showDeleteConfirm}
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isSubmitting}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
