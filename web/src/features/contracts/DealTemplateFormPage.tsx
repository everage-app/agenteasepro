import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface FormDefinition {
  id: string;
  code: string;
  displayName: string;
  category: string;
  version?: string;
  schemaJson?: any;
}

interface FormInstance {
  id: string;
  status: 'DRAFT' | 'COMPLETED' | 'SENT' | 'SIGNED';
  title: string;
  data: Record<string, any>;
  definition?: FormDefinition;
}

export function DealTemplateFormPage() {
  const navigate = useNavigate();
  const { dealId, formCode } = useParams<{ dealId: string; formCode: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [instance, setInstance] = useState<FormInstance | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  const fieldKeys = useMemo(() => {
    const questions = Array.isArray(definition?.schemaJson?.questions) ? definition?.schemaJson?.questions : [];
    const keys = new Set<string>();
    for (const question of questions) {
      if (Array.isArray(question?.targets)) {
        for (const target of question.targets) {
          if (typeof target === 'string' && target.trim()) {
            keys.add(target.trim());
          }
        }
      }
    }
    return Array.from(keys);
  }, [definition?.schemaJson]);

  const load = async () => {
    if (!dealId || !formCode) return;
    setLoading(true);
    setError(null);

    try {
      const [defsRes, instancesRes] = await Promise.all([
        api.get<FormDefinition[]>('/forms/definitions'),
        api.get<FormInstance[]>(`/forms/deals/${dealId}/forms`),
      ]);

      const def = (defsRes.data || []).find((item) => item.code === formCode) || null;
      if (!def) {
        setError(`Template ${formCode} was not found.`);
        return;
      }

      let current = (instancesRes.data || []).find((item) => item.definition?.code === formCode) || null;
      if (!current) {
        const created = await api.post<FormInstance>(`/forms/deals/${dealId}/forms`, { formCode });
        current = created.data;
      }

      setDefinition(def);
      setInstance(current);
      const nextData = (current?.data && typeof current.data === 'object') ? current.data : {};
      setFormData(nextData);
      setNotes(typeof nextData.notes === 'string' ? nextData.notes : '');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load form template.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dealId, formCode]);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const persist = async (status?: FormInstance['status']) => {
    if (!instance) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        data: {
          ...formData,
          notes,
        },
        ...(status ? { status } : {}),
      };

      const updated = await api.put<FormInstance>(`/forms/${instance.id}`, payload);
      setInstance(updated.data);
      setFormData((updated.data.data && typeof updated.data.data === 'object') ? updated.data.data : {});
      setNotes(typeof updated.data.data?.notes === 'string' ? updated.data.data.notes : notes);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save form.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title={definition?.displayName || formCode || 'Template Form'}
      subtitle="Complete your template details for this deal"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(`/deals/${dealId}/repc`)}>
            Back to REPC
          </Button>
          {definition?.code && (
            <Button
              variant="secondary"
              onClick={() => window.open(`/api/forms/definitions/${encodeURIComponent(definition.code)}/pdf?download=1`, '_blank')}
            >
              Download Template
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {loading && (
          <Card className="p-6 text-sm text-slate-400">Loading template…</Card>
        )}

        {!loading && error && (
          <Card className="p-6 border border-red-500/30 bg-red-500/10 text-sm text-red-200">{error}</Card>
        )}

        {!loading && !error && instance && (
          <>
            <Card className="p-5 space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Status</div>
              <div className="text-sm text-white">{instance.status}</div>
              <div className="text-xs text-slate-400">Template code: {definition?.code}</div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="text-sm font-semibold text-white">Form fields</div>

              {fieldKeys.length === 0 ? (
                <div className="text-xs text-slate-400">
                  This template does not have predefined fields yet. Add notes below and mark the status when complete.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fieldKeys.map((key) => (
                    <label key={key} className="space-y-1">
                      <div className="text-xs text-slate-400">{key}</div>
                      <input
                        value={typeof formData[key] === 'string' ? formData[key] : (formData[key] ?? '')}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  ))}
                </div>
              )}

              <label className="space-y-1 block">
                <div className="text-xs text-slate-400">Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  placeholder="Add deal-specific notes for this template"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => persist('DRAFT')} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
                <Button variant="secondary" onClick={() => persist('COMPLETED')} disabled={saving}>Mark Complete</Button>
                <Button variant="secondary" onClick={() => persist('SENT')} disabled={saving}>Mark Sent</Button>
                <Button variant="secondary" onClick={() => persist('SIGNED')} disabled={saving}>Mark Signed</Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </PageLayout>
  );
}
