import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Phone, Mail, MessageSquare, StickyNote, Eye, Calendar, Sparkles } from 'lucide-react';
import api from '../../lib/api';

interface Activity {
  id: string;
  activityType: string;
  description?: string;
  createdAt: string;
  metadata?: any;
}

interface UnifiedActivityTimelineProps {
  leadId: string;
  activities: Activity[];
  onActivityCreated: () => void;
}

type TabType = 'NOTE' | 'CALL' | 'EMAIL' | 'TEXT';

export function UnifiedActivityTimeline({ leadId, activities, onActivityCreated }: UnifiedActivityTimelineProps) {
  const [activeTab, setActiveTab] = useState<TabType>('NOTE');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tabs: { type: TabType; label: string; icon: React.ReactNode }[] = [
    { type: 'NOTE', label: 'Note', icon: <StickyNote className="w-4 h-4" /> },
    { type: 'CALL', label: 'Log Call', icon: <Phone className="w-4 h-4" /> },
    { type: 'EMAIL', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { type: 'TEXT', label: 'Text', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/leads/${leadId}/activities`, {
        activityType: activeTab,
        description: content,
      });
      setContent('');
      onActivityCreated();
    } catch (err) {
      console.error('Failed to create activity:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityConfig = (type: string) => {
    switch (type.toUpperCase()) {
      case 'CALL':
        return { icon: <Phone className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'EMAIL':
        return { icon: <Mail className="w-4 h-4 text-blue-500" />, bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'TEXT':
      case 'SMS':
        return { icon: <MessageSquare className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      case 'VIEW':
      case 'PROPERTY_VIEW':
        return { icon: <Eye className="w-4 h-4 text-pink-500" />, bg: 'bg-pink-500/10', border: 'border-pink-500/20' };
      case 'NOTE':
      default:
        return { icon: <StickyNote className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    }
  };

  return (
    <Card title="Activity Timeline" description="Unified feed of every touchpoint, call, text, email, and property view.">
      {/* Quick Action Bar (FUB Style) */}
      <div className="rounded-[24px] border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/50 mb-6 overflow-hidden">
        <div className="flex border-b border-slate-200/70 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.type
                  ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder={`Add a ${tabs.find((t) => t.type === activeTab)?.label.toLowerCase()}...`}
            className="w-full bg-transparent border-0 focus:ring-0 text-sm text-slate-900 dark:text-white placeholder-slate-400 resize-none p-2"
          />
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-3">
            <div className="flex gap-2">
              <button disabled className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" title="AI Summary Overlay (Coming Soon)"><Sparkles className="w-4 h-4" /></button>
              <button disabled className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" title="Schedule Follow-up"><Calendar className="w-4 h-4" /></button>
            </div>
            <Button onClick={handleSubmit} disabled={!content.trim() || submitting}>
              {submitting ? 'Saving...' : 'Save Activity'}
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="pl-4 space-y-6">
        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/70 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
              <StickyNote className="w-6 h-6 text-slate-300 dark:text-slate-600" />
            </div>
            No activity yet. Every interaction will be logged here automatically.
          </div>
        ) : (
          activities.map((activity, index) => {
            const config = getActivityConfig(activity.activityType);
            const isLast = index === activities.length - 1;
            
            return (
              <div key={activity.id} className="relative flex gap-4 pr-2">
                {/* Timeline Line */}
                {!isLast && (
                  <div className="absolute left-[19px] top-10 bottom-[-24px] w-px bg-slate-200 dark:bg-white/10" />
                )}
                
                {/* Icon Circle */}
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${config.bg} ${config.border}`}>
                  {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {activity.activityType.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(activity.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                    {activity.description || 'Action logged without notes.'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
