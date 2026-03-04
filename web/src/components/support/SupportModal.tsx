import { useEffect, useState } from 'react';
import api from '../../lib/api';
import {
  StunningModal,
  ModalInput,
  ModalSelect,
  ModalTextarea,
  ModalCancelButton,
  ModalPrimaryButton,
} from '../ui/StunningModal';

const categories = [
  { value: 'GENERAL', label: 'Support question' },
  { value: 'SUGGESTION', label: 'Feature suggestion' },
  { value: 'BILLING', label: 'Billing help' },
  { value: 'BUG', label: 'Bug report' },
] as const;

const priorities = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [category, setCategory] = useState<'GENERAL' | 'SUGGESTION' | 'BILLING' | 'BUG'>('GENERAL');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCategory('GENERAL');
    setPriority('MEDIUM');
    setSubject('');
    setMessage('');
    setError(null);
    setSuccess(false);
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Please add a subject and message.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.post('/support', {
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        pagePath: window.location.pathname,
        pageUrl: window.location.href,
        meta: {
          source: 'app',
        },
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Unable to submit support request.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <StunningModal
      isOpen={isOpen}
      onClose={onClose}
      title={success ? 'Support request sent' : 'Support & Suggestions'}
      subtitle={success ? 'We have your request and will follow up soon.' : 'Ask a question, report an issue, or share feedback.'}
      icon={success ? '✅' : '🧭'}
      iconGradient="from-cyan-500 to-blue-500"
      size="md"
      footer={
        success ? (
          <div className="flex items-center justify-end">
            <ModalPrimaryButton onClick={onClose}>Done</ModalPrimaryButton>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ModalCancelButton onClick={onClose}>Cancel</ModalCancelButton>
            <ModalPrimaryButton onClick={handleSubmit} loading={loading} disabled={loading}>
              Submit
            </ModalPrimaryButton>
          </div>
        )
      }
    >
      {success ? (
        <div className="text-sm text-slate-300">
          Thanks for the details. Your request is now in our internal queue.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModalSelect label="Category" value={category} onChange={(e) => setCategory(e.target.value as any)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </ModalSelect>
            <ModalSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </ModalSelect>
          </div>

          <ModalInput
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary (e.g., Billing question about plan)"
            required
          />

          <ModalTextarea
            label="Details"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what happened and what you need help with."
            rows={5}
            required
          />

          {error && <div className="text-xs text-rose-300">{error}</div>}
          <div className="text-xs text-slate-500">
            We do not display personal support contact info. Your request is routed securely to the internal support board.
          </div>
        </div>
      )}
    </StunningModal>
  );
}
