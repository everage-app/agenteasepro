import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  StunningModal,
  ModalCancelButton,
  ModalPrimaryButton,
  ModalInput,
} from '../../components/ui/StunningModal';

interface EnvelopeView {
  contractSnapshot: any;
  envelopeType?: string;
  packetTitle?: string;
  signer?: {
    id?: string;
    name?: string;
    role?: string;
  };
}

interface EnvelopeField {
  id: string;
  type: 'text' | 'signature' | 'initials' | 'date' | 'address' | 'checkbox' | 'name' | 'email' | 'price' | 'mls';
  required?: boolean;
  assignedTo?: string;
  value?: string;
  placeholder?: string;
}

export function PublicSignPage() {
  const { envelopeId, signerId, token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EnvelopeView | null>(null);
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [showAdoptModal, setShowAdoptModal] = useState(false);
  const [initials, setInitials] = useState('');
  const [signatureStyle, setSignatureStyle] = useState<'script' | 'classic' | 'clean'>('script');
  const [focusPdf, setFocusPdf] = useState(false);
  const [showPdfFullscreen, setShowPdfFullscreen] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [activeRequiredFieldId, setActiveRequiredFieldId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fieldInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const contractSnapshot = data?.contractSnapshot || {};
  const propertyAddress = [
    contractSnapshot.street,
    contractSnapshot.city,
    contractSnapshot.state,
    contractSnapshot.zip,
  ]
    .filter(Boolean)
    .join(', ');

  const formatMoney = (value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    const numeric = typeof value === 'string' ? Number(value) : Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(numeric);
  };

  const allFields: EnvelopeField[] = Array.isArray(contractSnapshot?.__esignFieldPlacements)
    ? contractSnapshot.__esignFieldPlacements
    : [];

  const signerRole = data?.signer?.role || '';
  const assignedFields = allFields.filter((field) => {
    if (!field?.id || !field?.type) return false;
    if (!field.assignedTo) return true;
    return field.assignedTo === signerRole;
  });

  const requiredAssignedFields = assignedFields.filter((field) => field.required !== false);

  const isFieldCompleted = (field: EnvelopeField) => {
    if (field.type === 'signature') return !!name.trim();
    if (field.type === 'initials') {
      const current = fieldValues[field.id];
      const local = typeof current === 'string' ? current.trim() : '';
      return !!(local || initials.trim());
    }
    if (field.type === 'checkbox') return fieldValues[field.id] === true;
    const value = fieldValues[field.id];
    return typeof value === 'string' && value.trim().length > 0;
  };

  const missingRequiredFields = requiredAssignedFields.filter((field) => !isFieldCompleted(field));

  const requiredCompletionPercent =
    requiredAssignedFields.length === 0
      ? 100
      : Math.round(((requiredAssignedFields.length - missingRequiredFields.length) / requiredAssignedFields.length) * 100);

  const interactionLocked = !rulesAcknowledged;
  const signerNameEntered = !!name.trim();

  const signerTasks = [
    {
      id: 'ack',
      label: 'Acknowledge e-sign disclosure',
      done: rulesAcknowledged,
      detail: 'Required first to unlock signer actions.',
    },
    {
      id: 'fields',
      label: 'Complete required fields',
      done: requiredAssignedFields.length > 0 ? missingRequiredFields.length === 0 : true,
      detail:
        requiredAssignedFields.length > 0
          ? `${requiredAssignedFields.length - missingRequiredFields.length}/${requiredAssignedFields.length} complete`
          : 'No required fields assigned',
    },
    {
      id: 'identity',
      label: 'Confirm signer identity',
      done: confirmed && signerNameEntered,
      detail: 'Check agreement box and confirm legal name.',
    },
    {
      id: 'adopt',
      label: 'Adopt and complete signature',
      done: !!hash,
      detail: 'Final DocuSign-style confirmation step.',
    },
  ];

  const nextSignerTask = signerTasks.find((task) => !task.done);

  const focusField = (field: EnvelopeField) => {
    setActiveRequiredFieldId(field.id);
    if (field.type === 'signature') {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const target = fieldInputRefs.current[field.id];
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const goToNextMissingField = () => {
    if (missingRequiredFields.length === 0) return;
    const currentIndex = missingRequiredFields.findIndex((field) => field.id === activeRequiredFieldId);
    const nextField = missingRequiredFields[(currentIndex + 1 + missingRequiredFields.length) % missingRequiredFields.length];
    focusField(nextField);
  };

  useEffect(() => {
    if (missingRequiredFields.length === 0) {
      setActiveRequiredFieldId(null);
      return;
    }
    if (!activeRequiredFieldId || !missingRequiredFields.some((field) => field.id === activeRequiredFieldId)) {
      setActiveRequiredFieldId(missingRequiredFields[0].id);
    }
  }, [activeRequiredFieldId, missingRequiredFields]);

  const completedAssignedFields = assignedFields.map((field) => {
    const localValue = fieldValues[field.id];
    if (field.type === 'signature') {
      return { id: field.id, type: field.type, value: name.trim() };
    }
    if (field.type === 'initials') {
      const initialsValue =
        typeof localValue === 'string' && localValue.trim() ? localValue.trim() : initials.trim();
      return { id: field.id, type: field.type, value: initialsValue };
    }
    if (field.type === 'checkbox') {
      return { id: field.id, type: field.type, value: localValue === true ? 'checked' : '' };
    }
    return {
      id: field.id,
      type: field.type,
      value: typeof localValue === 'string' ? localValue : '',
    };
  });

  useEffect(() => {
    const load = async () => {
      if (!envelopeId || !signerId || !token) return;
      try {
        const res = await api.get(`/esign-public/envelopes/${envelopeId}/${signerId}/${token}`);
        setData({
          contractSnapshot: res.data?.contractSnapshot ?? {},
          envelopeType: res.data?.envelopeType,
          packetTitle: res.data?.packetTitle,
          signer: res.data?.signer
            ? {
                id: res.data.signer.id,
                name: res.data.signer.name,
                role: res.data.signer.role,
              }
            : undefined,
        });
        setName(res.data?.signer?.name || '');

        const incomingFields: EnvelopeField[] = Array.isArray(res.data?.contractSnapshot?.__esignFieldPlacements)
          ? res.data.contractSnapshot.__esignFieldPlacements
          : [];
        const initialValues: Record<string, string | boolean> = {};
        incomingFields.forEach((field) => {
          if (!field?.id) return;
          if (field.type === 'checkbox') {
            initialValues[field.id] = field.value === 'checked';
            return;
          }
          initialValues[field.id] = field.value || '';
        });
        setFieldValues(initialValues);
      } catch (err) {
        console.error('Failed to load envelope:', err);
        setError('This signing link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [envelopeId, signerId, token]);

  const packetPdfPath = envelopeId && signerId && token
    ? `/api/esign-public/envelopes/${envelopeId}/${signerId}/${token}/pdf`
    : null;
  const packetPdfDownloadPath = envelopeId && signerId && token
    ? `/api/esign-public/envelopes/${envelopeId}/${signerId}/${token}/pdf?download=1`
    : null;

  const performSubmit = async () => {
    if (!envelopeId || !signerId || !token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await api.post(`/esign-public/sign/${envelopeId}/${signerId}/${token}`, {
        name,
        signatureType: 'TYPED',
        acceptedEsignRules: rulesAcknowledged,
        signatureData: {
          fullName: name,
          initials,
          style: signatureStyle,
          adoptedAt: new Date().toISOString(),
          rulesAcknowledged,
          rulesAcknowledgedAt: new Date().toISOString(),
          completedFields: completedAssignedFields,
        },
        completedFields: completedAssignedFields,
      });
      setHash(res.data.auditHash);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverError = err?.response?.data?.error;

      if (status === 409 && serverError === 'Already signed') {
        setFormError('This document has already been signed with this link.');
      } else if (status === 401) {
        setFormError('This signing link is invalid or has expired.');
      } else {
        setFormError(serverError || 'Unable to capture signature. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!rulesAcknowledged) {
      setFormError('Please acknowledge the e-sign disclosure first to unlock signing actions.');
      return;
    }
    if (missingRequiredFields.length > 0) {
      setFormError(`Please complete all required fields before signing (${missingRequiredFields.length} remaining).`);
      return;
    }
    if (!confirmed || !name) return;
    setShowAdoptModal(true);
  };

  const handleConfirmAdoptAndSign = async () => {
    if (!initials.trim()) {
      setFormError('Please set your initials before signing.');
      return;
    }
    setShowAdoptModal(false);
    await performSubmit();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ae-bg">
        <div className="text-sm text-slate-400">Loading e-sign packet…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center ae-bg px-4">
        <Card tone="solid" className="max-w-md w-full p-6 space-y-3 text-sm bg-slate-900/40 backdrop-blur-xl border-white/10">
          <div className="text-lg font-semibold text-white">Unable to continue signing</div>
          <div className="text-slate-400">{error}</div>
        </Card>
      </div>
    );
  }

  if (hash) {
    return (
      <div className="min-h-screen flex items-center justify-center ae-bg px-4 relative overflow-hidden">
        <div className="ae-bg-gradient absolute inset-0" />
        <div className="ae-bg-wave absolute inset-0 opacity-30" />

        <Card tone="solid" className="relative z-10 max-w-md w-full p-6 space-y-4 text-sm bg-slate-900/40 backdrop-blur-xl border-white/10">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-white">Signature captured</h1>
            <p className="text-slate-400">
              Thank you. Your signature is complete and has been recorded with a secure audit trail.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold mb-1">Audit Hash</p>
            <p className="text-xs text-slate-300 break-all font-mono">{hash}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center ae-bg px-3 md:px-4 relative overflow-hidden">
      <div className="ae-bg-gradient absolute inset-0" />
      <div className="ae-bg-wave absolute inset-0 opacity-30" />

      <Card tone="solid" className="relative z-10 w-[98vw] max-w-[1500px] p-4 md:p-6 space-y-4 text-sm bg-slate-900/40 backdrop-blur-xl border-white/10">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white">Review & sign</h1>
          <p className="text-slate-400">Review your contract packet PDF, then complete signature in about 1 minute.</p>
        </div>

        <div className={`rounded-xl border px-3 py-3 ${rulesAcknowledged ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rulesAcknowledged}
              onChange={(e) => setRulesAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-200">
              <span className="font-semibold text-white">E-sign disclosure acknowledgement:</span> I consent to use electronic records and signatures, understand this is a legally binding transaction, and confirm I am authorized to sign for my role.
            </span>
          </label>
        </div>

        <div className={`text-xs rounded-xl px-3 py-2 border ${interactionLocked ? 'text-amber-100 bg-amber-500/10 border-amber-500/30' : 'text-blue-200/90 bg-blue-500/10 border-blue-500/30'}`}>
          {interactionLocked
            ? 'Step 1 required: acknowledge the e-sign disclosure above to unlock signer actions and required tabs.'
            : 'Signing tip: switch to Focus PDF or Full Screen to zoom in and verify every highlighted sign/initial marker.'}
        </div>

        <div className={`grid gap-4 ${focusPdf ? 'grid-cols-1' : 'md:grid-cols-[2.25fr_1fr]'}`}>
          <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden min-h-[620px] relative">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-slate-900/60">
              <div className="text-[11px] text-slate-300">
                Zoom tip: use PDF controls (+/-) for exact line review.
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={interactionLocked} onClick={() => setFocusPdf((v) => !v)}>
                  {focusPdf ? 'Show Signing Panel' : 'Focus PDF'}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={interactionLocked} onClick={() => setShowPdfFullscreen(true)}>
                  Full Screen
                </Button>
              </div>
            </div>

            {!pdfReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-300 text-sm bg-slate-900/30">
                Loading contract PDF…
              </div>
            )}

            {packetPdfPath ? (
              <iframe
                title="Contract PDF"
                src={packetPdfPath}
                className="w-full h-[76vh] min-h-[620px] bg-white"
                onLoad={() => setPdfReady(true)}
              />
            ) : (
              <div className="h-full min-h-[620px] flex items-center justify-center text-slate-400 text-sm px-4 text-center">
                PDF preview unavailable. You can still complete signature from the panel.
              </div>
            )}
          </div>

          {!focusPdf && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2">Packet details</div>
                <div className="text-xs text-slate-200 space-y-1">
                  <div>Form: {data?.envelopeType || 'Contract packet'}</div>
                  <div>Property: {propertyAddress || data?.packetTitle || 'Property contract'}</div>
                  {contractSnapshot.mlsId && <div>MLS: {contractSnapshot.mlsId}</div>}
                  {formatMoney(contractSnapshot.purchasePrice) && <div>Purchase price: {formatMoney(contractSnapshot.purchasePrice)}</div>}
                  {contractSnapshot.buyerNames && <div>Buyer: {contractSnapshot.buyerNames}</div>}
                  {contractSnapshot.sellerNames && <div>Seller: {contractSnapshot.sellerNames}</div>}
                  <div>Signer role: {data?.signer?.role || 'Participant'}</div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="text-[10px] uppercase tracking-wide text-blue-200 font-bold mb-2">Required before submit</div>
                <ul className="text-xs text-slate-200 space-y-1 list-disc list-inside">
                  <li>Review highlighted sign/initial tabs on each page</li>
                  <li>Confirm legal name spelling</li>
                  <li>Confirm property address and terms shown</li>
                  <li>Check acknowledgement box</li>
                </ul>
                {packetPdfPath && (
                  <div className="mt-3 flex items-center gap-3">
                    <a
                      href={packetPdfPath}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-xs font-semibold underline ${interactionLocked ? 'text-slate-400 pointer-events-none' : 'text-blue-200'}`}
                    >
                      Open PDF in new tab
                    </a>
                    {packetPdfDownloadPath && (
                      <a
                        href={packetPdfDownloadPath}
                        className={`text-xs font-semibold underline ${interactionLocked ? 'text-slate-400 pointer-events-none' : 'text-blue-200'}`}
                      >
                        Download PDF
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                <div className="text-[10px] uppercase tracking-wide text-cyan-200 font-bold mb-2">Signer action required</div>
                <div className="space-y-2">
                  {signerTasks.map((task, idx) => (
                    <div key={task.id} className="flex items-start gap-2 text-xs">
                      <div className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${task.done ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200' : 'border-white/20 bg-white/5 text-slate-300'}`}>
                        {task.done ? '✓' : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className={`${task.done ? 'text-emerald-200' : 'text-slate-100'} font-semibold`}>{task.label}</div>
                        <div className="text-slate-400">{task.detail}</div>
                      </div>
                    </div>
                  ))}
                  {nextSignerTask && (
                    <div className="pt-1 text-[11px] text-cyan-100">Next step: {nextSignerTask.label}</div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                {assignedFields.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Your Required Fields
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {requiredAssignedFields.length - missingRequiredFields.length}/{requiredAssignedFields.length} complete
                        </span>
                        <button
                          type="button"
                          onClick={goToNextMissingField}
                          disabled={interactionLocked || missingRequiredFields.length === 0}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                        >
                          Next Required
                        </button>
                      </div>
                    </div>

                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${requiredCompletionPercent}%` }}
                      />
                    </div>

                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {assignedFields.map((field, index) => {
                        const label = field.placeholder || `${field.type} field ${index + 1}`;
                        const key = `${field.id}-${index}`;
                        const completed = isFieldCompleted(field);
                        const requiredIndex = requiredAssignedFields.findIndex((requiredField) => requiredField.id === field.id);
                        const indexBadge = requiredIndex >= 0 ? requiredIndex + 1 : null;
                        const isActive = activeRequiredFieldId === field.id;

                        if (field.type === 'checkbox') {
                          return (
                            <label key={key} className={`flex items-start gap-2 rounded-lg border px-2 py-2 ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
                              {indexBadge && (
                                <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 px-1">
                                  {indexBadge}
                                </span>
                              )}
                              <input
                                type="checkbox"
                                ref={(el) => {
                                  fieldInputRefs.current[field.id] = el;
                                }}
                                disabled={interactionLocked}
                                checked={fieldValues[field.id] === true}
                                onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.checked }))}
                                className="mt-0.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-200">
                                {label}
                                {field.required !== false && <span className="text-amber-300"> *</span>}
                                <span className={`ml-2 text-[10px] ${completed ? 'text-emerald-300' : 'text-slate-500'}`}>
                                  {completed ? 'Done' : 'Required'}
                                </span>
                              </span>
                              <button
                                type="button"
                                className="ml-auto text-[10px] text-cyan-200 underline"
                                disabled={interactionLocked}
                                onClick={(e) => {
                                  e.preventDefault();
                                  focusField(field);
                                }}
                              >
                                Jump
                              </button>
                            </label>
                          );
                        }

                        if (field.type === 'signature') {
                          return (
                            <div key={key} className={`rounded-lg border px-2 py-2 text-xs text-slate-200 ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  {indexBadge && (
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 px-1">
                                      {indexBadge}
                                    </span>
                                  )}
                                  {label}
                                  {field.required !== false && <span className="text-amber-300"> *</span>}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] ${completed ? 'text-emerald-300' : 'text-slate-500'}`}>
                                    {completed ? 'Ready' : 'Enter name below'}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-[10px] text-cyan-200 underline"
                                    disabled={interactionLocked}
                                    onClick={() => focusField(field)}
                                  >
                                    Jump
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (field.type === 'initials') {
                          return (
                            <div key={key} className={`space-y-1 rounded-lg border px-2 py-2 ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
                              <label className="text-xs text-slate-300 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  {indexBadge && (
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 px-1">
                                      {indexBadge}
                                    </span>
                                  )}
                                  {label}
                                  {field.required !== false && <span className="text-amber-300"> *</span>}
                                </span>
                                <button type="button" className="text-[10px] text-cyan-200 underline" onClick={() => focusField(field)}>Jump</button>
                              </label>
                              <input
                                type="text"
                                ref={(el) => {
                                  fieldInputRefs.current[field.id] = el;
                                }}
                                disabled={interactionLocked}
                                value={typeof fieldValues[field.id] === 'string' ? String(fieldValues[field.id]) : ''}
                                onChange={(e) => {
                                  const next = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
                                  setFieldValues((prev) => ({ ...prev, [field.id]: next }));
                                }}
                                placeholder="AB"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600"
                              />
                            </div>
                          );
                        }

                        return (
                          <div key={key} className={`space-y-1 rounded-lg border px-2 py-2 ${isActive ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
                            <label className="text-xs text-slate-300 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2">
                                {indexBadge && (
                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 px-1">
                                    {indexBadge}
                                  </span>
                                )}
                                {label}
                                {field.required !== false && <span className="text-amber-300"> *</span>}
                              </span>
                              <button type="button" className="text-[10px] text-cyan-200 underline" onClick={() => focusField(field)}>Jump</button>
                            </label>
                            <input
                              type={field.type === 'date' ? 'date' : 'text'}
                              ref={(el) => {
                                fieldInputRefs.current[field.id] = el;
                              }}
                              disabled={interactionLocked}
                              value={typeof fieldValues[field.id] === 'string' ? String(fieldValues[field.id]) : ''}
                              onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              placeholder={field.placeholder || 'Enter value'}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
                  <input
                    type="checkbox"
                    disabled={interactionLocked}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-300 font-medium">I have reviewed this contract and agree to sign electronically.</span>
                </label>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Type your full legal name</label>
                  <input
                    ref={nameInputRef}
                    disabled={interactionLocked}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>

                {formError && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {formError}
                  </div>
                )}

                <Button
                  type="button"
                  disabled={!rulesAcknowledged || !confirmed || !name || missingRequiredFields.length > 0 || submitting}
                  onClick={handleSubmit}
                  className="w-full py-3 text-base font-bold shadow-lg shadow-blue-500/20"
                >
                  {submitting ? 'Finalizing Signature…' : 'Adopt & Complete Signature'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {showPdfFullscreen && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/95 p-3 md:p-4">
          <div className="h-full w-full rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div>
                <h2 className="text-sm font-bold text-white">Contract packet — Full Screen</h2>
                <p className="text-xs text-slate-400">Use PDF zoom controls to inspect every sign/initial marker.</p>
              </div>
              <div className="flex items-center gap-2">
                {packetPdfPath && (
                  <a
                    href={packetPdfDownloadPath || packetPdfPath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-200 underline"
                  >
                    Download PDF
                  </a>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowPdfFullscreen(false)}>
                  Close
                </Button>
              </div>
            </div>

            {packetPdfPath && (
              <iframe title="Contract PDF Full Screen" src={packetPdfPath} className="w-full h-[calc(100vh-120px)] bg-white" />
            )}
          </div>
        </div>
      )}

      <StunningModal
        isOpen={showAdoptModal}
        onClose={() => setShowAdoptModal(false)}
        title="Adopt signature & initials"
        subtitle="This matches the DocuSign-style final step before submit"
        size="md"
        footer={
          <div className="flex gap-3">
            <ModalCancelButton onClick={() => setShowAdoptModal(false)}>Back</ModalCancelButton>
            <ModalPrimaryButton onClick={handleConfirmAdoptAndSign} disabled={!name || !initials || submitting} loading={submitting}>
              Adopt and Sign
            </ModalPrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <ModalInput
            label="Full legal name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full legal name"
          />

          <ModalInput
            label="Initials"
            required
            value={initials}
            onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            placeholder="e.g. BP"
            maxLength={4}
          />

          <div>
            <div className="text-sm font-semibold text-slate-300 mb-2">Signature style</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'script', label: 'Script' },
                { key: 'classic', label: 'Classic' },
                { key: 'clean', label: 'Clean' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSignatureStyle(option.key as 'script' | 'classic' | 'clean')}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    signatureStyle === option.key
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2">Preview</div>
            <div className="space-y-2">
              <div className={`text-white ${signatureStyle === 'script' ? 'font-serif italic text-lg' : signatureStyle === 'classic' ? 'font-semibold text-base' : 'font-mono text-base'}`}>
                {name || 'Your Signature'}
              </div>
              <div className="inline-block rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-100">
                {initials || 'INITIALS'}
              </div>
            </div>
          </div>
        </div>
      </StunningModal>
    </div>
  );
}
