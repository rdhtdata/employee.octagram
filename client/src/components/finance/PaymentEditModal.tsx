import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Payment, User } from '../../types/index.js';
import { Calendar, Trash2, CheckCircle2, AlertCircle, Save, Repeat } from 'lucide-react';

interface PaymentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payment: Payment | null;
  usersList: User[];
  onDeleteSuccess?: () => void;
}

export const PaymentEditModal: React.FC<PaymentEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  payment,
  usersList,
  onDeleteSuccess,
}) => {
  const { showToast } = useNotification();

  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [dueDate, setDueDate] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [status, setStatus] = useState<string>('UPCOMING');
  const [recurrence, setRecurrence] = useState<string>('NONE');
  const [responsibleUserId, setResponsibleUserId] = useState<string>('');
  const [invoiceRef, setInvoiceRef] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && payment) {
      setAmount(payment.amount ? String(payment.amount) : '');
      setCurrency(payment.currency || 'INR');
      setDueDate(payment.dueDate ? new Date(payment.dueDate).toISOString().split('T')[0] : '');
      setPaymentDate(payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : '');
      setStatus(payment.status || 'UPCOMING');
      setRecurrence(payment.recurrence || 'NONE');
      setResponsibleUserId(payment.responsibleUserId || '');
      setInvoiceRef(payment.invoiceRef || '');
      setPaymentMethod(payment.paymentMethod || '');
      setNotes(payment.notes || '');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, payment]);

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
    if (!payment) return;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToast('Please enter a valid payment amount.', 'warning');
      return;
    }

    if (!dueDate) {
      showToast('Please enter a valid due date.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.accounts.updatePayment(payment.id, {
        amount: Number(amount),
        currency,
        dueDate,
        paymentDate: paymentDate || null,
        status,
        recurrence,
        responsibleUserId: responsibleUserId || null,
        invoiceRef: invoiceRef.trim() || null,
        paymentMethod: paymentMethod.trim() || null,
        notes: notes.trim() || null,
      });

      showToast('Payment record updated successfully & calendar/tasks synchronized.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!payment) return;
    try {
      setIsDeleting(true);
      await api.accounts.deletePayment(payment.id);
      showToast('Payment deleted & reminder tasks cleared.', 'success');
      if (onDeleteSuccess) {
        onDeleteSuccess();
      } else {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete payment.', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!payment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modify Payment — ${payment.client?.name || 'Client'}`}
      subtitle={`Payment ID: ${payment.id.slice(0, 8)}... • Created ${payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : ''}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Delete Confirmation Banner */}
        {showDeleteConfirm && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 rounded-xl space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-rose-300 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to permanently delete this payment?</span>
            </div>
            <p className="text-[11px] text-rose-200 leading-relaxed">
              This will remove the payment record of {currency === 'INR' ? '₹' : '$'}
              {Number(amount || 0).toLocaleString()} and automatically delete any associated task reminders.
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

        {/* Amount & Currency */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-zinc-300 font-medium mb-1">Amount *</label>
            <input
              type="number"
              required
              min="1"
              step="any"
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-2.5 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono focus:outline-none focus:border-sky-500 cursor-pointer"
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
            <label className="block text-zinc-300 font-medium mb-1">Payment Status *</label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer font-medium"
            >
              <option value="UPCOMING">🔵 Upcoming / Scheduled</option>
              <option value="DUE">🟡 Due Now</option>
              <option value="PAID">🟢 Paid / Received</option>
              <option value="OVERDUE">🔴 Overdue</option>
              <option value="PARTIALLY_PAID">🟠 Partially Paid</option>
              <option value="CANCELLED">⚪ Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Recurrence Schedule</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="NONE">One-time Milestone</option>
              <option value="WEEKLY">Weekly Recurring</option>
              <option value="MONTHLY">Monthly Retainer</option>
              <option value="QUARTERLY">Quarterly Recurring</option>
              <option value="YEARLY">Yearly Renewal</option>
            </select>
          </div>
        </div>

        {/* Due Date & Paid Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>Payment Due Date *</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Date Received / Paid</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              placeholder="Leave empty if unpaid"
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Responsible Rep & Payment Method */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Responsible Sales / Account Rep</label>
            <select
              value={responsibleUserId}
              onChange={(e) => setResponsibleUserId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">⚪ Unassigned (Client Default)</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  👤 {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">Select Method (Optional)</option>
              <option value="Bank Transfer">🏦 Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="UPI">📱 UPI / GPay / PhonePe</option>
              <option value="Credit / Debit Card">💳 Credit / Debit Card</option>
              <option value="Stripe">🌐 Stripe Gateway</option>
              <option value="Razorpay">⚡ Razorpay</option>
              <option value="Cash">💵 Cash</option>
              <option value="Cheque">📜 Cheque</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Invoice Ref */}
        <div>
          <label className="block text-zinc-300 font-medium mb-1">Invoice / Reference #</label>
          <input
            type="text"
            placeholder="e.g. OCT-2026-INV-104"
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-zinc-300 font-medium mb-1">Payment Notes / Description</label>
          <textarea
            rows={2}
            placeholder="Scope details, milestone summary, or collection notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500"
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
