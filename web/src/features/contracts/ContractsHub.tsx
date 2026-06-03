import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import {
  EnvelopeLink,
  buildEnvelopeSendToast,
  getEnvelopeLinkDeliveryLabel,
  getEnvelopeLinkPrimaryLabel,
  getEnvelopeLinkSubtitle,
} from '../../lib/esignDelivery';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PdfAnnotator } from './PdfAnnotator';

interface Deal {
  id: string;
  title: string;
  status: string;
  property: {
    street: string;
    city: string;
    state: string;
    zip?: string;
    county?: string;
    mlsId?: string;
    taxId?: string;
  };
  buyer?: { firstName: string; lastName: string; email?: string };
  seller?: { firstName: string; lastName: string; email?: string };
  repc?: {
    id: string;
    purchasePrice: number;
    settlementDeadline: string;
  };
  createdAt: string;
}

interface FormDefinition {
  id: string;
  code: string;
  displayName: string;
  category: string;
  version?: string;
  schemaJson?: {
    usageScope?: 'DEAL' | 'CLIENT' | 'BOTH';
    ownerAgentId?: string;
    source?: string;
  };
}

interface ClientListItem {
  id: string;
  name: string;
  email?: string;
}

interface SignatureEnvelope {
  id: string;
  dealId: string;
  type: string;
  documentVersion: number;
  createdAt: string;
  lastReminderSentAt?: string | null;
  signers: {
    id: string;
    name: string;
    email: string;
    role: string;
    viewedAt?: string;
    signedAt?: string;
  }[];
  deal?: Deal;
}

const REMINDER_COOLDOWN_MS = 90_000;
const SIGNER_STALLED_MS = 24 * 60 * 60 * 1000;

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

type SendEnvelopePayload = {
  signers: { role: string; name: string; email: string }[];
  subject: string;
  message: string;
  sendEmails?: boolean;
};

type ContractsWorkspace = 'active' | 'pending' | 'templates' | 'archive';

const CONTRACTS_SECTION_IDS: Record<ContractsWorkspace, string> = {
  active: 'contracts-active-section',
  pending: 'contracts-pending-section',
  templates: 'contracts-templates-section',
  archive: 'contracts-archive-section',
};

function cleanDisplayText(value: unknown) {
  const text = String(value ?? '')
    .trim()
    .replace(/^(null|undefined)\s*[-:]\s*/i, '')
    .replace(/\s*[-:]\s*(null|undefined)$/i, '')
    .trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
}

function joinDisplayParts(...values: unknown[]) {
  return values.map(cleanDisplayText).filter(Boolean).join(', ');
}

function formatPersonName(person?: { firstName?: string; lastName?: string } | null) {
  return [cleanDisplayText(person?.firstName), cleanDisplayText(person?.lastName)].filter(Boolean).join(' ');
}

function getDealDisplayTitle(deal: Deal) {
  return joinDisplayParts(deal.property?.street) || cleanDisplayText(deal.title) || 'Untitled deal';
}

function getDealAddressLine(deal: Deal) {
  return joinDisplayParts(deal.property?.city, deal.property?.state, deal.property?.zip);
}

function getDealFullAddress(deal: Deal) {
  return joinDisplayParts(deal.property?.street, deal.property?.city, deal.property?.state, deal.property?.zip)
    || cleanDisplayText(deal.title)
    || 'Untitled deal';
}

function buildDefaultSubjectForDeal(deal: Deal) {
  return `Please Sign: Contract for ${getDealDisplayTitle(deal)}`;
}

export function ContractsHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [formDefs, setFormDefs] = useState<FormDefinition[]>([]);
  const [envelopes, setEnvelopes] = useState<SignatureEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ContractsWorkspace>('active');
  const [templatePreview, setTemplatePreview] = useState<{
    form: FormDefinition;
    blobUrl: string | null;
  } | null>(null);
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(null);
  const [templateUploadOpen, setTemplateUploadOpen] = useState(false);
  const [templateUploadSaving, setTemplateUploadSaving] = useState(false);
  const [templateUploadError, setTemplateUploadError] = useState<string | null>(null);
  const [templateUploadName, setTemplateUploadName] = useState('');
  const [templateUploadCategory, setTemplateUploadCategory] = useState('');
  const [templateUploadScope, setTemplateUploadScope] = useState<'DEAL' | 'CLIENT' | 'BOTH'>('DEAL');
  const [templateUploadFile, setTemplateUploadFile] = useState<File | null>(null);
  const [clientTemplateForm, setClientTemplateForm] = useState<FormDefinition | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [clientTemplateSearch, setClientTemplateSearch] = useState('');
  const [clientTemplateRole, setClientTemplateRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientsLoading, setClientsLoading] = useState(false);
  const [lastSignLinks, setLastSignLinks] = useState<EnvelopeLink[] | null>(null);
  const [highlightDealId, setHighlightDealId] = useState<string | null>(null);
  const [resendingByEnvelopeId, setResendingByEnvelopeId] = useState<Record<string, boolean>>({});
  const [reminderCooldownByEnvelopeId, setReminderCooldownByEnvelopeId] = useState<Record<string, number>>({});
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const [quickSendingDealId, setQuickSendingDealId] = useState<string | null>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (Object.keys(reminderCooldownByEnvelopeId).length === 0) return;

    const intervalId = window.setInterval(() => {
      setCooldownNow(Date.now());
      setReminderCooldownByEnvelopeId((prev) => {
        const next = Object.entries(prev).reduce<Record<string, number>>((acc, [envelopeId, until]) => {
          if (until > Date.now()) acc[envelopeId] = until;
          return acc;
        }, {});
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [reminderCooldownByEnvelopeId]);

  const getReminderCooldownLabel = (envelopeId?: string) => {
    if (!envelopeId) return null;
    const until = (() => {
      const localUntil = reminderCooldownByEnvelopeId[envelopeId] || 0;
      const envelope = envelopes.find((item) => item.id === envelopeId);
      const serverUntil = envelope?.lastReminderSentAt
        ? new Date(envelope.lastReminderSentAt).getTime() + REMINDER_COOLDOWN_MS
        : 0;
      return Math.max(localUntil, serverUntil);
    })();
    if (!until || until <= cooldownNow) return null;
    const remainingSeconds = Math.ceil((until - cooldownNow) / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `Cooldown ${mm}:${ss}`;
  };

  const remindPendingSigners = async (dealId: string) => {
    const envelope = pendingEnvelopeByDealId[dealId];
    if (!envelope?.id) {
      showToast('error', 'No signature envelope found for this deal.');
      return;
    }

    if (resendingByEnvelopeId[envelope.id]) return;

    const serverCooldownUntil = envelope.lastReminderSentAt
      ? new Date(envelope.lastReminderSentAt).getTime() + REMINDER_COOLDOWN_MS
      : 0;
    const cooldownUntil = Math.max(reminderCooldownByEnvelopeId[envelope.id] || 0, serverCooldownUntil);
    if (cooldownUntil && cooldownUntil > Date.now()) {
      const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
      showToast('warning', `Please wait ${remainingSeconds}s before sending another reminder.`);
      return;
    }

    setResendingByEnvelopeId((prev) => ({ ...prev, [envelope.id]: true }));

    try {
      const res = await api.post(`/esign/envelopes/${envelope.id}/remind`);
      const sent = res.data?.emailStatus?.sent ?? 0;
      const failed = res.data?.emailStatus?.failed ?? 0;

      if (sent > 0 && failed === 0) {
        showToast('success', `Reminder sent to ${sent} signer${sent > 1 ? 's' : ''}.`);
        setReminderCooldownByEnvelopeId((prev) => ({
          ...prev,
          [envelope.id]: Date.now() + REMINDER_COOLDOWN_MS,
        }));
      } else if (sent > 0 && failed > 0) {
        showToast('warning', `Reminder sent to ${sent} signer(s), but ${failed} email(s) failed.`);
        setReminderCooldownByEnvelopeId((prev) => ({
          ...prev,
          [envelope.id]: Date.now() + REMINDER_COOLDOWN_MS,
        }));
      } else {
        showToast('error', 'Could not send reminder emails.');
      }

      loadData();
    } catch (err: any) {
      const retryAfterSeconds = err?.response?.data?.retryAfterSeconds;
      const cooldownUntil = err?.response?.data?.cooldownUntil;
      if (typeof retryAfterSeconds === 'number' && cooldownUntil) {
        setReminderCooldownByEnvelopeId((prev) => ({
          ...prev,
          [envelope.id]: new Date(cooldownUntil).getTime(),
        }));
      }
      showToast('error', err?.response?.data?.error || 'Failed to send reminder.');
    } finally {
      setResendingByEnvelopeId((prev) => ({ ...prev, [envelope.id]: false }));
    }
  };

  const safePdfFilename = (name: string) => {
    const base = (name || 'form')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return `${base || 'form'}.pdf`;
  };

  const closeTemplatePreview = () => {
    if (templatePreview?.blobUrl) {
      URL.revokeObjectURL(templatePreview.blobUrl);
    }
    setTemplatePreview(null);
    setTemplatePreviewLoading(false);
    setTemplatePreviewError(null);
  };

  const openTemplatePreview = async (form: FormDefinition) => {
    if (templatePreview?.blobUrl) {
      URL.revokeObjectURL(templatePreview.blobUrl);
    }

    setTemplatePreview({ form, blobUrl: null });
    setTemplatePreviewLoading(true);
    setTemplatePreviewError(null);

    try {
      const res = await api.get(`/forms/definitions/${encodeURIComponent(form.code)}/pdf`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);

      setTemplatePreview((prev) => {
        if (!prev || prev.form.code !== form.code) return prev;
        return { form, blobUrl };
      });
    } catch (err) {
      console.error('Failed to load PDF preview', err);
      setTemplatePreviewError('Could not load preview. Try downloading instead.');
    } finally {
      setTemplatePreviewLoading(false);
    }
  };

  const downloadOfficialPdf = async (formCode: string, displayName: string) => {
    try {
      const res = await api.get(`/forms/definitions/${encodeURIComponent(formCode)}/pdf?download=1`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safePdfFilename(displayName || formCode);
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      console.error('Failed to download PDF', err);
    }
  };

  const downloadSignedPdf = async (envelopeId: string, propertyStreet?: string) => {
    try {
      const res = await api.get(`/esign/envelopes/${envelopeId}/pdf?download=1`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safePdfFilename(`${propertyStreet || 'contract'}-signed`);
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      console.error('Failed to download signed PDF', err);
    }
  };

  useEffect(() => {
    if (!templatePreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTemplatePreview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [templatePreview]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dealsRes, formsRes, envelopesRes] = await Promise.allSettled([
        api.get('/deals'),
        api.get('/forms/definitions'),
        api.get('/esign/envelopes'),
      ]);

      if (dealsRes.status === 'fulfilled') {
        setDeals(dealsRes.value.data || []);
      } else {
        console.error('Failed to load deals:', dealsRes.reason);
        setDeals([]);
      }

      if (formsRes.status === 'fulfilled') {
        setFormDefs(formsRes.value.data || []);
      } else {
        console.error('Failed to load form definitions:', formsRes.reason);
        setFormDefs([]);
      }

      if (envelopesRes.status === 'fulfilled') {
        setEnvelopes(envelopesRes.value.data || []);
      } else {
        console.error('Failed to load e-sign envelopes:', envelopesRes.reason);
        setEnvelopes([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    setClientsLoading(true);
    try {
      const res = await api.get('/clients');
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load clients for template flow', err);
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  };

  const handleTemplateUpload = async () => {
    if (!templateUploadFile) {
      setTemplateUploadError('Select a PDF to upload.');
      return;
    }

    setTemplateUploadSaving(true);
    setTemplateUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', templateUploadFile);
      if (templateUploadName.trim()) formData.append('displayName', templateUploadName.trim());
      if (templateUploadCategory.trim()) formData.append('category', templateUploadCategory.trim());
      formData.append('usageScope', templateUploadScope);

      await api.post('/forms/definitions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTemplateUploadOpen(false);
      setTemplateUploadFile(null);
      setTemplateUploadName('');
      setTemplateUploadCategory('');
      setTemplateUploadScope('DEAL');
      await loadData();
      showToast('success', 'Template uploaded successfully.');
    } catch (err: any) {
      setTemplateUploadError(err?.response?.data?.error || 'Template upload failed.');
    } finally {
      setTemplateUploadSaving(false);
    }
  };

  const openClientTemplateFlow = async (form: FormDefinition) => {
    setClientTemplateForm(form);
    setClientTemplateSearch('');
    setSelectedClientId('');
    setClientTemplateRole('BUYER');
    if (clients.length === 0) {
      await loadClients();
    }
  };

  const useTemplateForClient = () => {
    if (!clientTemplateForm || !selectedClientId) {
      showToast('warning', 'Select a client first.');
      return;
    }

    const params = new URLSearchParams({
      template: clientTemplateForm.code,
      clientId: selectedClientId,
      role: clientTemplateRole,
    });

    setClientTemplateForm(null);
    navigate(`/deals/new?${params.toString()}`);
  };

  const visibleClients = clients.filter((client) => {
    const q = clientTemplateSearch.trim().toLowerCase();
    if (!q) return true;
    return `${client.name || ''} ${client.email || ''}`.toLowerCase().includes(q);
  });

  // Filter deals based on status
  const activeDeals = deals.filter(d => 
    ['ACTIVE', 'OFFER_SENT', 'UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING'].includes(d.status)
  );
  const completedDeals = deals.filter(d => d.status === 'CLOSED');
  const pendingEnvelopeByDealId = envelopes.reduce<Record<string, SignatureEnvelope>>((acc, env) => {
    if (!env.signers.some((signer) => !signer.signedAt)) {
      return acc;
    }

    const existing = acc[env.dealId];
    if (!existing || new Date(env.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      acc[env.dealId] = env;
    }

    return acc;
  }, {});

  const dealsWithPendingSignatures = Object.values(pendingEnvelopeByDealId)
    .map((env) => env.deal || deals.find((deal) => deal.id === env.dealId))
    .filter(Boolean) as Deal[];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesDeal = (deal: Deal) => {
    if (!normalizedQuery) return true;
    const buyer = formatPersonName(deal.buyer);
    const seller = formatPersonName(deal.seller);
    const text = [
      deal.title,
      getDealFullAddress(deal),
      buyer,
      seller,
    ].join(' ').toLowerCase();
    return text.includes(normalizedQuery);
  };

  const filteredActiveDeals = activeDeals.filter(matchesDeal);
  const filteredPendingDeals = dealsWithPendingSignatures.filter(matchesDeal);
  const filteredCompletedDeals = completedDeals.filter(matchesDeal);

  const focusWorkspace = (workspace: ContractsWorkspace) => {
    setActiveWorkspace(workspace);
    if (workspace === 'pending') setShowPending(true);
    if (workspace === 'templates') setShowTemplates(true);
    if (workspace === 'archive') setShowArchive(true);

    window.setTimeout(() => {
      const target = document.getElementById(CONTRACTS_SECTION_IDS[workspace]);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  };

  const handleSendWorkspaceAction = () => {
    if (filteredPendingDeals.length > 0) {
      focusWorkspace('pending');
      return;
    }

    if (filteredActiveDeals.length === 1) {
      setSelectedDeal(filteredActiveDeals[0]);
      showToast('success', 'Opened the send flow for your ready contract.');
      return;
    }

    if (filteredActiveDeals.length > 1) {
      focusWorkspace('active');
      showToast('warning', 'Choose the deal you want to send from Active Contracts below.');
      return;
    }

    showToast('warning', 'Create a deal first so there is a contract packet to send.');
    navigate('/deals/new');
  };

  const handleStandaloneDocumentEsign = () => {
    navigate('/contracts/pdf-editor?mode=document-esign');
  };

  useEffect(() => {
    const dealId = (location.state as { dealId?: string } | null)?.dealId;
    if (!dealId || deals.length === 0) return;
    setHighlightDealId(dealId);

    setTimeout(() => {
      const el = document.getElementById(`deal-card-${dealId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    const timer = setTimeout(() => setHighlightDealId(null), 2500);
    return () => clearTimeout(timer);
  }, [location.state, deals.length]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
      OFFER_SENT: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
      UNDER_CONTRACT: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
      DUE_DILIGENCE: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30',
      FINANCING: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
      CLOSED: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30',
      DRAFT: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30',
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30';
  };

  const buildDefaultSubject = buildDefaultSubjectForDeal;
  const buildDefaultMessage = () =>
    'Please review and e-sign your contract packet. It takes about 1-2 minutes.';

  const buildQuickSignersFromDeal = (deal: Deal) => {
    const quickSigners: { role: string; name: string; email: string }[] = [];

    const buyerName = deal.buyer
      ? `${deal.buyer.firstName || ''} ${deal.buyer.lastName || ''}`.trim()
      : '';
    const buyerEmail = deal.buyer?.email?.trim() || '';
    if (buyerName) {
      quickSigners.push({
        role: 'BUYER',
        name: buyerName,
        email: isValidEmailAddress(buyerEmail) ? buyerEmail : '',
      });
    }

    const sellerName = deal.seller
      ? `${deal.seller.firstName || ''} ${deal.seller.lastName || ''}`.trim()
      : '';
    const sellerEmail = deal.seller?.email?.trim() || '';
    if (sellerName) {
      quickSigners.push({
        role: 'SELLER',
        name: sellerName,
        email: isValidEmailAddress(sellerEmail) ? sellerEmail : '',
      });
    }

    return quickSigners;
  };

  const canQuickSendFromDeal = (deal: Deal) => Boolean(deal.repc) && buildQuickSignersFromDeal(deal).length > 0;

  const sendEnvelopeForDeal = async (
    deal: Deal,
    payload: SendEnvelopePayload,
    options: { quick?: boolean; closeModal?: boolean } = {},
  ) => {
    const res = await api.post('/esign/envelopes', {
      dealId: deal.id,
      type: 'REPC',
      signers: payload.signers,
      subject: payload.subject,
      message: payload.message,
      sendEmails: payload.sendEmails,
    });

    const feedback = buildEnvelopeSendToast(res.data?.emailStatus, { quick: options.quick });
    showToast(feedback.type, feedback.message);

    setLastSignLinks(res.data?.links || null);
    if (options.closeModal) setSelectedDeal(null);
    await loadData();
  };

  const quickSendForSignature = async (deal: Deal) => {
    if (quickSendingDealId === deal.id) return;

    if (!deal.repc) {
      showToast('warning', 'Complete the contract details first. Opening your Contracts workspace now.');
      navigate(`/contracts/${deal.id}`);
      return;
    }

    const quickSigners = buildQuickSignersFromDeal(deal);
    if (quickSigners.length === 0) {
      showToast('warning', 'Quick send needs at least one buyer or seller name. Opening setup.');
      setSelectedDeal(deal);
      return;
    }

    setQuickSendingDealId(deal.id);
    try {
      await sendEnvelopeForDeal(
        deal,
        {
          signers: quickSigners,
          subject: buildDefaultSubject(deal),
          message: buildDefaultMessage(),
          sendEmails: quickSigners.some((signer) => Boolean(signer.email)),
        },
        { quick: true },
      );
    } catch (err: any) {
      console.error('Quick send failed:', err);
      showToast('error', err?.response?.data?.error || 'Quick send failed. Please try again.');
    } finally {
      setQuickSendingDealId(null);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/90 text-white' 
            : toast.type === 'warning'
            ? 'bg-amber-500/90 text-white'
            : 'bg-red-500/90 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : toast.type === 'warning' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

    <div className="space-y-6">
      <PageHeader
        title="Contracts & E-Sign"
        subtitle="Manage your real estate contracts, send for signatures, and track deal progress"
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/contracts/pdf-editor')}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[40px] bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:text-white dark:hover:bg-white/10 dark:active:bg-white/15"
              title="PDF Editor"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden sm:inline">PDF Editor</span>
            </button>
            <Button onClick={() => navigate('/deals/new')} className="min-h-[40px]">
              <svg className="w-4 h-4 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Contract</span>
            </Button>
          </div>
        }
      />

      <Card className="p-5 border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 shadow-sm dark:border-white/10 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-300/70">Contracts Workflow</div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-950 mt-2 dark:text-white">Clear steps from draft to signed contract</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 dark:text-slate-400">Start with the deal, verify core fields, then send signatures and track completions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/contracts/pdf-editor')}
            >
              Open PDF Editor
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/deals/new')}
            >
              Start REPC
            </Button>
            <Button
              size="sm"
              onClick={() => {
                focusWorkspace('pending');
              }}
            >
              Open Signature Inbox
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="text-slate-500 dark:text-slate-500">Active deals</div>
            <div className="text-base font-semibold text-slate-950 mt-1 dark:text-white">{activeDeals.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="text-slate-500 dark:text-slate-500">Pending signatures</div>
            <div className="text-base font-semibold text-slate-950 mt-1 dark:text-white">{dealsWithPendingSignatures.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="text-slate-500 dark:text-slate-500">Templates ready</div>
            <div className="text-base font-semibold text-slate-950 mt-1 dark:text-white">{formDefs.length}</div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <QuickStatCard
          label="Active Contracts"
          value={activeDeals.length}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          color="blue"
        />
        <QuickStatCard
          label="Awaiting Signatures"
          value={dealsWithPendingSignatures.length}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
          color="yellow"
        />
        <QuickStatCard
          label="Closed This Month"
          value={completedDeals.filter(d => {
            const closedDate = new Date(d.createdAt);
            const now = new Date();
            return closedDate.getMonth() === now.getMonth() && closedDate.getFullYear() === now.getFullYear();
          }).length}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="green"
        />
        <QuickStatCard
          label="Form Templates"
          value={formDefs.length}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          }
          color="purple"
        />
      </div>

      {/* Workflow */}
      <div className="grid gap-3 md:grid-cols-3">
        <WorkflowCard
          title="Start a REPC"
          description="Create a new deal and launch the contract wizard."
          actionLabel="New Deal"
          onClick={() => navigate('/deals/new')}
        />
        <WorkflowCard
          title="Send for e-sign"
          description="Upload a PDF for standalone e-sign, or send a saved deal packet."
          actionLabel="E-sign Document"
          onClick={handleStandaloneDocumentEsign}
          secondaryActionLabel={filteredPendingDeals.length > 0 ? 'Open Inbox' : filteredActiveDeals.length === 1 ? 'Send Deal' : 'Choose Deal'}
          onSecondaryClick={handleSendWorkspaceAction}
        />
        <WorkflowCard
          title="Edit PDFs"
          description="Merge, reorder, and export contract packets."
          actionLabel="PDF Editor"
          onClick={() => navigate('/contracts/pdf-editor')}
        />
      </div>

      {/* Search + toggles */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by address, buyer, or seller"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => focusWorkspace('active')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeWorkspace === 'active'
                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-500/30'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:text-white'
            }`}
          >
            Active Contracts
          </button>
          <button
            onClick={() => focusWorkspace('pending')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeWorkspace === 'pending'
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/30'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:text-white'
            }`}
          >
            Signature Inbox {filteredPendingDeals.length > 0 ? `(${filteredPendingDeals.length})` : ''}
          </button>
          <button
            onClick={() => focusWorkspace('templates')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeWorkspace === 'templates'
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/30'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:text-white'
            }`}
          >
            Templates {formDefs.length > 0 ? `(${formDefs.length})` : ''}
          </button>
          <button
            onClick={() => focusWorkspace('archive')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeWorkspace === 'archive'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:text-white'
            }`}
          >
            Archive {filteredCompletedDeals.length > 0 ? `(${filteredCompletedDeals.length})` : ''}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-10">
          <section id={CONTRACTS_SECTION_IDS.active} className="space-y-4 scroll-mt-24">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Active Contracts</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">{filteredActiveDeals.length} active deals</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleSendWorkspaceAction}>
                  {filteredPendingDeals.length > 0 ? 'Review signatures' : 'Send for e-sign'}
                </Button>
                <Button size="sm" onClick={() => navigate('/deals/new')}>
                  New Contract
                </Button>
              </div>
            </div>
            {filteredActiveDeals.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                title="No active contracts"
                description="Start a new deal to create your first contract"
                action={
                  <Button onClick={() => navigate('/deals/new')}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Deal
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4">
                {filteredActiveDeals.map((deal) => (
                  <div
                    key={deal.id}
                    id={`deal-card-${deal.id}`}
                    className={highlightDealId === deal.id ? 'ring-2 ring-blue-500/60 rounded-2xl' : ''}
                  >
                    <DealCard
                      deal={deal}
                      onViewContract={() => navigate(`/contracts/${deal.id}`)}
                      onQuickSend={() => quickSendForSignature(deal)}
                      quickSendReady={canQuickSendFromDeal(deal)}
                      quickSendBusy={quickSendingDealId === deal.id}
                      onSendForSignature={() => setSelectedDeal(deal)}
                      formatPrice={formatPrice}
                      formatDate={formatDate}
                      getStatusColor={getStatusColor}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {showPending && (
            <section id={CONTRACTS_SECTION_IDS.pending} className="space-y-4 scroll-mt-24">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Signature Inbox</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{filteredPendingDeals.length} awaiting signatures</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => focusWorkspace('active')}>
                  Back to active contracts
                </Button>
              </div>
              {filteredPendingDeals.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  }
                  title="No pending signatures"
                  description="All your contracts are signed or you haven't sent any for signature yet"
                />
              ) : (
                <div className="grid gap-4">
                  {filteredPendingDeals.map((deal) => (
                    <div
                      key={deal.id}
                      id={`deal-card-${deal.id}`}
                      className={highlightDealId === deal.id ? 'ring-2 ring-blue-500/60 rounded-2xl' : ''}
                    >
                      <SignatureCard
                        deal={deal}
                        envelope={pendingEnvelopeByDealId[deal.id]}
                        onResend={() => remindPendingSigners(deal.id)}
                        onView={() => navigate(`/contracts/${deal.id}`)}
                        onDownload={() => {
                          const env = pendingEnvelopeByDealId[deal.id];
                          if (env?.id) downloadSignedPdf(env.id, deal.property?.street);
                        }}
                        resendDisabled={Boolean(
                          pendingEnvelopeByDealId[deal.id]?.id &&
                          (resendingByEnvelopeId[pendingEnvelopeByDealId[deal.id].id] ||
                            Boolean(getReminderCooldownLabel(pendingEnvelopeByDealId[deal.id].id))),
                        )}
                        resendLabel={
                          pendingEnvelopeByDealId[deal.id]?.id
                            ? (resendingByEnvelopeId[pendingEnvelopeByDealId[deal.id].id]
                                ? 'Sending...'
                                : getReminderCooldownLabel(pendingEnvelopeByDealId[deal.id].id))
                            : null
                        }
                        formatDate={formatDate}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {showTemplates && (
            <section id={CONTRACTS_SECTION_IDS.templates} className="space-y-4 scroll-mt-24">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Templates & PDFs</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Browse Utah forms and edit documents</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setTemplateUploadOpen(true)}>
                    Upload template
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate('/contracts/pdf-editor')}>
                    Open PDF Editor
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <PdfToolCard onClick={() => navigate('/contracts/pdf-editor')} />
                {formDefs.map((form) => (
                  <FormTemplateCard
                    key={form.id}
                    form={form}
                    onStartDeal={() => navigate(`/deals/new?template=${encodeURIComponent(form.code)}`)}
                    onUseClient={() => openClientTemplateFlow(form)}
                    onViewPdf={() => openTemplatePreview(form)}
                    onDownloadPdf={() => downloadOfficialPdf(form.code, form.displayName)}
                  />
                ))}
              </div>
            </section>
          )}

          {showArchive && (
            <section id={CONTRACTS_SECTION_IDS.archive} className="space-y-4 scroll-mt-24">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Closed Contracts</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{filteredCompletedDeals.length} closed deals</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => focusWorkspace('active')}>
                  Back to active contracts
                </Button>
              </div>
              {filteredCompletedDeals.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="No completed contracts"
                  description="Closed deals will appear here"
                />
              ) : (
                <div className="grid gap-4">
                  {filteredCompletedDeals.map((deal) => (
                    <div
                      key={deal.id}
                      id={`deal-card-${deal.id}`}
                      className={highlightDealId === deal.id ? 'ring-2 ring-blue-500/60 rounded-2xl' : ''}
                    >
                      <DealCard
                        deal={deal}
                        onViewContract={() => navigate(`/contracts/${deal.id}`)}
                        formatPrice={formatPrice}
                        formatDate={formatDate}
                        getStatusColor={getStatusColor}
                        completed
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Send for Signature Modal */}
      {selectedDeal && (
        <SendForSignatureModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onNavigateToRepc={() => {
            setSelectedDeal(null);
            navigate(`/contracts/${selectedDeal.id}`);
          }}
          onSend={async (payload) => {
            try {
              await sendEnvelopeForDeal(selectedDeal, payload, { closeModal: true });
            } catch (err: any) {
              console.error('Failed to send for signature:', err);
              showToast('error', err?.response?.data?.error || 'Failed to send for signature. Please try again.');
            }
          }}
        />
      )}

      {lastSignLinks && lastSignLinks.length > 0 && (
        <CopyLinksModal
          links={lastSignLinks}
          onClose={() => setLastSignLinks(null)}
        />
      )}

      {/* Form Template Preview Modal */}
      {templatePreview && (
        <FormTemplatePreviewModal
          title={templatePreview.form.displayName}
          subtitle={templatePreview.form.code}
          blobUrl={templatePreview.blobUrl}
          isLoading={templatePreviewLoading}
          error={templatePreviewError}
          onClose={closeTemplatePreview}
          onDownload={() => downloadOfficialPdf(templatePreview.form.code, templatePreview.form.displayName)}
        />
      )}

      {templateUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm dark:bg-slate-950/80" onClick={() => setTemplateUploadOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Upload Custom Template</h3>
              <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setTemplateUploadOpen(false)}>✕</button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setTemplateUploadFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 file:text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <input
                value={templateUploadName}
                onChange={(e) => setTemplateUploadName(e.target.value)}
                placeholder="Template name (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
              />
              <input
                value={templateUploadCategory}
                onChange={(e) => setTemplateUploadCategory(e.target.value)}
                placeholder="Category (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
              />
              <select
                value={templateUploadScope}
                onChange={(e) => setTemplateUploadScope(e.target.value as 'DEAL' | 'CLIENT' | 'BOTH')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
              >
                <option value="DEAL" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Use for deals</option>
                <option value="CLIENT" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Use for clients</option>
                <option value="BOTH" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Use for both</option>
              </select>

              {templateUploadError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{templateUploadError}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => setTemplateUploadOpen(false)}>Cancel</Button>
                <Button onClick={handleTemplateUpload} disabled={templateUploadSaving}>
                  {templateUploadSaving ? 'Uploading…' : 'Upload'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {clientTemplateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm dark:bg-slate-950/80" onClick={() => setClientTemplateForm(null)}>
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Use template with a client</h3>
              <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setClientTemplateForm(null)}>✕</button>
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Template: {clientTemplateForm.displayName}</div>

            <div className="mt-4 space-y-3">
              <input
                value={clientTemplateSearch}
                onChange={(e) => setClientTemplateSearch(e.target.value)}
                placeholder="Search clients"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
              />
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                disabled={clientsLoading}
              >
                <option value="" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Select client</option>
                {visibleClients.map((client) => (
                  <option key={client.id} value={client.id} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                    {client.name}{client.email ? ` • ${client.email}` : ''}
                  </option>
                ))}
              </select>
              <select
                value={clientTemplateRole}
                onChange={(e) => setClientTemplateRole(e.target.value as 'BUYER' | 'SELLER')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
              >
                <option value="BUYER" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Attach as Buyer</option>
                <option value="SELLER" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Attach as Seller</option>
              </select>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => setClientTemplateForm(null)}>Cancel</Button>
                <Button onClick={useTemplateForClient} disabled={!selectedClientId}>Start Deal with Client</Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

function FormTemplatePreviewModal({
  title,
  subtitle,
  blobUrl,
  isLoading,
  error,
  onClose,
  onDownload,
}: {
  title: string;
  subtitle: string;
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onDownload: () => void;
}) {
  const modal = (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xl" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="relative w-full max-w-5xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Form preview"
        >
          <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-emerald-500/10 blur-xl opacity-80" />

          <div className="relative rounded-[24px] border border-slate-200/80 dark:border-white/12 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-900/95 dark:via-slate-950/95 dark:to-black/90 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onDownload}
                    className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-all min-h-[40px] dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-300 transition-all dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 dark:hover:border-red-500/30"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden dark:border-white/10 dark:bg-slate-950/40">
                {isLoading ? (
                  <div className="h-[70vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : error ? (
                  <div className="h-[70vh] flex flex-col items-center justify-center px-6 text-center">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Preview unavailable</div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 max-w-md">{error}</div>
                    <button
                      type="button"
                      onClick={onDownload}
                      className="mt-4 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-all dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/20"
                    >
                      Download PDF
                    </button>
                  </div>
                ) : blobUrl ? (
                  <iframe
                    src={blobUrl}
                    title={`${title} preview`}
                    className="w-full h-[70vh]"
                  />
                ) : (
                  <div className="h-[70vh] flex items-center justify-center text-xs text-slate-600 dark:text-slate-400">
                    Preparing preview…
                  </div>
                )}
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                Tip: Press Esc to close.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function WorkflowCard({
  title,
  description,
  actionLabel,
  onClick,
  secondaryActionLabel,
  onSecondaryClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  secondaryActionLabel?: string;
  onSecondaryClick?: () => void;
}) {
  if (secondaryActionLabel && onSecondaryClick) {
    return (
      <div className="ae-theme-card contract-workflow-card group rounded-2xl border p-4 text-left transition-all hover:border-cyan-300 hover:shadow-md dark:hover:border-cyan-500/30 dark:hover:shadow-[0_20px_40px_rgba(14,116,144,0.2)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">{title}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{description}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:justify-end">
            <button
              type="button"
              onClick={onClick}
              className="contract-workflow-action contract-workflow-action-primary inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              {actionLabel}
            </button>
            <button
              type="button"
              onClick={onSecondaryClick}
              className="contract-workflow-action contract-workflow-action-secondary inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              {secondaryActionLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="ae-theme-card contract-workflow-card group rounded-2xl border p-4 text-left transition-all hover:border-cyan-300 hover:shadow-md dark:hover:border-cyan-500/30 dark:hover:shadow-[0_20px_40px_rgba(14,116,144,0.2)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{description}</div>
        </div>
        <div className="contract-workflow-action contract-workflow-action-secondary rounded-full border px-3 py-1 text-xs font-semibold">
          {actionLabel}
        </div>
      </div>
    </button>
  );
}

function PdfToolCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ae-theme-card contract-pdf-tool-card group rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-400/35"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50 p-2 text-emerald-700 transition-colors dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-200">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">PDF Editor</div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Merge, reorder, and export contract packets.</div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
            Open editor
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

// Quick Stat Card Component
function QuickStatCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'from-blue-50 to-white border-blue-200 text-blue-700 dark:from-blue-500/20 dark:to-blue-600/10 dark:border-blue-500/30 dark:text-blue-400',
    green: 'from-green-50 to-white border-green-200 text-green-700 dark:from-green-500/20 dark:to-green-600/10 dark:border-green-500/30 dark:text-green-400',
    yellow: 'from-yellow-50 to-white border-yellow-200 text-yellow-800 dark:from-yellow-500/20 dark:to-yellow-600/10 dark:border-yellow-500/30 dark:text-yellow-400',
    purple: 'from-purple-50 to-white border-purple-200 text-purple-700 dark:from-purple-500/20 dark:to-purple-600/10 dark:border-purple-500/30 dark:text-purple-400',
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colorClasses[color]} border p-4 shadow-sm dark:shadow-none`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
        </div>
        <div className={colorClasses[color]}>{icon}</div>
      </div>
    </div>
  );
}

// Deal Card Component
function DealCard({
  deal,
  onViewContract,
  onQuickSend,
  quickSendReady,
  quickSendBusy,
  onSendForSignature,
  formatPrice,
  formatDate,
  getStatusColor,
  completed,
}: {
  deal: Deal;
  onViewContract: () => void;
  onQuickSend?: () => void;
  quickSendReady?: boolean;
  quickSendBusy?: boolean;
  onSendForSignature?: () => void;
  formatPrice: (price: number) => string;
  formatDate: (date: string) => string;
  getStatusColor: (status: string) => string;
  completed?: boolean;
}) {
  const dealTitle = getDealDisplayTitle(deal);
  const dealAddressLine = getDealAddressLine(deal);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getDealFullAddress(deal))}`;

  return (
    <Card className="p-4 hover:border-blue-500/30 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-950 truncate dark:text-white">
              {dealTitle}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(deal.status)}`}>
              {deal.status.replace(/_/g, ' ')}
            </span>
          </div>
          
          {dealAddressLine && (
            <p className="text-sm text-slate-600 mb-3 dark:text-slate-400">
              {dealAddressLine}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            {deal.buyer && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Buyer:</span>
                <span className="text-slate-900 dark:text-white">{deal.buyer.firstName} {deal.buyer.lastName}</span>
              </div>
            )}
            {deal.seller && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Seller:</span>
                <span className="text-slate-900 dark:text-white">{deal.seller.firstName} {deal.seller.lastName}</span>
              </div>
            )}
            {deal.repc && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Price:</span>
                <span className="text-green-700 font-semibold dark:text-green-400">
                  {formatPrice(deal.repc.purchasePrice)}
                </span>
              </div>
            )}
            {deal.repc?.settlementDeadline && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Settlement:</span>
                <span className="text-slate-900 dark:text-white">{formatDate(deal.repc.settlementDeadline)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-2 dark:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5s-3 1.343-3 3 1.343 3 3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11c0 7-7 11-7 11S5 18 5 11a7 7 0 1114 0z" />
            </svg>
            Map
          </a>
          <button
            onClick={onViewContract}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Open Contracts
          </button>
          
          {!completed && onQuickSend && (
            <button
              onClick={onQuickSend}
              disabled={quickSendBusy}
              className={`px-3 py-2 rounded-xl border text-sm transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                quickSendReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:border-amber-400/35 dark:text-amber-100 dark:hover:bg-amber-500/25'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              {quickSendBusy ? 'Quick Sending...' : quickSendReady ? 'Quick Send' : 'Quick Send Setup'}
            </button>
          )}

          {!completed && onSendForSignature && (
            <button
              onClick={onSendForSignature}
              className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 hover:bg-blue-100 transition-all flex items-center gap-2 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Advanced Send
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Signature Card Component
function SignatureCard({ deal, envelope, onResend, onView, onDownload, resendDisabled, resendLabel, formatDate }: {
  deal: Deal;
  envelope?: SignatureEnvelope;
  onResend: () => void;
  onView: () => void;
  onDownload?: () => void;
  resendDisabled?: boolean;
  resendLabel?: string | null;
  formatDate: (date: string) => string;
}) {
  const signers = envelope?.signers?.length
    ? envelope.signers.map((signer) => ({
        name: signer.name || 'Signer',
        role: signer.role,
        viewed: Boolean(signer.viewedAt),
        viewedAt: signer.viewedAt,
        signed: Boolean(signer.signedAt),
        signedAt: signer.signedAt,
        lastActivityAt: signer.signedAt || signer.viewedAt || envelope.createdAt,
      }))
    : [
        { name: deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}` : 'Buyer', role: 'BUYER', viewed: false, signed: false, lastActivityAt: envelope?.createdAt || deal.createdAt },
        { name: deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName}` : 'Seller', role: 'SELLER', viewed: false, signed: false, lastActivityAt: envelope?.createdAt || deal.createdAt },
      ];

  const signersWithState = signers.map((signer) => {
    const lastActivityAt = signer.lastActivityAt || envelope?.createdAt || deal.createdAt;
    const isStalled = !signer.signed && (Date.now() - new Date(lastActivityAt).getTime()) >= SIGNER_STALLED_MS;
    return {
      ...signer,
      lastActivityAt,
      isStalled,
    };
  });

  const viewedCount = signersWithState.filter((s) => s.viewed).length;
  const stalledCount = signersWithState.filter((s) => s.isStalled).length;
  const percentComplete = signersWithState.length
    ? (signersWithState.filter((s) => s.signed).length / signersWithState.length) * 100
    : 0;
  const isComplete = percentComplete === 100;
  const dealTitle = getDealDisplayTitle(deal);
  const lastReminderLabel = (() => {
    if (!envelope?.lastReminderSentAt) return null;
    const diffMs = Date.now() - new Date(envelope.lastReminderSentAt).getTime();
    if (diffMs < 60_000) return 'Auto reminder just sent';
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) return `Last reminder ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last reminder ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Last reminder ${diffDays}d ago`;
  })();

  return (
    <Card className="group relative overflow-hidden border border-slate-200 bg-white transition-all duration-300 hover:border-blue-300 hover:shadow-md dark:border-white/5 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:hover:border-blue-500/30 dark:hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)]">
      {/* Progress Bar Background */}
      <div className="absolute top-0 left-0 h-1 bg-slate-200 w-full dark:bg-slate-800" />
      <div 
        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000"
        style={{ width: `${percentComplete}%` }}
      />

      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-slate-950 tracking-tight truncate dark:text-white">
              {dealTitle}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5">
              REPC
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-6 dark:text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Sent {formatDate(envelope?.createdAt || deal.createdAt)}
          </div>

          <div className="flex items-center gap-8">
            <div className="flex -space-x-4">
              {signersWithState.map((signer, idx) => (
                <div key={idx} className="relative group/signer">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white transition-transform hover:scale-110 hover:z-10 dark:ring-[#0b1221] ${
                    signer.signed 
                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-green-900/20' 
                      : signer.viewed
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-900/20'
                      : signer.isStalled
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-900/30'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {signer.name.charAt(0)}
                    {signer.signed && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-slate-900 text-xs rounded opacity-0 group-hover/signer:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-200 shadow-lg dark:bg-slate-800 dark:text-white dark:border-white/10">
                    <div className="font-semibold">{signer.name}</div>
                    <div className="text-slate-500 text-[10px] dark:text-slate-400">
                      {signer.role} • {signer.signed ? `Signed ${'signedAt' in signer && signer.signedAt ? formatDate(signer.signedAt) : ''}` : signer.viewed ? `Viewed ${'viewedAt' in signer && signer.viewedAt ? formatDate(signer.viewedAt) : ''}` : signer.isStalled ? `Stalled since ${formatDate(signer.lastActivityAt)}` : 'Sent'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="h-8 w-px bg-slate-200 hidden md:block dark:bg-white/10" />

            <div className="hidden md:block">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Status</div>
              <div className={`text-sm font-bold ${isComplete ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}`}>
                {isComplete ? 'Complete' : `${signersWithState.filter(s => s.signed).length}/${signersWithState.length} Signed`}
              </div>
              {!isComplete && (
                <div className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{viewedCount}/{signersWithState.length} viewed</div>
              )}
              {!isComplete && stalledCount > 0 && (
                <div className="text-xs text-amber-700 mt-0.5 dark:text-amber-300">{stalledCount} signer{stalledCount > 1 ? 's' : ''} stalled 24h+</div>
              )}
              {!isComplete && lastReminderLabel && (
                <div className="text-xs text-cyan-700 mt-0.5 dark:text-cyan-300">{lastReminderLabel}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onView}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            View Document
          </button>
          {!isComplete && (
            <button
              onClick={onResend}
              disabled={resendDisabled}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 border border-blue-400/20 text-sm font-bold text-white hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {resendLabel || 'Send Reminder'}
            </button>
          )}
          {isComplete && (
            <button
              onClick={onDownload}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Form Template Card Component
function FormTemplateCard({
  form,
  onStartDeal,
  onUseClient,
  onViewPdf,
  onDownloadPdf,
}: {
  form: FormDefinition;
  onStartDeal: () => void;
  onUseClient: () => void;
  onViewPdf: () => void;
  onDownloadPdf: () => void;
}) {
  const usageScope = form.schemaJson?.usageScope || 'DEAL';
  const supportsDeal = usageScope === 'DEAL' || usageScope === 'BOTH';
  const supportsClient = usageScope === 'CLIENT' || usageScope === 'BOTH';
  const isCustom = form.version === 'custom-upload' || form.schemaJson?.source === 'custom-upload';

  const categoryColors: Record<string, string> = {
    Purchase: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    Contract: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    Addendum: 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    Addenda: 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    Disclosure: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    Disclosures: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
    General: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
    'Other': 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  };

  return (
    <div 
      className="ae-theme-card contract-template-card group flex min-h-[148px] flex-col rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:hover:border-cyan-300/35"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-600 transition-colors group-hover:border-cyan-200 group-hover:text-cyan-700 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300 dark:group-hover:border-cyan-300/25 dark:group-hover:text-cyan-200">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 truncate text-sm font-semibold text-slate-950 transition-colors group-hover:text-cyan-800 dark:text-white dark:group-hover:text-cyan-100">
            {form.displayName}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColors[form.category] || categoryColors.Other}`}>
              {form.category}
            </span>
            <span className="inline-block rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:border-cyan-300/25 dark:bg-cyan-400/10 dark:text-cyan-100">
              {usageScope === 'BOTH' ? 'Deal + Client' : usageScope === 'CLIENT' ? 'Client' : 'Deal'}
            </span>
            {isCustom && (
              <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-100">
                Custom
              </span>
            )}
            {form.version ? (
              <span className="text-xs text-slate-500">
                v{form.version}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-1 gap-2 pt-4">
        {supportsDeal && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartDeal();
            }}
            className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/16"
          >
            Start Deal With Template
          </button>
        )}
        {supportsClient && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUseClient();
            }}
            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-100 dark:hover:bg-blue-400/16"
          >
            Use With Client
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewPdf();
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200 dark:hover:bg-white/[0.075]"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDownloadPdf();
            }}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-100 dark:hover:bg-blue-400/16"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-slate-600 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}

// Send for Signature Modal - Enhanced with document selection and helpful empty states
function SendForSignatureModal({ deal, onClose, onSend, onNavigateToRepc }: {
  deal: Deal;
  onClose: () => void;
  onSend: (payload: { signers: { role: string; name: string; email: string }[]; subject: string; message: string; sendEmails?: boolean }) => void;
  onNavigateToRepc: () => void;
}) {
  const hasRepc = !!deal.repc;
  const [step, setStep] = useState<'documents' | 'recipients' | 'preview'>(hasRepc ? 'recipients' : 'documents');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Initialize with buyer/seller toggled on only if we have their info
  const [signers, setSigners] = useState([
    { 
      role: 'BUYER', 
      name: deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}` : '', 
      email: deal.buyer?.email || '',
      included: true,
    },
    { 
      role: 'SELLER', 
      name: deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName}` : '', 
      email: deal.seller?.email || '',
      included: true,
    },
  ]);
  const [subject, setSubject] = useState(buildDefaultSubjectForDeal(deal));
  const [message, setMessage] = useState('Please review and e-sign your contract packet. It takes about 1-2 minutes.');
  const [sending, setSending] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const includedSigners = signers.filter(s => s.included);
  const readySigners = includedSigners.filter(s => s.name.trim() && (!s.email.trim() || isValidEmail(s.email)));
  const emailedSigners = includedSigners.filter(s => s.name.trim() && s.email.trim() && isValidEmail(s.email));
  const linkOnlySigners = includedSigners.filter(s => s.name.trim() && !s.email.trim());
  const invalidEmailCount = includedSigners.filter((s) => s.email.trim() && !isValidEmail(s.email)).length;
  const missingNameCount = includedSigners.filter((s) => !s.name.trim()).length;
  const canSend = includedSigners.length > 0 && missingNameCount === 0 && invalidEmailCount === 0;
  const primaryActionLabel = emailedSigners.length > 0 ? 'Review & Send' : 'Review & Create Links';

  const autofillFromDealContacts = () => {
    const buyerName = deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}`.trim() : '';
    const sellerName = deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName}`.trim() : '';

    setSigners((prev) => {
      const next = [...prev];
      if (!next[0]) {
        next[0] = { role: 'BUYER', name: '', email: '', included: true };
      }
      if (!next[1]) {
        next[1] = { role: 'SELLER', name: '', email: '', included: true };
      }

      next[0] = {
        ...next[0],
        role: 'BUYER',
        name: buyerName,
        email: deal.buyer?.email || '',
        included: true,
      };
      next[1] = {
        ...next[1],
        role: 'SELLER',
        name: sellerName,
        email: deal.seller?.email || '',
        included: true,
      };

      return next;
    });
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    const payload = {
      signers: includedSigners.map(s => ({ role: s.role, name: s.name.trim(), email: s.email.trim() })),
      subject,
      message,
      sendEmails: emailedSigners.length > 0,
    };
    await onSend(payload);
    setSending(false);
  };

  const handlePreview = async () => {
    if (!canSend) return;
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      // Fetch the PDF blob
      const token = localStorage.getItem('utahcontracts_token');
      if (!token) {
        throw new Error('You are not authenticated. Please sign in again and retry.');
      }
      let response: Response | null = null;
      
      // Try deal-specific REPC PDF first
      if (deal.repc?.id) {
        try {
          response = await fetch(`/api/deals/${deal.id}/repc/pdf`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (e) {
          console.warn('Deal PDF failed, falling back to template:', e);
        }
      }
      
      // Fallback to blank REPC template
      if (!response || !response.ok) {
        response = await fetch('/api/forms/definitions/REPC/pdf', {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      if (response.ok) {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setStep('preview');
        return;
      }

      const fallbackMessage = `Unable to open preview (HTTP ${response.status})`;
      let details = '';
      try {
        details = await response.text();
      } catch {
        details = '';
      }
      const message = details?.trim() ? `${fallbackMessage}: ${details.trim()}` : fallbackMessage;
      setPreviewError(message);
    } catch (err) {
      console.error('Failed to load PDF preview:', err);
      const message = err instanceof Error ? err.message : 'Failed to load PDF preview. Please try again.';
      setPreviewError(message);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const updateSigner = (index: number, field: string, value: string | boolean) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    setSigners(updated);
  };

  const addRecipient = () => {
    setSigners([...signers, { role: 'OTHER', name: '', email: '', included: true }]);
  };

  const removeRecipient = (index: number) => {
    if (signers.length <= 1) return;
    setSigners(signers.filter((_, i) => i !== index));
  };

  // No documents available - show helpful guidance
  if (step === 'documents' && !hasRepc) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0b1221] border border-slate-200/80 dark:border-white/10 shadow-2xl ring-1 ring-white/5">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-amber-600/10 to-orange-600/10 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                Prepare Documents
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 pl-10">{getDealDisplayTitle(deal)}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close e-sign modal"
              title="Close"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300/70 bg-white/70 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-500/35 dark:hover:bg-red-500/15 dark:hover:text-red-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Info Banner */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No contract documents ready yet</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-1">
                    Before sending for signatures, you need to prepare the contract documents. Choose an option below to get started.
                  </p>
                </div>
              </div>
            </div>

            {/* Option: Fill REPC */}
            <button
              onClick={() => {
                onClose();
                onNavigateToRepc();
              }}
              className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all text-left group dark:border-white/10 dark:bg-white/5 dark:hover:bg-blue-500/10 dark:hover:border-blue-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">Fill Out REPC Form</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Use the Utah Real Estate Purchase Contract wizard to draft the terms and conditions for this deal.
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-blue-600 dark:text-blue-400">
                    <span>Recommended for Utah transactions</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* Option: PDF Editor (coming soon style) */}
            <div className="w-full p-4 rounded-xl border border-slate-200 bg-slate-100 text-left opacity-60 dark:border-white/5 dark:bg-slate-900/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700/50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-500 dark:text-slate-400">Upload Custom PDF</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    Upload and send your own contract documents for signature.
                  </p>
                  <span className="inline-block mt-2 text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex justify-end dark:border-white/5 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Has documents - show recipient selection
  if (step !== 'preview') {
    return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0b1221] border border-slate-200/80 dark:border-white/10 shadow-2xl ring-1 ring-white/5 my-auto text-slate-900 dark:text-white">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
              Send for Signature
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 pl-10">
              {getDealDisplayTitle(deal)} • REPC
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close e-sign modal"
            title="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300/70 bg-white/70 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-red-500/35 dark:hover:bg-red-500/15 dark:hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Document Summary Banner */}
        <div className="px-4 sm:px-6 py-3 bg-emerald-50 border-b border-slate-200/80 dark:bg-emerald-500/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">REPC Ready to Send</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Purchase Price: ${deal.repc?.purchasePrice?.toLocaleString() || 'Not set'} 
                {deal.repc?.settlementDeadline && ` • Settlement: ${new Date(deal.repc.settlementDeadline).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row max-h-[70vh] md:max-h-none overflow-hidden">
          {/* Signers Column */}
          <div className="w-full md:w-1/2 p-4 sm:p-6 space-y-4 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-white/5 overflow-y-auto max-h-[40vh] md:max-h-[50vh]">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/> Recipients
            </h3>

            <div className="rounded-xl border border-blue-200/70 bg-blue-50/70 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Fast start: pull buyer and seller from this deal. Leave email blank when you want a shareable signing link instead.</span>
                <button
                  type="button"
                  onClick={autofillFromDealContacts}
                  className="rounded-lg border border-blue-300/60 bg-white/70 px-2.5 py-1 font-semibold text-blue-700 hover:bg-white dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100"
                >
                  Autofill Deal Contacts
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {signers.map((signer, index) => (
                <div 
                  key={index} 
                  className={`p-3 sm:p-4 rounded-xl border transition-all ${
                    signer.included 
                      ? 'bg-slate-50 border-slate-200 hover:border-blue-500/30 dark:bg-white/5 dark:border-white/10' 
                      : 'bg-slate-100 border-slate-200 opacity-60 dark:bg-slate-900/30 dark:border-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* Toggle inclusion */}
                      <button
                        type="button"
                        onClick={() => updateSigner(index, 'included', !signer.included)}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          signer.included 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                        }`}
                        title={signer.included ? 'Click to exclude' : 'Click to include'}
                      >
                        {signer.included && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      
                      {/* Role selector */}
                      <select
                        value={signer.role}
                        onChange={(e) => updateSigner(index, 'role', e.target.value)}
                        disabled={!signer.included}
                        className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                      >
                        <option value="BUYER">Buyer</option>
                        <option value="SELLER">Seller</option>
                        <option value="AGENT">Agent</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {signer.included && signer.name.trim() && signer.email.trim() && isValidEmail(signer.email) ? (
                        <span className="text-xs text-green-400 font-medium">Ready to email</span>
                      ) : signer.included && signer.name.trim() && !signer.email.trim() ? (
                        <span className="text-xs text-cyan-500 dark:text-cyan-300 font-medium">Link only</span>
                      ) : signer.included && signer.email.trim() && !isValidEmail(signer.email) ? (
                        <span className="text-xs text-rose-500 dark:text-rose-300 font-medium">Fix email</span>
                      ) : signer.included ? (
                        <span className="text-xs text-amber-400 font-medium">Needs name</span>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">Excluded</span>
                      )}
                      
                      {/* Remove button for added recipients */}
                      {index >= 2 && (
                        <button
                          type="button"
                          onClick={() => removeRecipient(index)}
                          className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                          title="Remove recipient"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {signer.included && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={signer.name}
                        onChange={(e) => updateSigner(index, 'name', e.target.value)}
                        placeholder="Full Name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600"
                      />
                      <input
                        type="email"
                        value={signer.email}
                        onChange={(e) => updateSigner(index, 'email', e.target.value)}
                        placeholder="Email Address (optional)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600"
                      />
                      {!signer.email.trim() && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">No email needed. We will generate a secure signing link you can copy and share yourself.</p>
                      )}
                      {signer.email.trim() && !isValidEmail(signer.email) && (
                        <p className="text-[11px] text-rose-500 dark:text-rose-300">Enter a valid email address.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button 
              type="button"
              onClick={addRecipient}
              className="text-xs font-bold text-blue-600 hover:text-blue-500 flex items-center gap-1 py-2 dark:text-blue-400 dark:hover:text-blue-300"
            >
               + Add Another Recipient
            </button>
          </div>

          {/* Email Preview Column */}
          <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col bg-slate-50 dark:bg-slate-900/30 overflow-y-auto max-h-[40vh] md:max-h-[50vh]">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"/> Message & delivery
            </h3>

            <div className="space-y-4 flex-1">
               <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Subject</label>
                  <input 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-200 pb-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                    placeholder="Email Subject"
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Message</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full h-24 sm:h-32 bg-transparent border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 resize-none dark:border-white/10 dark:text-slate-300 dark:placeholder:text-slate-600"
                    placeholder="Enter your message to the recipients..."
                  />
               </div>
               
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 leading-relaxed dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300/80">
                <strong className="text-blue-700 dark:text-blue-300">Delivery:</strong> {emailedSigners.length > 0 ? `${emailedSigners.length} signer${emailedSigners.length > 1 ? 's' : ''} will receive email automatically.` : 'No emails will be sent.'} {linkOnlySigners.length > 0 ? `${linkOnlySigners.length} secure link${linkOnlySigners.length > 1 ? 's' : ''} will be ready to share manually after send.` : ''}
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-200/80 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 dark:border-white/5 dark:bg-slate-900/50">
            <div className="text-xs text-slate-600 text-center sm:text-left w-full sm:w-auto dark:text-slate-500">
              {readySigners.length} of {includedSigners.length} recipients ready
              {includedSigners.length === 0 && <span className="text-amber-400 ml-1">(select at least one)</span>}
              {emailedSigners.length > 0 && <span className="ml-1">• {emailedSigners.length} email</span>}
              {linkOnlySigners.length > 0 && <span className="ml-1">• {linkOnlySigners.length} link only</span>}
              {missingNameCount > 0 && <span className="text-amber-400 ml-1">({missingNameCount} need name)</span>}
              {invalidEmailCount > 0 && <span className="text-rose-500 ml-1">({invalidEmailCount} invalid email{invalidEmailCount > 1 ? 's' : ''})</span>}
              {previewError && (
                <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
                  {previewError}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <Button 
                onClick={handlePreview} 
                disabled={loadingPreview || !canSend} 
                className="flex-1 sm:flex-none shadow-lg shadow-emerald-900/20 bg-emerald-600 hover:bg-emerald-500"
              >
                {loadingPreview ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {primaryActionLabel}
                  </>
                )}
              </Button>
            </div>
        </div>
      </div>
    </div>
    );
  }

  // Preview step - full PDF annotator for adding signature fields
  if (step === 'preview') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 animate-in fade-in duration-200">
        {pdfUrl ? (
          <PdfAnnotator
            pdfUrl={pdfUrl}
            signers={includedSigners.map(s => ({ role: s.role, name: s.name, email: s.email }))}
            dealData={{
              address: cleanDisplayText(deal.property?.street),
              city: cleanDisplayText(deal.property?.city),
              state: cleanDisplayText(deal.property?.state),
              zip: cleanDisplayText(deal.property?.zip),
              county: cleanDisplayText(deal.property?.county),
              mlsNumber: cleanDisplayText(deal.property?.mlsId),
              taxId: cleanDisplayText(deal.property?.taxId),
              purchasePrice: deal.repc?.purchasePrice,
              settlementDate: deal.repc?.settlementDeadline,
              buyerName: deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}` : undefined,
              buyerEmail: deal.buyer?.email,
              sellerName: deal.seller ? `${deal.seller.firstName} ${deal.seller.lastName}` : undefined,
              sellerEmail: deal.seller?.email,
            }}
            onCancel={() => setStep('recipients')}
            onSend={handleSend}
            sending={sending}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
          </div>
        )}
      </div>
    );
  }
}

function CopyLinksModal({
  links,
  onClose,
}: {
  links: EnvelopeLink[];
  onClose: () => void;
}) {
  const allLinks = links.map((l) => l.url).join('\n');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0b1221] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden ring-1 ring-white/5">
        <div className="p-6 bg-gradient-to-r from-emerald-600/10 to-blue-600/10 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Signing links ready</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{getEnvelopeLinkSubtitle(links)}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors p-2 hover:bg-slate-100 rounded-full dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {links.map((link, idx) => (
              <div key={link.signerId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center gap-2 dark:border-white/10 dark:bg-white/5">
                <div className="sm:w-44 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{getEnvelopeLinkPrimaryLabel(link, idx)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{getEnvelopeLinkDeliveryLabel(link)}</div>
                </div>
                <div className="flex-1 text-xs text-slate-700 break-all dark:text-slate-200">{link.url}</div>
                <button
                  type="button"
                  onClick={() => handleCopy(link.url)}
                  className="px-3 py-1.5 rounded-lg bg-white text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className={`text-xs ${copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
              {copied ? 'Copied to clipboard' : 'Copy all links for quick sharing'}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(allLinks)}
              className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-200 dark:hover:bg-blue-500/30"
            >
              Copy All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractsHub;
