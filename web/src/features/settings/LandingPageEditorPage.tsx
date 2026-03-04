import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';

interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  preview: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    heroOverlay: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  layout: 'modern' | 'classic' | 'minimal' | 'bold' | 'elegant';
}

interface Testimonial {
  text: string;
  author: string;
  role?: string;
  avatar?: string;
  rating?: number;
}

interface NearbyAmenity {
  name: string;
  type: 'school' | 'restaurant' | 'shopping' | 'park' | 'gym' | 'hospital' | 'transit' | 'other';
  distance: string;
  rating?: number;
}

interface OpenHouse {
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface LandingPageData {
  id: string;
  title: string;
  slug: string;
  description?: string;
  heroImage?: string;
  templateId: string;
  isActive: boolean;
  customContent?: {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    ctaSecondaryText?: string;
    features?: string[];
    testimonials?: Testimonial[];
    agentBio?: string;
    videoUrl?: string;
    virtualTourUrl?: string;
    floorPlanUrl?: string;
    neighborhoodDescription?: string;
    nearbyAmenities?: NearbyAmenity[];
    openHouses?: OpenHouse[];
    urgencyText?: string;
    socialProofText?: string;
    priceDropAmount?: number;
    daysOnMarket?: number;
  };
  customStyles?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    headingFont?: string;
    heroOpacity?: number;
    heroHeight?: 'small' | 'medium' | 'large' | 'full';
    cornerRadius?: 'none' | 'small' | 'medium' | 'large';
    animationStyle?: 'none' | 'subtle' | 'dynamic';
    backgroundPattern?: 'none' | 'dots' | 'grid' | 'waves' | 'gradient';
    buttonStyle?: 'solid' | 'outline' | 'gradient' | 'glow';
    imageStyle?: 'normal' | 'rounded' | 'shadow' | 'frame';
  };
  seoSettings?: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    keywords?: string[];
  };
  leadCapture?: {
    enabled?: boolean;
    formTitle?: string;
    formSubtitle?: string;
    requiredFields?: ('name' | 'email' | 'phone' | 'message' | 'prequalified')[];
    buttonText?: string;
    successMessage?: string;
  };
  sections?: {
    hero?: boolean;
    gallery?: boolean;
    features?: boolean;
    video?: boolean;
    virtualTour?: boolean;
    floorPlan?: boolean;
    neighborhood?: boolean;
    amenities?: boolean;
    testimonials?: boolean;
    agent?: boolean;
    contact?: boolean;
    openHouse?: boolean;
    mortgage?: boolean;
  };
  listing?: {
    addressLine1: string;
    city: string;
    state: string;
    price: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    photos?: string[];
  };
}

const themes: ThemeConfig[] = [
  {
    id: 'modern-luxury',
    name: 'Modern Luxury',
    description: 'Clean lines with bold accents. Perfect for high-end properties.',
    preview: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#1e40af',
      secondary: '#0ea5e9',
      accent: '#f59e0b',
      background: '#0f172a',
      text: '#f1f5f9',
      heroOverlay: 'rgba(15, 23, 42, 0.6)',
    },
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    layout: 'modern',
  },
  {
    id: 'warm-earth',
    name: 'Warm & Inviting',
    description: 'Earthy tones that feel like home. Great for family properties.',
    preview: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#92400e',
      secondary: '#d97706',
      accent: '#065f46',
      background: '#fef3c7',
      text: '#1c1917',
      heroOverlay: 'rgba(120, 53, 15, 0.5)',
    },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
    layout: 'classic',
  },
  {
    id: 'minimal-white',
    name: 'Minimal White',
    description: 'Ultra-clean with lots of whitespace. Lets photos shine.',
    preview: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#18181b',
      secondary: '#71717a',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#18181b',
      heroOverlay: 'rgba(255, 255, 255, 0.2)',
    },
    fonts: { heading: 'DM Sans', body: 'DM Sans' },
    layout: 'minimal',
  },
  {
    id: 'bold-contrast',
    name: 'Bold & Dynamic',
    description: 'High contrast with vibrant accents. Stands out from the crowd.',
    preview: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      accent: '#10b981',
      background: '#030712',
      text: '#f9fafb',
      heroOverlay: 'rgba(124, 58, 237, 0.4)',
    },
    fonts: { heading: 'Poppins', body: 'Poppins' },
    layout: 'bold',
  },
  {
    id: 'elegant-serif',
    name: 'Elegant Estate',
    description: 'Timeless elegance with serif typography. Perfect for luxury listings.',
    preview: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#1e3a5f',
      secondary: '#c9a227',
      accent: '#8b5a2b',
      background: '#f8f5f0',
      text: '#1e3a5f',
      heroOverlay: 'rgba(30, 58, 95, 0.5)',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
    layout: 'elegant',
  },
  {
    id: 'coastal-breeze',
    name: 'Coastal Breeze',
    description: 'Light and airy with ocean-inspired colors. Great for waterfront.',
    preview: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#0369a1',
      secondary: '#06b6d4',
      accent: '#fbbf24',
      background: '#f0f9ff',
      text: '#0c4a6e',
      heroOverlay: 'rgba(3, 105, 161, 0.4)',
    },
    fonts: { heading: 'Montserrat', body: 'Open Sans' },
    layout: 'modern',
  },
  {
    id: 'urban-edge',
    name: 'Urban Edge',
    description: 'Industrial meets modern. Perfect for city condos and lofts.',
    preview: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#374151',
      secondary: '#f97316',
      accent: '#22c55e',
      background: '#111827',
      text: '#e5e7eb',
      heroOverlay: 'rgba(17, 24, 39, 0.7)',
    },
    fonts: { heading: 'Oswald', body: 'Roboto' },
    layout: 'bold',
  },
  {
    id: 'garden-retreat',
    name: 'Garden Retreat',
    description: 'Fresh greens and natural tones. Ideal for homes with great outdoor spaces.',
    preview: 'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=400&q=80',
    colors: {
      primary: '#166534',
      secondary: '#84cc16',
      accent: '#a16207',
      background: '#f0fdf4',
      text: '#14532d',
      heroOverlay: 'rgba(22, 101, 52, 0.4)',
    },
    fonts: { heading: 'Quicksand', body: 'Nunito' },
    layout: 'classic',
  },
];

export function LandingPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const authToken = token || localStorage.getItem('utahcontracts_token') || '';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<LandingPageData | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'theme' | 'content' | 'sections' | 'style' | 'seo' | 'preview'>('theme');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Custom content state
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [ctaText, setCtaText] = useState('Schedule a Showing');
  const [ctaSecondaryText, setCtaSecondaryText] = useState('Download Brochure');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [agentBio, setAgentBio] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [virtualTourUrl, setVirtualTourUrl] = useState('');
  const [floorPlanUrl, setFloorPlanUrl] = useState('');
  const [neighborhoodDescription, setNeighborhoodDescription] = useState('');
  const [urgencyText, setUrgencyText] = useState('');
  const [socialProofText, setSocialProofText] = useState('');
  
  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [newTestimonial, setNewTestimonial] = useState<Testimonial>({ text: '', author: '', role: '', rating: 5 });
  
  // Amenities state
  const [amenities, setAmenities] = useState<NearbyAmenity[]>([]);
  const [newAmenity, setNewAmenity] = useState<NearbyAmenity>({ name: '', type: 'other', distance: '' });
  
  // Open houses state
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [newOpenHouse, setNewOpenHouse] = useState<OpenHouse>({ date: '', startTime: '', endTime: '' });
  
  // Custom style state
  const [primaryColor, setPrimaryColor] = useState('#1e40af');
  const [secondaryColor, setSecondaryColor] = useState('#0ea5e9');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [heroOpacity, setHeroOpacity] = useState(60);
  const [headingFont, setHeadingFont] = useState('Playfair Display');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [heroHeight, setHeroHeight] = useState<'small' | 'medium' | 'large' | 'full'>('large');
  const [cornerRadius, setCornerRadius] = useState<'none' | 'small' | 'medium' | 'large'>('medium');
  const [animationStyle, setAnimationStyle] = useState<'none' | 'subtle' | 'dynamic'>('subtle');
  const [backgroundPattern, setBackgroundPattern] = useState<'none' | 'dots' | 'grid' | 'waves' | 'gradient'>('none');
  const [buttonStyle, setButtonStyle] = useState<'solid' | 'outline' | 'gradient' | 'glow'>('gradient');
  const [imageStyle, setImageStyle] = useState<'normal' | 'rounded' | 'shadow' | 'frame'>('rounded');
  
  // SEO state
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  
  // Lead capture state
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(true);
  const [formTitle, setFormTitle] = useState('Interested in this property?');
  const [formSubtitle, setFormSubtitle] = useState('Fill out the form and we\'ll get back to you within 24 hours.');
  const [leadFormFields, setLeadFormFields] = useState<string[]>(['name', 'email', 'phone']);
  const [leadButtonText, setLeadButtonText] = useState('Request Information');
  const [successMessage, setSuccessMessage] = useState('Thank you! We\'ll be in touch soon.');
  
  // Sections visibility state
  const [sections, setSections] = useState({
    hero: true,
    gallery: true,
    features: true,
    video: false,
    virtualTour: false,
    floorPlan: false,
    neighborhood: true,
    amenities: true,
    testimonials: true,
    agent: true,
    contact: true,
    openHouse: false,
    mortgage: true,
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (id) {
      fetchPage();
    }
  }, [id]);

  const fetchPage = async () => {
    try {
      const res = await fetch(`/api/landing-pages/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPage(data);
        
        // Initialize from existing data
        const theme = themes.find(t => t.id === data.templateId) || themes[0];
        setSelectedTheme(theme);
        
        if (data.customContent) {
          setHeadline(data.customContent.headline || '');
          setSubheadline(data.customContent.subheadline || '');
          setCtaText(data.customContent.ctaText || 'Schedule a Showing');
          setCtaSecondaryText(data.customContent.ctaSecondaryText || 'Download Brochure');
          setFeatures(data.customContent.features || []);
          setAgentBio(data.customContent.agentBio || '');
          setVideoUrl(data.customContent.videoUrl || '');
          setVirtualTourUrl(data.customContent.virtualTourUrl || '');
          setFloorPlanUrl(data.customContent.floorPlanUrl || '');
          setNeighborhoodDescription(data.customContent.neighborhoodDescription || '');
          setAmenities(data.customContent.nearbyAmenities || []);
          setOpenHouses(data.customContent.openHouses || []);
          setTestimonials(data.customContent.testimonials || []);
          setUrgencyText(data.customContent.urgencyText || '');
          setSocialProofText(data.customContent.socialProofText || '');
        }
        
        if (data.customStyles) {
          setPrimaryColor(data.customStyles.primaryColor || theme.colors.primary);
          setSecondaryColor(data.customStyles.secondaryColor || theme.colors.secondary);
          setAccentColor(data.customStyles.accentColor || theme.colors.accent);
          setHeroOpacity(data.customStyles.heroOpacity || 60);
          setHeadingFont(data.customStyles.headingFont || theme.fonts.heading);
          setBodyFont(data.customStyles.bodyFont || theme.fonts.body);
          setHeroHeight(data.customStyles.heroHeight || 'large');
          setCornerRadius(data.customStyles.cornerRadius || 'medium');
          setAnimationStyle(data.customStyles.animationStyle || 'subtle');
          setBackgroundPattern(data.customStyles.backgroundPattern || 'none');
          setButtonStyle(data.customStyles.buttonStyle || 'gradient');
          setImageStyle(data.customStyles.imageStyle || 'rounded');
        } else {
          setPrimaryColor(theme.colors.primary);
          setSecondaryColor(theme.colors.secondary);
          setAccentColor(theme.colors.accent);
        }

        if (data.seoSettings) {
          setMetaTitle(data.seoSettings.metaTitle || '');
          setMetaDescription(data.seoSettings.metaDescription || '');
          setKeywords(data.seoSettings.keywords || []);
        }

        if (data.leadCapture) {
          setLeadCaptureEnabled(data.leadCapture.enabled !== false);
          setFormTitle(data.leadCapture.formTitle || 'Interested in this property?');
          setFormSubtitle(data.leadCapture.formSubtitle || "Fill out the form and we'll get back to you within 24 hours.");
          setLeadFormFields(data.leadCapture.requiredFields || ['name', 'email', 'phone']);
          setLeadButtonText(data.leadCapture.buttonText || 'Request Information');
          setSuccessMessage(data.leadCapture.successMessage || "Thank you! We'll be in touch soon.");
        }

        if (data.sections) {
          setSections({ ...sections, ...data.sections });
        }
      }
    } catch (error) {
      console.error('Failed to fetch page', error);
      showToast('error', 'Failed to load landing page');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!page) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/landing-pages/${page.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          templateId: selectedTheme?.id,
          customContent: {
            headline,
            subheadline,
            ctaText,
            ctaSecondaryText,
            features,
            agentBio,
            videoUrl,
            virtualTourUrl,
            floorPlanUrl,
            neighborhoodDescription,
            nearbyAmenities: amenities,
            openHouses,
            testimonials,
            urgencyText,
            socialProofText,
          },
          customStyles: {
            primaryColor,
            secondaryColor,
            accentColor,
            heroOpacity,
            headingFont,
            bodyFont,
            heroHeight,
            cornerRadius,
            animationStyle,
            backgroundPattern,
            buttonStyle,
            imageStyle,
          },
          seoSettings: {
            metaTitle,
            metaDescription,
            keywords,
          },
          leadCapture: {
            enabled: leadCaptureEnabled,
            formTitle,
            formSubtitle,
            requiredFields: leadFormFields,
            buttonText: leadButtonText,
            successMessage,
          },
          sections,
        }),
      });

      if (res.ok) {
        showToast('success', 'Changes saved successfully!');
      } else {
        showToast('error', 'Failed to save changes');
      }
    } catch (error) {
      console.error('Failed to save', error);
      showToast('error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeSelect = (theme: ThemeConfig) => {
    setSelectedTheme(theme);
    setPrimaryColor(theme.colors.primary);
    setSecondaryColor(theme.colors.secondary);
  };

  const addFeature = () => {
    if (newFeature.trim() && features.length < 8) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Landing page not found</p>
        <button
          onClick={() => navigate('/settings/landing-pages')}
          className="mt-4 text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Landing Pages
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-top-2 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/settings/landing-pages')}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">{page.title}</h1>
                <p className="text-xs text-slate-400">/sites/{page.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/sites/${page.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview Live
              </a>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {[
              { id: 'theme', label: 'Theme', icon: '🎨' },
              { id: 'content', label: 'Content', icon: '✏️' },
              { id: 'sections', label: 'Sections', icon: '📑' },
              { id: 'style', label: 'Style', icon: '🖌️' },
              { id: 'seo', label: 'SEO & Leads', icon: '🔍' },
              { id: 'preview', label: 'Preview', icon: '👁️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Theme Selection */}
        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Choose Your Theme</h2>
              <p className="text-slate-400 text-sm">Select a theme that matches your listing's style. You can customize colors in the Style tab.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme)}
                  className={`group relative rounded-2xl overflow-hidden text-left transition-all duration-300 ${
                    selectedTheme?.id === theme.id
                      ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-950 scale-[1.02]'
                      : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-slate-950'
                  }`}
                >
                  <div className="aspect-[4/3] relative">
                    <img 
                      src={theme.preview} 
                      alt={theme.name}
                      className="w-full h-full object-cover"
                    />
                    <div 
                      className="absolute inset-0" 
                      style={{ background: theme.colors.heroOverlay }}
                    />
                    <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                      <p className="theme-card-text text-white font-semibold text-sm" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{theme.name}</p>
                      <p className="theme-card-text text-white/70 text-xs line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{theme.description}</p>
                    </div>
                    {selectedTheme?.id === theme.id && (
                      <div className="absolute top-3 right-3 h-7 w-7 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Color palette preview */}
                  <div className="flex gap-0.5 p-2 bg-slate-900">
                    <div className="flex-1 h-2 rounded-l" style={{ backgroundColor: theme.colors.primary }} />
                    <div className="flex-1 h-2" style={{ backgroundColor: theme.colors.secondary }} />
                    <div className="flex-1 h-2" style={{ backgroundColor: theme.colors.accent }} />
                    <div className="flex-1 h-2 rounded-r" style={{ backgroundColor: theme.colors.background }} />
                  </div>
                </button>
              ))}
            </div>

            {selectedTheme && (
              <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-4">
                  <div 
                    className="h-16 w-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: selectedTheme.colors.primary + '30' }}
                  >
                    🎨
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedTheme.name}</h3>
                    <p className="text-slate-400 text-sm mb-3">{selectedTheme.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-lg bg-white/10 text-xs text-slate-300">
                        Layout: {selectedTheme.layout}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/10 text-xs text-slate-300">
                        Heading: {selectedTheme.fonts.heading}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/10 text-xs text-slate-300">
                        Body: {selectedTheme.fonts.body}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Editor */}
        {activeTab === 'content' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Customize Content</h2>
              <p className="text-slate-400 text-sm">Personalize your landing page with custom headlines, features, and more.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left column - inputs */}
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">📝</span>
                    Headlines & Copy
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Main Headline</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder={page.listing?.addressLine1 || 'Your Dream Home Awaits'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                    {/* Headline suggestions */}
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">Headline Ideas:</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          `Welcome to ${page.listing?.addressLine1?.split(' ').slice(1).join(' ') || 'Your New Home'}`,
                          'Live the Dream',
                          'Where Luxury Meets Comfort',
                          'Your Perfect Home Awaits',
                          'A Rare Find',
                          'Move-In Ready Beauty',
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setHeadline(suggestion)}
                            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Subheadline</label>
                    <textarea
                      value={subheadline}
                      onChange={(e) => setSubheadline(e.target.value)}
                      placeholder="A stunning property in the heart of the city..."
                      rows={2}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                    />
                    {/* Subheadline suggestions */}
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">Subheadline Ideas:</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          `${page.listing?.beds || 4} beds • ${page.listing?.baths || 3} baths • ${page.listing?.sqft?.toLocaleString() || '2,500'} sqft of luxury living`,
                          'An exceptional opportunity in a prime location',
                          'Where every detail has been thoughtfully designed',
                          'Experience the perfect blend of style and comfort',
                          'Your search ends here',
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setSubheadline(suggestion)}
                            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 transition-colors"
                          >
                            {suggestion.slice(0, 40)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Primary CTA Button</label>
                      <input
                        type="text"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="Schedule a Showing"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Secondary CTA</label>
                      <input
                        type="text"
                        value={ctaSecondaryText}
                        onChange={(e) => setCtaSecondaryText(e.target.value)}
                        placeholder="Download Brochure"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Quick CTA Suggestions */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Popular CTAs</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Schedule a Showing',
                        'Request Info',
                        'Get Pre-Approved',
                        'Ask a Question',
                        'Book Virtual Tour',
                        'Contact Agent',
                      ].map((cta) => (
                        <button
                          key={cta}
                          onClick={() => setCtaText(cta)}
                          className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-slate-400 transition-colors"
                        >
                          {cta}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">✨</span>
                    Property Features
                  </h3>

                  {/* Quick feature suggestions */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Quick Add</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        'Gourmet Kitchen',
                        'Mountain Views',
                        'Smart Home',
                        'Pool & Spa',
                        'Home Office',
                        'Walk-in Closet',
                        'Hardwood Floors',
                        'Updated HVAC',
                        'Energy Efficient',
                        'Wine Cellar',
                        'Theater Room',
                        'RV Parking',
                      ].filter(f => !features.includes(f)).slice(0, 6).map((feature) => (
                        <button
                          key={feature}
                          onClick={() => features.length < 8 && setFeatures([...features, feature])}
                          className="px-2 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-400 transition-colors"
                        >
                          + {feature}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                      placeholder="Add custom feature..."
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-sm"
                    />
                    <button
                      onClick={addFeature}
                      disabled={!newFeature.trim() || features.length >= 8}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {features.map((feature, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm"
                        >
                          {feature}
                          <button
                            onClick={() => removeFeature(index)}
                            className="hover:text-red-400 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">{features.length}/8 features added</p>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">👤</span>
                    Agent Bio
                  </h3>
                  
                  <textarea
                    value={agentBio}
                    onChange={(e) => setAgentBio(e.target.value)}
                    placeholder="Tell visitors about yourself and why you're the right agent for them..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                  />
                  <p className="text-xs text-slate-500">{agentBio.length}/500 characters</p>
                </div>
              </div>

              {/* Right column - live preview card */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900">
                  <div className="p-4 border-b border-white/10 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-500/60"></div>
                      <div className="h-3 w-3 rounded-full bg-yellow-500/60"></div>
                      <div className="h-3 w-3 rounded-full bg-green-500/60"></div>
                    </div>
                    <span className="text-xs text-slate-500 ml-2">Live Preview</span>
                  </div>
                  <div 
                    className="aspect-[9/16] max-h-[500px] overflow-hidden relative"
                    style={{ backgroundColor: selectedTheme?.colors.background || '#0f172a' }}
                  >
                    {/* Hero section preview */}
                    <div className="h-1/2 relative">
                      <img 
                        src={page.listing?.photos?.[0] || selectedTheme?.preview || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div 
                        className="absolute inset-0 flex flex-col justify-end p-4"
                        style={{ background: `linear-gradient(to top, ${selectedTheme?.colors.background || '#0f172a'}, transparent)` }}
                      >
                        <h2 
                          className="text-lg font-bold leading-tight"
                          style={{ color: selectedTheme?.colors.text || '#f1f5f9' }}
                        >
                          {headline || page.listing?.addressLine1 || 'Your Dream Home'}
                        </h2>
                        <p 
                          className="text-xs mt-1 opacity-80"
                          style={{ color: selectedTheme?.colors.text || '#f1f5f9' }}
                        >
                          {subheadline || 'A stunning property awaits...'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Content preview */}
                    <div className="p-4 space-y-3">
                      {features.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {features.slice(0, 4).map((f, i) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 rounded-full text-[10px]"
                              style={{ 
                                backgroundColor: primaryColor + '30',
                                color: selectedTheme?.colors.text || '#f1f5f9'
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <button
                        className="w-full py-2 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {ctaText || 'Schedule a Showing'}
                      </button>
                      
                      {agentBio && (
                        <p 
                          className="text-[10px] opacity-70 line-clamp-3"
                          style={{ color: selectedTheme?.colors.text || '#f1f5f9' }}
                        >
                          {agentBio}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Style Customization */}
        {activeTab === 'style' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Customize Style</h2>
              <p className="text-slate-400 text-sm">Fine-tune colors and effects to match your brand.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🎨</span>
                    Colors
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Primary Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-10 w-14 rounded-lg border border-white/10 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Secondary Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="h-10 w-14 rounded-lg border border-white/10 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Hero Overlay Opacity: {heroOpacity}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={heroOpacity}
                      onChange={(e) => setHeroOpacity(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Light</span>
                      <span>Dark</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs">💡</span>
                    Quick Presets
                  </h3>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Blue', primary: '#1e40af', secondary: '#0ea5e9' },
                      { name: 'Green', primary: '#166534', secondary: '#22c55e' },
                      { name: 'Purple', primary: '#7c3aed', secondary: '#a855f7' },
                      { name: 'Orange', primary: '#c2410c', secondary: '#f97316' },
                      { name: 'Rose', primary: '#be123c', secondary: '#f43f5e' },
                      { name: 'Teal', primary: '#0f766e', secondary: '#14b8a6' },
                      { name: 'Amber', primary: '#b45309', secondary: '#f59e0b' },
                      { name: 'Slate', primary: '#334155', secondary: '#64748b' },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setPrimaryColor(preset.primary);
                          setSecondaryColor(preset.secondary);
                        }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex gap-1 mb-1">
                          <div className="h-4 w-4 rounded" style={{ backgroundColor: preset.primary }} />
                          <div className="h-4 w-4 rounded" style={{ backgroundColor: preset.secondary }} />
                        </div>
                        <span className="text-xs text-slate-400">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Typography */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">Aa</span>
                    Typography
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Heading Font</label>
                      <select
                        value={headingFont}
                        onChange={(e) => setHeadingFont(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      >
                        <option value="Playfair Display">Playfair Display</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Poppins">Poppins</option>
                        <option value="DM Sans">DM Sans</option>
                        <option value="Oswald">Oswald</option>
                        <option value="Merriweather">Merriweather</option>
                        <option value="Cormorant Garamond">Cormorant Garamond</option>
                        <option value="Quicksand">Quicksand</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Body Font</label>
                      <select
                        value={bodyFont}
                        onChange={(e) => setBodyFont(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      >
                        <option value="Inter">Inter</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Lato">Lato</option>
                        <option value="Source Sans Pro">Source Sans Pro</option>
                        <option value="Nunito">Nunito</option>
                        <option value="DM Sans">DM Sans</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Layout Options */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs">📐</span>
                    Layout Options
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Hero Height</label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large', 'full'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setHeroHeight(size)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                            heroHeight === size 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Corner Radius</label>
                    <div className="flex gap-2">
                      {(['none', 'small', 'medium', 'large'] as const).map((radius) => (
                        <button
                          key={radius}
                          onClick={() => setCornerRadius(radius)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                            cornerRadius === radius 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {radius.charAt(0).toUpperCase() + radius.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Button Style</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'solid', label: 'Solid', preview: 'bg-blue-600' },
                        { id: 'outline', label: 'Outline', preview: 'border-2 border-blue-600 text-blue-400' },
                        { id: 'gradient', label: 'Gradient', preview: 'bg-gradient-to-r from-blue-600 to-cyan-500' },
                        { id: 'glow', label: 'Glow', preview: 'bg-blue-600 shadow-lg shadow-blue-500/50' },
                      ].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setButtonStyle(style.id as any)}
                          className={`p-3 rounded-lg border transition-colors ${
                            buttonStyle === style.id 
                              ? 'border-cyan-500 bg-cyan-500/10' 
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className={`h-6 rounded ${style.preview}`} />
                          <span className="text-[10px] text-slate-400 mt-1 block">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Effects */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-pink-500/20 flex items-center justify-center text-xs">✨</span>
                    Effects & Animations
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Animation Style</label>
                    <div className="flex gap-2">
                      {(['none', 'subtle', 'dynamic'] as const).map((anim) => (
                        <button
                          key={anim}
                          onClick={() => setAnimationStyle(anim)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                            animationStyle === anim 
                              ? 'bg-pink-500 text-white' 
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {anim.charAt(0).toUpperCase() + anim.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {animationStyle === 'none' && 'No animations'}
                      {animationStyle === 'subtle' && 'Gentle fade-ins and hover effects'}
                      {animationStyle === 'dynamic' && 'Eye-catching parallax and scroll animations'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Background Pattern</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'none', label: 'None' },
                        { id: 'dots', label: 'Dots' },
                        { id: 'grid', label: 'Grid' },
                        { id: 'waves', label: 'Waves' },
                        { id: 'gradient', label: 'Gradient' },
                      ].map((pattern) => (
                        <button
                          key={pattern.id}
                          onClick={() => setBackgroundPattern(pattern.id as any)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            backgroundPattern === pattern.id 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {pattern.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Image Style</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'normal', label: 'Normal' },
                        { id: 'rounded', label: 'Rounded' },
                        { id: 'shadow', label: 'Shadow' },
                        { id: 'frame', label: 'Frame' },
                      ].map((imgStyle) => (
                        <button
                          key={imgStyle.id}
                          onClick={() => setImageStyle(imgStyle.id as any)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            imageStyle === imgStyle.id 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {imgStyle.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live style preview */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <div className="p-4 border-b border-white/10 bg-slate-900 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Style Preview</span>
                  </div>
                  <div className="p-6 bg-slate-900 space-y-4">
                    {/* Button preview */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Buttons</p>
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Primary
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                          style={{ backgroundColor: secondaryColor }}
                        >
                          Secondary
                        </button>
                      </div>
                    </div>
                    
                    {/* Hero overlay preview */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Hero Overlay ({heroOpacity}%)</p>
                      <div className="h-32 rounded-lg overflow-hidden relative">
                        <img 
                          src={selectedTheme?.preview || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80'}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <div 
                          className="absolute inset-0 flex items-end p-3"
                          style={{ 
                            background: `linear-gradient(to top, rgba(0,0,0,${heroOpacity / 100}), transparent)`
                          }}
                        >
                          <span className="text-white text-sm font-semibold">Sample Text</span>
                        </div>
                      </div>
                    </div>

                    {/* Accent elements */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Accent Elements</p>
                      <div className="flex gap-2">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Tag 1
                        </span>
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: primaryColor + '20',
                            color: primaryColor
                          }}
                        >
                          Tag 2
                        </span>
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium border"
                          style={{ 
                            borderColor: primaryColor,
                            color: primaryColor
                          }}
                        >
                          Tag 3
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sections Manager */}
        {activeTab === 'sections' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Manage Sections</h2>
              <p className="text-slate-400 text-sm">Choose which sections to display and customize their content.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Section toggles */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'hero', name: 'Hero Banner', icon: '🖼️', description: 'Eye-catching header with property image' },
                    { id: 'gallery', name: 'Photo Gallery', icon: '📷', description: 'Showcase all property photos' },
                    { id: 'features', name: 'Property Features', icon: '✨', description: 'Highlight key amenities' },
                    { id: 'video', name: 'Property Video', icon: '🎬', description: 'Embed walkthrough video' },
                    { id: 'virtualTour', name: 'Virtual Tour', icon: '🏠', description: '3D tour or Matterport embed' },
                    { id: 'floorPlan', name: 'Floor Plan', icon: '📐', description: 'Interactive floor plan view' },
                    { id: 'neighborhood', name: 'Neighborhood', icon: '🗺️', description: 'Area description and highlights' },
                    { id: 'amenities', name: 'Nearby Amenities', icon: '📍', description: 'Schools, restaurants, parks' },
                    { id: 'testimonials', name: 'Testimonials', icon: '⭐', description: 'Client reviews and ratings' },
                    { id: 'agent', name: 'Agent Profile', icon: '👤', description: 'Your bio and contact info' },
                    { id: 'contact', name: 'Contact Form', icon: '📧', description: 'Lead capture form' },
                    { id: 'openHouse', name: 'Open House', icon: '📅', description: 'Scheduled showing times' },
                    { id: 'mortgage', name: 'Mortgage Calculator', icon: '🧮', description: 'Interactive payment estimator' },
                  ].map((section) => (
                    <div
                      key={section.id}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        sections[section.id as keyof typeof sections]
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                      onClick={() => setSections(prev => ({ ...prev, [section.id]: !prev[section.id as keyof typeof sections] }))}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{section.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-white">{section.name}</h4>
                            <div className={`w-10 h-5 rounded-full transition-colors ${
                              sections[section.id as keyof typeof sections] ? 'bg-cyan-500' : 'bg-white/20'
                            }`}>
                              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                                sections[section.id as keyof typeof sections] ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
                              }`} />
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{section.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section-specific settings */}
              <div className="space-y-4">
                {sections.video && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      🎬 Video Settings
                    </h4>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="YouTube or Vimeo URL"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                    />
                    <p className="text-xs text-slate-500">Paste your video link</p>
                  </div>
                )}

                {sections.virtualTour && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      🏠 Virtual Tour Settings
                    </h4>
                    <input
                      type="url"
                      value={virtualTourUrl}
                      onChange={(e) => setVirtualTourUrl(e.target.value)}
                      placeholder="Matterport or tour URL"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                    />
                  </div>
                )}

                {sections.floorPlan && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      📐 Floor Plan
                    </h4>
                    <input
                      type="url"
                      value={floorPlanUrl}
                      onChange={(e) => setFloorPlanUrl(e.target.value)}
                      placeholder="Floor plan image URL"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                    />
                    <button className="w-full py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors">
                      Upload Floor Plan
                    </button>
                  </div>
                )}

                {sections.neighborhood && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      🗺️ Neighborhood Info
                    </h4>
                    <textarea
                      value={neighborhoodDescription}
                      onChange={(e) => setNeighborhoodDescription(e.target.value)}
                      placeholder="Describe the neighborhood, nearby attractions, lifestyle..."
                      rows={3}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 resize-none"
                    />
                  </div>
                )}

                {sections.amenities && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      📍 Nearby Amenities
                    </h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newAmenity.name}
                        onChange={(e) => setNewAmenity(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Amenity name"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newAmenity.type}
                          onChange={(e) => setNewAmenity(prev => ({ ...prev, type: e.target.value as any }))}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        >
                          <option value="school">🏫 School</option>
                          <option value="restaurant">🍽️ Restaurant</option>
                          <option value="shopping">🛒 Shopping</option>
                          <option value="park">🌳 Park</option>
                          <option value="gym">💪 Gym</option>
                          <option value="hospital">🏥 Hospital</option>
                          <option value="transit">🚇 Transit</option>
                          <option value="other">📍 Other</option>
                        </select>
                        <input
                          type="text"
                          value={newAmenity.distance}
                          onChange={(e) => setNewAmenity(prev => ({ ...prev, distance: e.target.value }))}
                          placeholder="0.5 mi"
                          className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (newAmenity.name && newAmenity.distance) {
                            setAmenities([...amenities, newAmenity]);
                            setNewAmenity({ name: '', type: 'other', distance: '' });
                          }
                        }}
                        className="w-full py-2 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                      >
                        Add Amenity
                      </button>
                    </div>
                    {amenities.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {amenities.map((a, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-white/5 text-xs">
                            <span className="text-slate-300">{a.name}</span>
                            <span className="text-slate-500">{a.distance}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sections.openHouse && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      📅 Open House Schedule
                    </h4>
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={newOpenHouse.date}
                        onChange={(e) => setNewOpenHouse(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={newOpenHouse.startTime}
                          onChange={(e) => setNewOpenHouse(prev => ({ ...prev, startTime: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        />
                        <span className="text-slate-500 self-center">to</span>
                        <input
                          type="time"
                          value={newOpenHouse.endTime}
                          onChange={(e) => setNewOpenHouse(prev => ({ ...prev, endTime: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (newOpenHouse.date && newOpenHouse.startTime && newOpenHouse.endTime) {
                            setOpenHouses([...openHouses, newOpenHouse]);
                            setNewOpenHouse({ date: '', startTime: '', endTime: '' });
                          }
                        }}
                        className="w-full py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                      >
                        Add Open House
                      </button>
                    </div>
                    {openHouses.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {openHouses.map((oh, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-white/5 text-xs">
                            <span className="text-slate-300">{new Date(oh.date).toLocaleDateString()}</span>
                            <span className="text-slate-500">{oh.startTime} - {oh.endTime}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sections.testimonials && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      ⭐ Client Testimonials
                    </h4>
                    <div className="space-y-2">
                      <textarea
                        value={newTestimonial.text}
                        onChange={(e) => setNewTestimonial(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="Client testimonial..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 resize-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTestimonial.author}
                          onChange={(e) => setNewTestimonial(prev => ({ ...prev, author: e.target.value }))}
                          placeholder="Client name"
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                        <div className="flex items-center gap-1 px-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setNewTestimonial(prev => ({ ...prev, rating: star }))}
                              className={`text-lg ${star <= (newTestimonial.rating || 5) ? 'text-yellow-400' : 'text-slate-600'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (newTestimonial.text && newTestimonial.author) {
                            setTestimonials([...testimonials, newTestimonial]);
                            setNewTestimonial({ text: '', author: '', role: '', rating: 5 });
                          }
                        }}
                        className="w-full py-2 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors"
                      >
                        Add Testimonial
                      </button>
                    </div>
                    {testimonials.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {testimonials.map((t, i) => (
                          <div key={i} className="p-2 rounded bg-white/5 text-xs">
                            <p className="text-slate-300 italic">"{t.text.slice(0, 50)}..."</p>
                            <p className="text-slate-500 mt-1">— {t.author}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SEO & Lead Capture */}
        {activeTab === 'seo' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">SEO & Lead Capture</h2>
              <p className="text-slate-400 text-sm">Optimize for search engines and capture more leads.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* SEO Settings */}
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🔍</span>
                    Search Engine Optimization
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Page Title <span className="text-slate-500">(for Google)</span>
                    </label>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder={`${page.listing?.addressLine1 || 'Beautiful Home'} | For Sale`}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    <p className="text-xs text-slate-500 mt-1">{metaTitle.length}/60 characters recommended</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Meta Description
                    </label>
                    <textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Stunning 4-bed, 3-bath home with modern amenities, gourmet kitchen, and mountain views..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">{metaDescription.length}/160 characters recommended</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Keywords
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newKeyword.trim()) {
                            setKeywords([...keywords, newKeyword.trim()]);
                            setNewKeyword('');
                          }
                        }}
                        placeholder="Add keyword..."
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                      />
                      <button
                        onClick={() => {
                          if (newKeyword.trim()) {
                            setKeywords([...keywords, newKeyword.trim()]);
                            setNewKeyword('');
                          }
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs flex items-center gap-1">
                          {kw}
                          <button onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))} className="hover:text-red-400">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* SEO Preview */}
                  <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Google Preview</p>
                    <div className="space-y-1">
                      <p className="text-blue-400 text-sm font-medium truncate">
                        {metaTitle || `${page.listing?.addressLine1 || 'Beautiful Home'} | For Sale`}
                      </p>
                      <p className="text-emerald-400 text-xs">
                        {window.location.origin}/sites/{page.slug}
                      </p>
                      <p className="text-slate-400 text-xs line-clamp-2">
                        {metaDescription || 'Discover this amazing property. Schedule a showing today!'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Social Sharing */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-pink-500/20 flex items-center justify-center text-xs">📱</span>
                    Social Sharing Preview
                  </h3>
                  
                  <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-slate-700">
                      <img 
                        src={page.listing?.photos?.[0] || selectedTheme?.preview || ''} 
                        alt="Social preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-white text-sm font-medium truncate">
                      {metaTitle || page.listing?.addressLine1 || 'Property For Sale'}
                    </p>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                      {metaDescription || subheadline || 'Check out this amazing property!'}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">{window.location.host}</p>
                  </div>
                </div>
              </div>

              {/* Lead Capture Settings */}
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">📧</span>
                      Lead Capture Form
                    </h3>
                    <button
                      onClick={() => setLeadCaptureEnabled(!leadCaptureEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors ${leadCaptureEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                        leadCaptureEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {leadCaptureEnabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Form Title</label>
                        <input
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="Interested in this property?"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Form Subtitle</label>
                        <input
                          type="text"
                          value={formSubtitle}
                          onChange={(e) => setFormSubtitle(e.target.value)}
                          placeholder="We'll get back to you within 24 hours"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Required Fields</label>
                        <div className="space-y-2">
                          {[
                            { id: 'name', label: 'Full Name', icon: '👤' },
                            { id: 'email', label: 'Email Address', icon: '✉️' },
                            { id: 'phone', label: 'Phone Number', icon: '📞' },
                            { id: 'message', label: 'Message', icon: '💬' },
                            { id: 'prequalified', label: 'Pre-qualified?', icon: '✓' },
                          ].map((field) => (
                            <label key={field.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={leadFormFields.includes(field.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setLeadFormFields([...leadFormFields, field.id]);
                                  } else {
                                    setLeadFormFields(leadFormFields.filter(f => f !== field.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                              />
                              <span className="text-sm text-slate-300">{field.icon} {field.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Submit Button Text</label>
                        <input
                          type="text"
                          value={leadButtonText}
                          onChange={(e) => setLeadButtonText(e.target.value)}
                          placeholder="Request Information"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Success Message</label>
                        <input
                          type="text"
                          value={successMessage}
                          onChange={(e) => setSuccessMessage(e.target.value)}
                          placeholder="Thank you! We'll be in touch soon."
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Urgency & Social Proof */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-red-500/20 flex items-center justify-center text-xs">🔥</span>
                    Urgency & Social Proof
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Urgency Banner</label>
                    <input
                      type="text"
                      value={urgencyText}
                      onChange={(e) => setUrgencyText(e.target.value)}
                      placeholder="Open House This Saturday!"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Creates a banner at the top of the page</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Social Proof</label>
                    <input
                      type="text"
                      value={socialProofText}
                      onChange={(e) => setSocialProofText(e.target.value)}
                      placeholder="47 people viewed this property today"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                    />
                  </div>

                  {/* Quick urgency presets */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      '🔥 Hot Property!',
                      '⏰ Price Reduced!',
                      '🏠 Open House Sunday',
                      '✨ Just Listed',
                      '📈 Multiple Offers',
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setUrgencyText(preset)}
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lead Form Preview */}
                {leadCaptureEnabled && (
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-500 mb-3">Form Preview</p>
                    <div className="p-4 rounded-xl border border-white/10" style={{ backgroundColor: selectedTheme?.colors.background || '#0f172a' }}>
                      <h4 className="text-sm font-semibold mb-1" style={{ color: selectedTheme?.colors.text || '#f1f5f9' }}>
                        {formTitle || 'Interested in this property?'}
                      </h4>
                      <p className="text-xs opacity-70 mb-3" style={{ color: selectedTheme?.colors.text || '#f1f5f9' }}>
                        {formSubtitle || "We'll get back to you within 24 hours."}
                      </p>
                      <div className="space-y-2">
                        {leadFormFields.slice(0, 3).map((field) => (
                          <div key={field} className="h-8 rounded bg-white/10" />
                        ))}
                        <button
                          className="w-full py-2 rounded text-xs font-semibold text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {leadButtonText || 'Request Information'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Preview */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Full Preview</h2>
                <p className="text-slate-400 text-sm">See how your landing page will look to visitors.</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Desktop">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Mobile">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900">
              <div className="p-3 border-b border-white/10 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/60"></div>
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-400 text-center">
                    {window.location.origin}/sites/{page.slug}
                  </div>
                </div>
              </div>
              
              <iframe
                src={`/sites/${page.slug}`}
                className="w-full h-[600px] bg-white"
                title="Landing Page Preview"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
