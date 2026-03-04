import { useState, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../auth/authStore';

interface ImportPreview {
  filePath: string;
  totalRows: number;
  headers: string[];
  previewRows: Record<string, string>[];
  suggestedMappings: Record<string, string>;
  availableFields: string[];
}

interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
}

export function DataSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const authToken = token || localStorage.getItem('utahcontracts_token') || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Import state
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/settings/import/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to preview CSV');

      const data: ImportPreview = await response.json();
      setPreview(data);
      setMappings(data.suggestedMappings);
      setImportStep('preview');
    } catch (error) {
      console.error('Failed to preview CSV:', error);
      setMessage({ type: 'error', text: 'Failed to read CSV file. Please check the format and try again.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setImporting(true);
    setImportStep('importing');

    try {
      const response = await fetch('/api/settings/import/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          filePath: preview.filePath,
          mappings,
          skipDuplicates,
        }),
      });

      if (!response.ok) throw new Error('Failed to import clients');

      const result: ImportResult = await response.json();
      setImportResult(result);
      setImportStep('done');
    } catch (error) {
      console.error('Failed to import clients:', error);
      setMessage({ type: 'error', text: 'Failed to import clients. Please try again.' });
      setImportStep('upload');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (type: 'clients' | 'deals' | 'listings' | 'all') => {
    setExporting(type);

    try {
      const response = await fetch(`/api/settings/export/${type}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) throw new Error('Failed to export data');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'all' 
        ? `agentease-export-${Date.now()}.json` 
        : `${type}-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to export:', error);
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadSample = () => {
    const csv = `First Name,Last Name,Email,Phone,Type,Source,Notes
John,Smith,john.smith@email.com,(801) 555-0123,BUYER,Website,Interested in downtown condos
Jane,Doe,jane.doe@email.com,(801) 555-0124,SELLER,Referral,Wants to sell in 3 months
Bob,Johnson,bob.johnson@email.com,(801) 555-0125,BOTH,Open House,Active buyer and seller`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-clients.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setImportStep('upload');
    setPreview(null);
    setMappings({});
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {message && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl border backdrop-blur-xl ${
              message.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/30'
                : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-400/30'
            }`}
          >
            <span className="text-lg">{message.type === 'success' ? '✅' : '⚠️'}</span>
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Import Clients */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Import clients</h2>
        <p className="text-xs text-slate-400 mb-6">
          Bulk import your existing clients from a CSV file
        </p>

        {/* Upload Step */}
        {importStep === 'upload' && (
          <>
            <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
              <div className="text-4xl mb-3">📁</div>
              <h3 className="text-sm font-semibold text-slate-50 mb-2">
                Upload your client list
              </h3>
              <p className="text-xs text-slate-400 mb-4 max-w-md mx-auto">
                We'll match columns automatically and let you review before importing. 
                Your CSV should have columns like: Name, Email, Phone, Type, etc.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {uploading ? 'Reading file...' : 'Upload CSV'}
              </Button>
            </div>

            <div className="mt-4 flex items-start gap-3 p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-300 mb-1">Not sure how to format your CSV?</p>
                <p className="text-xs text-slate-400 mb-2">
                  Download our sample template to see the expected columns and format.
                </p>
                <button
                  onClick={handleDownloadSample}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline"
                >
                  Download sample CSV
                </button>
              </div>
            </div>
          </>
        )}

        {/* Preview Step */}
        {importStep === 'preview' && preview && (
          <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
              <p className="text-sm text-blue-400 font-medium">
                Found {preview.totalRows} rows in your CSV
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Review the column mappings below and adjust as needed
              </p>
            </div>

            {/* Column Mapping */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Column Mapping</h4>
              <div className="space-y-2">
                {preview.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-32 truncate font-mono bg-white/5 px-2 py-1 rounded">
                      {header}
                    </span>
                    <span className="text-slate-500">→</span>
                    <select
                      value={mappings[header] || ''}
                      onChange={(e) => setMappings({ ...mappings, [header]: e.target.value })}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-50 outline-none focus:border-cyan-400"
                    >
                      <option value="">Skip this column</option>
                      <option value="firstName">First Name</option>
                      <option value="lastName">Last Name</option>
                      <option value="fullName">Full Name (will split)</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="address">Address</option>
                      <option value="city">City</option>
                      <option value="state">State</option>
                      <option value="zip">Zip</option>
                      <option value="type">Type (BUYER/SELLER/BOTH)</option>
                      <option value="source">Lead Source</option>
                      <option value="notes">Notes</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Preview (first 5 rows)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {preview.headers.map((header) => (
                        <th key={header} className="text-left py-2 px-3 text-slate-400 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {preview.headers.map((header) => (
                          <td key={header} className="py-2 px-3 text-slate-300 truncate max-w-[150px]">
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skipDuplicates"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded border-white/20 bg-white/5"
              />
              <label htmlFor="skipDuplicates" className="text-sm text-slate-300">
                Skip duplicates (same email)
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={resetImport} variant="ghost">
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {importing ? 'Importing...' : `Import ${preview.totalRows} clients`}
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {importStep === 'importing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-sm text-slate-300">Importing clients...</p>
            <p className="text-xs text-slate-500 mt-1">This may take a moment</p>
          </div>
        )}

        {/* Done Step */}
        {importStep === 'done' && importResult && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
              <p className="text-sm text-green-400 font-medium mb-2">
                Import complete!
              </p>
              <div className="space-y-1 text-xs text-slate-300">
                <p>✓ {importResult.success} clients imported successfully</p>
                {importResult.skipped > 0 && (
                  <p className="text-yellow-400">⚠ {importResult.skipped} duplicates skipped</p>
                )}
                {importResult.errors.length > 0 && (
                  <p className="text-red-400">✗ {importResult.errors.length} rows had errors</p>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
                <p className="text-xs text-red-400 font-medium mb-2">Errors:</p>
                <ul className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li>... and {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <Button onClick={resetImport} className="bg-blue-600 hover:bg-blue-500">
              Import more
            </Button>
          </div>
        )}
      </Card>

      {/* Export Data */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-50 mb-1">Export data</h2>
        <p className="text-xs text-slate-400 mb-6">
          Download your data as CSV files for backup or migration
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">👥</span>
              <div>
                <h3 className="text-sm font-medium text-slate-50">Clients</h3>
                <p className="text-xs text-slate-400">All your contacts</p>
              </div>
            </div>
            <Button
              onClick={() => handleExport('clients')}
              disabled={exporting === 'clients'}
              size="sm"
              className="w-full"
            >
              {exporting === 'clients' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🤝</span>
              <div>
                <h3 className="text-sm font-medium text-slate-50">Deals</h3>
                <p className="text-xs text-slate-400">All transactions</p>
              </div>
            </div>
            <Button
              onClick={() => handleExport('deals')}
              disabled={exporting === 'deals'}
              size="sm"
              className="w-full"
            >
              {exporting === 'deals' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🏠</span>
              <div>
                <h3 className="text-sm font-medium text-slate-50">Listings</h3>
                <p className="text-xs text-slate-400">All properties</p>
              </div>
            </div>
            <Button
              onClick={() => handleExport('listings')}
              disabled={exporting === 'listings'}
              size="sm"
              className="w-full"
            >
              {exporting === 'listings' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>

          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📦</span>
              <div>
                <h3 className="text-sm font-medium text-slate-50">Everything</h3>
                <p className="text-xs text-slate-400">Full data export (JSON)</p>
              </div>
            </div>
            <Button
              onClick={() => handleExport('all')}
              disabled={exporting === 'all'}
              size="sm"
              className="w-full bg-cyan-600 hover:bg-cyan-500"
            >
              {exporting === 'all' ? 'Exporting...' : 'Export All'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Data Privacy */}
      <Card className="p-6 bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-white/10">
        <div className="flex items-start gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-50 mb-2">Your data, your control</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              All data you import or create in AgentEase Pro belongs to you. 
              You can export it anytime, and if you ever decide to leave, we'll help you take your data with you. 
              We never sell or share your client information with third parties.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
