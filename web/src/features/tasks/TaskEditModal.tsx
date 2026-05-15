import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { TaskBucket, TaskListItem, TaskPriority, TaskStatus } from './TaskCard';
import api from '../../lib/api';

type TaskEditPayload = {
  title: string;
  description: string;
  dueAt: string | null;
  priority: TaskPriority;
  bucket: TaskBucket;
  status: TaskStatus;
  dealId?: string;
  clientId?: string;
};

interface Deal {
  id: string;
  title: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  clientId?: string | null;
  client?: {
    id: string;
  } | null;
}

interface TaskEditModalProps {
  task: TaskListItem;
  onClose: () => void;
  onSave: (payload: TaskEditPayload) => Promise<void>;
  onDelete: () => Promise<void>;
}

function toDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function TaskEditModal({ task, onClose, onSave, onDelete }: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [dueAt, setDueAt] = useState(toDateTimeInput(task.dueAt));
  const [priority, setPriority] = useState<TaskPriority>(task.priority || 'NORMAL');
  const [bucket, setBucket] = useState<TaskBucket>(task.bucket || 'TODAY');
  const [status, setStatus] = useState<TaskStatus>(task.status || 'OPEN');
  const [dealId, setDealId] = useState(task.deal?.id || '');
  const [clientId, setClientId] = useState(task.client?.id || '');
  const [leadId, setLeadId] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingRelations, setLoadingRelations] = useState(true);
  const [error, setError] = useState('');

  const relationHint = useMemo(() => {
    if (task.deal) return `Linked to deal: ${task.deal.title}`;
    if (task.client) return `Linked to client: ${task.client.name}`;
    if (task.listing) return `Linked to listing: ${task.listing.address || task.listing.mlsId || 'Listing'}`;
    if (task.marketingBlast) return `Linked to marketing: ${task.marketingBlast.title}`;
    return 'General task';
  }, [task]);

  useEscapeKey(onClose);

  useEffect(() => {
    const loadRelations = async () => {
      try {
        setLoadingRelations(true);
        const [dealsRes, clientsRes, leadsRes] = await Promise.all([
          api.get('/deals'),
          api.get('/clients'),
          api.get('/leads', { params: { archived: 'false' } }),
        ]);
        setDeals(dealsRes.data || []);
        setClients(clientsRes.data || []);
        setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.data || []);
      } catch (err) {
        console.error('Failed to load relation options', err);
      } finally {
        setLoadingRelations(false);
      }
    };

    loadRelations();
  }, []);

  const applyPreset = (preset: 'lead-call' | 'showing-followup' | 'listing-checkin' | 'contract-deadline') => {
    const now = new Date();
    const inHours = (h: number) => {
      const d = new Date(now);
      d.setHours(d.getHours() + h);
      return toDateTimeInput(d.toISOString());
    };

    if (preset === 'lead-call') {
      setTitle('Call hot lead and confirm next step');
      setPriority('HIGH');
      setBucket('TODAY');
      setStatus('OPEN');
      setDueAt(inHours(2));
      return;
    }
    if (preset === 'showing-followup') {
      setTitle('Post-showing follow-up and feedback recap');
      setPriority('NORMAL');
      setBucket('TODAY');
      setStatus('OPEN');
      setDueAt(inHours(6));
      return;
    }
    if (preset === 'listing-checkin') {
      setTitle('Weekly listing performance check-in');
      setPriority('NORMAL');
      setBucket('THIS_WEEK');
      setStatus('OPEN');
      setDueAt(inHours(48));
      return;
    }
    setTitle('Contract contingency/deadline review');
    setPriority('HIGH');
    setBucket('TODAY');
    setStatus('OPEN');
    setDueAt(inHours(4));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      let resolvedClientId = clientId || undefined;

      if (leadId && !resolvedClientId) {
        const convertRes = await api.post(`/leads/${leadId}/convert`);
        resolvedClientId = convertRes.data?.client?.id || convertRes.data?.lead?.clientId || undefined;
      }

      await onSave({
        title: title.trim(),
        description: description.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        priority,
        bucket,
        status,
        dealId: dealId || undefined,
        clientId: resolvedClientId,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save task', err);
      setError('Could not save task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (err) {
      console.error('Failed to delete task', err);
      setError('Could not delete task. Please try again.');
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />

      <form
        onSubmit={submit}
        className="relative w-full max-w-2xl rounded-3xl border border-cyan-400/20 bg-slate-950/90 shadow-[0_28px_100px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      >
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Task command center</div>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-1">Edit task</h3>
              <p className="text-xs text-slate-400 mt-1">{relationHint}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-2 uppercase tracking-wide">Agent quick presets</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => applyPreset('lead-call')} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20">Hot lead call</button>
              <button type="button" onClick={() => applyPreset('showing-followup')} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20">Showing follow-up</button>
              <button type="button" onClick={() => applyPreset('listing-checkin')} className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20">Listing check-in</button>
              <button type="button" onClick={() => applyPreset('contract-deadline')} className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20">Contract deadline</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2">
              <div className="text-xs font-medium text-slate-200 mb-1.5">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to happen?"
                className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </label>

            <label className="sm:col-span-2">
              <div className="text-xs font-medium text-slate-200 mb-1.5">Notes</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Conversation notes, next action, or context"
                className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-y"
              />
            </label>

            <label>
              <div className="text-xs font-medium text-slate-200 mb-1.5">Due</div>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </label>

            <label>
              <div className="text-xs font-medium text-slate-200 mb-1.5">Priority</div>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-slate-200 mb-1.5">Board lane</div>
              <select value={bucket} onChange={(e) => setBucket(e.target.value as TaskBucket)} className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                <option value="TODAY">Today</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="LATER">Later</option>
                <option value="DONE">Done</option>
              </select>
            </label>

            <label>
              <div className="text-xs font-medium text-slate-200 mb-1.5">Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                <option value="OPEN">Open</option>
                <option value="DONE">Done</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>

            <div className="sm:col-span-2 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300 mb-2">Link to client, lead, or deal</div>
              {loadingRelations ? (
                <div className="text-xs text-slate-400">Loading CRM records...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label>
                    <div className="text-[11px] text-slate-300 mb-1">Lead</div>
                    <select
                      value={leadId}
                      onChange={(e) => {
                        const nextLeadId = e.target.value;
                        setLeadId(nextLeadId);
                        if (!nextLeadId) return;
                        const selected = leads.find((lead) => lead.id === nextLeadId);
                        setClientId(selected?.clientId || selected?.client?.id || '');
                      }}
                      className="w-full rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    >
                      <option value="">No lead</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email || 'Unnamed lead'}
                          {lead.clientId || lead.client?.id ? '' : ' (auto-convert)'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div className="text-[11px] text-slate-300 mb-1">Client</div>
                    <select
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        if (e.target.value) setLeadId('');
                      }}
                      className="w-full rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    >
                      <option value="">No client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div className="text-[11px] text-slate-300 mb-1">Deal</div>
                    <select
                      value={dealId}
                      onChange={(e) => setDealId(e.target.value)}
                      className="w-full rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    >
                      <option value="">No deal</option>
                      {deals.map((deal) => (
                        <option key={deal.id} value={deal.id}>{deal.title}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {leadId && !((leads.find((lead) => lead.id === leadId)?.clientId) || (leads.find((lead) => lead.id === leadId)?.client?.id)) && (
                <div className="mt-2 text-[11px] text-amber-300">
                  This lead will be converted and linked to a client when you save.
                </div>
              )}
            </div>
          </div>

          {error && <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={remove}
            disabled={deleting || saving}
            className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete task'}
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Cancel</button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
