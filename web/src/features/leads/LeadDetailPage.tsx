import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { leadsApi } from '../../lib/leadsApi';
import { formatPhoneDisplay, phoneToTelHref } from '../../lib/phone';
import { LeadPriority, LeadSource } from '../../types/leads';
import { NewTaskModal } from '../tasks/NewTaskModal';
import { ContactEmailModal } from '../../components/communications/ContactEmailModal';
import { MarketingCampaignModal } from '../marketing/MarketingCampaignModal';

type LeadDetail = any;

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

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newNote, setNewNote] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showMarketing, setShowMarketing] = useState(false);
  const [taskDefaultTitle, setTaskDefaultTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadLead = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await leadsApi.getLead(id);
      const next = res.data as LeadDetail;
      setDetail(next);
      setDraft({
        firstName: next.firstName || '',
        lastName: next.lastName || '',
        email: next.email || '',
        phone: next.phone || '',
        source: (next.source || LeadSource.WEBSITE) as LeadSource,
        priority: (next.priority || LeadPriority.WARM) as LeadPriority,
        nextTask: next.nextTask || '',
        notes: next.notes || '',
        tags: Array.isArray(next.tags) ? next.tags.join(', ') : '',
        converted: Boolean(next.converted),
      });
    } catch (e) {
      console.error('Failed to load lead detail:', e);
      setError('Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLead();
  }, [id]);

  const conversationBrief = useMemo(() => {
    const activities = (detail?.activities || []).slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = activities[0];
    const hasRecentReply = activities.some((item: any) => String(item.activityType || '').toUpperCase().includes('REPLY'));
    const daysSinceTouch = latest?.createdAt
      ? Math.max(0, Math.floor((Date.now() - new Date(latest.createdAt).getTime()) / 86400000))
      : null;

    let nextStep = 'Create one clear next step and assign a due date today.';
    if (hasRecentReply) nextStep = 'Reply now and lock in a concrete call time.';
    else if ((daysSinceTouch ?? 0) >= 7) nextStep = 'Send re-engagement outreach with two proposed time slots.';
    else if ((detail?.visitCount ?? 0) >= 3) nextStep = 'Reference the homes they viewed and propose two matching options.';

    return {
      hasRecentReply,
      daysSinceTouch,
      lastActivityLabel: latest?.description || latest?.activityType || 'No activity yet',
      lastActivityAt: latest?.createdAt || null,
      nextStep,
    };
  }, [detail]);

  const leadInsights = useMemo(() => {
    const activities = (detail?.activities || []) as Array<any>;
    const pageViews = (detail?.pageViews || []) as Array<any>;
    const forms = (detail?.forms || []) as Array<any>;
    const latestView = pageViews[0] || null;
    const latestForm = forms[0] || null;
    const signedForms = forms.filter((item) => item.status === 'SIGNED').length;
    const activeForms = forms.filter((item) => ['SENT', 'VIEWED', 'PARTIALLY_SIGNED'].includes(item.status)).length;
    const noteCount = activities.filter((item) => String(item.activityType || '').toUpperCase() === 'NOTE').length;
    const outreachCount = activities.filter((item) => ['CALL', 'EMAIL', 'SMS'].includes(String(item.activityType || '').toUpperCase())).length;

    let momentumLabel = 'Needs a push';
    if (conversationBrief.hasRecentReply) momentumLabel = 'Active conversation';
    else if ((conversationBrief.daysSinceTouch ?? 999) <= 2) momentumLabel = 'Recently engaged';
    else if (pageViews.length >= 3 || Number(detail?.visitCount || 0) >= 3) momentumLabel = 'Researching seriously';

    let relationshipLabel = 'New lead';
    if (detail?.clientId || detail?.client?.id) relationshipLabel = 'Client linked';
    else if (detail?.converted) relationshipLabel = 'Converted';
    else if (noteCount >= 3 || outreachCount >= 3) relationshipLabel = 'Worked lead';

    return {
      latestView,
      latestForm,
      signedForms,
      activeForms,
      noteCount,
      outreachCount,
      momentumLabel,
      relationshipLabel,
      totalPageViews: pageViews.length,
      recentActivities: activities.slice(0, 12),
      recentPageViews: pageViews.slice(0, 6),
      recentForms: forms.slice(0, 8),
    };
  }, [conversationBrief.daysSinceTouch, conversationBrief.hasRecentReply, detail]);

  const saveLead = async () => {
    if (!id || !draft) return;
    try {
      setSaving(true);
      setError(null);
      const tags = draft.tags
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
      const res = await leadsApi.updateLead(id, {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
        source: draft.source,
        priority: draft.priority,
        nextTask: draft.nextTask.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        tags,
        converted: draft.converted,
      });
      setDetail((prev: any) => ({ ...(prev || {}), ...(res.data as any) }));
    } catch (e) {
      console.error('Failed to save lead:', e);
      setError('Failed to save lead changes.');
    } finally {
      setSaving(false);
    }
  };

  const createNote = async () => {
    if (!id || !newNote.trim()) return;
    try {
      setCreatingNote(true);
      await leadsApi.createActivity(id, { type: 'NOTE', description: newNote.trim() });
      setNewNote('');
      await loadLead();
    } catch (e) {
      console.error('Failed to create lead note:', e);
      setError('Failed to create note.');
    } finally {
      setCreatingNote(false);
    }
  };

  const openTask = () => {
    if (!detail) return;
    setTaskDefaultTitle(`Follow up: ${detail.firstName} ${detail.lastName}`.trim());
    setShowNewTask(true);
  };

  const convertLead = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const res = await leadsApi.convertLead(id);
      if (res.data.client?.id) {
        navigate(`/clients/${res.data.client.id}`);
        return;
      }
      await loadLead();
    } catch (e) {
      console.error('Failed to convert lead:', e);
      setError('Failed to convert lead to client.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading lead profile...</div>;
  if (!detail || !draft) return <div className="p-8 text-slate-400">Lead not found.</div>;

  const telHref = phoneToTelHref(detail.phone);
  const smsHref = phoneToSmsHref(detail.phone);
  const openClientId = detail.clientId || detail.client?.id || null;
  const openListingId = detail.listingId || detail.listing?.id || null;
  const openRecentDealId = leadInsights.latestForm?.dealId || null;

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openLinkedClient = () => {
    if (openClientId) navigate(`/clients/${openClientId}`);
  };

  const openLinkedListing = () => {
    if (openListingId) navigate(`/listings?id=${openListingId}`);
  };

  const openDealDetail = (dealId: string) => {
    navigate(`/deals/${dealId}/detail`);
  };

  const openDealWorkspace = (dealId: string, formCode?: string | null) => {
    if (formCode) {
      navigate(`/deals/${dealId}/forms/${encodeURIComponent(formCode)}`);
      return;
    }

    openDealDetail(dealId);
  };

  const startDealForClient = () => {
    if (openClientId) navigate(`/deals/new?clientId=${openClientId}`);
  };

  const openRecentDeal = () => {
    if (openRecentDealId) openDealDetail(openRecentDealId);
  };

  return (
    <div className="space-y-7 pb-10">
      <div className="relative overflow-hidden rounded-[34px] border border-indigo-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.92))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(8,145,178,0.22),_transparent_28%),linear-gradient(135deg,_rgba(3,11,26,0.96),_rgba(6,22,47,0.92))] dark:shadow-[0_30px_90px_rgba(1,8,20,0.72)] sm:p-8">
        <div className="pointer-events-none absolute -top-16 right-10 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-400/18" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl dark:bg-blue-500/18" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <span>Lead Command Center</span>
              <span className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-[10px] tracking-[0.2em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {leadInsights.relationshipLabel}
              </span>
              <span className="rounded-full border border-cyan-300/70 bg-cyan-500/10 px-3 py-1 text-[10px] tracking-[0.2em] text-cyan-700 dark:border-cyan-400/30 dark:text-cyan-200">
                {leadInsights.momentumLabel}
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || 'Lead Profile'}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span>{detail.email || 'No email on file'}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>{detail.phone ? formatPhoneDisplay(detail.phone) : 'No phone'}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>{prettyEnum(detail.source || 'Unknown')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <HeroPill label="Priority" value={detail.priority || '—'} onClick={() => scrollToSection('profile-details')} actionLabel="Edit profile" />
              <HeroPill label="Last Touch" value={formatTouchWindow(conversationBrief.daysSinceTouch)} onClick={() => scrollToSection('timeline-notes')} actionLabel="View timeline" />
              <HeroPill
                label="Paperwork"
                value={leadInsights.activeForms > 0 ? `${leadInsights.activeForms} active` : leadInsights.signedForms > 0 ? `${leadInsights.signedForms} signed` : 'No forms'}
                onClick={() => scrollToSection('forms-readiness')}
                actionLabel="Open forms"
              />
            </div>
          </div>

          <div className="flex max-w-xl flex-wrap items-center justify-start gap-2 xl:justify-end">
            <Button variant="secondary" onClick={() => navigate('/leads')}>Back to Leads</Button>
            {telHref && <a href={telHref} className={actionLinkClass}>Call</a>}
            {smsHref && <a href={smsHref} className={actionLinkClass}>Text</a>}
            {detail.email && <Button variant="outline" onClick={() => setShowEmail(true)}>Email</Button>}
            <Button variant="outline" onClick={openTask}>Add Task</Button>
            <Button variant="outline" onClick={() => setShowMarketing(true)}>Marketing</Button>
            {detail.clientId || detail.client?.id ? (
              <>
                <Button variant="secondary" onClick={() => navigate(`/clients/${detail.clientId || detail.client.id}`)}>Open Client</Button>
                {openRecentDealId ? (
                  <Button variant="outline" onClick={openRecentDeal}>Open Deal</Button>
                ) : (
                  <Button variant="outline" onClick={startDealForClient}>Start Deal</Button>
                )}
              </>
            ) : (
              <Button onClick={() => void convertLead()} disabled={saving}>Convert to Client</Button>
            )}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <SignalPanel
            title="Next best move"
            value={conversationBrief.nextStep}
            caption={conversationBrief.lastActivityAt ? `Latest touch ${new Date(conversationBrief.lastActivityAt).toLocaleString()}` : 'No activity history yet'}
            onClick={openTask}
            actionLabel="Create task"
          />
          <SignalPanel
            title="Engagement pulse"
            value={leadInsights.momentumLabel}
            caption={`${leadInsights.totalPageViews} recent page signals · ${leadInsights.outreachCount} outreach events`}
            onClick={() => scrollToSection('behavior-intelligence')}
            actionLabel="See behavior"
          />
          <SignalPanel
            title="Relationship"
            value={leadInsights.relationshipLabel}
            caption={detail.client?.id ? `Client linked to ${detail.client.firstName} ${detail.client.lastName}` : detail.nextTask || 'No current next task set'}
            onClick={openClientId ? openLinkedClient : () => scrollToSection('relationship-snapshot')}
            actionLabel={openClientId ? 'Open client' : 'See snapshot'}
          />
          <SignalPanel
            title="Current paperwork"
            value={leadInsights.latestForm ? formatFormStatus(leadInsights.latestForm.status) : 'No active forms'}
            caption={leadInsights.latestForm ? leadInsights.latestForm.title : 'Nothing in motion yet'}
            onClick={leadInsights.latestForm ? () => openDealWorkspace(leadInsights.latestForm.dealId, leadInsights.latestForm.formCode) : () => scrollToSection('forms-readiness')}
            actionLabel={leadInsights.latestForm ? (leadInsights.latestForm.formCode ? 'Open form' : 'Open deal') : 'Open forms'}
          />
        </div>
      </div>

      {error && (
        <Card className="border-red-400/30">
          <div className="text-sm text-red-300">{error}</div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card title="Agent Playbook" description="What matters right now and the clearest next move for this lead.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PlaybookCard
              label="Respond window"
              value={conversationBrief.hasRecentReply ? 'Now' : formatTouchWindow(conversationBrief.daysSinceTouch)}
              detail={conversationBrief.hasRecentReply ? 'A fresh reply is waiting for momentum.' : 'Use this to decide urgency today.'}
              onClick={openTask}
              actionLabel="Create task"
            />
            <PlaybookCard
              label="Latest activity"
              value={conversationBrief.lastActivityLabel}
              detail={conversationBrief.lastActivityAt ? new Date(conversationBrief.lastActivityAt).toLocaleString() : 'No recorded activity yet'}
              onClick={() => scrollToSection('timeline-notes')}
              actionLabel="Open timeline"
            />
            <PlaybookCard
              label="Browsing signal"
              value={leadInsights.latestView ? formatPageViewHeadline(leadInsights.latestView) : 'No recent page view'}
              detail={leadInsights.latestView ? new Date(leadInsights.latestView.createdAt).toLocaleString() : 'No visible web activity'}
              onClick={() => scrollToSection('behavior-intelligence')}
              actionLabel="See signals"
            />
          </div>

          <div className="mt-5 rounded-[24px] border border-cyan-300/40 bg-cyan-500/8 p-5 dark:border-cyan-400/20 dark:bg-cyan-400/10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-200">Recommended action</div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{conversationBrief.nextStep}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={openTask}>Create follow-up task</Button>
              {detail.email && <Button size="sm" variant="secondary" onClick={() => setShowEmail(true)}>Send email</Button>}
              {smsHref && <a href={smsHref} className={smallActionLinkClass}>Send text</a>}
            </div>
          </div>
        </Card>

        <div id="relationship-snapshot">
        <Card title="Relationship Snapshot" description="A fast read on this contact before you reach out.">
          <div className="space-y-3">
            <SnapshotRow label="Next task" value={detail.nextTask || 'No task committed yet'} onClick={openTask} actionLabel="Create task" />
            <SnapshotRow label="Tags" value={renderTagSummary(detail.tags)} onClick={() => scrollToSection('profile-details')} actionLabel="Edit tags" />
            <SnapshotRow label="Client status" value={detail.clientId || detail.client?.id ? 'Linked client' : detail.converted ? 'Converted lead' : 'Open lead'} onClick={openClientId ? openLinkedClient : () => void convertLead()} actionLabel={openClientId ? 'Open client' : 'Convert'} />
            <SnapshotRow label="Activity logged" value={`${leadInsights.noteCount} notes · ${leadInsights.outreachCount} outreach events`} onClick={() => scrollToSection('timeline-notes')} actionLabel="View activity" />
            <SnapshotRow label="Web interest" value={`${detail.visitCount ?? 0} visits · ${detail.homesViewed ?? 0} homes viewed`} onClick={() => scrollToSection('behavior-intelligence')} actionLabel="Open signals" />
          </div>
        </Card>
        </div>
      </div>

      <div id="lead-overview">
      <Card title="Lead Overview" description="The operating facts agents need at a glance.">
        <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <OverviewItem label="Priority" value={detail.priority || '—'} onClick={() => scrollToSection('profile-details')} actionLabel="Edit" />
          <OverviewItem label="Source" value={prettyEnum(detail.source || '—')} onClick={() => scrollToSection('profile-details')} actionLabel="Edit" />
          <OverviewItem label="Momentum" value={leadInsights.momentumLabel} onClick={() => scrollToSection('behavior-intelligence')} actionLabel="Signals" />
          <OverviewItem label="Converted" value={detail.clientId || detail.client?.id ? 'Yes (client linked)' : detail.converted ? 'Yes' : 'No'} onClick={openClientId ? openLinkedClient : () => void convertLead()} actionLabel={openClientId ? 'Open client' : 'Convert'} />
          <OverviewItem label="Visits" value={String(detail.visitCount ?? 0)} onClick={() => scrollToSection('behavior-intelligence')} actionLabel="View" />
          <OverviewItem label="Homes viewed" value={String(detail.homesViewed ?? 0)} onClick={() => scrollToSection('behavior-intelligence')} actionLabel="View" />
          <OverviewItem label="Average price" value={detail.averagePrice ? `$${Number(detail.averagePrice).toLocaleString()}` : '—'} />
          <OverviewItem label="Last visit" value={detail.lastVisit ? new Date(detail.lastVisit).toLocaleString() : '—'} onClick={() => scrollToSection('behavior-intelligence')} actionLabel="Open" />
          <OverviewItem label="Created" value={detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'} />
          <OverviewItem label="Updated" value={detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : '—'} />
          <OverviewItem
            label="Client"
            value={detail.client?.firstName ? `${detail.client.firstName} ${detail.client.lastName || ''}`.trim() : detail.clientId ? `Linked (${detail.clientId.slice(0, 8)}…)` : 'Not linked'}
            onClick={openClientId ? openLinkedClient : undefined}
            actionLabel={openClientId ? 'Open' : undefined}
          />
          <OverviewItem
            label="Listing"
            value={detail.listing?.addressLine1 || detail.listingId ? detail.listing?.addressLine1 || `Linked (${detail.listingId.slice(0, 8)}…)` : 'Not linked'}
            onClick={openListingId ? openLinkedListing : undefined}
            actionLabel={openListingId ? 'Open' : undefined}
          />
          <OverviewItem
            label="Landing page"
            value={detail.landingPage?.title || detail.landingPageId ? detail.landingPage?.title || `Linked (${detail.landingPageId.slice(0, 8)}…)` : 'Not linked'}
            onClick={() => scrollToSection('behavior-intelligence')}
            actionLabel={detail.landingPage?.title || detail.landingPageId ? 'Signals' : undefined}
          />
        </div>
      </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div id="timeline-notes">
        <Card title="Timeline and Notes" description="Recent touches, call notes, email replies, and action context in one place.">
          <div className="rounded-[24px] border border-slate-200/70 bg-slate-100/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Add timeline note</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use this for call summaries, objections, preferences, and next steps.</div>
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={4} placeholder="Add a note…" className={`${inputClass} mt-3`} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNewNote('')}>Clear</Button>
              <Button onClick={() => void createNote()} disabled={!newNote.trim() || creatingNote}>
                {creatingNote ? 'Saving…' : 'Create Note'}
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {leadInsights.recentActivities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No activity yet. Add the first note after your next call or email.
              </div>
            ) : (
              leadInsights.recentActivities.map((activity: any, index: number) => (
                <div key={activity.id} className="relative rounded-[22px] border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  {index !== leadInsights.recentActivities.length - 1 && <div className="absolute left-6 top-full h-4 w-px bg-slate-300 dark:bg-white/10" />}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {prettyEnum(activity.activityType || 'Activity')}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {activity.description || 'No description provided'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(activity.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        </div>

        <div id="profile-details">
        <Card title="Profile Details" description="Clean contact data, assignment context, and persistent relationship notes.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name">
              <input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Last name">
              <input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email">
                <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <Field label="Phone">
              <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Priority">
              <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as LeadPriority })} className={inputClass}>
                {Object.values(LeadPriority).map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Source">
                <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as LeadSource })} className={inputClass}>
                  {Object.values(LeadSource).map((source) => (
                    <option key={source} value={source}>{prettyEnum(source)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Next task">
                <input value={draft.nextTask} onChange={(e) => setDraft({ ...draft, nextTask: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Tags (comma-separated)">
                <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Profile notes (long-form)">
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={5} className={inputClass} />
              </Field>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Durable relationship context belongs here. Timeline-specific updates belong in the note composer.
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={() => void saveLead()} disabled={saving}>{saving ? 'Saving…' : 'Save Lead'}</Button>
            </div>
          </div>
        </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <div id="forms-readiness">
        <Card title="Forms and Deal Readiness" description={`Signed ${leadInsights.signedForms} · In progress ${leadInsights.activeForms}`}>
          {leadInsights.recentForms.length === 0 ? (
            <div className="text-sm text-slate-400">No forms linked to this lead yet.</div>
          ) : (
            <div className="space-y-2">
              {leadInsights.recentForms.map((form: any) => (
                <div key={`${form.kind}-${form.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100 truncate">{form.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {form.dealTitle}
                        {form.propertyAddress ? ` · ${form.propertyAddress}` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {form.sentAt && <span>Sent {new Date(form.sentAt).toLocaleDateString()}</span>}
                        {form.signedAt && <span>Signed {new Date(form.signedAt).toLocaleDateString()}</span>}
                        {form.signerSummary && <span>{form.signerSummary.signed}/{form.signerSummary.total} signed</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 text-[11px] rounded-md border ${formStatusClass(form.status)}`}>
                        {formatFormStatus(form.status)}
                      </span>
                      {form.formCode && (
                        <button type="button" onClick={() => openDealWorkspace(form.dealId, form.formCode)} className="text-xs text-cyan-200 hover:text-cyan-100">
                          Open Form
                        </button>
                      )}
                      <button type="button" onClick={() => openDealDetail(form.dealId)} className="text-xs text-slate-300 hover:text-white">
                        Open Deal
                      </button>
                      {form.downloadUrl && (
                        <a href={`/api${form.downloadUrl}`} target="_blank" rel="noreferrer" className="text-xs text-cyan-200 hover:text-cyan-100">
                          Open PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>

        <div id="behavior-intelligence">
        <Card title="Behavior and Lead Intelligence" description="Show the digital signals behind what this lead is doing, not just what they told you.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OverviewItem label="Recent page views" value={String(leadInsights.totalPageViews)} onClick={() => scrollToSection('behavior-intelligence')} actionLabel="Review" />
            <OverviewItem label="Last page signal" value={leadInsights.latestView ? formatPageViewHeadline(leadInsights.latestView) : 'No signal'} onClick={() => scrollToSection('behavior-intelligence')} actionLabel={leadInsights.latestView ? 'Open' : undefined} />
            <OverviewItem label="Landing page" value={detail.landingPage?.title || 'No landing page linked'} onClick={() => scrollToSection('behavior-intelligence')} actionLabel={detail.landingPage?.title ? 'Signals' : undefined} />
            <OverviewItem label="Listing interest" value={detail.listing?.addressLine1 || 'No listing linked'} onClick={openListingId ? openLinkedListing : undefined} actionLabel={openListingId ? 'Open listing' : undefined} />
          </div>

          <div className="mt-5 space-y-2">
            {leadInsights.recentPageViews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/70 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No recent page view history is attached to this lead yet.
              </div>
            ) : (
              leadInsights.recentPageViews.map((view: any) => (
                <div key={view.id} className="rounded-2xl border border-slate-200/70 bg-slate-100/75 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{formatPageViewHeadline(view)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {view.city || view.region || view.country ? [view.city, view.region, view.country].filter(Boolean).join(', ') : 'Location unavailable'}
                        {view.device || view.browser ? ` · ${[view.device, view.browser].filter(Boolean).join(' / ')}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(view.createdAt).toLocaleString()}</div>
                      {openListingId && (
                        <button type="button" onClick={openLinkedListing} className="text-xs text-cyan-700 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100">
                          Open listing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        </div>
      </div>

      {showNewTask && (
        <NewTaskModal
          defaultClientId={detail.clientId || detail.client?.id || undefined}
          defaultCategory="CALL"
          defaultTitle={taskDefaultTitle}
          onClose={() => setShowNewTask(false)}
          onComplete={() => setShowNewTask(false)}
        />
      )}

      {showEmail && detail.email && (
        <ContactEmailModal
          open={showEmail}
          contactType="lead"
          contactId={detail.id}
          contactName={`${detail.firstName || ''} ${detail.lastName || ''}`.trim()}
          contactEmail={detail.email}
          onClose={() => setShowEmail(false)}
          onSent={() => {
            setShowEmail(false);
            void loadLead();
          }}
        />
      )}

      {showMarketing && (
        <MarketingCampaignModal
          targetType="lead"
          targetName={`${detail.firstName || ''} ${detail.lastName || ''}`.trim()}
          targetEmail={detail.email || ''}
          leadId={detail.id}
          clientId={detail.clientId || detail.client?.id || null}
          onClose={() => setShowMarketing(false)}
          onOpenMarketing={() => {
            setShowMarketing(false);
            navigate('/marketing');
          }}
          onComplete={() => {
            void loadLead();
          }}
        />
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder-slate-500';

const actionLinkClass =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 ae-motion-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#040b18] border-2 border-slate-300 bg-transparent text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:translate-y-[-1px] text-sm px-5 py-2.5 dark:border-white/30 dark:text-slate-100 dark:hover:border-white/60 dark:hover:bg-white/5';

const smallActionLinkClass =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 ae-motion-button border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-[0_10px_30px_rgba(15,23,42,0.12)] hover:shadow-[0_15px_40px_rgba(15,23,42,0.18)] hover:translate-y-[-1px] text-xs px-3 py-2 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:border-white/40';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-2">{label}</label>
      {children}
    </div>
  );
}

function OverviewItem({ label, value, onClick, actionLabel }: { label: string; value: React.ReactNode; onClick?: () => void; actionLabel?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`rounded-xl border border-slate-200/70 bg-slate-100/80 p-2.5 text-left dark:border-white/10 dark:bg-white/5 ${onClick ? 'transition hover:border-blue-400/50 hover:bg-white dark:hover:bg-white/10' : 'cursor-default'}`}>
      <div className="text-slate-500 dark:text-slate-500">{label}</div>
      <div className="text-slate-900 dark:text-slate-200 mt-1 truncate" title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {actionLabel && <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">{actionLabel}</div>}
    </button>
  );
}

function HeroPill({ label, value, onClick, actionLabel }: { label: string; value: React.ReactNode; onClick?: () => void; actionLabel?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-left backdrop-blur-xl dark:border-white/10 dark:bg-white/5 ${onClick ? 'transition hover:border-blue-400/50 hover:bg-white dark:hover:bg-white/10' : 'cursor-default'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {actionLabel && <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">{actionLabel}</div>}
    </button>
  );
}

function SignalPanel({ title, value, caption, onClick, actionLabel }: { title: string; value: React.ReactNode; caption: React.ReactNode; onClick?: () => void; actionLabel?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`rounded-[24px] border border-slate-200/70 bg-white/70 p-4 text-left backdrop-blur-xl dark:border-white/10 dark:bg-white/5 ${onClick ? 'transition hover:border-blue-400/50 hover:bg-white dark:hover:bg-white/10' : 'cursor-default'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{caption}</div>
      {actionLabel && <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">{actionLabel}</div>}
    </button>
  );
}

function PlaybookCard({ label, value, detail, onClick, actionLabel }: { label: string; value: React.ReactNode; detail: React.ReactNode; onClick?: () => void; actionLabel?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`rounded-[22px] border border-slate-200/70 bg-slate-100/80 p-4 text-left dark:border-white/10 dark:bg-white/5 ${onClick ? 'transition hover:border-blue-400/50 hover:bg-white dark:hover:bg-white/10' : 'cursor-default'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{detail}</div>
      {actionLabel && <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">{actionLabel}</div>}
    </button>
  );
}

function SnapshotRow({ label, value, onClick, actionLabel }: { label: string; value: React.ReactNode; onClick?: () => void; actionLabel?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-100/70 px-4 py-3 text-left dark:border-white/10 dark:bg-white/5 ${onClick ? 'transition hover:border-blue-400/50 hover:bg-white dark:hover:bg-white/10' : 'cursor-default'}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="max-w-[70%] text-right">
        <div className="text-sm font-medium text-slate-900 dark:text-white">{value}</div>
        {actionLabel && <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">{actionLabel}</div>}
      </div>
    </button>
  );
}

function prettyEnum(value: unknown) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFormStatus(status: string) {
  return String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTouchWindow(daysSinceTouch: number | null) {
  if (daysSinceTouch === null) return 'Unknown';
  if (daysSinceTouch === 0) return 'Today';
  if (daysSinceTouch === 1) return '1 day ago';
  return `${daysSinceTouch} days ago`;
}

function formatPageViewHeadline(view: any) {
  if (!view) return 'No page view';
  if (view.utmCampaign) return `Campaign: ${view.utmCampaign}`;
  if (view.utmSource) return `Source: ${view.utmSource}`;
  if (view.referrer) return `Referrer: ${view.referrer}`;
  if (view.listingId) return 'Viewed linked listing';
  if (view.landingPageId) return 'Viewed linked landing page';
  return 'Viewed property content';
}

function renderTagSummary(tags: string[] | undefined) {
  if (!tags || tags.length === 0) return 'No tags yet';
  return tags.slice(0, 4).join(' · ');
}

function formStatusClass(status: string) {
  if (status === 'SIGNED') return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
  if (status === 'PARTIALLY_SIGNED') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
  if (status === 'VIEWED') return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40';
  if (status === 'SENT') return 'bg-blue-500/20 text-blue-300 border-blue-400/40';
  if (status === 'DRAFT') return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
  return 'bg-purple-500/20 text-purple-300 border-purple-400/40';
}
