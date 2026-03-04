import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { formatPhoneInput, normalizePhoneForStorage } from '../../lib/phone';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface NewClientModalProps {
  onClose: () => void;
  onComplete: () => void;
}

type ClientRole = 'BUYER' | 'SELLER' | 'BOTH' | 'OTHER';
type ClientStage = 'NEW_LEAD' | 'NURTURE' | 'ACTIVE' | 'UNDER_CONTRACT' | 'CLOSED' | 'PAST_CLIENT' | 'DEAD';
type ClientTemperature = 'HOT' | 'WARM' | 'COLD';
type ReferralRank = 'A' | 'B' | 'C';

export function NewClientModal({ onClose, onComplete }: NewClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'BUYER' as ClientRole,
    stage: 'NEW_LEAD' as ClientStage,
    temperature: 'COLD' as ClientTemperature,
    referralRank: 'C' as ReferralRank,
    leadSource: '',
    notes: '',
    mailingAddress: '',
    mailingCity: '',
    mailingState: '',
    mailingZip: '',
  });

  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    if (formData.email && !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await api.post('/clients', {
        // API expects these exact fields
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim() || null,
        phone: normalizePhoneForStorage(formData.phone) || null,
        role: formData.role,
        stage: formData.stage,
        temperature: formData.temperature,
        source: formData.leadSource.trim() || null,
        referralRank: formData.referralRank,
        notes: formData.notes.trim() || null,
        mailingAddress: formData.mailingAddress.trim() || null,
        mailingCity: formData.mailingCity.trim() || null,
        mailingState: formData.mailingState.trim() || null,
        mailingZip: formData.mailingZip.trim() || null,
      });

      onComplete();
      setIsVisible(false);
      setTimeout(onClose, 200);
    } catch (err: any) {
      console.error('Failed to create client:', err);
      if (!err?.response) {
        setError('Network error. Please refresh and try again.');
        return;
      }
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to create client. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'BUYER', label: 'Buyer', icon: '🏠', color: 'blue' },
    { value: 'SELLER', label: 'Seller', icon: '💰', color: 'emerald' },
    { value: 'BOTH', label: 'Both', icon: '🔄', color: 'purple' },
    { value: 'OTHER', label: 'Other', icon: '📋', color: 'slate' },
  ];

  const rankOptions = [
    { value: 'A', label: 'A-List', desc: 'Top referrer', color: 'from-amber-500 to-yellow-400' },
    { value: 'B', label: 'B-List', desc: 'Good referrer', color: 'from-slate-400 to-slate-300' },
    { value: 'C', label: 'C-List', desc: 'New/Minimal', color: 'from-orange-600 to-orange-500' },
  ];

  const tempOptions = [
    { value: 'HOT', label: 'Hot', desc: 'Active 1-3 Mo', color: 'from-orange-500 to-red-500' },
    { value: 'WARM', label: 'Warm', desc: 'Nurture 3-6 Mo', color: 'from-yellow-400 to-orange-400' },
    { value: 'COLD', label: 'Cold', desc: 'Long Term 6+ Mo', color: 'from-cyan-400 to-blue-500' },
  ];

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xl" onClick={handleClose} />

      {/* Glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Modal Container */}
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className={`relative w-full max-w-xl transform transition-all duration-300 ease-out my-8 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Outer glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-purple-500/20 rounded-[28px] blur-xl opacity-75" />

          {/* Main Modal */}
          <div className="relative rounded-[24px] border border-slate-200/80 dark:border-white/20 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-900/98 dark:via-slate-900/95 dark:to-slate-950/98 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-cyan-500 rounded-xl blur-lg opacity-40" />
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-600/20 border border-purple-400/30">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add New Client</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Create a client profile</p>
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

            {/* Form */}
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

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="John"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Last Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Role</label>
                  <div className="grid grid-cols-4 gap-2">
                    {roleOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: opt.value as ClientRole })}
                        className={`relative p-3 rounded-xl border transition-all duration-200 ${
                          formData.role === opt.value
                            ? 'border-purple-500/50 bg-purple-500/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">{opt.icon}</span>
                          <span className={`text-xs font-semibold ${formData.role === opt.value ? 'text-purple-300' : 'text-slate-400'}`}>
                            {opt.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Referral Rank & Temperature */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Referral Rank</label>
                    <div className="grid grid-cols-1 gap-2">
                        {rankOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, referralRank: opt.value as ReferralRank })}
                            className={`relative p-2 rounded-lg border flex items-center gap-3 transition-all duration-200 ${
                            formData.referralRank === opt.value
                                ? 'border-white/30 bg-white/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${opt.color} flex items-center justify-center text-xs font-bold text-white shadow-lg`}>
                            {opt.value}
                            </div>
                            <div className="text-left">
                            <div className={`text-xs font-bold ${formData.referralRank === opt.value ? 'text-white' : 'text-slate-300'}`}>
                                {opt.label}
                            </div>
                            <div className="text-[10px] text-slate-500">{opt.desc}</div>
                            </div>
                        </button>
                        ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Temperature</label>
                    <div className="grid grid-cols-1 gap-2">
                        {tempOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, temperature: opt.value as ClientTemperature })}
                            className={`relative p-2 rounded-lg border flex items-center gap-3 transition-all duration-200 ${
                            formData.temperature === opt.value
                                ? 'border-white/30 bg-white/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${opt.color} flex items-center justify-center text-xs font-bold text-white shadow-lg`}>
                              {opt.value === 'HOT' ? '🔥' : opt.value === 'WARM' ? '🌅' : '❄️'}
                            </div>
                            <div className="text-left">
                            <div className={`text-xs font-bold ${formData.temperature === opt.value ? 'text-white' : 'text-slate-300'}`}>
                                {opt.label}
                            </div>
                            <div className="text-[10px] text-slate-500">{opt.desc}</div>
                            </div>
                        </button>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Stage & Source */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Stage</label>
                    <select
                      value={formData.stage}
                      onChange={(e) => setFormData({ ...formData, stage: e.target.value as ClientStage })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:[&>option]:bg-slate-900"
                    >
                      <option value="NEW_LEAD">New Lead</option>
                      <option value="NURTURE">Nurture</option>
                      <option value="ACTIVE">Active</option>
                      <option value="UNDER_CONTRACT">Under Contract</option>
                      <option value="CLOSED">Closed</option>
                      <option value="PAST_CLIENT">Past Client</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Lead Source</label>
                    <input
                      type="text"
                      value={formData.leadSource}
                      onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="Referral, Zillow..."
                    />
                  </div>
                </div>

                {/* Mailing Address */}
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Address (Optional)</label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.mailingAddress}
                      onChange={(e) => setFormData({ ...formData, mailingAddress: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="123 Main St"
                    />
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-3">
                         <input
                          type="text"
                          value={formData.mailingCity}
                          onChange={(e) => setFormData({ ...formData, mailingCity: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                          placeholder="City"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          value={formData.mailingState}
                          onChange={(e) => setFormData({ ...formData, mailingState: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                          placeholder="UT"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={formData.mailingZip}
                          onChange={(e) => setFormData({ ...formData, mailingZip: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                          placeholder="Zip"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                    placeholder="Important details about this client..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="relative px-6 py-5 bg-slate-950/60 border-t border-white/5">
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
                    disabled={loading}
                    className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 group-hover:from-purple-400 group-hover:to-cyan-400 transition-all" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-cyan-400" />
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
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      )}
                      {loading ? 'Creating...' : 'Create Client'}
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
