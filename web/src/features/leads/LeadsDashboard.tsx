import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageLayout } from '../../components/layout/PageLayout';
import api from '../../lib/api';
import { leadsApi } from '../../lib/leadsApi';
import { formatPhoneDisplay, phoneToTelHref } from '../../lib/phone';
import { Lead, LeadAnalytics, LeadPriority, LeadSource } from '../../types/leads';
import { LeadActionsMenu } from './LeadActionsMenu';
import { NewTaskModal } from '../tasks/NewTaskModal';
import { MarketingCampaignModal } from '../marketing/MarketingCampaignModal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ContactEmailModal } from '../../components/communications/ContactEmailModal';

const ARCHIVED_TAG = 'ARCHIVED';

type LeadDetail = Lead & {
  activities?: Array<{
    id: string;
    activityType: string;
    description?: string;
    createdAt: string;
  }>;
  forms?: Array<{
    id: string;
    kind: 'ESIGN_ENVELOPE' | 'FORM_INSTANCE';
    title: string;
    status: string;
    sentAt: string | null;
    signedAt: string | null;
    updatedAt: string;
    dealId: string;
    dealTitle: string;
    propertyAddress: string | null;
    formCode: string | null;
    signerSummary?: {
      total: number;
      signed: number;
      viewed: number;
    };
    downloadUrl?: string | null;
  }>;
};

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: LeadSource;
  priority: LeadPriority;
  nextTask: string;
  notes: string;
  tags: string;
  converted: boolean;
};

const phoneToSmsHref = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits ? `sms:${digits}` : '';
};

export default function LeadsDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<LeadAnalytics | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [archivedView, setArchivedView] = useState<'active' | 'archived'>('active');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDetailLoading, setLeadDetailLoading] = useState(false);
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [detailDraft, setDetailDraft] = useState<Draft | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);

  const [showNewLead, setShowNewLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newLead, setNewLead] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: LeadSource.WEBSITE as LeadSource,
    priority: LeadPriority.WARM as LeadPriority,
    notes: '',
  });

  const [newLeadNote, setNewLeadNote] = useState('');
  const [creatingLeadNote, setCreatingLeadNote] = useState(false);
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [quickNoteError, setQuickNoteError] = useState<string | null>(null);
  const [showAddToDeal, setShowAddToDeal] = useState(false);
  const [addToDealClientId, setAddToDealClientId] = useState<string | null>(null);
  const [addToDealLeadName, setAddToDealLeadName] = useState<string>('');
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [attachRole, setAttachRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [attachingClient, setAttachingClient] = useState(false);
  const [showMergeLead, setShowMergeLead] = useState(false);
  const [mergeSourceLead, setMergeSourceLead] = useState<Lead | null>(null);
  const [mergeTargetLeadId, setMergeTargetLeadId] = useState('');
  const [mergeLeadOptions, setMergeLeadOptions] = useState<Lead[]>([]);
  const [loadingLeadOptions, setLoadingLeadOptions] = useState(false);
  const [mergingLead, setMergingLead] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskDefaultTitle, setTaskDefaultTitle] = useState('');
  const [taskDefaultClientId, setTaskDefaultClientId] = useState<string | undefined>(undefined);
  const [showMarketingCampaign, setShowMarketingCampaign] = useState(false);
  const [marketingLead, setMarketingLead] = useState<Lead | null>(null);
  const [emailLead, setEmailLead] = useState<Lead | null>(null);

  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const importCancelRef = useRef(false);
  const [importDefaults, setImportDefaults] = useState({
    source: LeadSource.WEBSITE as LeadSource,
    priority: LeadPriority.WARM as LeadPriority,
  });
  const [importTouchedEmails, setImportTouchedEmails] = useState<string[]>([]);
  const [showImportedOnly, setShowImportedOnly] = useState(false);
  const leadDetailOpenedAtRef = useRef(0);

  const archivedParam = archivedView === 'archived' ? 'true' : 'false';

  const loadData = async () => {
    try {
      setLoading(true);
      setActionError(null);
      const [leadsRes, analyticsRes] = await Promise.all([
        leadsApi.getLeads({
          priority: priorityFilter || undefined,
          source: sourceFilter || undefined,
          search: searchQuery || undefined,
          archived: archivedParam,
        }),
        leadsApi.getAnalytics({ archived: archivedParam }),
      ]);

      setLeads(leadsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (e) {
      console.error('Failed to load leads:', e);
      setActionError('Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  const refreshLeadDetail = async (leadId: string) => {
    try {
      const res = await leadsApi.getLead(leadId);
      setLeadDetail(res.data as LeadDetail);
    } catch (e) {
      console.error('Failed to refresh lead detail:', e);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, sourceFilter, searchQuery, archivedView]);

  useEffect(() => {
    const focusId = searchParams.get('focusId');
    if (!focusId) return;

    setShowNewTask(false);
    setTaskDefaultClientId(undefined);
    setTaskDefaultTitle('');
    setQuickNoteLead(null);
    setShowAddToDeal(false);
    setShowMergeLead(false);
    setShowMarketingCampaign(false);
    setMarketingLead(null);
    setEmailLead(null);

    const leadInList = leads.find((lead) => lead.id === focusId);
    if (leadInList) {
      setSelectedLead(leadInList);
      const next = new URLSearchParams(searchParams);
      next.delete('focusId');
      setSearchParams(next, { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await leadsApi.getLead(focusId);
        if (cancelled) return;
        const detail = res.data as any as LeadDetail;
        setSelectedLead({
          id: detail.id,
          firstName: detail.firstName,
          lastName: detail.lastName,
          email: detail.email,
          phone: detail.phone,
          source: detail.source,
          priority: detail.priority,
          notes: detail.notes,
          nextTask: detail.nextTask,
          assignedTo: detail.assignedTo,
          converted: detail.converted,
          tags: detail.tags || [],
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
          lastVisit: detail.lastVisit,
          visitCount: detail.visitCount,
          averagePrice: detail.averagePrice,
          homesViewed: detail.homesViewed,
          clientId: detail.clientId,
          client: detail.client,
          listingId: detail.listingId,
          listing: detail.listing,
          landingPageId: detail.landingPageId,
          landingPage: detail.landingPage,
        } as any);
      } catch {
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams);
          next.delete('focusId');
          setSearchParams(next, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, leads]);

  useEffect(() => {
    const leadId = selectedLead?.id;
    if (!leadId) {
      setLeadDetail(null);
      setDetailDraft(null);
      setNewLeadNote('');
      return;
    }

    (async () => {
      try {
        setLeadDetailLoading(true);
        const res = await leadsApi.getLead(leadId);
        const detail = res.data as any as LeadDetail;
        setLeadDetail(detail);
        setDetailDraft({
          firstName: detail.firstName || '',
          lastName: detail.lastName || '',
          email: detail.email || '',
          phone: detail.phone || '',
          source: (detail.source || LeadSource.WEBSITE) as LeadSource,
          priority: (detail.priority || LeadPriority.WARM) as LeadPriority,
          nextTask: detail.nextTask || '',
          notes: detail.notes || '',
          tags: Array.isArray(detail.tags) ? detail.tags.join(', ') : '',
          converted: Boolean(detail.converted),
        });
      } catch (e) {
        console.error('Failed to load lead detail:', e);
        setActionError('Failed to load lead details.');
      } finally {
        setLeadDetailLoading(false);
      }
    })();
  }, [selectedLead?.id]);

  useEscapeKey(
    () => {
      if (quickNoteLead) setQuickNoteLead(null);
      else if (selectedLead) setSelectedLead(null);
    },
    Boolean(quickNoteLead || selectedLead),
  );

  // Safety reset in case any nested modal leaves body scroll locked.
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!showNewTask && !showMarketingCampaign && !quickNoteLead && !showAddToDeal && !showMergeLead && !emailLead && !selectedLead) {
      document.body.style.overflow = '';
    }
  }, [showNewTask, showMarketingCampaign, quickNoteLead, showAddToDeal, showMergeLead, emailLead, selectedLead]);

  const resetPanels = () => {
    setShowNewLead(false);
    setShowImport(false);
    setActionError(null);
  };

  const handleCreateLead = async () => {
    const firstName = newLead.firstName.trim();
    const lastName = newLead.lastName.trim();
    const email = newLead.email.trim();
    if (!firstName || !lastName || !email) {
      setActionError('First name, last name, and email are required.');
      return;
    }

    try {
      setSavingDetail(true);
      setActionError(null);
      await leadsApi.createLead({
        firstName,
        lastName,
        email,
        phone: newLead.phone.trim() || undefined,
        source: newLead.source,
        priority: newLead.priority,
        notes: newLead.notes.trim() || undefined,
      });

      setNewLead({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        source: LeadSource.WEBSITE,
        priority: LeadPriority.WARM,
        notes: '',
      });
      setShowNewLead(false);
      await loadData();
    } catch (e) {
      console.error('Failed to create lead:', e);
      setActionError('Failed to create lead.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedLead?.id || !detailDraft) return;
    try {
      setSavingDetail(true);
      setActionError(null);

      const tags = detailDraft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await leadsApi.updateLead(selectedLead.id, {
        firstName: detailDraft.firstName.trim(),
        lastName: detailDraft.lastName.trim(),
        email: detailDraft.email.trim(),
        phone: detailDraft.phone.trim() ? detailDraft.phone.trim() : undefined,
        source: detailDraft.source,
        priority: detailDraft.priority,
        nextTask: detailDraft.nextTask.trim() || undefined,
        notes: detailDraft.notes.trim() || undefined,
        tags,
        converted: detailDraft.converted,
      });

      setLeadDetail(res.data as any);
      setSelectedLead(res.data as any);
      await loadData();
    } catch (e) {
      console.error('Failed to save lead:', e);
      setActionError('Failed to save lead changes.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!selectedLead?.id) return;
    try {
      setSavingDetail(true);
      setActionError(null);
      const isArchived = (leadDetail?.tags || []).includes(ARCHIVED_TAG);
      const res = isArchived
        ? await leadsApi.unarchiveLead(selectedLead.id)
        : await leadsApi.archiveLead(selectedLead.id);
      setLeadDetail(res.data as any);
      setSelectedLead(res.data as any);
      await loadData();
    } catch (e) {
      console.error('Failed to archive/unarchive lead:', e);
      setActionError('Failed to update archive status.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLead?.id) return;
    const ok = window.confirm('Delete this lead permanently?');
    if (!ok) return;
    try {
      setSavingDetail(true);
      setActionError(null);
      await leadsApi.deleteLead(selectedLead.id);
      setSelectedLead(null);
      setLeadDetail(null);
      setDetailDraft(null);
      await loadData();
    } catch (e) {
      console.error('Failed to delete lead:', e);
      setActionError('Failed to delete lead.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleConvertLead = async (leadId: string) => {
    try {
      setSavingDetail(true);
      setActionError(null);
      const res = await leadsApi.convertLead(leadId);

      const nextLead = res.data.lead as any as Lead;
      setSelectedLead(nextLead);
      setLeadDetail(nextLead as any);
      await loadData();

      const clientId = res.data.client?.id;
      if (clientId) {
        navigate(`/clients/${clientId}`);
      }
    } catch (e) {
      console.error('Failed to convert lead:', e);
      setActionError('Failed to convert lead to client.');
    } finally {
      setSavingDetail(false);
    }
  };

  const loadDeals = async () => {
    setLoadingDeals(true);
    try {
      const res = await api.get('/deals');
      setAllDeals(res.data || []);
    } catch (e) {
      console.error('Failed to load deals:', e);
    } finally {
      setLoadingDeals(false);
    }
  };

  const openAddToDeal = async (lead: Lead) => {
    const clientId = lead.clientId || lead.client?.id || null;
    if (!clientId) return;
    setAddToDealClientId(clientId);
    setAddToDealLeadName(`${lead.firstName} ${lead.lastName}`);
    setSelectedDealId('');
    setAttachRole('BUYER');
    setShowAddToDeal(true);
    await loadDeals();
  };

  const attachClientToDeal = async () => {
    if (!addToDealClientId || !selectedDealId) return;
    try {
      setAttachingClient(true);
      await api.patch(`/deals/${selectedDealId}/attach-client`, {
        clientId: addToDealClientId,
        role: attachRole,
      });
      setShowAddToDeal(false);
    } catch (e) {
      console.error('Failed to add client to deal:', e);
      setActionError('Failed to add client to deal.');
    } finally {
      setAttachingClient(false);
    }
  };

  const openMergeLead = async (lead: Lead) => {
    setMergeSourceLead(lead);
    setMergeTargetLeadId('');
    setShowMergeLead(true);
    setLoadingLeadOptions(true);
    try {
      const res = await leadsApi.getLeads({ archived: 'all' });
      setMergeLeadOptions(res.data || []);
    } catch (e) {
      console.error('Failed to load leads for merge:', e);
    } finally {
      setLoadingLeadOptions(false);
    }
  };

  const mergeLeads = async () => {
    if (!mergeSourceLead || !mergeTargetLeadId) return;
    const ok = window.confirm('Merge this lead into the selected lead? All activity, saved listings, and history will be transferred. This cannot be undone.');
    if (!ok) return;
    try {
      setMergingLead(true);
      await leadsApi.mergeLead(mergeSourceLead.id, mergeTargetLeadId);
      setShowMergeLead(false);
      setMergeSourceLead(null);
      await loadData();
    } catch (e) {
      console.error('Failed to merge leads:', e);
      setActionError('Failed to merge leads.');
    } finally {
      setMergingLead(false);
    }
  };

  const handleCreateLeadNote = async () => {
    if (!selectedLead?.id) return;
    const text = newLeadNote.trim();
    if (!text) return;
    try {
      setCreatingLeadNote(true);
      setActionError(null);
      await leadsApi.createActivity(selectedLead.id, { type: 'NOTE', description: text });
      setNewLeadNote('');
      const res = await leadsApi.getLead(selectedLead.id);
      setLeadDetail(res.data as any);
    } catch (e) {
      console.error('Failed to create lead note:', e);
      setActionError('Failed to create note.');
    } finally {
      setCreatingLeadNote(false);
    }
  };

  const openQuickNote = (lead: Lead) => {
    setQuickNoteLead(lead);
    setQuickNoteText('');
    setQuickNoteError(null);
  };

  const saveQuickNote = async () => {
    if (!quickNoteLead) return;
    const text = quickNoteText.trim();
    if (!text) {
      setQuickNoteError('Please enter a note.');
      return;
    }
    try {
      setSavingQuickNote(true);
      await leadsApi.createActivity(quickNoteLead.id, { type: 'NOTE', description: text });
      setQuickNoteLead(null);
      setQuickNoteText('');
      await loadData();
    } catch (e) {
      console.error('Failed to create lead note:', e);
      setQuickNoteError('Failed to save note.');
    } finally {
      setSavingQuickNote(false);
    }
  };

  const openLeadTask = (lead: Lead) => {
    const elapsedSinceProfileOpen = Date.now() - leadDetailOpenedAtRef.current;
    if (elapsedSinceProfileOpen >= 0 && elapsedSinceProfileOpen < 450) {
      return;
    }
    const clientId = lead.clientId || lead.client?.id || undefined;
    setTaskDefaultClientId(clientId || undefined);
    setTaskDefaultTitle(`Follow up: ${lead.firstName} ${lead.lastName}`.trim());
    setShowNewTask(true);
  };

  const openLeadDetail = (lead: Lead) => {
    leadDetailOpenedAtRef.current = Date.now();
    setShowNewTask(false);
    setTaskDefaultClientId(undefined);
    setTaskDefaultTitle('');
    setQuickNoteLead(null);
    setQuickNoteText('');
    setQuickNoteError(null);
    setShowAddToDeal(false);
    setShowMergeLead(false);
    setShowMarketingCampaign(false);
    setMarketingLead(null);
    setEmailLead(null);
    setActionError(null);
    setSelectedLead(lead);
  };

  const openLeadEmail = (lead: Lead) => {
    if (!lead.email) return;
    setEmailLead(lead);
  };

  const openMarketingCampaign = (lead: Lead) => {
    setMarketingLead(lead);
    setShowMarketingCampaign(true);
  };

  const handleCsvSelected = async (file: File) => {
    setActionError(null);
    setImportFileName(file.name);
    setImportRows([]);
    setImportProgress(null);
    importCancelRef.current = false;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []) as any[];
        const max = 20000;
        if (rows.length > max) {
          setActionError(
            `This CSV has ${rows.length.toLocaleString()} rows. Importing the first ${max.toLocaleString()} to keep things fast.`,
          );
        }
        setImportRows(rows.slice(0, max));
      },
      error: () => {
        setActionError('Failed to parse CSV.');
      },
    });
  };

  const handleImport = async () => {
    if (importing) return;
    if (!importRows.length) {
      setActionError('Select a CSV file first.');
      return;
    }

    setImporting(true);
    setActionError(null);
    importCancelRef.current = false;

    try {
      const rowsToImport = importRows;
      const BATCH_SIZE = 500;
      const touchedEmailSet = new Set<string>();

      let created = 0;
      let updated = 0;
      let skipped = 0;

      setImportProgress({ done: 0, total: rowsToImport.length, created: 0, updated: 0, skipped: 0 });

      for (let offset = 0; offset < rowsToImport.length; offset += BATCH_SIZE) {
        if (importCancelRef.current) {
          setActionError('Import cancelled.');
          break;
        }

        const batch = rowsToImport.slice(offset, offset + BATCH_SIZE);
        let skippedMissingEmail = 0;

        const records = batch
          .map((row) => {
            const email = normalizeCsvField(row, ['email']);
            if (!email) {
              skippedMissingEmail += 1;
              return null;
            }
            touchedEmailSet.add(email.trim().toLowerCase());

            const phone = normalizeCsvField(row, ['phone', 'mobile']);
            const firstName = normalizeCsvField(row, ['firstname', 'first_name', 'first']);
            const lastName = normalizeCsvField(row, ['lastname', 'last_name', 'last']);
            const fullName = normalizeCsvField(row, ['name', 'full_name', 'fullname']);
            const sourceRaw = normalizeCsvField(row, ['source', 'lead_source', 'leadsource', 'lead source']);
            const priorityRaw = normalizeCsvField(row, ['priority', 'lead_priority', 'leadpriority']);
            const notes = normalizeCsvField(row, ['notes', 'note']);
            const tagsRaw = normalizeCsvField(row, ['tags', 'tag']);

            let fn = firstName;
            let ln = lastName;
            if ((!fn || !ln) && fullName) {
              const parts = fullName.split(' ').filter(Boolean);
              fn = fn || parts[0] || 'Lead';
              ln = ln || parts.slice(1).join(' ') || 'Imported';
            }
            if (!fn) fn = 'Lead';
            if (!ln) ln = 'Imported';

            const tags = tagsRaw
              ? tagsRaw
                  .split(/[;,|]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              : undefined;

            return {
              firstName: fn,
              lastName: ln,
              name: fullName || undefined,
              email,
              phone: phone || undefined,
              source: (mapLeadSource(sourceRaw) || undefined) as any,
              priority: (mapLeadPriority(priorityRaw) || undefined) as any,
              notes: notes || undefined,
              tags,
            };
          })
          .filter(Boolean) as any[];

        skipped += skippedMissingEmail;

        if (records.length > 0) {
          const res = await leadsApi.bulkImport({
            records,
            skipDuplicates: false,
            defaults: { source: importDefaults.source, priority: importDefaults.priority },
          });
          created += Number(res.data?.created || 0);
          updated += Number(res.data?.updated || 0);
          skipped += Number(res.data?.skipped || 0);
        }

        setImportProgress((p) =>
          p
            ? {
                ...p,
                done: Math.min(offset + batch.length, p.total),
                created,
                updated,
                skipped,
              }
            : null,
        );
      }

      await loadData();

      if (touchedEmailSet.size > 0) {
        setImportTouchedEmails(Array.from(touchedEmailSet));
        setShowImportedOnly(true);
      }

      if (!importCancelRef.current) {
        setActionError(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped.`);
        setShowImport(false);
        setImportFileName(null);
        setImportRows([]);
        setImportProgress(null);
      }
    } catch (e) {
      console.error('Import failed:', e);
      setActionError('Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const importPreview = useMemo(() => {
    if (!showImport || importRows.length === 0) return null;
    const rows = importRows.slice(0, 5).map((row) => {
      const email = normalizeCsvField(row, ['email']);
      const phone = normalizeCsvField(row, ['phone', 'mobile']);
      const fullName = normalizeCsvField(row, ['name', 'full_name', 'fullname']);
      const firstName = normalizeCsvField(row, ['firstname', 'first_name', 'first']);
      const lastName = normalizeCsvField(row, ['lastname', 'last_name', 'last']);
      const sourceRaw = normalizeCsvField(row, ['source', 'lead_source', 'leadsource', 'lead source']);
      const priorityRaw = normalizeCsvField(row, ['priority', 'lead_priority', 'leadpriority']);
      const source = mapLeadSource(sourceRaw) || importDefaults.source;
      const priority = mapLeadPriority(priorityRaw) || importDefaults.priority;

      let name = `${firstName} ${lastName}`.trim();
      if ((!firstName || !lastName) && fullName) name = fullName;
      if (!name) name = 'Lead Imported';

      return { name, email, phone, source, priority };
    });

    const total = importRows.length;
    const valid = importRows.filter((r) => normalizeCsvField(r, ['email'])).length;
    const invalid = total - valid;
    return { rows, total, valid, invalid };
  }, [showImport, importRows, importDefaults.source, importDefaults.priority]);

  const leadConversationBrief = useMemo(() => {
    const activities = (leadDetail?.activities || []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastActivity = activities[0];
    const recentReply = activities.find((item) => (item.description || '').toLowerCase().includes('reply received'));
    const lastTouchAt = selectedLead?.lastContact || lastActivity?.createdAt || selectedLead?.createdAt;
    const daysSinceTouch = lastTouchAt ? Math.max(0, Math.floor((Date.now() - new Date(lastTouchAt).getTime()) / 86400000)) : null;

    let nextStep = 'Move this lead to the next stage with one specific ask.';
    if (recentReply) nextStep = 'Reply now while interest is high and lock the next call time.';
    else if (!selectedLead?.phone) nextStep = 'Capture a phone number to speed up conversion.';
    else if ((daysSinceTouch ?? 0) >= 3) nextStep = 'Re-engage today with a short check-in message.';

    return {
      lastActivityLabel: lastActivity?.activityType || 'No recent activity',
      lastActivityAt: lastActivity?.createdAt || null,
      daysSinceTouch,
      nextStep,
      hasRecentReply: Boolean(recentReply),
    };
  }, [leadDetail?.activities, selectedLead?.createdAt, selectedLead?.lastContact, selectedLead?.phone]);

  const selectedClientId = leadDetail?.clientId || selectedLead?.clientId || leadDetail?.client?.id || selectedLead?.client?.id || null;
  const latestDrawerForm = leadDetail?.forms?.[0] || null;

  const openDrawerClient = () => {
    if (selectedClientId) navigate(`/clients/${selectedClientId}`);
  };

  const openDrawerDealDetail = (dealId: string) => {
    navigate(`/deals/${dealId}/detail`);
  };

  const openDrawerDealWorkspace = (dealId: string, formCode?: string | null) => {
    if (formCode) {
      navigate(`/deals/${dealId}/forms/${encodeURIComponent(formCode)}`);
      return;
    }

    openDrawerDealDetail(dealId);
  };

  const startDrawerDeal = () => {
    if (selectedClientId) navigate(`/deals/new?clientId=${selectedClientId}`);
  };

  const leadCommandCenter = useMemo(() => {
    const now = Date.now();
    const activeLeads = leads.filter((lead) => !(lead.tags || []).includes(ARCHIVED_TAG));

    const noPhoneLeads = activeLeads.filter((lead) => !String(lead.phone || '').trim());
    const staleLeads = activeLeads.filter((lead) => {
      if (!lead.lastContact) return true;
      return now - new Date(lead.lastContact).getTime() > 1000 * 60 * 60 * 24 * 3;
    });
    const highIntentLeads = activeLeads.filter((lead) => (lead.visitCount || 0) >= 3 || (lead.homesViewed || 0) >= 2);
    const taskGapLeads = activeLeads.filter((lead) => !String(lead.nextTask || '').trim());

    const firstHotCallable = activeLeads.find((lead) => lead.priority === LeadPriority.HOT && String(lead.phone || '').trim());
    const firstNoPhone = noPhoneLeads[0] || null;
    const firstStale = staleLeads[0] || null;

    let headline = 'Pipeline in motion';
    let subline = 'Use these actions to keep momentum and lift conversion this week.';
    if (staleLeads.length >= 10) {
      headline = 'Re-engagement sprint needed';
      subline = `${staleLeads.length} leads have gone cold. Start with a fast warm-back sequence.`;
    } else if (highIntentLeads.length >= 5) {
      headline = 'High-intent window open';
      subline = `${highIntentLeads.length} leads show strong buying signals. Prioritize same-day contact.`;
    }

    return {
      headline,
      subline,
      staleCount: staleLeads.length,
      highIntentCount: highIntentLeads.length,
      noPhoneCount: noPhoneLeads.length,
      taskGapCount: taskGapLeads.length,
      firstHotCallable,
      firstNoPhone,
      firstStale,
    };
  }, [leads]);

  const importedEmailSet = useMemo(() => new Set(importTouchedEmails.map((v) => v.trim().toLowerCase())), [importTouchedEmails]);

  const displayedLeads = useMemo(() => {
    if (!showImportedOnly || importedEmailSet.size === 0) return leads;
    return leads.filter((lead) => importedEmailSet.has(String(lead.email || '').trim().toLowerCase()));
  }, [leads, showImportedOnly, importedEmailSet]);

  const smartQueue = useMemo(() => {
    const queue: Array<{ lead: Lead; reason: string }> = [];
    const used = new Set<string>();

    const activeLeads = leads.filter((lead) => !(lead.tags || []).includes(ARCHIVED_TAG));
    const add = (candidate: Lead | undefined, reason: string) => {
      if (!candidate || used.has(candidate.id) || queue.length >= 3) return;
      used.add(candidate.id);
      queue.push({ lead: candidate, reason });
    };

    add(
      activeLeads.find((lead) => lead.priority === LeadPriority.HOT && !String(lead.nextTask || '').trim()),
      'HOT lead missing a defined next task',
    );
    add(
      activeLeads.find((lead) => {
        if (!lead.lastContact) return true;
        return Date.now() - new Date(lead.lastContact).getTime() > 1000 * 60 * 60 * 24 * 3;
      }),
      'No recent contact in 3+ days',
    );
    add(
      activeLeads.find((lead) => !String(lead.phone || '').trim()),
      'Missing phone number, reduce friction now',
    );

    return queue;
  }, [leads]);

  return (
    <PageLayout
      title="Lead Tracking Hub"
      subtitle="Track, analyze, and convert your leads into clients with real-time analytics and engagement insights."
      maxWidth="full"
      actions={
        <>
          <button
            onClick={() => {
              setActionError(null);
              setShowImport((v) => !v);
              setShowNewLead(false);
            }}
            className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
          >
            Import CSV
          </button>
          <button
            onClick={() => {
              setActionError(null);
              setShowNewLead((v) => !v);
              setShowImport(false);
            }}
            className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            New Lead
          </button>
        </>
      }
    >
      <div className="relative ae-content">
        {actionError && (
          <div className="mb-4 bg-slate-950/40 backdrop-blur-xl border border-slate-800/50 rounded-[18px] px-4 py-3 text-sm text-slate-200">
            {actionError}
          </div>
        )}

        {(showNewLead || showImport) && (
          <div className="mb-6 bg-slate-950/40 backdrop-blur-xl border border-slate-800/50 rounded-[24px] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">{showNewLead ? 'Create Lead' : 'Import Leads (CSV)'}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {showNewLead ? 'Add a lead manually in seconds.' : 'Upload a CSV with at least an email column.'}
                </p>
              </div>
              <button onClick={resetPanels} className="text-slate-400 hover:text-white transition-colors" aria-label="Close">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {showNewLead && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="First name">
                  <input
                    value={newLead.firstName}
                    onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    value={newLead.lastName}
                    onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Source">
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value as LeadSource })}
                    className={inputClass}
                  >
                    {Object.values(LeadSource).map((s) => (
                      <option key={s} value={s}>
                        {prettyEnum(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={newLead.priority}
                    onChange={(e) => setNewLead({ ...newLead, priority: e.target.value as LeadPriority })}
                    className={inputClass}
                  >
                    {Object.values(LeadPriority).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Notes (optional)">
                    <textarea
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      rows={3}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={resetPanels}
                    className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleCreateLead()}
                    disabled={savingDetail}
                    className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
                  >
                    Create Lead
                  </button>
                </div>
              </div>
            )}

            {showImport && (
              <div className="mt-6">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleCsvSelected(f);
                    }}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-800/50 file:text-slate-200 hover:file:bg-slate-800"
                  />
                  <button
                    onClick={downloadSampleCsv}
                    className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
                  >
                    Download sample CSV
                  </button>
                  <button
                    onClick={() => void handleImport()}
                    disabled={importing || importRows.length === 0}
                    className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
                  >
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                  {importing && (
                    <button
                      onClick={() => {
                        importCancelRef.current = true;
                        setActionError('Canceling import…');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Default source (if missing)">
                    <select
                      value={importDefaults.source}
                      onChange={(e) => setImportDefaults({ ...importDefaults, source: e.target.value as LeadSource })}
                      className={inputClass}
                    >
                      {Object.values(LeadSource).map((s) => (
                        <option key={s} value={s}>
                          {prettyEnum(s)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Default priority (if missing)">
                    <select
                      value={importDefaults.priority}
                      onChange={(e) => setImportDefaults({ ...importDefaults, priority: e.target.value as LeadPriority })}
                      className={inputClass}
                    >
                      {Object.values(LeadPriority).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-3 text-sm text-slate-400">
                  {importFileName ? (
                    <span>
                      {importFileName} • {importRows.length} row(s) ready
                    </span>
                  ) : (
                    <span>
                      CSV columns supported: email (required), firstName/lastName or name, phone, source, priority, notes, tags.
                    </span>
                  )}
                </div>

                {importPreview && (
                  <div className="mt-4 bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="text-sm text-slate-300">Preview (first {importPreview.rows.length} rows)</div>
                      <div className="text-xs text-slate-400">
                        {importPreview.valid} valid • {importPreview.invalid} missing email
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-500">
                            <th className="text-left py-2 pr-4">Name</th>
                            <th className="text-left py-2 pr-4">Email</th>
                            <th className="text-left py-2 pr-4">Phone</th>
                            <th className="text-left py-2 pr-4">Source</th>
                            <th className="text-left py-2">Priority</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-200">
                          {importPreview.rows.map((r: any, idx: number) => (
                            <tr key={idx} className="border-t border-slate-800/40">
                              <td className="py-2 pr-4 whitespace-nowrap">{r.name}</td>
                              <td className={`py-2 pr-4 whitespace-nowrap ${r.email ? 'text-slate-200' : 'text-amber-300'}`}>
                                {r.email || 'Missing'}
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap">{r.phone || '-'}</td>
                              <td className="py-2 pr-4 whitespace-nowrap">{prettyEnum(r.source)}</td>
                              <td className="py-2 whitespace-nowrap">{String(r.priority)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importProgress && (
                  <div className="mt-4 bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="text-sm text-slate-200">
                        Importing {importProgress.done}/{importProgress.total}
                      </div>
                      <div className="text-xs text-slate-400">
                        {importProgress.created} created • {importProgress.updated} updated • {importProgress.skipped} skipped
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 rounded-[24px] border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-slate-950/30 p-4 sm:p-5 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Lead Command Center</div>
              <div className="mt-1 text-lg font-bold text-white truncate">{leadCommandCenter.headline}</div>
              <div className="mt-1 text-sm text-slate-300">{leadCommandCenter.subline}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
              <MiniStat label="Stale" value={leadCommandCenter.staleCount} />
              <MiniStat label="High Intent" value={leadCommandCenter.highIntentCount} />
              <MiniStat label="Missing Phone" value={leadCommandCenter.noPhoneCount} />
              <MiniStat label="No Next Task" value={leadCommandCenter.taskGapCount} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!leadCommandCenter.firstHotCallable}
              onClick={() => leadCommandCenter.firstHotCallable && navigate(`/leads/${leadCommandCenter.firstHotCallable.id}`)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              Start with hottest lead
            </button>
            <button
              type="button"
              disabled={!leadCommandCenter.firstNoPhone}
              onClick={() => leadCommandCenter.firstNoPhone && navigate(`/leads/${leadCommandCenter.firstNoPhone.id}`)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
            >
              Fix contact gaps
            </button>
            <button
              type="button"
              disabled={!leadCommandCenter.firstStale}
              onClick={() => leadCommandCenter.firstStale && navigate(`/leads/${leadCommandCenter.firstStale.id}`)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 disabled:opacity-40"
            >
              Re-engage stale lead
            </button>
            <button
              type="button"
              onClick={() => {
                setArchivedView('active');
                setPriorityFilter('HOT');
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            >
              Focus HOT pipeline
            </button>
            {importTouchedEmails.length > 0 && (
              <button
                type="button"
                onClick={() => setShowImportedOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  showImportedOnly
                    ? 'border-blue-300/40 bg-blue-500/20 text-blue-100'
                    : 'border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20'
                }`}
              >
                {showImportedOnly ? 'Showing imported only' : 'Review imported in this session'}
              </button>
            )}
          </div>

          {smartQueue.length > 0 && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
              {smartQueue.map((item) => (
                <div key={item.lead.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                  <div className="text-xs text-slate-400">Smart next lead</div>
                  <div className="text-sm font-semibold text-white truncate mt-0.5">
                    {item.lead.firstName} {item.lead.lastName}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">{item.reason}</div>
                  <div className="mt-2 text-[10px] text-slate-500">
                    {item.lead.priority} • {prettyEnum(item.lead.source)} • {item.lead.visitCount || 0} visits
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/leads/${item.lead.id}`)}
                      className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Open profile
                    </button>
                    <button
                      type="button"
                      onClick={() => openLeadTask(item.lead)}
                      className="px-2.5 py-1.5 rounded-lg border border-cyan-400/30 text-xs text-cyan-200 hover:bg-cyan-500/10"
                    >
                      Add task
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {importTouchedEmails.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-400/20 bg-blue-500/5 px-4 py-2.5">
            <div className="text-xs text-blue-200">
              Imported session memory active: {importTouchedEmails.length} lead email{importTouchedEmails.length === 1 ? '' : 's'}.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportedOnly((v) => !v)}
                className="px-2.5 py-1 rounded-lg border border-blue-300/30 text-[11px] text-blue-100 hover:bg-blue-500/20"
              >
                {showImportedOnly ? 'Show all leads' : 'Show imported only'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTouchedEmails([]);
                  setShowImportedOnly(false);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-400/30 text-[11px] text-slate-200 hover:bg-slate-500/20"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Total" value={analytics.summary.totalLeads} />
            <StatCard label="Hot" value={analytics.summary.hotLeads} accent="text-rose-300" />
            <StatCard label="Warm" value={analytics.summary.warmLeads} accent="text-amber-300" />
            <StatCard label="Cold" value={analytics.summary.coldLeads} accent="text-cyan-300" />
            <StatCard label="Converted" value={analytics.summary.convertedLeads} accent="text-emerald-300" />
            <StatCard label="Conversion" value={`${Math.round(analytics.summary.conversionRate)}%`} />
          </div>
        )}

        <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-800/50 rounded-[24px] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Icons.Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads by name, email, or phone"
                  className="w-full bg-slate-900/40 border border-slate-700/50 rounded-2xl pl-12 pr-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {([
                { value: null, label: 'All' },
                { value: 'HOT', label: 'Hot' },
                { value: 'WARM', label: 'Warm' },
                { value: 'COLD', label: 'Cold' },
              ] as Array<{ value: string | null; label: string }>).map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPriorityFilter(p.value)}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                    priorityFilter === p.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icons.Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}

              <select
                value={sourceFilter || ''}
                onChange={(e) => setSourceFilter(e.target.value || null)}
                className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
              >
                <option value="">All sources</option>
                {Object.values(LeadSource).map((s) => (
                  <option key={s} value={s}>
                    {prettyEnum(s)}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setArchivedView((v) => (v === 'archived' ? 'active' : 'archived'))}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                  archivedView === 'archived'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icons.Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Archived</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-slate-300">Loading…</div>
          ) : displayedLeads.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800/50 rounded-2xl mb-4">
                <Icons.Users className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No leads yet</h3>
              <p className="text-slate-400 mb-5">
                {searchQuery || priorityFilter || sourceFilter
                  ? 'Try adjusting your filters'
                  : showImportedOnly
                    ? 'No imported leads match the current filters'
                  : archivedView === 'archived'
                    ? 'No archived leads found'
                    : 'Start capturing leads to see them here'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/30 overflow-x-auto overflow-y-auto max-h-[68vh] overscroll-contain">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-xl">
                  <tr className="text-slate-500 border-b border-slate-800/40">
                    <th className="text-left py-3 pr-4">Lead</th>
                    <th className="text-left py-3 pr-4">Priority</th>
                    <th className="text-left py-3 pr-4">Source</th>
                    <th className="text-left py-3 pr-4">Visits</th>
                    <th className="text-left py-3">Updated</th>
                    <th className="text-right py-3 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {displayedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-slate-800/40 hover:bg-slate-900/20 cursor-pointer"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <td className="py-3 pr-4">
                        <div className="text-slate-100 font-semibold">
                          {lead.firstName} {lead.lastName}
                          {importedEmailSet.has(String(lead.email || '').trim().toLowerCase()) && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-md border border-blue-400/40 bg-blue-500/10 text-[10px] text-blue-200 align-middle">
                              Imported
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{lead.email}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-200">{lead.priority}</td>
                      <td className="py-3 pr-4 text-slate-300">{prettyEnum(lead.source)}</td>
                      <td className="py-3 pr-4 text-slate-300">{lead.visitCount}</td>
                      <td className="py-3 text-slate-400">{new Date(lead.updatedAt).toLocaleDateString()}</td>
                      <td className="py-3 pl-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {lead.phone && (
                            <a
                              href={phoneToTelHref(lead.phone)}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 text-[11px] hover:bg-emerald-500/20 transition-colors"
                            >
                              Call
                            </a>
                          )}
                          {lead.phone && (
                            <a
                              href={phoneToSmsHref(lead.phone)}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-[11px] hover:bg-cyan-500/20 transition-colors"
                            >
                              Text
                            </a>
                          )}
                          {lead.email && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLeadEmail(lead);
                              }}
                              className="px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-400/30 text-slate-200 text-[11px] hover:bg-slate-500/20 transition-colors"
                            >
                              Email
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLeadTask(lead);
                            }}
                            className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-200 text-[11px] hover:bg-purple-500/20 transition-colors"
                          >
                            Task
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuickNote(lead);
                            }}
                            className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-200 text-[11px] hover:bg-blue-500/20 transition-colors"
                          >
                            Quick note
                          </button>
                          <LeadActionsMenu
                            leadName={`${lead.firstName} ${lead.lastName}`}
                            isArchived={(lead.tags || []).includes(ARCHIVED_TAG)}
                            isConverted={Boolean(lead.converted)}
                            hasClient={Boolean(lead.clientId || lead.client?.id)}
                            onAddToMarketing={() => openMarketingCampaign(lead)}
                            onAddTask={() => openLeadTask(lead)}
                            onOpenClient={
                              lead.clientId || lead.client?.id
                                ? () => navigate(`/clients/${lead.clientId || lead.client!.id}`)
                                : undefined
                            }
                            onConvert={() => handleConvertLead(lead.id)}
                            onAddToDeal={() => openAddToDeal(lead)}
                            onMerge={() => openMergeLead(lead)}
                            onArchiveToggle={async () => {
                              const isArchived = (lead.tags || []).includes(ARCHIVED_TAG);
                              if (isArchived) await leadsApi.unarchiveLead(lead.id);
                              else await leadsApi.archiveLead(lead.id);
                              await loadData();
                            }}
                            onDelete={async () => {
                              await leadsApi.deleteLead(lead.id);
                              if (selectedLead?.id === lead.id) setSelectedLead(null);
                              await loadData();
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {quickNoteLead && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60" onClick={() => setQuickNoteLead(null)} />
          <div className="absolute inset-x-4 sm:inset-x-auto sm:right-8 top-20 sm:top-24 sm:w-[420px] bg-white/95 dark:bg-slate-950/90 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Quick note</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              {quickNoteLead.firstName} {quickNoteLead.lastName} • Notes save to Activity automatically.
            </div>
            <textarea
              value={quickNoteText}
              onChange={(e) => setQuickNoteText(e.target.value)}
              rows={4}
              placeholder="Call summary, next steps, preferences…"
              className={inputClass}
            />
            {quickNoteError && <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{quickNoteError}</div>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setQuickNoteLead(null)}
                className="px-3 py-2 rounded-xl bg-white text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveQuickNote()}
                disabled={savingQuickNote || !quickNoteText.trim()}
                className="px-3 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
              >
                {savingQuickNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddToDeal && addToDealClientId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60" onClick={() => setShowAddToDeal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add Lead to Deal</h3>
                <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setShowAddToDeal(false)}>✕</button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-4">Client: {addToDealLeadName}</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Deal</label>
                  <select
                    value={selectedDealId}
                    onChange={(e) => setSelectedDealId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
                  >
                    <option value="">Choose a deal</option>
                    {allDeals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.title}
                      </option>
                    ))}
                  </select>
                  {loadingDeals && <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading deals…</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role in this deal</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAttachRole('BUYER')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                        attachRole === 'BUYER'
                          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/20 dark:border-blue-400/40 dark:text-blue-200'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30'
                      }`}
                    >
                      Buyer
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachRole('SELLER')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                        attachRole === 'SELLER'
                          ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/20 dark:border-orange-400/40 dark:text-orange-200'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30'
                      }`}
                    >
                      Seller
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowAddToDeal(false)}
                  className="px-3 py-2 rounded-xl bg-white text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:border-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void attachClientToDeal()}
                  disabled={!selectedDealId || attachingClient}
                  className="px-3 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-60"
                >
                  {attachingClient ? 'Adding…' : 'Add to Deal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMergeLead && mergeSourceLead && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60" onClick={() => setShowMergeLead(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Merge Lead</h3>
                <button className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setShowMergeLead(false)}>✕</button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Source: {mergeSourceLead.firstName} {mergeSourceLead.lastName}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Merge into</label>
                <select
                  value={mergeTargetLeadId}
                  onChange={(e) => setMergeTargetLeadId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
                >
                  <option value="">Choose a lead</option>
                  {mergeLeadOptions
                    .filter((l) => l.id !== mergeSourceLead.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.firstName} {l.lastName} · {l.email}
                      </option>
                    ))}
                </select>
                {loadingLeadOptions && <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading leads…</div>}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  This will move activity, saved listings, and history into the selected lead.
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowMergeLead(false)}
                  className="px-3 py-2 rounded-xl bg-white text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:border-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void mergeLeads()}
                  disabled={!mergeTargetLeadId || mergingLead}
                  className="px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-60"
                >
                  {mergingLead ? 'Merging…' : 'Merge Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewTask && (
        <NewTaskModal
          defaultClientId={taskDefaultClientId}
          defaultTitle={taskDefaultTitle}
          defaultCategory="CALL"
          onClose={() => setShowNewTask(false)}
          onComplete={() => {
            setShowNewTask(false);
          }}
        />
      )}

      {showMarketingCampaign && marketingLead && (
        <MarketingCampaignModal
          targetType="lead"
          targetName={`${marketingLead.firstName} ${marketingLead.lastName}`.trim()}
          targetEmail={marketingLead.email}
          leadId={marketingLead.id}
          clientId={marketingLead.clientId || marketingLead.client?.id || null}
          onClose={() => {
            setShowMarketingCampaign(false);
            setMarketingLead(null);
          }}
          onOpenMarketing={() => {
            setShowMarketingCampaign(false);
            setMarketingLead(null);
            navigate('/marketing');
          }}
          onComplete={() => {
            void loadData();
            if (marketingLead?.id) {
              void refreshLeadDetail(marketingLead.id);
            }
          }}
        />
      )}

      {emailLead?.email && (
        <ContactEmailModal
          open={Boolean(emailLead)}
          contactType="lead"
          contactId={emailLead.id}
          contactName={`${emailLead.firstName} ${emailLead.lastName}`.trim()}
          contactEmail={emailLead.email}
          onClose={() => setEmailLead(null)}
          onSent={() => {
            void loadData();
            if (selectedLead?.id === emailLead.id) {
              void refreshLeadDetail(emailLead.id);
            }
          }}
        />
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/60" onClick={() => setSelectedLead(null)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white/95 dark:bg-slate-950/70 backdrop-blur-xl border-l border-slate-200/80 dark:border-slate-800/50">
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/50 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Lead Profile</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
                    {selectedLead.firstName} {selectedLead.lastName}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{selectedLead.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/leads/${selectedLead.id}`)}
                    className="px-3 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors text-xs font-semibold"
                  >
                    Open Full Profile
                  </button>
                  {selectedClientId && (
                    <button
                      onClick={openDrawerClient}
                      className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors border border-emerald-400/30 text-xs font-semibold"
                    >
                      Open Client
                    </button>
                  )}
                  {selectedClientId && (
                    latestDrawerForm ? (
                      <button
                        onClick={() => openDrawerDealDetail(latestDrawerForm.dealId)}
                        className="px-3 py-2 rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 transition-colors border border-white/10 text-xs font-semibold"
                      >
                        Open Deal
                      </button>
                    ) : (
                      <button
                        onClick={startDrawerDeal}
                        className="px-3 py-2 rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 transition-colors border border-white/10 text-xs font-semibold"
                      >
                        Start Deal
                      </button>
                    )
                  )}
                  <LeadActionsMenu
                    leadName={`${selectedLead.firstName} ${selectedLead.lastName}`}
                    isArchived={(leadDetail?.tags || selectedLead.tags || []).includes(ARCHIVED_TAG)}
                    isConverted={Boolean(leadDetail?.converted ?? selectedLead.converted)}
                    hasClient={Boolean(leadDetail?.clientId || selectedLead.clientId || leadDetail?.client?.id || selectedLead.client?.id)}
                    onAddToMarketing={() => openMarketingCampaign(selectedLead)}
                    onAddTask={() => openLeadTask(selectedLead)}
                    onOpenClient={
                      leadDetail?.clientId || selectedLead.clientId || leadDetail?.client?.id || selectedLead.client?.id
                        ? () =>
                            navigate(
                              `/clients/${
                                leadDetail?.clientId ||
                                selectedLead.clientId ||
                                leadDetail?.client?.id ||
                                selectedLead.client!.id
                              }`,
                            )
                        : undefined
                    }
                    onConvert={() => handleConvertLead(selectedLead.id)}
                    onAddToDeal={() => openAddToDeal(selectedLead)}
                    onMerge={() => openMergeLead(selectedLead)}
                    onArchiveToggle={() => handleArchiveToggle()}
                    onDelete={() => handleDelete()}
                  />
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="text-slate-400 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <Icons.X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {leadDetailLoading || !detailDraft ? (
                  <div className="text-slate-300">Loading…</div>
                ) : (
                  <div className="space-y-5">
                    <div className="bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <div className="text-sm font-semibold text-white">Agent Snapshot</div>
                          <div className="text-xs text-slate-400">High-signal context without opening the full profile editor.</div>
                        </div>
                        {(leadDetail?.clientId || selectedLead.clientId || leadDetail?.client?.id || selectedLead.client?.id) && (
                          <span className="text-[10px] px-2 py-1 rounded-md border border-emerald-400/30 text-emerald-300">
                            Client linked
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <OverviewItem label="Priority" value={leadDetail?.priority || selectedLead.priority || '—'} />
                        <OverviewItem label="Source" value={prettyEnum(leadDetail?.source || selectedLead.source || '—')} />
                        <OverviewItem label="Visits" value={String(leadDetail?.visitCount ?? selectedLead.visitCount ?? 0)} />
                        <OverviewItem label="Homes viewed" value={String(leadDetail?.homesViewed ?? selectedLead.homesViewed ?? 0)} />
                        <OverviewItem
                          label="Last visit"
                          value={
                            leadDetail?.lastVisit || selectedLead.lastVisit
                              ? new Date(leadDetail?.lastVisit || selectedLead.lastVisit || '').toLocaleString()
                              : '—'
                          }
                        />
                        <OverviewItem
                          label="Client"
                          value={
                            leadDetail?.client
                              ? `${leadDetail.client.firstName} ${leadDetail.client.lastName}`
                              : selectedLead.client
                                ? `${selectedLead.client.firstName} ${selectedLead.client.lastName}`
                                : leadDetail?.clientId || selectedLead.clientId
                                  ? `Linked (${(leadDetail?.clientId || selectedLead.clientId || '').slice(0, 8)}…)`
                                  : 'Not linked'
                          }
                          onClick={selectedClientId ? openDrawerClient : undefined}
                          actionLabel={selectedClientId ? 'Open client' : undefined}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="text-sm font-semibold text-white">Next best step</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openLeadTask(selectedLead)}
                            className="px-3 py-2 rounded-xl bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 border border-blue-400/30 text-xs font-semibold"
                          >
                            + Add Task
                          </button>
                          {selectedLead.email && (
                            <button
                              type="button"
                              onClick={() => openLeadEmail(selectedLead)}
                              className="px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50 text-xs font-semibold text-slate-200"
                            >
                              Email
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-xs text-slate-400">Conversation brief</div>
                        {leadConversationBrief.hasRecentReply && (
                          <span className="text-[10px] px-2 py-1 rounded-md border border-emerald-400/30 text-emerald-300">
                            Fresh reply
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl border border-slate-800/40 bg-slate-950/20 p-2.5">
                          <div className="text-slate-500">Last touch</div>
                          <div className="text-slate-200 mt-1">
                            {leadConversationBrief.daysSinceTouch === null
                              ? 'Unknown'
                              : leadConversationBrief.daysSinceTouch === 0
                                ? 'Today'
                                : `${leadConversationBrief.daysSinceTouch}d ago`}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800/40 bg-slate-950/20 p-2.5">
                          <div className="text-slate-500">Latest activity</div>
                          <div className="text-slate-200 mt-1 truncate">{leadConversationBrief.lastActivityLabel}</div>
                        </div>
                        <div className="rounded-xl border border-slate-800/40 bg-slate-950/20 p-2.5">
                          <div className="text-slate-500">When</div>
                          <div className="text-slate-200 mt-1">
                            {leadConversationBrief.lastActivityAt
                              ? new Date(leadConversationBrief.lastActivityAt).toLocaleString()
                              : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-cyan-200">Next best step: {leadConversationBrief.nextStep}</div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                      <div className="text-sm font-semibold text-white mb-2">Create Note</div>
                      <div className="text-xs text-slate-400 mb-3">
                        Quick notes show up in Activity (call summaries, next steps, preferences).
                      </div>
                      <textarea
                        value={newLeadNote}
                        onChange={(e) => setNewLeadNote(e.target.value)}
                        rows={3}
                        placeholder="Add a note…"
                        className={inputClass}
                      />
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setNewLeadNote('')}
                          className="px-3 py-2 rounded-xl bg-slate-800/50 text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => void handleCreateLeadNote()}
                          disabled={creatingLeadNote || !newLeadNote.trim()}
                          className="px-3 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
                        >
                          {creatingLeadNote ? 'Saving…' : 'Create Note'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                      <div className="text-sm font-semibold text-white mb-3">Relationship context</div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">Next task</div>
                          <div className="text-slate-200 mt-1">{detailDraft.nextTask || 'No task set yet.'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">Tags</div>
                          <div className="text-slate-200 mt-1">{detailDraft.tags || 'No tags yet.'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">Profile notes</div>
                          <div className="text-slate-300 mt-1 whitespace-pre-line">{detailDraft.notes || 'No long-form notes yet.'}</div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{leadDetail?.clientId || leadDetail?.client?.id ? 'Converted to client' : detailDraft.converted ? 'Converted' : 'Not converted'}</span>
                          <span>{(leadDetail?.tags || []).includes(ARCHIVED_TAG) ? 'Archived' : 'Active'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      {selectedLead.phone ? (
                        <a
                          href={phoneToTelHref(selectedLead.phone) || undefined}
                          className="px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50"
                        >
                          Call {formatPhoneDisplay(selectedLead.phone)}
                        </a>
                      ) : (
                        <div className="px-3 py-2 rounded-xl bg-slate-900/40 border border-slate-800/30 text-slate-500">
                          No phone
                        </div>
                      )}
                      {selectedLead.email && (
                        <button
                          type="button"
                          onClick={() => openLeadEmail(selectedLead)}
                          className="px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50"
                        >
                          Email
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-sm font-semibold text-white">Forms</div>
                        <div className="text-xs text-slate-400">
                          Signed {((leadDetail?.forms || []).filter((f) => f.status === 'SIGNED')).length} · In progress {((leadDetail?.forms || []).filter((f) => ['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(f.status))).length}
                        </div>
                      </div>

                      {(leadDetail?.forms || []).length === 0 ? (
                        <div className="text-sm text-slate-400">No forms linked to this lead yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {(leadDetail?.forms || []).slice(0, 8).map((form) => (
                            <div key={`${form.kind}-${form.id}`} className="border border-slate-800/40 rounded-xl p-3 bg-slate-950/20">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm text-slate-100 truncate">{form.title}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {form.dealTitle}
                                    {form.propertyAddress ? ` · ${form.propertyAddress}` : ''}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                                    {form.sentAt && <span>Sent {new Date(form.sentAt).toLocaleDateString()}</span>}
                                    {form.signedAt && <span>Signed {new Date(form.signedAt).toLocaleDateString()}</span>}
                                    {form.signerSummary && <span>{form.signerSummary.signed}/{form.signerSummary.total} signed</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-1 text-[11px] rounded-md border ${formStatusClass(form.status)}`}>
                                    {formatFormStatus(form.status)}
                                  </span>
                                  {form.formCode && (
                                    <button
                                      type="button"
                                      onClick={() => openDrawerDealWorkspace(form.dealId, form.formCode)}
                                      className="px-2 py-1 text-[11px] rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30"
                                    >
                                      Form
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openDrawerDealDetail(form.dealId)}
                                    className="px-2 py-1 text-[11px] rounded-md bg-white/10 border border-white/10 text-slate-200 hover:bg-white/15"
                                  >
                                    Deal
                                  </button>
                                  {form.kind === 'ESIGN_ENVELOPE' && form.downloadUrl && (
                                    <a
                                      href={`/api${form.downloadUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-1 text-[11px] rounded-md bg-blue-500/20 border border-blue-400/40 text-blue-200 hover:bg-blue-500/30"
                                    >
                                      PDF
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/30 rounded-2xl p-4">
                      <div className="text-sm font-semibold text-white mb-3">Activity</div>
                      {(leadDetail?.activities || []).length === 0 ? (
                        <div className="text-sm text-slate-400">No activity yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {(leadDetail?.activities || []).slice(0, 8).map((a) => (
                            <div key={a.id} className="border border-slate-800/40 rounded-xl p-3 bg-slate-950/20">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-slate-400">{a.activityType}</div>
                                <div className="text-xs text-slate-500">
                                  {new Date(a.createdAt).toLocaleString()}
                                </div>
                              </div>
                              {a.description && (
                                <div className="text-sm text-slate-200 mt-1 whitespace-pre-line">{a.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-800/50 flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500">Use the full profile for deeper editing and lead intelligence.</div>
                <button
                  onClick={() => navigate(`/leads/${selectedLead.id}`)}
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  Open Full Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

const inputClass =
  'w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-2">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-800/50 rounded-[18px] p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent || 'text-white'}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">{label}</div>
      <div className="text-base font-bold text-white">{value}</div>
    </div>
  );
}

function OverviewItem({ label, value, onClick, actionLabel }: { label: string; value: React.ReactNode; onClick?: () => void; actionLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border border-slate-800/40 bg-slate-950/20 p-2.5 text-left ${onClick ? 'transition hover:border-cyan-400/40 hover:bg-slate-900/40' : 'cursor-default'}`}
    >
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200 mt-1 truncate" title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {actionLabel && <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">{actionLabel}</div>}
    </button>
  );
}

function prettyEnum(value: unknown) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFormStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formStatusClass(status: string) {
  if (status === 'SIGNED') return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
  if (status === 'PARTIALLY_SIGNED') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
  if (status === 'VIEWED') return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40';
  if (status === 'SENT') return 'bg-blue-500/20 text-blue-300 border-blue-400/40';
  if (status === 'DRAFT') return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
  return 'bg-purple-500/20 text-purple-300 border-purple-400/40';
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '').replace(/-/g, '');
}

function normalizeCsvField(row: any, candidates: string[]): string {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  for (const c of candidates) {
    if (c in row) {
      const raw = row[c];
      return raw == null ? '' : String(raw).trim();
    }
    const match = keys.find((k) => normalizeKey(k) === normalizeKey(c));
    if (match) {
      const raw = row[match];
      return raw == null ? '' : String(raw).trim();
    }
  }
  return '';
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mapLeadSource(raw: string): LeadSource | null {
  if (!raw) return null;
  const t = normalizeToken(raw);
  if (!t) return null;
  const asKey = t.toUpperCase();
  if ((LeadSource as any)[asKey]) return (LeadSource as any)[asKey] as LeadSource;
  const aliases: Record<string, LeadSource> = {
    website: LeadSource.WEBSITE,
    web: LeadSource.WEBSITE,
    landing_page: LeadSource.LANDING_PAGE,
    landingpage: LeadSource.LANDING_PAGE,
    zillow: LeadSource.ZILLOW,
    realtor_com: LeadSource.REALTOR_COM,
    realtor: LeadSource.REALTOR_COM,
    facebook: LeadSource.FACEBOOK,
    fb: LeadSource.FACEBOOK,
    instagram: LeadSource.INSTAGRAM,
    ig: LeadSource.INSTAGRAM,
    google_ads: LeadSource.GOOGLE_ADS,
    google: LeadSource.GOOGLE_ADS,
    email: LeadSource.EMAIL,
    direct: LeadSource.DIRECT,
    referral: LeadSource.REFERRAL,
    referred: LeadSource.REFERRAL,
    other: LeadSource.OTHER,
  };
  return aliases[t] || null;
}

function mapLeadPriority(raw: string): LeadPriority | null {
  if (!raw) return null;
  const t = normalizeToken(raw);
  if (!t) return null;
  const asKey = t.toUpperCase();
  if ((LeadPriority as any)[asKey]) return (LeadPriority as any)[asKey] as LeadPriority;
  const aliases: Record<string, LeadPriority> = {
    hot: LeadPriority.HOT,
    warm: LeadPriority.WARM,
    cold: LeadPriority.COLD,
    dead: LeadPriority.DEAD,
    junk: LeadPriority.DEAD,
    lost: LeadPriority.DEAD,
  };
  return aliases[t] || null;
}

function downloadSampleCsv() {
  const csv =
    'firstName,lastName,email,phone,source,priority,notes,tags\n' +
    'Jane,Doe,jane@example.com,8015550101,WEBSITE,WARM,Looking to buy soon,"buyer;preapproved"\n' +
    'John,Smith,john@example.com,8015550102,REFERRAL,HOT,Referral from Bob,"vip"\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leads-sample.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const Icons = {
  X: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  Search: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
    </svg>
  ),
  Filter: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
    </svg>
  ),
  Users: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Archive: (props: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 12h4" />
    </svg>
  ),
};
