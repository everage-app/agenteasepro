import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Clock3, ExternalLink, FileCheck2, FileText, PenLine, RefreshCw, Send } from 'lucide-react';
import api from '../../lib/api';
import {
  EnvelopeLink,
  buildEnvelopeSendToast,
  getEnvelopeLinkDeliveryLabel,
  getEnvelopeLinkPrimaryLabel,
  getEnvelopeLinkSubtitle,
} from '../../lib/esignDelivery';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useMlsStore, MlsListingRecord } from '../mls/mlsStore';
import { ContractAIPanel } from '../../components/contracts/ContractAIPanel';
import { DocumentChecklist } from '../../components/contracts/DocumentChecklist';
import { PdfAnnotator } from '../contracts/PdfAnnotator';

interface RepcDraft {
  dealId: string;
  buyerLegalNames: string;
  sellerLegalNames: string;
  earnestMoneyAmount: number;
  earnestMoneyForm: string;
  additionalEarnestMoneyAmount?: number | null;
  propertyCity: string;
  propertyCounty: string;
  propertyState: string;
  propertyZip: string;
  propertyTaxId: string;
  otherIncludedItems: string;
  excludedItems: string;
  purchasePrice: number;
  newLoanAmount?: number | null;
  sellerFinancingAmount?: number | null;
  cashAtSettlement?: number | null;
  isSubjectToSaleOfBuyersProperty: boolean;
  buyersPropertyDescription?: string | null;
  possessionTiming: 'ON_RECORDING' | 'HOURS_AFTER_RECORDING' | 'DAYS_AFTER_RECORDING';
  possessionOffset?: number | null;
  capitalImprovementsPayer: 'SELLER' | 'BUYER' | 'SPLIT' | 'OTHER';
  capitalImprovementsPayerOther?: string | null;
  changeOfOwnershipFeePayer: 'SELLER' | 'BUYER' | 'SPLIT' | 'OTHER';
  changeOfOwnershipFeePayerOther?: string | null;
  hasDueDiligenceCondition: boolean;
  hasAppraisalCondition: boolean;
  hasFinancingCondition: boolean;
  sellerDisclosureDeadline: string;
  dueDiligenceDeadline: string;
  financingAppraisalDeadline: string;
  settlementDeadline: string;
  hasHomeWarranty: boolean;
  homeWarrantyOrderedBy: 'BUYER' | 'SELLER' | 'UNKNOWN';
  homeWarrantyMaxCost?: number | null;
  offerExpirationDate: string;
  offerExpirationTime: string;
  offerExpirationMeridiem: 'AM' | 'PM';
}

const REPC_REQUIRED_FIELDS: Array<{ id: string; label: string; key: keyof RepcDraft }> = [
  { id: 'buyerLegalNames', label: 'Buyer Legal Names', key: 'buyerLegalNames' },
  { id: 'sellerLegalNames', label: 'Seller Legal Names', key: 'sellerLegalNames' },
  { id: 'purchasePrice', label: 'Purchase Price', key: 'purchasePrice' },
  { id: 'earnestMoneyAmount', label: 'Earnest Money Amount', key: 'earnestMoneyAmount' },
  { id: 'settlementDeadline', label: 'Settlement/Closing Date', key: 'settlementDeadline' },
  { id: 'dueDiligenceDeadline', label: 'Due Diligence Deadline', key: 'dueDiligenceDeadline' },
  { id: 'financingAppraisalDeadline', label: 'Financing/Appraisal Deadline', key: 'financingAppraisalDeadline' },
  { id: 'sellerDisclosureDeadline', label: 'Seller Disclosure Deadline', key: 'sellerDisclosureDeadline' },
];

const inputClasses =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:[color-scheme:dark]';
const labelClasses = 'text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block';

// Quick Fill Presets for common scenarios
const QUICK_FILL_PRESETS = {
  standard30: {
    label: 'Standard 30-day',
    description: '14 days due diligence, 21 days financing, 30 days to close',
    getDates: () => {
      const today = new Date();
      const ddl = new Date(today); ddl.setDate(ddl.getDate() + 14);
      const fin = new Date(today); fin.setDate(fin.getDate() + 21);
      const settle = new Date(today); settle.setDate(settle.getDate() + 30);
      const disc = new Date(today); disc.setDate(disc.getDate() + 7);
      const exp = new Date(today); exp.setDate(exp.getDate() + 2);
      return {
        dueDiligenceDeadline: ddl.toISOString().slice(0, 10),
        financingAppraisalDeadline: fin.toISOString().slice(0, 10),
        settlementDeadline: settle.toISOString().slice(0, 10),
        sellerDisclosureDeadline: disc.toISOString().slice(0, 10),
        offerExpirationDate: exp.toISOString().slice(0, 10),
        hasDueDiligenceCondition: true,
        hasAppraisalCondition: true,
        hasFinancingCondition: true,
      };
    },
  },
  quick14: {
    label: 'Quick Close (14 days)',
    description: '7 days due diligence, 10 days financing, 14 days to close',
    getDates: () => {
      const today = new Date();
      const ddl = new Date(today); ddl.setDate(ddl.getDate() + 7);
      const fin = new Date(today); fin.setDate(fin.getDate() + 10);
      const settle = new Date(today); settle.setDate(settle.getDate() + 14);
      const disc = new Date(today); disc.setDate(disc.getDate() + 5);
      const exp = new Date(today); exp.setDate(exp.getDate() + 1);
      return {
        dueDiligenceDeadline: ddl.toISOString().slice(0, 10),
        financingAppraisalDeadline: fin.toISOString().slice(0, 10),
        settlementDeadline: settle.toISOString().slice(0, 10),
        sellerDisclosureDeadline: disc.toISOString().slice(0, 10),
        offerExpirationDate: exp.toISOString().slice(0, 10),
        hasDueDiligenceCondition: true,
        hasAppraisalCondition: true,
        hasFinancingCondition: true,
      };
    },
  },
  cash21: {
    label: 'Cash Offer (21 days)',
    description: 'No financing, 10 days due diligence, 21 days to close',
    getDates: () => {
      const today = new Date();
      const ddl = new Date(today); ddl.setDate(ddl.getDate() + 10);
      const settle = new Date(today); settle.setDate(settle.getDate() + 21);
      const disc = new Date(today); disc.setDate(disc.getDate() + 5);
      const exp = new Date(today); exp.setDate(exp.getDate() + 1);
      return {
        dueDiligenceDeadline: ddl.toISOString().slice(0, 10),
        financingAppraisalDeadline: '',
        settlementDeadline: settle.toISOString().slice(0, 10),
        sellerDisclosureDeadline: disc.toISOString().slice(0, 10),
        offerExpirationDate: exp.toISOString().slice(0, 10),
        hasDueDiligenceCondition: true,
        hasAppraisalCondition: false,
        hasFinancingCondition: false,
      };
    },
  },
  extended60: {
    label: 'Extended (60 days)',
    description: '21 days due diligence, 45 days financing, 60 days to close',
    getDates: () => {
      const today = new Date();
      const ddl = new Date(today); ddl.setDate(ddl.getDate() + 21);
      const fin = new Date(today); fin.setDate(fin.getDate() + 45);
      const settle = new Date(today); settle.setDate(settle.getDate() + 60);
      const disc = new Date(today); disc.setDate(disc.getDate() + 10);
      const exp = new Date(today); exp.setDate(exp.getDate() + 3);
      return {
        dueDiligenceDeadline: ddl.toISOString().slice(0, 10),
        financingAppraisalDeadline: fin.toISOString().slice(0, 10),
        settlementDeadline: settle.toISOString().slice(0, 10),
        sellerDisclosureDeadline: disc.toISOString().slice(0, 10),
        offerExpirationDate: exp.toISOString().slice(0, 10),
        hasDueDiligenceCondition: true,
        hasAppraisalCondition: true,
        hasFinancingCondition: true,
      };
    },
  },
} as const;

// Validation helper functions
function validateRepc(draft: RepcDraft): { field: string; message: string; type: 'error' | 'warning' }[] {
  const issues: { field: string; message: string; type: 'error' | 'warning' }[] = [];
  
  // Money validations
  if (draft.purchasePrice > 0 && draft.earnestMoneyAmount > draft.purchasePrice) {
    issues.push({ field: 'earnestMoneyAmount', message: 'Earnest money exceeds purchase price', type: 'error' });
  }
  if (draft.purchasePrice > 0 && draft.earnestMoneyAmount > 0) {
    const earnestPercent = (draft.earnestMoneyAmount / draft.purchasePrice) * 100;
    if (earnestPercent < 1) {
      issues.push({ field: 'earnestMoneyAmount', message: `Only ${earnestPercent.toFixed(2)}% - typical is 1-3%`, type: 'warning' });
    } else if (earnestPercent > 5) {
      issues.push({ field: 'earnestMoneyAmount', message: `${earnestPercent.toFixed(1)}% is unusually high`, type: 'warning' });
    }
  }
  
  // Date validations
  const today = new Date().toISOString().slice(0, 10);
  if (draft.sellerDisclosureDeadline && draft.sellerDisclosureDeadline < today) {
    issues.push({ field: 'sellerDisclosureDeadline', message: 'Date is in the past', type: 'warning' });
  }
  if (draft.dueDiligenceDeadline && draft.dueDiligenceDeadline < today) {
    issues.push({ field: 'dueDiligenceDeadline', message: 'Date is in the past', type: 'warning' });
  }
  if (draft.settlementDeadline && draft.settlementDeadline < today) {
    issues.push({ field: 'settlementDeadline', message: 'Settlement date is in the past', type: 'error' });
  }
  
  // Date ordering
  if (draft.dueDiligenceDeadline && draft.settlementDeadline && draft.dueDiligenceDeadline >= draft.settlementDeadline) {
    issues.push({ field: 'dueDiligenceDeadline', message: 'Must be before settlement', type: 'error' });
  }
  if (draft.financingAppraisalDeadline && draft.settlementDeadline && draft.financingAppraisalDeadline >= draft.settlementDeadline) {
    issues.push({ field: 'financingAppraisalDeadline', message: 'Must be before settlement', type: 'error' });
  }
  if (draft.dueDiligenceDeadline && draft.financingAppraisalDeadline && draft.dueDiligenceDeadline > draft.financingAppraisalDeadline) {
    issues.push({ field: 'dueDiligenceDeadline', message: 'Usually before financing deadline', type: 'warning' });
  }
  
  // Offer expiration
  if (draft.offerExpirationDate && draft.offerExpirationDate < today) {
    issues.push({ field: 'offerExpirationDate', message: 'Offer already expired', type: 'error' });
  }
  
  // Required party names
  if (!draft.buyerLegalNames.trim()) {
    issues.push({ field: 'buyerLegalNames', message: 'Buyer name required', type: 'error' });
  }
  if (!draft.sellerLegalNames.trim()) {
    issues.push({ field: 'sellerLegalNames', message: 'Seller name required', type: 'error' });
  }
  
  return issues;
}

// Helper tip component
function FieldTip({ tip }: { tip: string }) {
  return (
    <span className="ml-1.5 inline-flex items-center group relative">
      <svg className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="absolute left-full ml-2 px-2 py-1 text-[10px] text-slate-900 bg-white border border-slate-200 rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 dark:text-white dark:bg-slate-800 dark:border-slate-700">
        {tip}
      </span>
    </span>
  );
}

function toDateInputValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value?: number | null): string {
  if (!value) return 'Not set';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatShortDate(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function extractErrorMessage(errorLike: unknown, fallback: string): string {
  if (typeof errorLike === 'string' && errorLike.trim()) return errorLike;
  if (errorLike && typeof errorLike === 'object') {
    const candidate = errorLike as {
      message?: unknown;
      error?: unknown;
      code?: unknown;
    };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
    if (candidate.error) return extractErrorMessage(candidate.error, fallback);
    if (typeof candidate.code === 'string' && candidate.code.trim()) return candidate.code;
  }
  return fallback;
}

function canPersistDraft(draft: RepcDraft): boolean {
  return Boolean(
    draft.sellerDisclosureDeadline &&
      draft.dueDiligenceDeadline &&
      draft.financingAppraisalDeadline &&
      draft.settlementDeadline &&
      draft.offerExpirationDate,
  );
}

export function RepcWizard() {
  const { dealId } = useParams<{ dealId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const repcPrefill = (location.state as { repcPrefill?: Partial<RepcDraft> } | null)?.repcPrefill;
  const templateStartCode = (location.state as { templateStartCode?: string } | null)?.templateStartCode;
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<'form' | 'guided'>('form');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<boolean>(false);
  const [draft, setDraft] = useState<RepcDraft | null>(null);
  // FormInstance integration
  const [formInstanceId, setFormInstanceId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  // Smart prompt state
  const [smartPrompt, setSmartPrompt] = useState('');
  const [smartExplanation, setSmartExplanation] = useState<string | null>(null);
  const [answerExplanation, setAnswerExplanation] = useState<string | null>(null);
  const [pendingSmartUpdate, setPendingSmartUpdate] = useState<{
    label: string;
    updates: Record<string, any>;
    explanation?: string | null;
  } | null>(null);
  const [smartFillLog, setSmartFillLog] = useState<Array<{
    id: string;
    source: 'deal' | 'mls' | 'smart_prompt' | 'undo';
    summary: string;
    timestamp: string;
    fields?: string[];
  }>>([]);
  const [smartFillUndo, setSmartFillUndo] = useState<{
    label: string;
    previous: Record<string, any>;
    fields: string[];
  } | null>(null);
  const { lastResult: mlsListing, loading: mlsLoading, search: mlsSearch, error: mlsSearchError } = useMlsStore((state) => ({
    lastResult: state.lastResult,
    loading: state.loading,
    search: state.search,
    error: state.error,
  }));
  const [prefillAppliedId, setPrefillAppliedId] = useState<string | null>(null);
  const [prefillSummary, setPrefillSummary] = useState<string | null>(null);
  const [dealSummary, setDealSummary] = useState<any | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [signLinks, setSignLinks] = useState<EnvelopeLink[] | null>(null);
  const [mlsQuery, setMlsQuery] = useState('');
  const [mlsInlineError, setMlsInlineError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pdfInlineUrl, setPdfInlineUrl] = useState<string | null>(null);
  const [pdfInlineLoading, setPdfInlineLoading] = useState(false);
  const [pdfInlineError, setPdfInlineError] = useState<string | null>(null);
  const [autoPreviewed, setAutoPreviewed] = useState(false);
  
  // PDF Preview state
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loadingPdfPreview, setLoadingPdfPreview] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const addSmartFillLog = (entry: { source: 'deal' | 'mls' | 'smart_prompt' | 'undo'; summary: string; fields?: string[] }) => {
    const next = {
      id: `smartfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toLocaleString(),
      ...entry,
    };
    setSmartFillLog((prev) => [next, ...prev].slice(0, 6));
  };

  const setSmartFillUndoSnapshot = (label: string, fields: string[], currentDraft: RepcDraft) => {
    if (!fields.length) return;
    const previous: Record<string, any> = {};
    fields.forEach((field) => {
      if (field in currentDraft) previous[field] = (currentDraft as any)[field];
    });
    setSmartFillUndo({ label, previous, fields });
  };

  useEffect(() => {
    const load = async () => {
      if (!dealId) return;
      try {
        setLoading(true);
        const dealRequest = api.get(`/deals/${dealId}`).catch(() => null);
        const res = await api.get(`/repc/${dealId}`).catch(() => null);
        const dealRes = await dealRequest;
        const nextDealSummary = dealRes?.data ?? null;
        setDealSummary(nextDealSummary);

        if (res && res.data) {
          setExisting(true);
          const d = res.data;
          setDraft({
            dealId,
            buyerLegalNames: d.buyerLegalNames || `${nextDealSummary?.buyer?.firstName || ''} ${nextDealSummary?.buyer?.lastName || ''}`.trim(),
            sellerLegalNames: d.sellerLegalNames || `${nextDealSummary?.seller?.firstName || ''} ${nextDealSummary?.seller?.lastName || ''}`.trim(),
            earnestMoneyAmount: toRequiredNumber(d.earnestMoneyAmount),
            earnestMoneyForm: d.earnestMoneyForm || 'wire',
            additionalEarnestMoneyAmount: toOptionalNumber(d.additionalEarnestMoneyAmount),
            propertyCity: d.propertyCity || nextDealSummary?.property?.city || '',
            propertyCounty: d.propertyCounty || nextDealSummary?.property?.county || '',
            propertyState: d.propertyState || nextDealSummary?.property?.state || 'UT',
            propertyZip: d.propertyZip || nextDealSummary?.property?.zip || '',
            propertyTaxId: d.propertyTaxId || nextDealSummary?.property?.taxId || '',
            otherIncludedItems: d.otherIncludedItems || '',
            excludedItems: d.excludedItems || '',
            purchasePrice: toRequiredNumber(d.purchasePrice ?? nextDealSummary?.repc?.purchasePrice),
            newLoanAmount: toOptionalNumber(d.newLoanAmount),
            sellerFinancingAmount: toOptionalNumber(d.sellerFinancingAmount),
            cashAtSettlement: toOptionalNumber(d.cashAtSettlement),
            isSubjectToSaleOfBuyersProperty: Boolean(d.isSubjectToSaleOfBuyersProperty),
            buyersPropertyDescription:
              d.buyersPropertyDescription ||
              (nextDealSummary?.property?.mlsId ? `MLS #${nextDealSummary.property.mlsId}` : null),
            possessionTiming: d.possessionTiming || 'ON_RECORDING',
            possessionOffset: toOptionalNumber(d.possessionOffset),
            capitalImprovementsPayer: d.capitalImprovementsPayer || 'SELLER',
            capitalImprovementsPayerOther: d.capitalImprovementsPayerOther || null,
            changeOfOwnershipFeePayer: d.changeOfOwnershipFeePayer || 'BUYER',
            changeOfOwnershipFeePayerOther: d.changeOfOwnershipFeePayerOther || null,
            hasDueDiligenceCondition: d.hasDueDiligenceCondition ?? true,
            hasAppraisalCondition: d.hasAppraisalCondition ?? true,
            hasFinancingCondition: d.hasFinancingCondition ?? true,
            sellerDisclosureDeadline: toDateInputValue(d.sellerDisclosureDeadline),
            dueDiligenceDeadline: toDateInputValue(d.dueDiligenceDeadline),
            financingAppraisalDeadline: toDateInputValue(d.financingAppraisalDeadline),
            settlementDeadline: toDateInputValue(d.settlementDeadline),
            hasHomeWarranty: Boolean(d.hasHomeWarranty),
            homeWarrantyOrderedBy: d.homeWarrantyOrderedBy || 'UNKNOWN',
            homeWarrantyMaxCost: toOptionalNumber(d.homeWarrantyMaxCost),
            offerExpirationDate: toDateInputValue(d.offerExpirationDate),
            offerExpirationTime: d.offerExpirationTime || '17:00',
            offerExpirationMeridiem: d.offerExpirationMeridiem || 'PM',
          });
        } else {
          const buyerName = `${nextDealSummary?.buyer?.firstName || ''} ${nextDealSummary?.buyer?.lastName || ''}`.trim();
          const sellerName = `${nextDealSummary?.seller?.firstName || ''} ${nextDealSummary?.seller?.lastName || ''}`.trim();
          setExisting(false);
          setDraft({
            dealId,
            buyerLegalNames: buyerName,
            sellerLegalNames: sellerName,
            earnestMoneyAmount: 0,
            earnestMoneyForm: 'wire',
            additionalEarnestMoneyAmount: null,
            propertyCity: nextDealSummary?.property?.city || '',
            propertyCounty: nextDealSummary?.property?.county || '',
            propertyState: nextDealSummary?.property?.state || 'UT',
            propertyZip: nextDealSummary?.property?.zip || '',
            propertyTaxId: nextDealSummary?.property?.taxId || '',
            otherIncludedItems: '',
            excludedItems: '',
            purchasePrice: toRequiredNumber(nextDealSummary?.repc?.purchasePrice),
            newLoanAmount: null,
            sellerFinancingAmount: null,
            cashAtSettlement: null,
            isSubjectToSaleOfBuyersProperty: false,
            buyersPropertyDescription: nextDealSummary?.property?.mlsId ? `MLS #${nextDealSummary.property.mlsId}` : null,
            possessionTiming: 'ON_RECORDING',
            possessionOffset: null,
            capitalImprovementsPayer: 'SELLER',
            capitalImprovementsPayerOther: null,
            changeOfOwnershipFeePayer: 'BUYER',
            changeOfOwnershipFeePayerOther: null,
            hasDueDiligenceCondition: repcPrefill?.hasDueDiligenceCondition ?? true,
            hasAppraisalCondition: repcPrefill?.hasAppraisalCondition ?? true,
            hasFinancingCondition: repcPrefill?.hasFinancingCondition ?? true,
            sellerDisclosureDeadline: '',
            dueDiligenceDeadline: repcPrefill?.dueDiligenceDeadline || '',
            financingAppraisalDeadline: repcPrefill?.financingAppraisalDeadline || '',
            settlementDeadline: repcPrefill?.settlementDeadline || '',
            hasHomeWarranty: false,
            homeWarrantyOrderedBy: 'UNKNOWN',
            homeWarrantyMaxCost: null,
            offerExpirationDate: '',
            offerExpirationTime: '17:00',
            offerExpirationMeridiem: 'PM',
          });
        }
      } catch (loadError) {
        console.error('Failed to load REPC wizard:', loadError);
        setError('We could not load this deal. Please refresh or return to Deals and reopen the contract.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dealId]);

  // Ensure REPC FormInstance exists
  useEffect(() => {
    const ensureFormInstance = async () => {
      if (!dealId) return;
      try {
        const forms = await api.get(`/forms/deals/${dealId}/forms`);
        const repcInstance = (forms.data || []).find((f: any) => f.definition?.code === 'REPC');
        if (repcInstance) setFormInstanceId(repcInstance.id);
        else {
          const created = await api.post(`/forms/deals/${dealId}/forms`, { formCode: 'REPC' });
          setFormInstanceId(created.data.id);
        }
      } catch (e) {
        console.error('Failed to ensure form instance', e);
      }
    };
    ensureFormInstance();
  }, [dealId]);

  // Load guided questions when switching to guided mode
  useEffect(() => {
    const loadQuestions = async () => {
      if (viewMode !== 'guided' || !formInstanceId) return;
      try {
        const res = await api.get(`/forms/${formInstanceId}/questions`);
        setQuestions(res.data.questions || []);
        setQuestionIndex(0);
        setAnswerText('');
      } catch (e) {
        console.error('Failed to load questions', e);
      }
    };
    loadQuestions();
  }, [viewMode, formInstanceId]);

  useEffect(() => {
    setPrefillSummary(null);
    if (!mlsListing) {
      setPrefillAppliedId(null);
      return;
    }
    setPrefillAppliedId((current) => (current === mlsListing.id ? current : null));
  }, [mlsListing?.id]);

  const normalizeSmartUpdates = (updates: Record<string, any>, currentDraft: RepcDraft) => {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates || {})) {
      if (!(key in currentDraft)) continue;
      if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T/.test(value)) {
        normalized[key] = value.slice(0, 10);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  };

  const applySmartUpdates = (sourceLabel: string, updates: Record<string, any>, explanation?: string | null) => {
    const updateKeys = Object.keys(updates || {});
    setSmartExplanation(explanation || null);
    addSmartFillLog({
      source: 'smart_prompt',
      summary: updateKeys.length
        ? `${sourceLabel} updated ${updateKeys.length} field${updateKeys.length === 1 ? '' : 's'}.`
        : `${sourceLabel} made no changes.`,
      fields: updateKeys,
    });

    if (!draft) return;
    if (!updateKeys.length) return;

    setSmartFillUndoSnapshot(sourceLabel, updateKeys, draft);
    setDraft({ ...draft, ...updates });
    showToast('success', `${sourceLabel} applied.`);
  };

  const requestSmartPromptUpdates = async (text: string, sourceLabel: string, autoApply: boolean) => {
    if (!formInstanceId || !text.trim()) return;
    try {
      const res = await api.post(`/forms/${formInstanceId}/smart-prompt`, { text });
      if (!draft) return;
      const normalized = normalizeSmartUpdates(res.data.updates || {}, draft);
      if (autoApply) {
        applySmartUpdates(sourceLabel, normalized, res.data.explanation);
      } else {
        setPendingSmartUpdate({
          label: sourceLabel,
          updates: normalized,
          explanation: res.data.explanation,
        });
      }
      setSmartPrompt('');
    } catch (e) {
      setSmartExplanation('Could not interpret prompt.');
    }
  };

  const applySmartPrompt = async () => {
    await requestSmartPromptUpdates(smartPrompt, 'Smart prompt', true);
  };

  const buildAutoFillPrompt = () => {
    const parts: string[] = [];
    if (dealSummary?.buyer) {
      parts.push(`Buyer ${dealSummary.buyer.firstName || ''} ${dealSummary.buyer.lastName || ''}`.trim());
    }
    if (dealSummary?.seller) {
      parts.push(`Seller ${dealSummary.seller.firstName || ''} ${dealSummary.seller.lastName || ''}`.trim());
    }
    if (dealSummary?.property?.street) {
      const city = dealSummary.property.city || '';
      const state = dealSummary.property.state || 'UT';
      const zip = dealSummary.property.zip || '';
      parts.push(`Property ${dealSummary.property.street}, ${city}, ${state} ${zip}`.replace(/\s+/g, ' ').trim());
    }
    if (dealSummary?.repc?.purchasePrice) {
      parts.push(`Purchase price ${dealSummary.repc.purchasePrice}`);
    }
    if (dealSummary?.repc?.settlementDeadline) {
      parts.push(`Settlement deadline ${dealSummary.repc.settlementDeadline}`);
    }
    if (mlsListing?.mlsNumber) {
      parts.push(`MLS ${mlsListing.mlsNumber}`);
    }
    if (mlsListing?.price) {
      parts.push(`MLS price ${mlsListing.price}`);
    }
    if (mlsListing?.city) {
      parts.push(`MLS city ${mlsListing.city}`);
    }
    if (mlsListing?.zip) {
      parts.push(`MLS zip ${mlsListing.zip}`);
    }

    if (parts.length === 0) return '';
    return `Use this data to autofill the Utah REPC fields: ${parts.join('; ')}`;
  };

  const applyAiSuggestion = async (field: string, suggestion: string) => {
    const prompt = `Set ${field} to ${suggestion}`;
    await requestSmartPromptUpdates(prompt, 'AI suggestion', false);
  };

  const applyDealPrefill = () => {
    if (!draft || !dealSummary) return;
    const patch: Partial<RepcDraft> = {};

    if (!draft.buyerLegalNames && dealSummary.buyer) {
      patch.buyerLegalNames = `${dealSummary.buyer.firstName} ${dealSummary.buyer.lastName}`.trim();
    }
    if (!draft.sellerLegalNames && dealSummary.seller) {
      patch.sellerLegalNames = `${dealSummary.seller.firstName} ${dealSummary.seller.lastName}`.trim();
    }
    if (!draft.propertyCity && dealSummary.property?.city) patch.propertyCity = dealSummary.property.city;
    if (!draft.propertyCounty && dealSummary.property?.county) patch.propertyCounty = dealSummary.property.county;
    if (!draft.propertyState && dealSummary.property?.state) patch.propertyState = dealSummary.property.state;
    if (!draft.propertyZip && dealSummary.property?.zip) patch.propertyZip = dealSummary.property.zip;
    if (!draft.propertyTaxId && dealSummary.property?.taxId) patch.propertyTaxId = dealSummary.property.taxId;

    if ((!draft.purchasePrice || draft.purchasePrice === 0) && dealSummary.repc?.purchasePrice) {
      patch.purchasePrice = Number(dealSummary.repc.purchasePrice);
    }

    if (!draft.buyersPropertyDescription && dealSummary.mlsNumber) {
      patch.buyersPropertyDescription = `MLS #${dealSummary.mlsNumber}`;
    }

    const modifiedFields = Object.keys(patch).length;
    if (!modifiedFields) {
      setPrefillSummary('Deal data already captured in this draft.');
      addSmartFillLog({
        source: 'deal',
        summary: 'Deal import found no new fields to apply.',
      });
      return;
    }

    setSmartFillUndoSnapshot('Deal import', Object.keys(patch), draft);
    setDraft({ ...draft, ...patch });
    setPrefillSummary(`Imported ${modifiedFields} field${modifiedFields === 1 ? '' : 's'} from the deal.`);
    showToast('success', 'Deal data applied to this REPC.');
    addSmartFillLog({
      source: 'deal',
      summary: `Deal import applied ${modifiedFields} field${modifiedFields === 1 ? '' : 's'}.`,
      fields: Object.keys(patch),
    });
  };

  const answerCurrentQuestion = async () => {
    if (!formInstanceId || !questions.length) return;
    const q = questions[questionIndex];
    try {
      const res = await api.post(`/forms/${formInstanceId}/questions/${q.id}/answer`, { answerText });
      setAnswerExplanation(res.data.explanation);
      const refreshed = await api.get(`/forms/${formInstanceId}/questions`);
      setQuestions(refreshed.data.questions || []);
      if (draft) {
        const merged: any = { ...draft };
        for (const [k, v] of Object.entries(res.data.updates || {})) {
          if (k in merged) {
            if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) merged[k] = (v as string).slice(0,10);
            else merged[k] = v as any;
          }
        }
        setDraft(merged);
      }
      setAnswerText('');
      setQuestionIndex(i => Math.min(i + 1, questions.length - 1));
    } catch (e) {
      setAnswerExplanation('Could not apply answer.');
    }
  };

  const applyMlsPrefill = (listing: MlsListingRecord) => {
    if (!draft || !listing) return;
    const patch: Partial<RepcDraft> = {};
    let updatedCount = 0;
    let filledCount = 0;

    const setStringField = (key: keyof RepcDraft, incoming?: string | null) => {
      const next = (incoming || '').trim();
      if (!next) return;
      const current = String(draft[key] || '').trim();
      if (current === next) return;
      (patch as any)[key] = next;
      if (current) updatedCount += 1;
      else filledCount += 1;
    };

    const setNumberField = (key: keyof RepcDraft, incoming?: number | string | null) => {
      if (incoming === null || incoming === undefined || incoming === '') return;
      const next = Number(incoming);
      if (!Number.isFinite(next) || next <= 0) return;
      const currentRaw = draft[key] as unknown;
      const current = typeof currentRaw === 'number' ? currentRaw : Number(currentRaw || 0);
      if (Number.isFinite(current) && current === next) return;
      (patch as any)[key] = next;
      if (current > 0) updatedCount += 1;
      else filledCount += 1;
    };

    setStringField('propertyCity', listing.city);
    setStringField('propertyState', listing.state || 'UT');
    setStringField('propertyZip', listing.zip);
    setNumberField('purchasePrice', listing.price);

    const taxId = (listing.raw as any)?.taxId;
    if (typeof taxId === 'string') {
      setStringField('propertyTaxId', taxId);
    }

    const currentDescription = String(draft.buyersPropertyDescription || '').trim();
    const nextDescription = (listing.headline || '').trim()
      || (listing.squareFeet ? `${listing.squareFeet.toLocaleString()} sq ft | MLS #${listing.mlsNumber}` : '');
    const canReplaceDescription = !currentDescription || /^MLS\s*#/i.test(currentDescription);
    if (canReplaceDescription && nextDescription && currentDescription !== nextDescription) {
      patch.buyersPropertyDescription = nextDescription;
      if (currentDescription) updatedCount += 1;
      else filledCount += 1;
    }

    const modifiedFields = Object.keys(patch).length;
    if (!modifiedFields) {
      setPrefillSummary('MLS data already captured in this draft.');
      addSmartFillLog({
        source: 'mls',
        summary: 'MLS import found no new fields to apply.',
      });
      return;
    }

    setSmartFillUndoSnapshot('MLS import', Object.keys(patch), draft);
    setDraft({ ...draft, ...patch });
    setPrefillAppliedId(listing.id);
    const filledLabel = filledCount ? `${filledCount} filled` : '';
    const updatedLabel = updatedCount ? `${updatedCount} updated` : '';
    const detailLabel = [filledLabel, updatedLabel].filter(Boolean).join(', ');
    setPrefillSummary(`Applied MLS data to ${modifiedFields} field${modifiedFields === 1 ? '' : 's'}${detailLabel ? ` (${detailLabel})` : ''}.`);
    addSmartFillLog({
      source: 'mls',
      summary: `MLS import applied ${modifiedFields} field${modifiedFields === 1 ? '' : 's'}.`,
      fields: Object.keys(patch),
    });
  };

  const handleMlsSearch = async () => {
    setMlsInlineError(null);
    const query = mlsQuery.trim();
    if (!query) return;
    try {
      const normalizedMls = query.replace(/[^0-9]/g, '');
      const isMlsNumber = /^\d{6,10}$/.test(normalizedMls);

      if (isMlsNumber) {
        await mlsSearch(normalizedMls, { force: false });
        return;
      }

      const searchRes = await api.post('/search/properties', { query, limit: 1 });
      const firstResult = searchRes.data?.results?.[0];
      const discoveredMls = String(firstResult?.mlsId || '').trim();
      if (!discoveredMls) {
        setMlsInlineError('No listing found. Try a different MLS # or address.');
        return;
      }

      await mlsSearch(discoveredMls, { force: false });
      setPrefillSummary(`Found listing via address search (MLS #${discoveredMls}).`);
    } catch (err: any) {
      setMlsInlineError(err?.message || 'Could not sync MLS data.');
    }
  };

  const handleSendForEsign = async (payload: { signers: { role: string; name: string; email: string }[]; subject: string; message: string; sendEmails?: boolean }) => {
    if (!dealId) return;
    try {
      const res = await api.post('/esign/envelopes', {
        dealId,
        type: 'REPC',
        signers: payload.signers,
        subject: payload.subject,
        message: payload.message,
        sendEmails: payload.sendEmails,
      });
      const feedback = buildEnvelopeSendToast(res.data?.emailStatus);
      showToast(feedback.type, feedback.message);
      
      setSignLinks(res.data?.links || null);
    } catch (err: any) {
      console.error('Failed to send for e-sign:', err);
      showToast('error', err?.response?.data?.error || 'Failed to send for signature. Please try again.');
    }
  };

  const save = async (options?: { suppressValidationError?: boolean }) => {
    if (!draft) return;
    if (!canPersistDraft(draft)) {
      if (!options?.suppressValidationError) {
        setError('Complete the contract deadlines and offer expiration before saving this REPC.');
      }
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      // Helper to safely convert date strings - only convert if valid
      const safeDate = (val: string | null | undefined) => {
        if (!val || val === '') return undefined;
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      };
      
      const payload = {
        ...draft,
        // Only include dates that are actually set
        sellerDisclosureDeadline: safeDate(draft.sellerDisclosureDeadline),
        dueDiligenceDeadline: safeDate(draft.dueDiligenceDeadline),
        financingAppraisalDeadline: safeDate(draft.financingAppraisalDeadline),
        settlementDeadline: safeDate(draft.settlementDeadline),
        offerExpirationDate: safeDate(draft.offerExpirationDate),
        rawJson: draft,
      };
      if (existing) {
        await api.put(`/repc/${draft.dealId}`, payload);
      } else {
        await api.post('/repc', payload);
        setExisting(true);
      }
      setLastSyncedAt(new Date());
      return true;
    } catch (e: any) {
      console.error('REPC save error:', e);
      setError(extractErrorMessage(e?.response?.data?.error ?? e, 'Could not save REPC details.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const fetchRepcPdfUrl = async () => {
    const token = localStorage.getItem('utahcontracts_token');
    let response: Response | null = null;
    if (dealId && draft && canPersistDraft(draft)) {
      try {
        const saved = await save({ suppressValidationError: true });
        if (saved) {
          response = await fetch(`/api/deals/${dealId}/repc/pdf`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (e) {
        console.warn('Deal PDF failed, falling back to template:', e);
      }
    }

    if (!response || !response.ok) {
      response = await fetch('/api/forms/definitions/REPC/pdf', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  const loadInlinePreview = async () => {
    if (pdfInlineLoading) return;
    setPdfInlineLoading(true);
    setPdfInlineError(null);
    try {
      if (pdfInlineUrl) {
        URL.revokeObjectURL(pdfInlineUrl);
        setPdfInlineUrl(null);
      }
      const url = await fetchRepcPdfUrl();
      if (!url) {
        setPdfInlineError('Preview unavailable. Use the PDF workspace to open the template.');
        return;
      }
      setPdfInlineUrl(url);
    } catch (e) {
      console.error('Inline PDF preview error:', e);
      setPdfInlineError('Failed to load preview.');
    } finally {
      setPdfInlineLoading(false);
    }
  };

  const openPdfWorkspace = async () => {
    setLoadingPdfPreview(true);
    try {
      const url = await fetchRepcPdfUrl();
      if (!url) {
        showToast('error', 'Could not load contract PDF. Please check your connection.');
        return;
      }
      setPdfPreviewUrl(url);
      setShowPdfPreview(true);
      if (!dealId || !draft) {
        showToast('success', 'Showing blank REPC template. Fill in form details to personalize.');
      }
    } catch (err) {
      console.error('PDF preview error:', err);
      showToast('error', 'Failed to load PDF workspace.');
    } finally {
      setLoadingPdfPreview(false);
    }
  };

  const undoSmartFill = () => {
    if (!draft || !smartFillUndo) return;
    setDraft({ ...draft, ...smartFillUndo.previous });
    addSmartFillLog({
      source: 'undo',
      summary: `Undid ${smartFillUndo.label.toLowerCase()} changes.`,
      fields: smartFillUndo.fields,
    });
    setSmartFillUndo(null);
    showToast('success', 'Reverted last Smart Fill update.');
  };

  useEffect(() => {
    if (!dealId || autoPreviewed || !draft) return;
    setAutoPreviewed(true);
    loadInlinePreview();
  }, [dealId, autoPreviewed, draft]);

  useEffect(() => {
    return () => {
      if (pdfInlineUrl) URL.revokeObjectURL(pdfInlineUrl);
    };
  }, [pdfInlineUrl]);

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-400">Loading contract workspace...</div>
      </div>
    );
  }

  const sumComponents =
    (draft.newLoanAmount || 0) + (draft.sellerFinancingAmount || 0) + (draft.cashAtSettlement || 0);
  const purchaseMatches = sumComponents === draft.purchasePrice;
  const syncLabel = lastSyncedAt
    ? `Synced ${lastSyncedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : 'Not synced yet';
  const validationIssues = validateRepc(draft);
  const errorIssues = validationIssues.filter((issue) => issue.type === 'error');
  const warningIssues = validationIssues.filter((issue) => issue.type === 'warning');
  const missingRequired = REPC_REQUIRED_FIELDS.filter((field) => {
    const value = draft[field.key];
    if (typeof value === 'number') return value <= 0;
    return !String(value || '').trim();
  });
  const readinessScore = Math.max(0, 100 - missingRequired.length * 8 - errorIssues.length * 10 - warningIssues.length * 4);
  const firstMissing = missingRequired[0];

  const focusField = (fieldKey: keyof RepcDraft) => {
    const element = document.querySelector(`[name="${fieldKey}"]`) ||
      document.querySelector(`[data-field="${fieldKey}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (element as HTMLElement).focus?.();
    }
  };

  const timelineItems = [
    { key: 'offerExpirationDate', label: 'Offer Expiration', date: draft.offerExpirationDate },
    { key: 'sellerDisclosureDeadline', label: 'Seller Disclosure', date: draft.sellerDisclosureDeadline },
    { key: 'dueDiligenceDeadline', label: 'Due Diligence', date: draft.dueDiligenceDeadline },
    { key: 'financingAppraisalDeadline', label: 'Financing/Appraisal', date: draft.financingAppraisalDeadline },
    { key: 'settlementDeadline', label: 'Settlement', date: draft.settlementDeadline },
  ]
    .filter((item) => item.date)
    .map((item) => {
      const date = new Date(item.date as string);
      const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      let status: 'past' | 'soon' | 'upcoming' = 'upcoming';
      if (days < 0) status = 'past';
      else if (days <= 5) status = 'soon';
      return { ...item, days, status };
    })
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  const nextDeadline = timelineItems.find((item) => item.status !== 'past');
  const propertyLabel = dealSummary?.property?.street
    ? `${dealSummary.property.street}${dealSummary.property.city ? `, ${dealSummary.property.city}` : ''}`
    : dealSummary?.title || 'Deal paperwork';
  const partyLabel = [draft.buyerLegalNames, draft.sellerLegalNames].filter(Boolean).join(' vs ') || 'Parties not set';
  const readinessLabel = missingRequired.length === 0 && errorIssues.length === 0
    ? 'Ready for review'
    : [
        missingRequired.length ? `${missingRequired.length} required missing` : null,
        errorIssues.length ? `${errorIssues.length} error${errorIssues.length === 1 ? '' : 's'}` : null,
        warningIssues.length ? `${warningIssues.length} warning${warningIssues.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(', ');
  const primaryPaperworkActions = [
    {
      label: existing ? 'Draft saved' : 'Draft not saved',
      detail: syncLabel,
      tone: existing ? 'emerald' : 'amber',
      icon: existing ? CheckCircle2 : Clock3,
    },
    {
      label: `${readinessScore}% complete`,
      detail: readinessLabel,
      tone: readinessScore >= 85 ? 'emerald' : readinessScore >= 60 ? 'blue' : 'amber',
      icon: ClipboardCheck,
    },
    {
      label: nextDeadline ? nextDeadline.label : 'Deadlines',
      detail: nextDeadline ? `${formatShortDate(nextDeadline.date)} (${nextDeadline.days} days)` : 'Not set yet',
      tone: nextDeadline?.status === 'soon' ? 'amber' : 'blue',
      icon: Clock3,
    },
  ];

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

    <div className="mx-auto w-full max-w-[96rem] space-y-6 px-4 pb-8 pt-1 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <PageHeader
        eyebrow="Deal contracts"
        title="Contracts"
        icon={<FileText className="h-5 w-5" strokeWidth={2.2} />}
        subtitle={`${propertyLabel} - ${partyLabel}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              onClick={() => navigate('/contracts', { state: { dealId } })}
            >
              <ArrowLeft className="h-4 w-4" />
              Contracts hub
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={openPdfWorkspace}
              loading={loadingPdfPreview}
            >
              <ExternalLink className="h-4 w-4" />
              PDF workspace
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowSendModal(true)}>
              <Send className="h-4 w-4" />
              E-sign
            </Button>
          </>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] dark:border-[#f2d894]/[0.12] dark:bg-[#0a0f18]/90">
        <div className="grid items-stretch xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col border-b border-slate-200/80 p-3 dark:border-white/10 sm:p-4 xl:min-h-[calc(100vh-12rem)] xl:border-b-0 xl:border-r">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    Primary contract
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Utah Real Estate Purchase Contract</span>
                </div>
                <h2 className="mt-2 truncate text-lg font-semibold text-slate-950 dark:text-white">{propertyLabel}</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{partyLabel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={loadInlinePreview} disabled={pdfInlineLoading}>
                  <RefreshCw className={`h-4 w-4 ${pdfInlineLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button size="sm" variant="primary" onClick={openPdfWorkspace} loading={loadingPdfPreview}>
                  <PenLine className="h-4 w-4" />
                  Open PDF
                </Button>
                <Button size="sm" variant="primary" onClick={() => setShowSendModal(true)}>
                  <Send className="h-4 w-4" />
                  E-sign
                </Button>
              </div>
            </div>

            <div className="flex min-h-[520px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black/45 md:min-h-[640px] xl:min-h-0">
              {pdfInlineLoading ? (
                <div className="flex flex-1 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                  Loading contract preview...
                </div>
              ) : pdfInlineError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div>{pdfInlineError}</div>
                  <Button size="sm" variant="secondary" onClick={loadInlinePreview}>
                    Try again
                  </Button>
                </div>
              ) : pdfInlineUrl ? (
                <iframe
                  title="Contract preview"
                  src={pdfInlineUrl}
                  className="min-h-[520px] w-full flex-1 bg-white md:min-h-[640px] xl:min-h-0"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                  Contract preview will appear here after loading.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-3 p-3">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {primaryPaperworkActions.map((item) => {
                const Icon = item.icon;
                const toneClass = item.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : item.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100'
                    : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-100';
                return (
                  <div key={item.label} className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-80">{item.detail}</div>
                  </div>
                );
              })}
            </div>

            {firstMissing && (
              <button
                type="button"
                onClick={() => focusField(firstMissing.key)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-left text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
              >
                <span className="truncate">Next missing: {firstMissing.label}</span>
                <span className="shrink-0">Jump</span>
              </button>
            )}

            {dealId && (
              <DocumentChecklist
                dealId={dealId}
                hasRepc={existing}
                repcStatus={existing ? 'draft' : undefined}
                defaultExpanded
                onStartRepc={() => {
                  setViewMode('form');
                  setStep(1);
                }}
                onEditRepc={() => {
                  setViewMode('form');
                  setStep(1);
                }}
                onSendRepc={() => setShowSendModal(true)}
              />
            )}
          </aside>
        </div>
      </section>

      {templateStartCode && templateStartCode !== 'REPC' && dealId && (
        <Card className="p-4 border border-blue-500/20 bg-blue-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Template ready to review</div>
              <div className="text-xs text-blue-700 dark:text-blue-200/80">Open {templateStartCode} to finish the template details for this deal.</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/contracts/${dealId}/forms/${templateStartCode}`)}>
              Open {templateStartCode}
            </Button>
          </div>
        </Card>
      )}

      {/* Contract AI Review Panel */}
      {draft && dealId && (
        <div id="contract-ai-panel">
          <ContractAIPanel
            formValues={draft}
            dealId={dealId}
            onFieldFocus={(field) => {
              const element = document.querySelector(`[name="${field}"]`) ||
                document.querySelector(`[data-field="${field}"]`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (element as HTMLElement).focus?.();
              }
            }}
            onAutoFill={(field, value) => {
              if (draft) {
                setDraft({ ...draft, [field]: value });
              }
            }}
          />
        </div>
      )}

      {/* View toggle */}
      <div className="inline-flex rounded-full bg-slate-100 border border-slate-200 p-1 text-xs dark:bg-white/5 dark:border-white/10">
        <button
          onClick={() => setViewMode('form')}
          className={
            'px-4 py-1.5 rounded-full font-bold transition ' +
            (viewMode === 'form' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5')
          }
        >
          Contract fields
        </button>
        <button
          onClick={() => setViewMode('guided')}
          className={
            'px-4 py-1.5 rounded-full font-bold transition ' +
            (viewMode === 'guided' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5')
          }
        >
          Guided Q&A
        </button>
      </div>

      {/* Two-column layout: dynamic main + side panel */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:gap-6">
        {/* Form container */}
        <div className="space-y-6">
          {viewMode === 'form' && (
            <>
            {/* Quick Fill & Smart Fill Card */}
            <Card className="space-y-3 border border-slate-200 bg-white/90 p-3 dark:border-white/10 dark:bg-slate-900/40 md:p-4">
              {/* Quick Fill Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Quick Fill Timelines</div>
                  <div className="hidden text-[10px] text-slate-500 sm:block">One-click deadlines</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(QUICK_FILL_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (draft) {
                          setDraft({ ...draft, ...preset.getDates() });
                          showToast('success', `Applied ${preset.label} timeline`);
                        }
                      }}
                      className="rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-600/80 to-indigo-600/80 px-2.5 py-1 text-[11px] text-white shadow-lg shadow-blue-500/10 transition-all hover:from-blue-500 hover:to-indigo-500"
                    >
                      <span className="font-semibold">{preset.label}</span>
                      <span className="hidden text-blue-200/70 ml-1 2xl:inline">- {preset.description.split(',')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Fill */}
              <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Smart Fill</div>
                  <div className="hidden text-[10px] text-slate-500 sm:block">Deal, MLS, or plain English</div>
                </div>
                <div className="grid gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/80">Import Data</div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={applyDealPrefill}
                        disabled={!dealSummary}
                        className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 border-emerald-500/30"
                      >
                        Import Deal + Client
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const prompt = buildAutoFillPrompt();
                          if (!prompt) {
                            showToast('warning', 'Add deal or MLS data to enable AI autofill.');
                            return;
                          }
                          await requestSmartPromptUpdates(prompt, 'AI autofill', false);
                        }}
                        disabled={!dealSummary && !mlsListing}
                        className="bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 border-blue-500/30"
                      >
                        AI Autofill
                      </Button>
                      <span className="self-center text-[10px] text-emerald-100/70">Buyer, seller, price</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input
                        value={mlsQuery}
                        onChange={(e) => setMlsQuery(e.target.value)}
                        placeholder="MLS # or address"
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleMlsSearch}
                        disabled={mlsLoading || !mlsQuery.trim()}
                        className="flex items-center justify-center"
                      >
                        {mlsLoading ? 'Syncing…' : 'Find Listing'}
                      </Button>
                    </div>
                    {(mlsSearchError || mlsInlineError) && (
                      <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                        {mlsInlineError || mlsSearchError}
                      </div>
                    )}
                    {mlsListing && (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 flex flex-col gap-2">
                        <div>
                          <div className="text-xs text-white font-semibold">
                            MLS #{mlsListing.mlsNumber}{mlsListing.addressLine1 ? ` • ${mlsListing.addressLine1}` : ''}
                          </div>
                          <div className="text-[11px] text-emerald-100/80 mt-1">
                            {mlsListing.city ? `${mlsListing.city}, ${mlsListing.state || 'UT'} ${mlsListing.zip || ''}` : 'Listing ready to apply'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={mlsLoading || !draft}
                          onClick={() => applyMlsPrefill(mlsListing)}
                          className="bg-white/10 text-white hover:bg-white/20 border-white/10"
                        >
                          {prefillAppliedId === mlsListing.id ? 'Prefill Applied' : 'Apply to Contract'}
                        </Button>
                      </div>
                    )}
                    {prefillSummary && (
                      <div className="text-[11px] text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-3 py-1 inline-flex">
                        {prefillSummary}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-900/10 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/80">Smart Prompt</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={smartPrompt}
                        onChange={(e) => setSmartPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applySmartPrompt();
                          }
                        }}
                        placeholder="Example: 550k price, 10k earnest, buyers John and Jane Doe"
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      <Button size="sm" variant="primary" onClick={applySmartPrompt} className="px-4">
                        Apply
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '550k price, 10k earnest',
                        'Buyers John and Jane Doe',
                        'Offer expires June 20 at 5pm',
                      ].map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setSmartPrompt(example)}
                          className="px-3 py-1 rounded-full text-[10px] text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                    {smartExplanation && (
                      <div className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5">
                        {smartExplanation}
                      </div>
                    )}
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1">
                      AI interpretation is a draft only. Review before relying.
                    </div>
                  </div>
                </div>
                {smartFillLog.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400">Smart Fill Log</div>
                      {smartFillUndo && (
                        <button
                          type="button"
                          onClick={undoSmartFill}
                          className="text-[10px] font-semibold text-amber-300 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 rounded-full hover:bg-amber-500/20"
                        >
                          Undo last
                        </button>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      {smartFillLog.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2">
                          <div>
                            <div className="text-xs text-white font-semibold">
                              {entry.source === 'smart_prompt'
                                ? 'Smart prompt'
                                : entry.source === 'deal'
                                ? 'Deal import'
                                : entry.source === 'mls'
                                ? 'MLS import'
                                : 'Undo'}
                            </div>
                            <div className="text-[11px] text-slate-400">{entry.summary}</div>
                          </div>
                          <div className="text-[10px] text-slate-500 whitespace-nowrap">{entry.timestamp}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

              {pendingSmartUpdate && draft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                  <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Review {pendingSmartUpdate.label} changes</h3>
                        <p className="text-xs text-slate-400 mt-1">Confirm before applying to your contract draft.</p>
                      </div>
                      <button
                        onClick={() => setPendingSmartUpdate(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      {pendingSmartUpdate.explanation && (
                        <div className="text-xs text-blue-200 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                          {pendingSmartUpdate.explanation}
                        </div>
                      )}

                      {Object.keys(pendingSmartUpdate.updates).length === 0 ? (
                        <div className="text-sm text-slate-400">No changes suggested.</div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(pendingSmartUpdate.updates).map(([key, value]) => (
                            <div key={key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                              <div className="text-[11px] text-slate-400">{key}</div>
                              <div className="mt-1 text-sm text-white">
                                <span className="text-slate-500">Current:</span>{' '}
                                <span className="text-slate-200">
                                  {(draft as any)[key] ? String((draft as any)[key]) : '—'}
                                </span>
                              </div>
                              <div className="text-sm text-emerald-200">
                                <span className="text-slate-500">New:</span>{' '}
                                {value ? String(value) : '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingSmartUpdate(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          applySmartUpdates(
                            pendingSmartUpdate.label,
                            pendingSmartUpdate.updates,
                            pendingSmartUpdate.explanation
                          );
                          setPendingSmartUpdate(null);
                        }}
                        disabled={Object.keys(pendingSmartUpdate.updates).length === 0}
                      >
                        Apply Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}

            {/* Form Steps Card */}
            <Card className="p-4 md:p-6 space-y-6 bg-white/90 border border-slate-200 dark:bg-slate-900/40 dark:border-white/10">
            {/* Stepper */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(s)}
                    className={
                      'h-8 w-8 rounded-full border text-xs font-bold transition ' +
                      (s === step
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                        : s < step
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-transparent text-slate-600 border-slate-800')
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Badge variant="info" className="bg-blue-500/10 text-blue-300 border-blue-500/20">Step {step} of 6</Badge>
            </div>

            {/* Real-time Validation Banner */}
            {(() => {
              const issues = validateRepc(draft);
              const errors = issues.filter(i => i.type === 'error');
              const warnings = issues.filter(i => i.type === 'warning');
              if (errors.length === 0 && warnings.length === 0) return null;
              return (
                <div className="space-y-2">
                  {errors.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-red-300">
                        <span className="font-semibold">Issues to fix:</span> {errors.map(e => e.message).join(' • ')}
                      </div>
                    </div>
                  )}
                  {warnings.length > 0 && errors.length === 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="text-xs text-amber-300">
                        <span className="font-semibold">Review:</span> {warnings.slice(0, 2).map(w => w.message).join(' • ')}
                        {warnings.length > 2 && ` +${warnings.length - 2} more`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Step 1: Offer basics */}
            {step === 1 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Offer Basics
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Required</span>
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>
                      Buyer Legal Names
                      <FieldTip tip="Full legal name(s) as they appear on ID" />
                    </label>
                    <input
                      name="buyerLegalNames"
                      data-field="buyerLegalNames"
                      className={inputClasses + (!draft.buyerLegalNames.trim() ? ' border-amber-500/50' : '')}
                      value={draft.buyerLegalNames}
                      onChange={(e) => setDraft({ ...draft, buyerLegalNames: e.target.value })}
                      placeholder="John and Jane Doe"
                    />
                    {!draft.buyerLegalNames.trim() && <p className="text-[10px] text-amber-400 mt-1">Required for valid offer</p>}
                  </div>
                  <div>
                    <label className={labelClasses}>
                      Seller Legal Names
                      <FieldTip tip="Names from title/deed" />
                    </label>
                    <input
                      name="sellerLegalNames"
                      data-field="sellerLegalNames"
                      className={inputClasses + (!draft.sellerLegalNames.trim() ? ' border-amber-500/50' : '')}
                      value={draft.sellerLegalNames}
                      onChange={(e) => setDraft({ ...draft, sellerLegalNames: e.target.value })}
                      placeholder="Bob and Alice Smith"
                    />
                    {!draft.sellerLegalNames.trim() && <p className="text-[10px] text-amber-400 mt-1">Required for valid offer</p>}
                  </div>
                </div>
              </section>
            )}

            {/* Step 2: Property */}
            {step === 2 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-white">Property Details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>City</label>
                    <input
                      className={inputClasses}
                      value={draft.propertyCity}
                      onChange={(e) => setDraft({ ...draft, propertyCity: e.target.value })}
                      placeholder="Salt Lake City"
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>County</label>
                    <input
                      className={inputClasses}
                      value={draft.propertyCounty}
                      onChange={(e) => setDraft({ ...draft, propertyCounty: e.target.value })}
                      placeholder="Salt Lake"
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>State</label>
                    <input
                      className={inputClasses}
                      value={draft.propertyState}
                      onChange={(e) => setDraft({ ...draft, propertyState: e.target.value })}
                      placeholder="UT"
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>ZIP</label>
                    <input
                      className={inputClasses}
                      value={draft.propertyZip}
                      onChange={(e) => setDraft({ ...draft, propertyZip: e.target.value })}
                      placeholder="84101"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Step 3: Money */}
            {step === 3 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Money
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Key terms</span>
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClasses}>
                      Purchase Price
                      <FieldTip tip="Total agreed price for property" />
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        name="purchasePrice"
                        data-field="purchasePrice"
                        className={inputClasses + ' pl-7'}
                        value={draft.purchasePrice || ''}
                        onChange={(e) =>
                          setDraft({ ...draft, purchasePrice: Number(e.target.value) })
                        }
                        placeholder="550000"
                      />
                    </div>
                    {draft.purchasePrice > 0 && (
                      <p className="text-[10px] text-emerald-400 mt-1">${draft.purchasePrice.toLocaleString()}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClasses}>
                      Earnest Money
                      <FieldTip tip="Typically 1-3% of purchase price" />
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        name="earnestMoneyAmount"
                        data-field="earnestMoneyAmount"
                        className={inputClasses + ' pl-7' + (draft.earnestMoneyAmount > draft.purchasePrice && draft.purchasePrice > 0 ? ' border-red-500/50' : '')}
                        value={draft.earnestMoneyAmount || ''}
                        onChange={(e) =>
                          setDraft({ ...draft, earnestMoneyAmount: Number(e.target.value) })
                        }
                        placeholder="10000"
                      />
                    </div>
                    {draft.purchasePrice > 0 && draft.earnestMoneyAmount > 0 && (
                      <p className={`text-[10px] mt-1 ${(draft.earnestMoneyAmount / draft.purchasePrice * 100) < 1 || (draft.earnestMoneyAmount / draft.purchasePrice * 100) > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {(draft.earnestMoneyAmount / draft.purchasePrice * 100).toFixed(2)}% of price
                        {(draft.earnestMoneyAmount / draft.purchasePrice * 100) < 1 && ' (typically 1-3%)'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClasses}>
                      Payment Form
                      <FieldTip tip="Wire, check, or other" />
                    </label>
                    <select
                      name="earnestMoneyForm"
                      className={inputClasses}
                      value={draft.earnestMoneyForm}
                      onChange={(e) => setDraft({ ...draft, earnestMoneyForm: e.target.value })}
                    >
                      <option value="wire">Wire Transfer</option>
                      <option value="check">Cashier's Check</option>
                      <option value="personal_check">Personal Check</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClasses}>New Loan</label>
                    <input
                      type="number"
                      className={inputClasses}
                      value={draft.newLoanAmount ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, newLoanAmount: Number(e.target.value) || null })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Seller Financing</label>
                    <input
                      type="number"
                      className={inputClasses}
                      value={draft.sellerFinancingAmount ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sellerFinancingAmount: Number(e.target.value) || null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Cash at Settlement</label>
                    <input
                      type="number"
                      className={inputClasses}
                      value={draft.cashAtSettlement ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, cashAtSettlement: Number(e.target.value) || null })
                      }
                    />
                  </div>
                </div>
                <p
                  className={
                    'text-xs px-3 py-2 rounded-xl font-medium ' +
                    (purchaseMatches
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-300 border border-red-500/30')
                  }
                >
                  Components total: ${sumComponents.toLocaleString()} vs purchase price $
                  {draft.purchasePrice.toLocaleString()}
                </p>
              </section>
            )}

            {/* Step 4: Conditions */}
            {step === 4 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Conditions & Deadlines
                  <span className="text-xs font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Use Quick Fill above</span>
                </h2>
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition w-full">
                    <input
                      type="checkbox"
                      checked={draft.hasDueDiligenceCondition}
                      onChange={(e) =>
                        setDraft({ ...draft, hasDueDiligenceCondition: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-slate-200 font-medium">Due diligence condition</span>
                  </label>
                  <label className="inline-flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition w-full">
                    <input
                      type="checkbox"
                      checked={draft.hasAppraisalCondition}
                      onChange={(e) =>
                        setDraft({ ...draft, hasAppraisalCondition: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-slate-200 font-medium">Appraisal condition</span>
                  </label>
                  <label className="inline-flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition w-full">
                    <input
                      type="checkbox"
                      checked={draft.hasFinancingCondition}
                      onChange={(e) =>
                        setDraft({ ...draft, hasFinancingCondition: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-sm text-slate-200 font-medium">Financing condition</span>
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className={labelClasses}>
                      Seller Disclosure Deadline
                      <FieldTip tip="When seller must provide disclosures" />
                    </label>
                    <input
                      type="date"
                      name="sellerDisclosureDeadline"
                      data-field="sellerDisclosureDeadline"
                      className={inputClasses + (draft.sellerDisclosureDeadline && draft.sellerDisclosureDeadline < new Date().toISOString().slice(0, 10) ? ' border-amber-500/50' : '')}
                      value={draft.sellerDisclosureDeadline}
                      onChange={(e) =>
                        setDraft({ ...draft, sellerDisclosureDeadline: e.target.value })
                      }
                    />
                    {draft.sellerDisclosureDeadline && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {Math.ceil((new Date(draft.sellerDisclosureDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days from today
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClasses}>
                      Due Diligence Deadline
                      <FieldTip tip="Inspection, review period ends" />
                    </label>
                    <input
                      type="date"
                      name="dueDiligenceDeadline"
                      data-field="dueDiligenceDeadline"
                      className={inputClasses + (draft.dueDiligenceDeadline && draft.settlementDeadline && draft.dueDiligenceDeadline >= draft.settlementDeadline ? ' border-red-500/50' : '')}
                      value={draft.dueDiligenceDeadline}
                      onChange={(e) =>
                        setDraft({ ...draft, dueDiligenceDeadline: e.target.value })
                      }
                    />
                    {draft.dueDiligenceDeadline && (
                      <p className={`text-[10px] mt-1 ${draft.settlementDeadline && draft.dueDiligenceDeadline >= draft.settlementDeadline ? 'text-red-400' : 'text-slate-400'}`}>
                        {Math.ceil((new Date(draft.dueDiligenceDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days from today
                        {draft.settlementDeadline && draft.dueDiligenceDeadline >= draft.settlementDeadline && ' - must be before settlement!'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClasses}>
                      Financing & Appraisal
                      <FieldTip tip="Loan approval deadline" />
                    </label>
                    <input
                      type="date"
                      name="financingAppraisalDeadline"
                      data-field="financingAppraisalDeadline"
                      className={inputClasses + (draft.financingAppraisalDeadline && draft.settlementDeadline && draft.financingAppraisalDeadline >= draft.settlementDeadline ? ' border-red-500/50' : '')}
                      value={draft.financingAppraisalDeadline}
                      onChange={(e) =>
                        setDraft({ ...draft, financingAppraisalDeadline: e.target.value })
                      }
                    />
                    {draft.financingAppraisalDeadline && (
                      <p className={`text-[10px] mt-1 ${draft.settlementDeadline && draft.financingAppraisalDeadline >= draft.settlementDeadline ? 'text-red-400' : 'text-slate-400'}`}>
                        {Math.ceil((new Date(draft.financingAppraisalDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days from today
                        {draft.settlementDeadline && draft.financingAppraisalDeadline >= draft.settlementDeadline && ' - must be before settlement!'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClasses}>
                      Settlement Deadline
                      <FieldTip tip="Closing date - when keys transfer" />
                    </label>
                    <input
                      type="date"
                      name="settlementDeadline"
                      data-field="settlementDeadline"
                      className={inputClasses + (draft.settlementDeadline && draft.settlementDeadline < new Date().toISOString().slice(0, 10) ? ' border-red-500/50' : '')}
                      value={draft.settlementDeadline}
                      onChange={(e) => setDraft({ ...draft, settlementDeadline: e.target.value })}
                    />
                    {draft.settlementDeadline && (
                      <p className={`text-[10px] mt-1 font-semibold ${draft.settlementDeadline < new Date().toISOString().slice(0, 10) ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Math.ceil((new Date(draft.settlementDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days to close
                        {draft.settlementDeadline < new Date().toISOString().slice(0, 10) && ' - date is in the past!'}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Step 5: Extras */}
            {step === 5 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Extras & Expiration
                  <span className="text-xs font-normal text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full">Optional</span>
                </h2>
                <label className="inline-flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition w-full">
                  <input
                    type="checkbox"
                    checked={draft.hasHomeWarranty}
                    onChange={(e) => setDraft({ ...draft, hasHomeWarranty: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                  <div>
                    <span className="text-sm text-slate-200 font-medium">Include home warranty</span>
                    <p className="text-[10px] text-slate-500">Covers repairs/replacements for 1 year</p>
                  </div>
                </label>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className={labelClasses}>
                      Offer Expires On
                      <FieldTip tip="Seller must respond by this date/time" />
                    </label>
                    <input
                      type="date"
                      name="offerExpirationDate"
                      data-field="offerExpirationDate"
                      className={inputClasses + (draft.offerExpirationDate && draft.offerExpirationDate < new Date().toISOString().slice(0, 10) ? ' border-red-500/50' : '')}
                      value={draft.offerExpirationDate}
                      onChange={(e) =>
                        setDraft({ ...draft, offerExpirationDate: e.target.value })
                      }
                    />
                    {draft.offerExpirationDate && (
                      <p className={`text-[10px] mt-1 ${draft.offerExpirationDate < new Date().toISOString().slice(0, 10) ? 'text-red-400' : 'text-slate-400'}`}>
                        {draft.offerExpirationDate < new Date().toISOString().slice(0, 10) 
                          ? 'Offer already expired!' 
                          : `${Math.ceil((new Date(draft.offerExpirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days to respond`}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                    <div>
                      <label className={labelClasses}>Time</label>
                      <input
                        className={inputClasses}
                        value={draft.offerExpirationTime}
                        onChange={(e) =>
                          setDraft({ ...draft, offerExpirationTime: e.target.value })
                        }
                        placeholder="17:00"
                      />
                    </div>
                    <div className="pb-1">
                      <select
                        className={inputClasses + ' h-[42px]'}
                        value={draft.offerExpirationMeridiem}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            offerExpirationMeridiem: e.target.value as 'AM' | 'PM',
                          })
                        }
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Step 6: Summary */}
            {step === 6 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-white">Summary</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2 text-sm">
                    <div className="font-bold text-slate-300 text-xs uppercase tracking-wider">Parties</div>
                    <div className="text-white font-medium">Buyer: {draft.buyerLegalNames}</div>
                    <div className="text-white font-medium">Seller: {draft.sellerLegalNames}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2 text-sm">
                    <div className="font-bold text-slate-300 text-xs uppercase tracking-wider">Money</div>
                    <div className="text-white font-medium">
                      Purchase: ${draft.purchasePrice.toLocaleString()}
                    </div>
                    <div className="text-slate-400">
                      Components: ${sumComponents.toLocaleString()} (
                      {purchaseMatches ? 'matches' : 'mismatch'})
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2 text-sm">
                    <div className="font-bold text-slate-300 text-xs uppercase tracking-wider">Deadlines</div>
                    <div className="text-slate-400">
                      Seller disclosure: <span className="text-white">{draft.sellerDisclosureDeadline || '—'}</span>
                    </div>
                    <div className="text-slate-400">
                      Due diligence: <span className="text-white">{draft.dueDiligenceDeadline || '—'}</span>
                    </div>
                    <div className="text-slate-400">
                      Financing: <span className="text-white">{draft.financingAppraisalDeadline || '—'}</span>
                    </div>
                    <div className="text-slate-400">
                      Settlement: <span className="text-white">{draft.settlementDeadline || '—'}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2 text-sm">
                    <div className="font-bold text-slate-300 text-xs uppercase tracking-wider">Offer Expiration</div>
                    <div className="text-white font-medium">
                      {draft.offerExpirationDate || '—'} {draft.offerExpirationTime}{' '}
                      {draft.offerExpirationMeridiem}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {error && (
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            </Card>
            </>
          )}

          {viewMode === 'guided' && (
            <Card className="p-5 space-y-6 bg-slate-900/40 backdrop-blur-xl border-white/10">
              {!formInstanceId && <div className="text-sm text-slate-500">Preparing guided session…</div>}
              {formInstanceId && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white">Guided contract interview</h2>
                      <p className="text-xs text-slate-400">Plain-language questions fill Utah REPC fields.</p>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">Question {questions.length ? questionIndex + 1 : 0} of {questions.length}</div>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: questions.length ? ((questionIndex + 1) / questions.length) * 100 + '%' : '0%' }}></div>
                  </div>
                  {questions.length === 0 && <div className="text-sm text-slate-500">No questions available.</div>}
                  {questions.length > 0 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-white">{questions[questionIndex].label}</div>
                        <div className="text-xs text-slate-400">{questions[questionIndex].prompt}</div>
                        {questions[questionIndex].helpText && (
                          <div className="text-[11px] text-slate-500">{questions[questionIndex].helpText}</div>
                        )}
                      </div>
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-600"
                        placeholder="Type your answer here…"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setQuestionIndex(i => Math.max(0, i - 1))} className="text-slate-400 hover:text-white">Back</Button>
                          <Button size="sm" variant="secondary" onClick={() => setQuestionIndex(i => Math.min(questions.length - 1, i + 1))} className="bg-white/5 text-slate-300 hover:bg-white/10 border-white/5">Skip</Button>
                        </div>
                        <Button size="sm" variant="primary" onClick={answerCurrentQuestion}>Apply answer</Button>
                      </div>
                      {answerExplanation && (
                        <div className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5">{answerExplanation}</div>
                      )}
                      <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1">AI parsing is heuristic only. Review mapped fields.</div>
                    </div>
                  )}
                  {draft && (
                    <div className="border-t border-white/10 pt-4 space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Snapshot</div>
                      <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500">
                        <div>Price: {draft.purchasePrice ? `$${draft.purchasePrice.toLocaleString()}` : '—'}</div>
                        <div>Earnest: {draft.earnestMoneyAmount ? `$${draft.earnestMoneyAmount.toLocaleString()}` : '—'}</div>
                        <div>Due diligence: {draft.dueDiligenceDeadline || '—'}</div>
                        <div>Settlement: {draft.settlementDeadline || '—'}</div>
                        <div>Disclosure: {draft.sellerDisclosureDeadline || '—'}</div>
                        <div>Financing/Appraisal: {draft.financingAppraisalDeadline || '—'}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {/* Action bar (form view only) */}
          {viewMode === 'form' && (
            <div className="flex items-center justify-between gap-4">
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))} className="text-slate-400 hover:text-white hover:bg-white/5">← Back</Button>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 mr-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/70" />
                  {syncLabel}
                </div>
                <Button variant="secondary" size="sm" onClick={() => void save()} disabled={saving} className="bg-white/5 text-white hover:bg-white/10 border-white/10">{saving ? 'Saving…' : 'Save draft'}</Button>
                <Button variant="primary" size="sm" onClick={() => setStep((s) => Math.min(6, s + 1))}>{step === 6 ? 'Finish' : 'Next step →'}</Button>
              </div>
            </div>
          )}
        </div>

        {/* Paperwork side panel */}
        <div className="hidden space-y-3 xl:block">
          <Card className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Paperwork at a glance</div>
                <div className="mt-1 truncate text-sm font-semibold text-white">{formatMoney(draft.purchasePrice)} purchase</div>
              </div>
              <div className="shrink-0 text-right text-[10px] text-slate-400">
                {errorIssues.length} errors
                <br />
                {warningIssues.length} warnings
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {timelineItems.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-400">
                  No contract dates set yet.
                </div>
              ) : (
                timelineItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => focusField(item.key as keyof RepcDraft)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      item.status === 'past'
                        ? 'border-red-400/30 bg-red-500/10 text-red-200'
                        : item.status === 'soon'
                          ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate font-semibold">{item.label}</span>
                    <span className="shrink-0">{formatShortDate(item.date)}</span>
                  </button>
                ))
              )}
            </div>

            {missingRequired.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100">
                <div className="font-semibold">Missing before send</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missingRequired.slice(0, 5).map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => focusField(field.key)}
                      className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold hover:bg-amber-500/20"
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-lg border border-blue-400/30 bg-blue-500/10 px-2.5 py-2 text-[10px] text-blue-100">
              Always compare final terms against the official Utah form and your brokerage review process.
            </div>
          </Card>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950 animate-in fade-in duration-200">
          <PdfAnnotator
            pdfUrl={pdfPreviewUrl}
            signers={[
              { role: 'BUYER', name: draft?.buyerLegalNames || '', email: '' },
              { role: 'SELLER', name: draft?.sellerLegalNames || '', email: '' },
            ]}
            dealData={{
              address: dealSummary?.property?.street ? `${dealSummary.property.street}, ${dealSummary.property.city || ''}, ${dealSummary.property.state || 'UT'}` : undefined,
              city: draft?.propertyCity,
              state: draft?.propertyState || 'UT',
              zip: draft?.propertyZip,
              county: draft?.propertyCounty,
              purchasePrice: draft?.purchasePrice,
              earnestMoney: draft?.earnestMoneyAmount,
              settlementDate: draft?.settlementDeadline,
              dueDiligenceDeadline: draft?.dueDiligenceDeadline,
              buyerName: draft?.buyerLegalNames,
              sellerName: draft?.sellerLegalNames,
              mlsNumber: mlsListing?.mlsNumber,
              taxId: draft?.propertyTaxId,
            }}
            onCancel={() => {
              setShowPdfPreview(false);
              if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl(null);
              }
            }}
            onSend={() => {
              setShowPdfPreview(false);
              setShowSendModal(true);
            }}
            sending={false}
          />
        </div>
      )}

      {showSendModal && dealId && (
        <SendForSignatureModal
          dealId={dealId}
          dealSummary={dealSummary}
          onClose={() => setShowSendModal(false)}
          onSend={async (payload) => {
            await handleSendForEsign(payload);
            setShowSendModal(false);
          }}
        />
      )}

      {signLinks && signLinks.length > 0 && (
        <CopyLinksModal links={signLinks} onClose={() => setSignLinks(null)} />
      )}
    </div>
    </>
  );
}

function SendForSignatureModal({
  dealId,
  dealSummary,
  onClose,
  onSend,
}: {
  dealId: string;
  dealSummary: any | null;
  onClose: () => void;
  onSend: (payload: { signers: { role: string; name: string; email: string }[]; subject: string; message: string; sendEmails?: boolean }) => void;
}) {
  const propertyLabel = dealSummary?.property?.street || dealSummary?.title || 'Property';
  const [step, setStep] = useState<'recipients' | 'preview'>('recipients');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [signers, setSigners] = useState([
    {
      role: 'BUYER',
      name: dealSummary?.buyer ? `${dealSummary.buyer.firstName} ${dealSummary.buyer.lastName}` : '',
      email: dealSummary?.buyer?.email || '',
      included: true,
    },
    {
      role: 'SELLER',
      name: dealSummary?.seller ? `${dealSummary.seller.firstName} ${dealSummary.seller.lastName}` : '',
      email: dealSummary?.seller?.email || '',
      included: true,
    },
  ]);
  const [subject, setSubject] = useState(`Please Sign: Contract for ${propertyLabel}`);
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
    const buyerName = dealSummary?.buyer
      ? `${dealSummary.buyer.firstName} ${dealSummary.buyer.lastName}`.trim()
      : '';
    const sellerName = dealSummary?.seller
      ? `${dealSummary.seller.firstName} ${dealSummary.seller.lastName}`.trim()
      : '';

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
        email: dealSummary?.buyer?.email || '',
        included: true,
      };
      next[1] = {
        ...next[1],
        role: 'SELLER',
        name: sellerName,
        email: dealSummary?.seller?.email || '',
        included: true,
      };

      return next;
    });
  };

  const updateSigner = (index: number, field: string, value: string | boolean) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value } as any;
    setSigners(updated);
  };

  const addRecipient = () => {
    setSigners([...signers, { role: 'OTHER', name: '', email: '', included: true }]);
  };

  const removeRecipient = (index: number) => {
    if (signers.length <= 1) return;
    setSigners(signers.filter((_, i) => i !== index));
  };

  const handlePreview = async () => {
    if (!canSend) return;
    setLoadingPreview(true);
    try {
      const token = localStorage.getItem('utahcontracts_token');
      const response = await fetch(`/api/deals/${dealId}/repc/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setStep('preview');
      }
    } catch (err) {
      console.error('Failed to load PDF preview:', err);
    } finally {
      setLoadingPreview(false);
    }
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

  // Preview step - full PDF annotator
  if (step === 'preview') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 animate-in fade-in duration-200">
        {pdfUrl ? (
          <PdfAnnotator
            pdfUrl={pdfUrl}
            signers={includedSigners.map(s => ({ role: s.role, name: s.name, email: s.email }))}
            dealData={{
              address: dealSummary?.property?.street ? `${dealSummary.property.street}, ${dealSummary.property.city || ''}, ${dealSummary.property.state || 'UT'}` : undefined,
              city: dealSummary?.property?.city,
              state: dealSummary?.property?.state || 'UT',
              zip: dealSummary?.property?.zip,
              purchasePrice: dealSummary?.repc?.purchasePrice,
              settlementDate: dealSummary?.repc?.settlementDeadline,
              buyerName: dealSummary?.buyer ? `${dealSummary.buyer.firstName} ${dealSummary.buyer.lastName}` : undefined,
              sellerName: dealSummary?.seller ? `${dealSummary.seller.firstName} ${dealSummary.seller.lastName}` : undefined,
              mlsNumber: dealSummary?.mlsNumber,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0b1221] border border-slate-200/80 dark:border-white/10 shadow-2xl ring-1 ring-white/5 my-auto text-slate-900 dark:text-white">
        <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Send for Signature</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">REPC • {propertyLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors p-2 hover:bg-slate-100 rounded-full dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col md:flex-row max-h-[70vh] md:max-h-none overflow-hidden">
          {/* Signers Column */}
          <div className="w-full md:w-1/2 p-4 sm:p-6 space-y-4 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-white/5 overflow-y-auto max-h-[40vh] md:max-h-[50vh]">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/> Recipients
            </div>

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
              {signers.map((signer, idx) => (
                <div 
                  key={idx} 
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
                        onClick={() => updateSigner(idx, 'included', !signer.included)}
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
                        onChange={(e) => updateSigner(idx, 'role', e.target.value)}
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
                      {idx >= 2 && (
                        <button
                          type="button"
                          onClick={() => removeRecipient(idx)}
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
                        onChange={(e) => updateSigner(idx, 'name', e.target.value)}
                        placeholder="Full Name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600"
                      />
                      <input
                        type="email"
                        value={signer.email}
                        onChange={(e) => updateSigner(idx, 'email', e.target.value)}
                        placeholder="Email Address (optional)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600"
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
          <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col bg-slate-50 dark:bg-slate-900/30 space-y-4 overflow-y-auto max-h-[40vh] md:max-h-[50vh]">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"/> Message & delivery
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent border-b border-slate-200 pb-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 dark:border-white/10 dark:text-white"
              />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-slate-500">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-24 sm:h-32 bg-transparent border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-blue-500 resize-none dark:border-white/10 dark:text-slate-300"
              />
            </div>
            <div className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 dark:text-blue-300/80 dark:bg-blue-500/10 dark:border-blue-500/20">
              <strong className="text-blue-700 dark:text-blue-300">Delivery:</strong> {emailedSigners.length > 0 ? `${emailedSigners.length} signer${emailedSigners.length > 1 ? 's' : ''} will receive email automatically.` : 'No emails will be sent.'} {linkOnlySigners.length > 0 ? `${linkOnlySigners.length} secure link${linkOnlySigners.length > 1 ? 's' : ''} will be ready to share manually after send.` : ''}
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
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 sm:flex-none text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePreview}
              disabled={loadingPreview || !canSend}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500"
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
