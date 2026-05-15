import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import api from '../../lib/api';

interface ClientImportWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

type ImportSource = 'CSV' | 'FUB' | 'BOOMTOWN' | 'KVCORE';

interface ImportedClientRecord {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  stage?: string;
  role?: string;
  source?: string;
  tags?: string[];
}

const SOURCE_OPTIONS: { id: ImportSource; label: string; hint: string }[] = [
  { id: 'CSV', label: 'Generic CSV', hint: 'Any CSV file with headers.' },
  { id: 'FUB', label: 'Follow Up Boss', hint: 'Admin → Export → CSV.' },
  { id: 'BOOMTOWN', label: 'BoomTown', hint: 'Leads → Export → CSV.' },
  { id: 'KVCORE', label: 'kvCORE / BoldTrail', hint: 'Smart CRM → More Actions → Export Contacts.' },
];

const FIELD_MAPPINGS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'name', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'stage', label: 'Stage' },
  { key: 'role', label: 'Role' },
  { key: 'tags', label: 'Tags' },
  { key: 'source', label: 'Source' },
];

export function ClientImportWizard({ onClose, onComplete }: ClientImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [source, setSource] = useState<ImportSource>('CSV');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      Papa.parse(f, {
        header: true,
        preview: 10,
        skipEmptyLines: true,
        complete: (results) => {
          setHeaders(results.meta.fields || []);
          setPreviewData(results.data);
          // Auto-map
          const newMapping: Record<string, string> = {};
          (results.meta.fields || []).forEach(header => {
            const lower = header.toLowerCase();
            if (lower.includes('first') && lower.includes('name')) newMapping['firstName'] = header;
            else if (lower.includes('last') && lower.includes('name')) newMapping['lastName'] = header;
            else if (lower === 'name' || lower === 'full name') newMapping['name'] = header;
            else if (lower.includes('email')) newMapping['email'] = header;
            else if (lower.includes('phone') || lower.includes('cell') || lower.includes('mobile')) newMapping['phone'] = header;
            else if (lower.includes('stage') || lower.includes('status') || lower.includes('pipeline')) newMapping['stage'] = header;
            else if (lower.includes('role') || lower.includes('type')) newMapping['role'] = header;
            else if (lower.includes('tag') || lower.includes('label')) newMapping['tags'] = header;
            else if (lower.includes('source')) newMapping['source'] = header;
          });
          setMapping(newMapping);
        },
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const records: ImportedClientRecord[] = results.data.map((row: any) => {
          const record: ImportedClientRecord = {};
          Object.entries(mapping).forEach(([field, header]) => {
            if (header) {
              let value = row[header];
              if (field === 'tags' && value) {
                // Split tags by comma or pipe
                record.tags = value.split(/[,|]/).map((t: string) => t.trim()).filter(Boolean);
              } else {
                (record as any)[field] = value;
              }
            }
          });
          // Default source if not mapped
          if (!record.source && source !== 'CSV') {
            record.source = SOURCE_OPTIONS.find(s => s.id === source)?.label;
          }
          return record;
        });

        try {
          const res = await api.post('/clients/bulk-import', { records });
          setResult(res.data);
          setStep(3);
        } catch (error) {
          console.error('Import failed:', error);
          alert('Import failed. Please check the console.');
        } finally {
          setImporting(false);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card tone="solid" className="w-full max-w-2xl bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95 border-slate-200/80 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-900 transition-all duration-200 hover:rotate-90 hover:scale-110 group dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-400 dark:hover:text-white"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Import Clients</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Bring your contacts into AgentEasePro</p>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">1. Select Source</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SOURCE_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        source === opt.id
                          ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/50 text-slate-900 dark:text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:border-white/20'
                      }`}
                      onClick={() => setSource(opt.id)}
                    >
                      <div className="font-semibold text-base mb-1">{opt.label}</div>
                      <div className="text-xs opacity-70 leading-relaxed">{opt.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">2. Upload CSV</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-300
                      file:mr-4 file:py-3 file:px-6
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-gradient-to-r file:from-blue-500 file:to-indigo-500
                      file:text-white file:shadow-lg file:shadow-blue-500/30
                      hover:file:from-blue-600 hover:file:to-indigo-600
                      file:transition-all file:duration-200
                      file:cursor-pointer"
                  />
                  {file && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      File selected: {file.name}
                    </div>
                  )}
                </div>
              </div>

              {file && (
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={onClose}>Cancel</Button>
                  <Button onClick={() => setStep(2)} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/30">
                    Next: Map Fields →
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-2">Map CSV Columns to Client Fields</h3>
                <p className="text-sm text-slate-400 mb-4">Match your CSV columns with AgentEasePro fields</p>
                <div className="grid gap-3">
                  {FIELD_MAPPINGS.map((field) => (
                    <div key={field.key} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                      <div className="w-32 text-sm font-medium text-slate-300">{field.label}</div>
                      <select
                        value={mapping[field.key] || ''}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all [&>option]:bg-slate-900"
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 overflow-x-auto">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview (First 5 rows)
                </h4>
                <table className="w-full text-xs text-left text-slate-300">
                  <thead>
                    <tr>
                      {headers.map(h => <th key={h} className="p-1 border-b border-white/10">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {headers.map(h => <td key={h} className="p-1 border-b border-white/5">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-3 pt-4 border-t border-white/10">
                <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </span>
                  ) : (
                    'Start Import ✓'
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && result && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in duration-500">
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Import Complete!</h3>
              <p className="text-slate-300 mb-2 max-w-md mx-auto">
                Successfully imported <span className="font-bold text-emerald-400">{result.created}</span> new clients and updated <span className="font-bold text-blue-400">{result.updated}</span> existing ones.
              </p>
              {result.skipped > 0 && (
                <p className="text-slate-400 text-sm mb-6">
                  Skipped {result.skipped} invalid records.
                </p>
              )}
              <div className="flex justify-center gap-3 mt-8">
                <Button variant="secondary" onClick={onClose}>Close</Button>
                <Button 
                  onClick={() => { onComplete(); onClose(); }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/30"
                >
                  View Clients →
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
