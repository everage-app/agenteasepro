import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface NewTaskModalProps {
  onClose: () => void;
  onComplete: () => void;
  defaultDealId?: string;
  defaultClientId?: string;
  defaultListingId?: string;
  defaultMarketingBlastId?: string;
  defaultDueAt?: string;
  defaultCategory?: 'GENERAL' | 'CONTRACT' | 'MARKETING' | 'CALL' | 'NOTE' | 'POPBY' | 'EVENT';
  defaultTitle?: string;
}

interface Deal {
  id: string;
  title: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Listing {
  id: string;
  headline: string;
}

interface MarketingBlast {
  id: string;
  title: string;
}

export function NewTaskModal({
  onClose,
  onComplete,
  defaultDealId,
  defaultClientId,
  defaultListingId,
  defaultMarketingBlastId,
  defaultDueAt,
  defaultCategory,
  defaultTitle,
}: NewTaskModalProps) {
  const [title, setTitle] = useState(defaultTitle || '');
  const [description, setDescription] = useState('');
  const [bucket, setBucket] = useState<'TODAY' | 'THIS_WEEK' | 'LATER'>('TODAY');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');
  const [dueAt, setDueAt] = useState(defaultDueAt || '');
  const [category, setCategory] = useState<'GENERAL' | 'CONTRACT' | 'MARKETING' | 'CALL' | 'NOTE' | 'POPBY' | 'EVENT'>(
    defaultCategory || 'GENERAL',
  );
  const [dealId, setDealId] = useState(defaultDealId || '');
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [listingId, setListingId] = useState(defaultListingId || '');
  const [marketingBlastId, setMarketingBlastId] = useState(defaultMarketingBlastId || '');
  
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [blasts, setBlasts] = useState<MarketingBlast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const isClientLocked = Boolean(defaultClientId);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  useEscapeKey(handleClose, true);

  useEffect(() => {
    // Fetch options for dropdowns
    const fetchOptions = async () => {
      try {
        const [dealsRes, clientsRes, listingsRes, blastsRes] = await Promise.all([
          api.get('/deals'),
          api.get('/clients'),
          api.get('/listings'),
          api.get('/marketing/blasts'),
        ]);
        setDeals(dealsRes.data || []);
        setClients(clientsRes.data || []);
        setListings(listingsRes.data || []);
        setBlasts(blastsRes.data || []);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };
    fetchOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');
    try {
      await api.post('/tasks', {
        title,
        description: description || undefined,
        category,
        bucket,
        priority,
        dueAt: dueAt || undefined,
        dealId: dealId || undefined,
        clientId: clientId || undefined,
        listingId: listingId || undefined,
        marketingBlastId: marketingBlastId || undefined,
      });
      onComplete();
      setIsVisible(false);
      setTimeout(onClose, 200);
    } catch (error: any) {
      console.error('Error creating task:', error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to create task. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const bucketOptions = [
    { value: 'TODAY', label: 'Today', icon: '🎯', color: 'from-red-500 to-orange-500' },
    { value: 'THIS_WEEK', label: 'This Week', icon: '📅', color: 'from-blue-500 to-cyan-500' },
    { value: 'LATER', label: 'Later', icon: '📌', color: 'from-slate-500 to-slate-400' },
  ];

  const priorityOptions = [
    {
      value: 'HIGH',
      label: 'High',
      color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
    },
    {
      value: 'NORMAL',
      label: 'Normal',
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
    },
    {
      value: 'LOW',
      label: 'Low',
      color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30',
    },
  ];

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-slate-950/60 dark:bg-black/88 backdrop-blur-xl" onClick={handleClose} />

      {/* Floating particles/glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-500/12 rounded-full blur-3xl dark:bg-blue-500/18" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl dark:bg-indigo-500/20" />
      </div>

      {/* Modal Container */}
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className={`relative w-full max-w-xl transform transition-all duration-300 ease-out my-8 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Outer glow ring */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 rounded-[28px] blur-xl opacity-75 dark:opacity-95" />

          {/* Main Modal */}
          <div className="relative rounded-[24px] border border-slate-200/80 dark:border-white/12 bg-gradient-to-b from-white via-slate-50 to-white dark:from-[#061126] dark:via-[#08142c] dark:to-[#040b19] shadow-2xl overflow-hidden">
            {/* Decorative top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl blur-lg opacity-40" />
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-400/30">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">New Task</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Add a task to your workflow</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-300 transition-all duration-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 dark:hover:border-red-500/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit}>
              <div className="px-6 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Task Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Follow up with client about inspection"
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100 dark:placeholder-slate-400"
                    required
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add details about this task..."
                    rows={2}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100 dark:placeholder-slate-400"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'GENERAL', label: 'General' },
                      { value: 'CALL', label: 'Call' },
                      { value: 'EVENT', label: 'Event' },
                      { value: 'MARKETING', label: 'Marketing' },
                      { value: 'NOTE', label: 'Note' },
                      { value: 'POPBY', label: 'Pop‑By' },
                      { value: 'CONTRACT', label: 'Contract' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategory(opt.value)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                          category === opt.value
                            ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200 dark:bg-cyan-500/20'
                            : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-900/65 dark:text-slate-300 dark:hover:bg-slate-900/85'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bucket Selection - Visual Pills */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">When</label>
                  <div className="grid grid-cols-3 gap-2">
                    {bucketOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBucket(opt.value as any)}
                        className={`relative p-3 rounded-xl border transition-all duration-200 ${
                          bucket === opt.value
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50 dark:border-white/12 dark:bg-slate-900/65 dark:hover:bg-slate-900/85'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">{opt.icon}</span>
                          <span className={`text-xs font-semibold ${bucket === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                            {opt.label}
                          </span>
                        </div>
                        {bucket === opt.value && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Selection - Visual Pills */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Priority</label>
                  <div className="flex gap-2">
                    {priorityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriority(opt.value as any)}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                          priority === opt.value
                            ? opt.color
                            : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-slate-900/65 dark:text-slate-300 dark:hover:bg-slate-900/85'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100"
                  />
                </div>

                {/* Link to Section */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/12">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">Link to (optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Deal */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-300 mb-1.5">Deal</label>
                      <select
                        value={dealId}
                        onChange={(e) => setDealId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100 dark:[&>option]:bg-slate-900"
                      >
                        <option value="">-- None --</option>
                        {deals.map((deal) => (
                          <option key={deal.id} value={deal.id}>{deal.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Client */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-300 mb-1.5">Client</label>
                      <select
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        disabled={isClientLocked}
                        className={`w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100 dark:[&>option]:bg-slate-900 ${
                          isClientLocked ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="">-- None --</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Listing */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-300 mb-1.5">Listing</label>
                      <select
                        value={listingId}
                        onChange={(e) => setListingId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100 dark:[&>option]:bg-slate-900"
                      >
                        <option value="">-- None --</option>
                        {listings.map((listing) => (
                          <option key={listing.id} value={listing.id}>{listing.headline}</option>
                        ))}
                      </select>
                    </div>

                    {/* Marketing Blast */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-300 mb-1.5">Marketing Blast</label>
                      <select
                        value={marketingBlastId}
                        onChange={(e) => setMarketingBlastId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/12 dark:bg-slate-900/75 dark:text-slate-100 dark:[&>option]:bg-slate-900"
                      >
                        <option value="">-- None --</option>
                        {blasts.map((blast) => (
                          <option key={blast.id} value={blast.id}>{blast.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="relative px-6 py-5 bg-slate-100/80 border-t border-slate-200/70 dark:bg-[#040b1a] dark:border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 font-medium text-sm dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !title.trim()}
                    className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 group-hover:from-blue-400 group-hover:to-indigo-400 transition-all" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.3),transparent_70%)]" />
                    </div>
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {loading ? 'Creating...' : 'Create Task'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
