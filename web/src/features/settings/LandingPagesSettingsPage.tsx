import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { Card } from '../../components/ui/Card';

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  totalViews: number;
  leadsGenerated: number;
  createdAt: string;
  templateId?: string;
  listing?: {
    addressLine1: string;
    price: number;
    photos?: string[];
  };
}

// Theme preview images map
const themeImages: Record<string, string> = {
  'modern-luxury': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
  'warm-earth': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
  'minimal-white': 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80',
  'bold-contrast': 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=400&q=80',
  'elegant-serif': 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=400&q=80',
  'coastal-breeze': 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80',
  'urban-edge': 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80',
  'garden-retreat': 'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=400&q=80',
};

const getPagePreviewImage = (page: LandingPage): string | null => {
  // Priority: listing photo > theme image > null
  if (page.listing?.photos?.[0]) {
    return page.listing.photos[0];
  }
  if (page.templateId && themeImages[page.templateId]) {
    return themeImages[page.templateId];
  }
  return themeImages['modern-luxury']; // Default fallback
};

export function LandingPagesSettingsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const authToken = token || localStorage.getItem('utahcontracts_token') || '';
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (pageId: string, pageTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${pageTitle}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/landing-pages/${pageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (res.ok) {
        showToast('success', 'Landing page deleted successfully.');
        fetchPages();
      } else {
        showToast('error', 'Failed to delete landing page.');
      }
    } catch (error) {
      console.error('Failed to delete page', error);
      showToast('error', 'Failed to delete landing page.');
    }
  };

  const fetchPages = async () => {
    try {
      const res = await fetch('/api/landing-pages', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data);
      }
    } catch (error) {
      console.error('Failed to fetch landing pages', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !pageTitle || !pageSlug) return;

    try {
      const res = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: pageTitle,
          slug: pageSlug,
          templateId: selectedTemplate,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchPages();
        setPageTitle('');
        setPageSlug('');
        setSelectedTemplate(null);
        showToast('success', 'Landing page created successfully!');
      } else {
        showToast('error', 'Failed to create landing page.');
      }
    } catch (error) {
      console.error('Failed to create page', error);
      showToast('error', 'Failed to create landing page.');
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/sites/${slug}`;
    navigator.clipboard.writeText(url);
    showToast('success', 'Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-cyan-500/10 to-purple-600/20 border border-white/10 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M54.627%200l.83.828-1.415%201.415L51.8%200h2.827zM5.373%200l-.83.828L5.96%202.243%208.2%200H5.374zM48.97%200l3.657%203.657-1.414%201.414L46.143%200h2.828zM11.03%200L7.372%203.657%208.787%205.07%2013.857%200H11.03zm32.284%200L49.8%206.485%2048.384%207.9l-7.9-7.9h2.83zM16.686%200L10.2%206.485%2011.616%207.9l7.9-7.9h-2.83zM22.344%200L13.858%208.485%2015.272%209.9l9.9-9.9h-2.828zM32%200l-3.486%203.485.707.707L32.707.707%2032%200zm6.344%200l-9.9%209.9%201.415%201.414L39.172%200h-.828zm5.656%200l-9.9%209.9%201.414%201.414%209.9-9.9-.707-.707L44%200zM0%205.373l.828-.83%201.415%201.415L0%208.2V5.374zm0%205.656l.828-.829%201.415%201.415L0%2013.857v-2.828zm0%205.657l.828-.828%201.415%201.415L0%2019.514v-2.828zm0%205.657l.828-.828%201.415%201.415L0%2025.172v-2.829zm0%205.657l.828-.828%201.415%201.415L0%2030.828v-2.829z%22%20fill%3D%22%23fff%22%20fill-opacity%3D%22.03%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] opacity-50"></div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Agent Landing Pages</h2>
          </div>
          <p className="text-slate-300 max-w-2xl mb-6">
            Create stunning, high-converting landing pages for your listings. Track visitor activity, capture leads, and market your properties with professional designs.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/25 transition-all"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Page
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Utah Real Estate Compliant
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-blue-500/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pages.length}</p>
              <p className="text-xs text-slate-400">Active Pages</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pages.reduce((sum, p) => sum + p.totalViews, 0).toLocaleString()}</p>
              <p className="text-xs text-slate-400">Total Views</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-amber-500/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pages.reduce((sum, p) => sum + p.leadsGenerated, 0)}</p>
              <p className="text-xs text-slate-400">Leads Captured</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-purple-500/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {pages.reduce((sum, p) => sum + p.totalViews, 0) > 0 
                  ? ((pages.reduce((sum, p) => sum + p.leadsGenerated, 0) / pages.reduce((sum, p) => sum + p.totalViews, 0)) * 100).toFixed(1) 
                  : '0.0'}%
              </p>
              <p className="text-xs text-slate-400">Conversion Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips Section */}
      {pages.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-white/10 p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">Pro Tips</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Share your landing page links on social media, include them in email signatures, or generate a QR code for print materials. 
                Each page is mobile-optimized and tracks visitor activity automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400 mx-auto"></div>
        </div>
      ) : pages.length === 0 ? (
        <Card className="text-center py-16 bg-white/5 border-white/10">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Create Your First Landing Page</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Professional landing pages help you capture more leads. Choose from 9+ stunning templates designed for real estate.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/25 transition-all"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Browse Templates
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => {
            const previewImage = getPagePreviewImage(page);
            return (
            <div key={page.id} className="group relative rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-cyan-500/50 transition-all duration-300">
              <div className="h-44 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                {previewImage ? (
                  <>
                    <img 
                      src={previewImage} 
                      alt={page.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23fff%22%20fill-opacity%3D%22.03%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="h-12 w-12 mx-auto rounded-xl bg-white/10 flex items-center justify-center mb-2">
                          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-xs text-slate-500">No Preview</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                    page.isActive 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${page.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                    {page.isActive ? 'Live' : 'Draft'}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-semibold text-white truncate mb-1" title={page.title}>
                  {page.title}
                </h3>
                <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  /sites/{page.slug}
                </p>
                
                <div className="mt-4 grid grid-cols-2 gap-4 py-4 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">{page.totalViews.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-400">{page.leadsGenerated}</p>
                    <p className="text-xs text-slate-400">Leads</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => copyLink(page.slug)}
                      className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/5 transition-colors"
                      title="Copy Link"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => navigate(`/settings/landing-pages/${page.id}/edit`)}
                      className="p-2 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-white/5 transition-colors" 
                      title="Edit & Customize"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(page.id, page.title)}
                      className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors" 
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <a
                    href={`/sites/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                  >
                    View Live
                    <svg className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create Landing Page</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Choose a template and customize your page</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Page Title</label>
                  <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-slate-500"
                    placeholder="e.g. Luxury Home on Main Street"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">URL Slug</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 text-sm dark:bg-white/5 dark:border-white/10 dark:text-slate-400">
                      /sites/
                    </span>
                    <input
                      type="text"
                      value={pageSlug}
                      onChange={(e) => setPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-r-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-slate-500"
                      placeholder="luxury-home-main-st"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Choose a Theme</h4>
                <p className="text-xs text-slate-500 mb-4">Select a theme that matches your listing's style. You can customize it further after creating.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'modern-luxury', name: 'Modern Luxury', description: 'Clean lines with bold accents', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80', tag: 'Popular', colors: ['#1e40af', '#0ea5e9', '#f59e0b'] },
                    { id: 'warm-earth', name: 'Warm & Inviting', description: 'Earthy tones, great for families', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80', colors: ['#92400e', '#d97706', '#065f46'] },
                    { id: 'minimal-white', name: 'Minimal White', description: 'Ultra-clean, lets photos shine', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80', tag: 'New', colors: ['#18181b', '#71717a', '#3b82f6'] },
                    { id: 'bold-contrast', name: 'Bold & Dynamic', description: 'High contrast, stands out', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=400&q=80', colors: ['#7c3aed', '#ec4899', '#10b981'] },
                    { id: 'elegant-serif', name: 'Elegant Estate', description: 'Timeless luxury styling', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=400&q=80', colors: ['#1e3a5f', '#c9a227', '#8b5a2b'] },
                    { id: 'coastal-breeze', name: 'Coastal Breeze', description: 'Light and airy, ocean vibes', image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80', colors: ['#0369a1', '#06b6d4', '#fbbf24'] },
                    { id: 'urban-edge', name: 'Urban Edge', description: 'Industrial meets modern', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80', colors: ['#374151', '#f97316', '#22c55e'] },
                    { id: 'garden-retreat', name: 'Garden Retreat', description: 'Fresh greens, natural tones', image: 'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=400&q=80', colors: ['#166534', '#84cc16', '#a16207'] },
                  ].map((template) => (
                    <button 
                      key={template.id} 
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`group relative rounded-xl overflow-hidden text-left transition-all duration-300 ${
                        selectedTemplate === template.id 
                          ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-[1.02]' 
                          : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-white dark:hover:ring-offset-slate-900'
                      }`}
                    >
                      <div className="aspect-[4/3] relative">
                        <img 
                          src={template.image} 
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        {template.tag && (
                          <div className="absolute top-2 left-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm ${
                              template.tag === 'Popular' ? 'bg-amber-500 text-white' : 'bg-cyan-500 text-white'
                            }`}>
                              {template.tag}
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="theme-card-text text-white font-semibold text-sm" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{template.name}</p>
                          <p className="theme-card-text text-white text-xs line-clamp-1" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{template.description}</p>
                        </div>
                        {selectedTemplate === template.id && (
                          <div className="absolute top-2 right-2 h-6 w-6 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Color palette */}
                      <div className="flex gap-0.5 p-1.5 bg-slate-100 dark:bg-slate-800">
                        {template.colors.map((color, i) => (
                          <div key={i} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedTemplate ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Theme selected • You can customize after creating
                    </span>
                  ) : 'Select a theme to continue'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors dark:text-slate-300 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!selectedTemplate || !pageTitle || !pageSlug}
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 transition-all"
                  >
                    Create Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
