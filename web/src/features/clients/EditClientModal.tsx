import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { formatPhoneInput, normalizePhoneForStorage } from '../../lib/phone';
import { useEscapeKey } from '../../hooks/useEscapeKey';

type ClientRole = 'BUYER' | 'SELLER' | 'BOTH' | 'OTHER';
type ClientStage = 'NEW_LEAD' | 'NURTURE' | 'ACTIVE' | 'UNDER_CONTRACT' | 'CLOSED' | 'PAST_CLIENT' | 'DEAD';
type ClientTemperature = 'HOT' | 'WARM' | 'COLD';
type ReferralRank = 'A' | 'B' | 'C';

export interface EditClientModalClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  stage: string;
  temperature?: string;
  leadSource: string | null;
  referralRank?: ReferralRank;
  notes?: string | null;
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
  birthday?: string | null;
}

interface EditClientModalProps {
  client: EditClientModalClient;
  onClose: () => void;
  onComplete: () => void;
}

export function EditClientModal({ client, onClose, onComplete }: EditClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const [formData, setFormData] = useState(() => ({
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    email: client.email || '',
    phone: client.phone || '',
    role: (client.role as ClientRole) || ('BUYER' as ClientRole),
    stage: (client.stage as ClientStage) || ('NEW_LEAD' as ClientStage),
    temperature: (client.temperature as ClientTemperature) || ('COLD' as ClientTemperature),
    referralRank: (client.referralRank as ReferralRank) || ('C' as ReferralRank),
    leadSource: client.leadSource || '',
    notes: client.notes || '',
    mailingAddress: client.mailingAddress || '',
    mailingCity: client.mailingCity || '',
    mailingState: client.mailingState || '',
    mailingZip: client.mailingZip || '',
    birthday: client.birthday ? String(client.birthday).slice(0, 10) : '',
  }));

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

  const normalizedPayload = useMemo(() => {
    return {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim() || null,
      phone: normalizePhoneForStorage(formData.phone) || null,
      role: formData.role,
      stage: formData.stage,
      temperature: formData.temperature,
      referralRank: formData.referralRank,
      leadSource: formData.leadSource.trim() || null,
      notes: formData.notes.trim() || null,
      mailingAddress: formData.mailingAddress.trim() || null,
      mailingCity: formData.mailingCity.trim() || null,
      mailingState: formData.mailingState.trim() || null,
      mailingZip: formData.mailingZip.trim() || null,
      birthday: formData.birthday || null,
    };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!normalizedPayload.firstName) {
      setError('First name is required.');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/clients/${client.id}`, normalizedPayload);
      onComplete();
      setIsVisible(false);
      setTimeout(onClose, 200);
    } catch (err: any) {
      console.error('Failed to update client:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to update client. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xl" onClick={handleClose} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className={`relative w-full max-w-xl transform transition-all duration-300 ease-out my-8 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-blue-500/20 rounded-[28px] blur-xl opacity-75" />

          <div className="relative rounded-[24px] border border-slate-200/80 dark:border-white/20 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-900/98 dark:via-slate-900/95 dark:to-slate-950/98 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-emerald-500 rounded-xl blur-lg opacity-40" />
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-600/20 border border-cyan-400/30">
                      <svg className="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Edit Client</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Update client details</p>
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

            <form onSubmit={handleSubmit}>
              <div className="px-6 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
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
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Stage</label>
                    <select
                      value={formData.stage}
                      onChange={(e) => setFormData({ ...formData, stage: e.target.value as ClientStage })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:[&>option]:bg-slate-900"
                    >
                      <option value="NEW_LEAD">New Lead</option>
                      <option value="NURTURE">Nurture</option>
                      <option value="ACTIVE">Active</option>
                      <option value="UNDER_CONTRACT">Under Contract</option>
                      <option value="CLOSED">Closed</option>
                      <option value="PAST_CLIENT">Past Client</option>
                      <option value="DEAD">Dead</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as ClientRole })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:[&>option]:bg-slate-900"
                    >
                      <option value="BUYER">Buyer</option>
                      <option value="SELLER">Seller</option>
                      <option value="BOTH">Both</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Referral Rank</label>
                     <select
                      value={formData.referralRank}
                      onChange={(e) => setFormData({ ...formData, referralRank: e.target.value as ReferralRank })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:[&>option]:bg-slate-900"
                    >
                      <option value="A">A-List</option>
                      <option value="B">B-List</option>
                      <option value="C">C-List</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Temperature</label>
                    <select
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value as ClientTemperature })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:[&>option]:bg-slate-900"
                    >
                        {tempOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label} ({opt.desc})</option>
                        ))}
                    </select>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Address (Optional)</label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.mailingAddress}
                      onChange={(e) => setFormData({ ...formData, mailingAddress: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                      placeholder="123 Main St"
                    />
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-3">
                         <input
                          type="text"
                          value={formData.mailingCity}
                          onChange={(e) => setFormData({ ...formData, mailingCity: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                          placeholder="City"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          value={formData.mailingState}
                          onChange={(e) => setFormData({ ...formData, mailingState: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                          placeholder="UT"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={formData.mailingZip}
                          onChange={(e) => setFormData({ ...formData, mailingZip: e.target.value })}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                          placeholder="Zip"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Lead Source</label>
                  <input
                    type="text"
                    value={formData.leadSource}
                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                    placeholder="Referral, Zillow..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">🎂 Birthday</label>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    We&apos;ll remind you when it&apos;s coming up so you can send a personal touch.
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500"
                    placeholder="Important details about this client..."
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Profile notes are long‑form context. For quick updates, use the Timeline “Create Note” box on the client profile.
                  </div>
                </div>
              </div>

              <div className="relative px-6 py-5 bg-slate-950/60 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 relative group px-5 py-3 rounded-xl overflow-hidden font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 group-hover:from-cyan-400 group-hover:to-emerald-400 transition-all" />
                    <div className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {loading ? 'Saving...' : 'Save Changes'}
                    </div>
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
