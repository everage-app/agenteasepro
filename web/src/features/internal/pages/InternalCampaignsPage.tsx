import { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { PageLayout } from '../../../components/layout/PageLayout';
import { Card } from '../../../components/ui/Card';

type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

function detectCsvDelimiter(text: string) {
  const firstLine = (text.split(/\r?\n/).find((line) => line.trim().length > 0) || '').trim();
  const candidates = [',', ';', '\t', '|'];
  const scored = candidates.map((delimiter) => ({
    delimiter,
    count: (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length,
  }));
  scored.sort((a, b) => b.count - a.count);
  return scored[0]?.count > 0 ? scored[0].delimiter : ',';
}

function parseCsvText(text: string): CsvParseResult {
  const delimiter = detectCsvDelimiter(text);
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (!inQuotes && char === '\n') {
      row.push(field.trim());
      field = '';
      rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((csvRow) => csvRow.some((cell) => cell.trim().length > 0));
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = nonEmptyRows[0];
  const hasHeader = headerRow.some((cell) => /[a-zA-Z]/.test(cell));
  const headers = (hasHeader ? headerRow : headerRow.map((_, idx) => `column_${idx + 1}`)).map((cell, idx) => {
    const cleaned = cell.trim();
    return cleaned.length ? cleaned : `column_${idx + 1}`;
  });

  const rawDataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
  const dataRows = rawDataRows.map((csvRow) => {
    if (csvRow.length >= headers.length) return csvRow.slice(0, headers.length);
    return [...csvRow, ...new Array(headers.length - csvRow.length).fill('')];
  });

  return { headers, rows: dataRows };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const DEFAULT_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AgentEasePro</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    body { margin:0 !important; padding:0 !important; width:100% !important; background:#0b0f18; }

    @media screen and (max-width:640px){
      .container{ width:100% !important; }
      .px{ padding-left:18px !important; padding-right:18px !important; }
      .h1{ font-size:26px !important; line-height:1.15 !important; }
      .sub{ font-size:15px !important; line-height:1.65 !important; }
      .btn{ display:block !important; width:100% !important; text-align:center !important; }
      .col{ display:block !important; width:100% !important; }
      .sp{ height:14px !important; line-height:14px !important; }
    }
  </style>
</head>

<body style="background:#0b0f18;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#0b0f18" style="background:#0b0f18;">
    <tr>
      <td align="center" style="padding:56px 14px;">
        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:18px;">
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;letter-spacing:.2px;color:#ffffff;">AgentEasePro</div>
              <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:4px;font-weight:800;color:#c89b3c;">ALL-IN-ONE REAL ESTATE PLATFORM</div>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="#0b0f18" style="background:#0b0f18;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#0b0f18" style="background:#0b0f18;">
                <tr>
                  <td align="center" style="padding:0;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#0f172a" style="background:#0f172a;border:1px solid rgba(255,255,255,.08);box-shadow:0 28px 80px rgba(0,0,0,.55);border-radius:18px;overflow:hidden;">
                      <tr>
                        <td bgcolor="#0f172a" style="background:#0f172a;border-radius:18px;overflow:hidden;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#0f172a" style="background:#0f172a;border-radius:18px;overflow:hidden;">
                            <tr>
                              <td style="height:6px;line-height:6px;background:linear-gradient(90deg,#f5d06f,#c89b3c,#6d28d9,#4f46e5);">&nbsp;</td>
                            </tr>

                            <tr>
                              <td class="px" style="padding:44px 40px 22px 40px;background:linear-gradient(145deg,#0f172a 0%, #111b35 45%, #1a1846 100%);">
                                <div class="h1" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#ffffff;font-weight:950;font-size:34px;line-height:1.08;letter-spacing:-.6px;text-align:center;">The All-In-One Platform<br><span style="color:#f5d06f;">for Modern Agents.</span></div>
                                <div class="sp" style="height:14px;line-height:14px;">&nbsp;</div>
                                <div class="sub" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#c7d2fe;font-size:16px;line-height:1.75;text-align:center;">CRM • Website + IDX • eSign • Email Marketing<br><span style="color:#e5e7eb;">Everything you need to run your business — in one place.</span></div>
                                <div class="sp" style="height:18px;line-height:18px;">&nbsp;</div>

                                <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;">
                                  <tr>
                                    <td style="padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#ffffff;font-size:13px;text-align:center;"><strong>$49.99/month</strong> · 7-day full access · Cancel anytime</td>
                                  </tr>
                                </table>

                                <div class="sp" style="height:20px;line-height:20px;">&nbsp;</div>

                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                  <tr>
                                    <td align="center">
                                      <a href="https://agenteasepro.com/trial?utm_source=mailchimp&utm_medium=email&utm_campaign=launch_1" class="btn" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;font-weight:900;padding:15px 24px;font-size:15px;border-radius:10px;box-shadow:0 14px 34px rgba(79,70,229,.45);">Start Your 7-Day Trial →</a>
                                    </td>
                                  </tr>
                                </table>

                                <div style="margin-top:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#9aa7c3;font-size:12px;line-height:1.6;text-align:center;">Takes ~2 minutes · No contracts · No add-ons</div>
                              </td>
                            </tr>

                            <tr>
                              <td class="px" style="padding:18px 40px 34px 40px;background:#0f172a;">
                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="rgba(255,255,255,.06)" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:14px;overflow:hidden;">
                                  <tr>
                                    <td style="padding:16px 16px;">
                                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                        <tr>
                                          <td class="col" width="33.33%" valign="top" style="padding:8px 10px;text-align:center;">
                                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#f5d06f;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Save Money</div>
                                            <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#ffffff;font-size:13px;line-height:1.6;">Replace 3–5 subscriptions</div>
                                          </td>

                                          <td class="col" width="33.33%" valign="top" style="padding:8px 10px;text-align:center;">
                                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#f5d06f;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Save Time</div>
                                            <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#ffffff;font-size:13px;line-height:1.6;">One login, one workflow</div>
                                          </td>

                                          <td class="col" width="33.33%" valign="top" style="padding:8px 10px;text-align:center;">
                                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#f5d06f;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Close Faster</div>
                                            <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#ffffff;font-size:13px;line-height:1.6;">eSign + follow-ups + marketing</div>
                                          </td>
                                        </tr>
                                      </table>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:18px;line-height:18px;">&nbsp;</td></tr>

          <tr>
            <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#7b879f;font-size:12px;line-height:1.7;">AgentEasePro · Built for agents who want everything in one place.<br><span style="color:#5f6c86;">Unsubscribe link will appear here.</span></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

type PreviewResponse = {
  totalParsed: number;
  deliverableCount: number;
  suppressedCount: number;
  invalidCount: number;
  sampleDeliverable: string[];
  sampleSuppressed: string[];
  sampleInvalid: string[];
};

type CampaignStatusResponse = {
  campaignId: string;
  title: string;
  blastStatus: string;
  sentAt: string | null;
  runtime?: {
    status: 'queued' | 'running' | 'completed' | 'failed';
    totalRecipients: number;
    sentRecipients: number;
    failedRecipients: number;
    suppressedRecipients: number;
    processedBatches: number;
    totalBatches: number;
    subject: string;
    startedAt?: string;
    completedAt?: string;
    lastError?: string;
    updatedAt: string;
  };
  aggregate: {
    batchesProcessed: number;
    sentRecipients: number;
    failedRecipients: number;
    recentFailures: Array<{ at: string; error: string | null; recipientsCount: number }>;
  };
};

export function InternalCampaignsPage() {
  const [campaignName, setCampaignName] = useState('AgentEasePro Launch #1');
  const [subject, setSubject] = useState('AgentEasePro: The All-in-One Platform for Modern Agents');
  const [fromEmail, setFromEmail] = useState('sales@agenteasepro.com');
  const [fromName, setFromName] = useState('AgentEasePro Sales');
  const [replyTo, setReplyTo] = useState('sales@agenteasepro.com');
  const [utmCampaign, setUtmCampaign] = useState('launch_1');
  const [batchSize, setBatchSize] = useState(250);
  const [throttleMs, setThrottleMs] = useState(0);
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_TEMPLATE);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [status, setStatus] = useState<CampaignStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappedEmailColumn, setMappedEmailColumn] = useState('');
  const [csvImportError, setCsvImportError] = useState<string | null>(null);

  const recipientsHint = useMemo(() => {
    const rough = recipientsRaw
      .split(/[\n,;\s]+/)
      .map((value) => value.trim())
      .filter(Boolean).length;
    return rough.toLocaleString();
  }, [recipientsRaw]);

  const csvExtractSummary = useMemo(() => {
    if (!csvHeaders.length || !csvRows.length || !mappedEmailColumn) {
      return { totalRows: csvRows.length, validEmails: 0, invalidEmails: 0 };
    }
    const emailColumnIndex = csvHeaders.indexOf(mappedEmailColumn);
    if (emailColumnIndex < 0) {
      return { totalRows: csvRows.length, validEmails: 0, invalidEmails: 0 };
    }

    let validEmails = 0;
    let invalidEmails = 0;
    for (const csvRow of csvRows) {
      const email = (csvRow[emailColumnIndex] || '').trim();
      if (!email) continue;
      if (isLikelyEmail(email)) validEmails += 1;
      else invalidEmails += 1;
    }
    return { totalRows: csvRows.length, validEmails, invalidEmails };
  }, [csvHeaders, csvRows, mappedEmailColumn]);

  async function handleCsvFileUpload(file: File) {
    setCsvImportError(null);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);

      if (!parsed.headers.length || !parsed.rows.length) {
        setCsvImportError('CSV file has no readable rows.');
        setCsvFileName(file.name);
        setCsvHeaders([]);
        setCsvRows([]);
        setMappedEmailColumn('');
        return;
      }

      const guessedEmailColumn =
        parsed.headers.find((header) => /(^|\b)(email|e-mail)(\b|$)/i.test(header)) || parsed.headers[0];

      setCsvFileName(file.name);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMappedEmailColumn(guessedEmailColumn);
    } catch (uploadError: any) {
      setCsvImportError(uploadError?.message || 'Failed to read CSV file');
    }
  }

  function applyCsvMappingToRecipients() {
    setCsvImportError(null);
    if (!csvHeaders.length || !csvRows.length) {
      setCsvImportError('Upload a CSV file first.');
      return;
    }
    if (!mappedEmailColumn) {
      setCsvImportError('Select an email column for mapping.');
      return;
    }

    const emailColumnIndex = csvHeaders.indexOf(mappedEmailColumn);
    if (emailColumnIndex < 0) {
      setCsvImportError('Selected email column is not valid.');
      return;
    }

    const uniqueEmails = Array.from(
      new Set(
        csvRows
          .map((csvRow) => normalizeEmail(csvRow[emailColumnIndex] || ''))
          .filter((email) => email.length > 0)
          .filter((email) => isLikelyEmail(email)),
      ),
    );

    if (!uniqueEmails.length) {
      setCsvImportError('No valid emails found in mapped column.');
      return;
    }

    setRecipientsRaw(uniqueEmails.join('\n'));
    setPreview(null);
    setError(null);
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/internal/campaigns/preview', {
        recipientsRaw,
      });
      setPreview(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function launchCampaign() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/internal/campaigns/send', {
        campaignName,
        subject,
        htmlTemplate,
        recipientsRaw,
        fromEmail,
        fromName,
        replyTo,
        batchSize,
        throttleMs,
        dryRun: false,
        utmCampaign,
      });
      setCampaignId(res.data.campaignId);
      if (res.data?.deduplicated) {
        setError('Identical campaign already running/sent recently. Reusing existing campaign ID.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Campaign launch failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!campaignId) return;

    let isMounted = true;
    const poll = async () => {
      try {
        const res = await api.get(`/internal/campaigns/${campaignId}/status`);
        if (!isMounted) return;
        setStatus(res.data);
      } catch {
        // noop
      }
    };

    poll();
    const interval = window.setInterval(poll, 4000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [campaignId]);

  return (
    <PageLayout title="Internal Email Campaigns" subtitle="Owner-only SendGrid campaign sender with suppression filtering and progress tracking" maxWidth="full">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/40 bg-red-500/10">
            <div className="text-sm text-red-300 font-medium">{error}</div>
          </Card>
        )}

        <Card title="Campaign Setup" description="Paste recipient emails and your HTML, then preview and send in safe batches.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <div className="text-sm text-slate-300">Campaign Name</div>
              <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">Subject</div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">From Email</div>
              <input value={fromEmail} readOnly className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-3 py-2 text-sm text-slate-300" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">From Name</div>
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">Reply-To</div>
              <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">UTM Campaign</div>
              <input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">Batch Size (full blast default: 250)</div>
              <input type="number" min={25} max={250} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value) || 250)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-slate-300">Delay Between Batches (ms, full blast default: 0)</div>
              <input type="number" min={0} max={5000} value={throttleMs} onChange={(e) => setThrottleMs(Number(e.target.value) || 0)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-cyan-200">CSV Import + Mapping</div>
                  <div className="text-xs text-slate-300">Upload CSV, map your email column, then apply it to recipients.</div>
                </div>
                <label className="inline-flex items-center justify-center rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 text-sm cursor-pointer">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleCsvFileUpload(file);
                      }
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              {csvFileName && (
                <div className="text-xs text-slate-300">
                  Loaded: <span className="font-semibold text-white">{csvFileName}</span>
                </div>
              )}

              {csvHeaders.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <label className="space-y-2 md:col-span-2">
                    <div className="text-sm text-slate-300">Map Email Column</div>
                    <select
                      value={mappedEmailColumn}
                      onChange={(event) => setMappedEmailColumn(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white"
                    >
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={applyCsvMappingToRecipients}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 text-sm"
                  >
                    Apply Mapping to Recipients
                  </button>
                </div>
              )}

              {(csvHeaders.length > 0 || csvImportError) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Stat label="CSV Rows" value={csvExtractSummary.totalRows} />
                  <Stat label="Valid Emails" value={csvExtractSummary.validEmails} />
                  <Stat label="Invalid Emails" value={csvExtractSummary.invalidEmails} />
                  <Stat label="Columns" value={csvHeaders.length} />
                </div>
              )}

              {csvImportError && <div className="text-xs text-red-300">{csvImportError}</div>}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">Recipients (paste emails, comma/newline separated)</div>
              <div className="text-xs text-slate-400">Approx parsed tokens: {recipientsHint}</div>
            </div>
            <textarea value={recipientsRaw} onChange={(e) => setRecipientsRaw(e.target.value)} rows={8} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white" placeholder="email1@domain.com&#10;email2@domain.com" />
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-sm text-slate-300">HTML Template</div>
            <textarea value={htmlTemplate} onChange={(e) => setHtmlTemplate(e.target.value)} rows={16} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-white font-mono" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={runPreview} disabled={busy || !recipientsRaw.trim()} className="rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold px-4 py-2 text-sm">
              {busy ? 'Working...' : 'Preview List Quality'}
            </button>
            <button onClick={launchCampaign} disabled={busy || !subject.trim() || !recipientsRaw.trim() || !htmlTemplate.trim()} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold px-4 py-2 text-sm">
              {busy ? 'Launching...' : 'Launch Campaign'}
            </button>
          </div>
        </Card>

        {preview && (
          <Card title="Recipient Preview" description="Suppression and dedupe checks before send">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Parsed" value={preview.totalParsed} />
              <Stat label="Deliverable" value={preview.deliverableCount} />
              <Stat label="Suppressed" value={preview.suppressedCount} />
              <Stat label="Invalid" value={preview.invalidCount} />
            </div>
          </Card>
        )}

        {(campaignId || status) && (
          <Card title="Campaign Progress" description={campaignId ? `Campaign ID: ${campaignId}` : undefined}>
            {status ? (
              <div className="space-y-3 text-sm text-slate-200">
                <div>Status: <span className="font-semibold">{status.runtime?.status || status.blastStatus}</span></div>
                <div>Subject: <span className="font-semibold">{status.runtime?.subject || status.title}</span></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Sent" value={status.runtime?.sentRecipients ?? status.aggregate.sentRecipients} />
                  <Stat label="Failed" value={status.runtime?.failedRecipients ?? status.aggregate.failedRecipients} />
                  <Stat label="Batches" value={status.runtime ? `${status.runtime.processedBatches}/${status.runtime.totalBatches}` : status.aggregate.batchesProcessed} />
                  <Stat label="Suppressed" value={status.runtime?.suppressedRecipients ?? 0} />
                </div>
                {status.runtime?.lastError && <div className="text-red-300">Last error: {status.runtime.lastError}</div>}
              </div>
            ) : (
              <div className="text-slate-300 text-sm">Polling campaign status...</div>
            )}
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-bold text-white mt-0.5">{value}</div>
    </div>
  );
}
