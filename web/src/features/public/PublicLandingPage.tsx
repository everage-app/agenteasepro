import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getTemplateMediaPack } from '../landing/templateMediaSuggestions';
import { toDisplayErrorMessage } from '../../lib/errorMessages';
import { buildTrackedLandingQrUrl } from '../../lib/landingQr';

function hexToRgb(hex?: string | null) {
  const value = String(hex || '').replace('#', '').trim();
  if (value.length !== 6) return null;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return null;
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgba(hex: string | undefined | null, alpha: number, fallback = '15,23,42') {
  const rgb = hexToRgb(hex);
  const value = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : fallback;
  return `rgba(${value}, ${alpha})`;
}

function clampBrokerageLogoWidth(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 260;
  return Math.min(420, Math.max(140, Math.round(parsed)));
}

function normalizeBrokerageLogoBackground(value: unknown) {
  return value === 'TRANSPARENT' ? 'TRANSPARENT' : 'CARD';
}

function luminance(hex?: string | null) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

type PublicLandingPageResponse = {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  theme: {
    id: string;
    layout?: 'modern' | 'classic' | 'minimal' | 'bold' | 'elegant';
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
  };
  content: {
    headline: string;
    subheadline?: string;
    ctaText?: string;
    galleryImages?: string[];
    features?: string[];
    urgencyText?: string;
    socialProofText?: string;
    neighborhoodDescription?: string;
    nearbyAmenities?: Array<{
      name: string;
      type?: string;
      distance?: string;
    }>;
    testimonials?: Array<{
      text: string;
      author: string;
      role?: string;
      rating?: number;
    }>;
    openHouses?: Array<{
      date: string;
      startTime: string;
      endTime: string;
      notes?: string;
    }>;
    videoUrl?: string | null;
    virtualTourUrl?: string | null;
    floorPlanUrl?: string | null;
    whyChooseBullets?: string[];
    stats?: {
      yearsExperience?: number | string;
      homesSold?: number | string;
      avgDaysOnMarket?: number | string;
      clientRating?: number | string;
    } | null;
    showHeaderQr?: boolean;
    qrListingUrl?: string;
    qrListingToken?: string;
    qrPersonalUrl?: string;
    qrPersonalLabel?: string;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string | null;
    heroOpacity?: number;
  };
  agent: {
    name: string;
    title?: string | null;
    email: string;
    phone?: string | null;
    photoUrl?: string | null;
    bio?: string | null;
    licenseNumber?: string | null;
    websiteUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
  };
  brokerage: {
    name?: string | null;
    logoUrl?: string | null;
    logoWidth?: number | null;
    logoBackground?: string | null;
    address?: string | null;
    phone?: string | null;
    license?: string | null;
  };
  listing: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    price?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    photos?: string[];
    description?: string | null;
    mlsNumber?: string | null;
  } | null;
  heroImage?: string | null;
  sections?: Record<string, boolean>;
  leadCapture?: {
    enabled?: boolean;
    formTitle?: string;
    formSubtitle?: string;
    requiredFields?: string[];
    buttonText?: string;
    successMessage?: string;
  };
  forceCapture?: {
    enabled?: boolean;
    mode?: 'FORM' | 'MODAL' | 'GATE';
    delay?: number;
    headline?: string;
    subheadline?: string;
    requirePhone?: boolean;
    persistMode?: 'SESSION' | 'ALWAYS';
    ctaText?: string;
  };
  customStyles?: {
    heroHeight?: 'small' | 'medium' | 'large' | 'full';
    cornerRadius?: 'none' | 'small' | 'medium' | 'large';
    animationStyle?: 'none' | 'subtle' | 'dynamic';
    backgroundPattern?: 'none' | 'dots' | 'grid' | 'waves' | 'gradient';
    buttonStyle?: 'solid' | 'outline' | 'gradient' | 'glow';
    imageStyle?: 'normal' | 'rounded' | 'shadow' | 'frame';
    headingFont?: string;
    bodyFont?: string;
  };
  seoSettings?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  otherListings?: Array<{
    slug: string;
    title: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    price?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    photo?: string | null;
  }>;
  analytics?: {
    totalViews: number;
    uniqueViews: number;
    leadsGenerated: number;
    conversionRate: number;
  };
};

type LeadFormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
  prequalified: boolean;
};

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatOpenHouseDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function toEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const youtubeMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return trimmed;
}

const LANDING_PAGE_FONT_ALLOWLIST = new Set([
  'Playfair Display',
  'Inter',
  'Merriweather',
  'Source Sans Pro',
  'DM Sans',
  'Poppins',
  'Cormorant Garamond',
  'Lato',
  'Montserrat',
  'Open Sans',
  'Oswald',
  'Roboto',
  'Quicksand',
  'Nunito',
]);

function toGoogleFontFamily(font?: string | null): string | null {
  const normalized = String(font || '').trim().replace(/\s+/g, ' ');
  if (!normalized || !LANDING_PAGE_FONT_ALLOWLIST.has(normalized)) return null;
  return normalized.replace(/\s/g, '+');
}

function MortgageCalculator({ listingPrice, primaryColor, surfaceStyle, nestedSurfaceStyle, isLightTheme, mutedTextColor }: {
  listingPrice?: number | null;
  primaryColor: string;
  surfaceStyle: React.CSSProperties;
  nestedSurfaceStyle: React.CSSProperties;
  isLightTheme: boolean;
  mutedTextColor: string;
}) {
  const defaultPrice = Number(listingPrice || 500000);
  const [price, setPrice] = useState(defaultPrice);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);

  const downPayment = price * (downPct / 100);
  const loan = Math.max(0, price - downPayment);
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  const monthly = monthlyRate === 0
    ? loan / n
    : (loan * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(v || 0));
  const textColor = isLightTheme ? '#0f172a' : '#ffffff';

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>Home price</label>
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none" style={{ ...nestedSurfaceStyle, color: textColor }} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>Down payment: {downPct}% ({fmt(downPayment)})</label>
          <input type="range" min={0} max={50} step={1} value={downPct} onChange={(e) => setDownPct(Number(e.target.value))} className="mt-1 w-full accent-cyan-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>Rate (%)</label>
            <input type="number" step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none" style={{ ...nestedSurfaceStyle, color: textColor }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>Term (years)</label>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none" style={{ ...nestedSurfaceStyle, color: textColor }}>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
        </div>
      </div>
      <div className="rounded-[28px] border p-6 backdrop-blur-xl flex flex-col justify-center" style={surfaceStyle}>
        <div className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: mutedTextColor }}>Estimated monthly payment</div>
        <div className="mt-2 text-4xl font-bold" style={{ color: primaryColor }}>{fmt(monthly)}</div>
        <div className="mt-4 space-y-1 text-sm" style={{ color: mutedTextColor }}>
          <div className="flex justify-between"><span>Loan amount</span><span style={{ color: textColor }}>{fmt(loan)}</span></div>
          <div className="flex justify-between"><span>Down payment</span><span style={{ color: textColor }}>{fmt(downPayment)}</span></div>
          <div className="flex justify-between"><span>Total interest</span><span style={{ color: textColor }}>{fmt(monthly * n - loan)}</span></div>
        </div>
        <p className="mt-4 text-[11px]" style={{ color: mutedTextColor }}>Principal &amp; interest only. Excludes taxes, insurance, and HOA fees. For illustration only.</p>
      </div>
    </div>
  );
}

export function PublicLandingPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PublicLandingPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<LeadFormState>({
    name: '',
    email: '',
    phone: '',
    message: '',
    prequalified: false,
  });
  const [valuationForm, setValuationForm] = useState({ address: '', name: '', email: '', phone: '' });
  const [valuationSubmitting, setValuationSubmitting] = useState(false);
  const [valuationMessage, setValuationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [gateVisible, setGateVisible] = useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateForm, setGateForm] = useState({ name: '', email: '', phone: '' });
  const [headerQrVariant, setHeaderQrVariant] = useState<'listing' | 'personal'>('listing');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(res.status === 404
            ? 'Landing page not found'
            : toDisplayErrorMessage(data?.error ?? data, 'Failed to load landing page'));
        }
        const data = (await res.json()) as PublicLandingPageResponse;
        if (cancelled) return;
        setPage(data);
        setError(null);

        const nextTitle = data.seoSettings?.metaTitle || data.title;
        document.title = nextTitle;

        const metaDescription = data.seoSettings?.metaDescription || data.description || '';
        if (metaDescription) {
          let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'description';
            document.head.appendChild(meta);
          }
          meta.content = metaDescription;
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(toDisplayErrorMessage(loadError, 'Failed to load landing page'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const templateMediaPack = useMemo(() => getTemplateMediaPack(page?.theme.id), [page?.theme.id]);

  const galleryPhotos = useMemo(() => {
    const base = [
      ...(page?.content?.galleryImages?.filter(Boolean) || []),
      ...(page?.listing?.photos?.filter(Boolean) || []),
    ];
    const unique = Array.from(new Set(base));
    if (unique.length > 0) return unique;
    if (page?.heroImage) return [page.heroImage];
    return [templateMediaPack.hero, ...templateMediaPack.gallery];
  }, [page, templateMediaPack]);

  const isLightTheme = luminance(page?.theme.colors.background) > 0.55;
  const surfaceStyle = useMemo(
    () => ({
      backgroundColor: isLightTheme ? rgba('#ffffff', 0.82, '255,255,255') : rgba('#020617', 0.72),
      borderColor: isLightTheme ? rgba(page?.theme.colors.primary, 0.18, '148,163,184') : 'rgba(255,255,255,0.10)',
      boxShadow: isLightTheme ? '0 24px 70px rgba(15, 23, 42, 0.12)' : '0 24px 70px rgba(2, 6, 23, 0.36)',
    }),
    [isLightTheme, page?.theme.colors.primary],
  );
  const nestedSurfaceStyle = useMemo(
    () => ({
      backgroundColor: isLightTheme ? rgba('#f8fafc', 0.96, '248,250,252') : rgba('#0f172a', 0.55),
      borderColor: isLightTheme ? 'rgba(148,163,184,0.20)' : 'rgba(255,255,255,0.08)',
    }),
    [isLightTheme],
  );
  const mutedTextColor = isLightTheme ? 'rgba(51,65,85,0.82)' : 'rgba(226,232,240,0.78)';
  const eyebrowColor = isLightTheme ? page?.branding.secondaryColor || page?.theme.colors.secondary || '#0891b2' : '#a5f3fc';
  const safeHeroImage = page?.heroImage && !failedImages.hero ? page.heroImage : null;
  const safeGalleryPhotos = galleryPhotos.filter((_, index) => !failedImages[`gallery-${index}`]);
  const safeAgentPhoto = page?.agent.photoUrl && !failedImages.agent ? page.agent.photoUrl : null;
  const safeBrandLogo = (page?.brokerage.logoUrl || page?.branding.logoUrl) && !failedImages.brand
    ? page.brokerage.logoUrl || page.branding.logoUrl
    : null;
  const brokerageLogoWidth = clampBrokerageLogoWidth(page?.brokerage.logoWidth);
  const headerBrokerageLogoWidth = Math.min(brokerageLogoWidth, 420);
  const compactBrokerageLogoWidth = Math.min(brokerageLogoWidth, 260);
  const brokerageLogoBackground = normalizeBrokerageLogoBackground(page?.brokerage.logoBackground);
  const brandName = page?.brokerage.name || page?.agent.name || 'Agent';
  const brandInitials = brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'A';
  const brokerageLogoClass = brokerageLogoBackground === 'TRANSPARENT'
    ? 'h-14 rounded-2xl object-contain sm:h-16'
    : 'h-14 rounded-2xl border border-white/10 bg-white/95 px-4 py-2 object-contain shadow-sm sm:h-16';
  const compactBrokerageLogoClass = brokerageLogoBackground === 'TRANSPARENT'
    ? 'h-11 rounded-xl object-contain'
    : 'h-11 rounded-xl border border-white/10 bg-white/90 p-2 object-contain shadow-sm';
  const fallbackSubheadline = page
    ? page.content.subheadline || page.description || `Private showings, pricing guidance, and direct local insight with ${page.agent.name}.`
    : '';

  const appliedHeadingFont = page?.customStyles?.headingFont || page?.theme.fonts.heading || 'Playfair Display';
  const appliedBodyFont = page?.customStyles?.bodyFont || page?.theme.fonts.body || 'Inter';
  const buttonStyleMode = page?.customStyles?.buttonStyle || 'gradient';
  const backgroundPatternMode = page?.customStyles?.backgroundPattern || 'none';
  const animationStyleMode = page?.customStyles?.animationStyle || 'subtle';
  const imageStyleMode = page?.customStyles?.imageStyle || 'rounded';

  const cornerRadiusPx = useMemo(() => {
    switch (page?.customStyles?.cornerRadius) {
      case 'none':
        return 0;
      case 'small':
        return 18;
      case 'large':
        return 36;
      case 'medium':
      default:
        return 28;
    }
  }, [page?.customStyles?.cornerRadius]);

  const heroMinHeightPx = useMemo(() => {
    switch (page?.customStyles?.heroHeight) {
      case 'small':
        return 440;
      case 'medium':
        return 520;
      case 'full':
        return 760;
      case 'large':
      default:
        return 620;
    }
  }, [page?.customStyles?.heroHeight]);

  const backgroundPattern = useMemo(() => {
    const textColor = page?.theme.colors.text || '#e2e8f0';
    switch (backgroundPatternMode) {
      case 'dots':
        return {
          layer: `radial-gradient(circle at 1px 1px, ${rgba(textColor, isLightTheme ? 0.08 : 0.13)} 1px, transparent 0)`,
          size: '24px 24px',
        };
      case 'grid':
        return {
          layer: `linear-gradient(${rgba(textColor, isLightTheme ? 0.06 : 0.1)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(textColor, isLightTheme ? 0.06 : 0.1)} 1px, transparent 1px)`,
          size: '34px 34px',
        };
      case 'waves':
        return {
          layer: `radial-gradient(120% 70% at 0% 0%, ${rgba(page?.branding.primaryColor, 0.12)} 0%, transparent 55%), radial-gradient(120% 70% at 100% 100%, ${rgba(page?.theme.colors.secondary, 0.1)} 0%, transparent 55%)`,
          size: 'auto',
        };
      case 'gradient':
        return {
          layer: `linear-gradient(115deg, ${rgba(page?.theme.colors.primary, isLightTheme ? 0.12 : 0.18)} 0%, transparent 45%, ${rgba(page?.theme.colors.secondary, isLightTheme ? 0.12 : 0.16)} 100%)`,
          size: 'auto',
        };
      case 'none':
      default:
        return { layer: '', size: '' };
    }
  }, [backgroundPatternMode, isLightTheme, page?.branding.primaryColor, page?.theme.colors.primary, page?.theme.colors.secondary, page?.theme.colors.text]);

  const primaryButtonStyle = useMemo(() => {
    const primary = page?.branding.primaryColor || page?.theme.colors.primary || '#1e40af';
    const secondary = page?.theme.colors.secondary || page?.branding.secondaryColor || '#0ea5e9';

    switch (buttonStyleMode) {
      case 'outline':
        return {
          backgroundColor: 'transparent',
          border: `1px solid ${rgba(primary, 0.6)}`,
          color: primary,
          boxShadow: 'none',
        } as React.CSSProperties;
      case 'glow':
        return {
          backgroundColor: primary,
          border: `1px solid ${rgba(primary, 0.55)}`,
          color: '#ffffff',
          boxShadow: `0 18px 40px ${rgba(primary, 0.55)}`,
        } as React.CSSProperties;
      case 'solid':
        return {
          backgroundColor: primary,
          border: `1px solid ${rgba(primary, 0.45)}`,
          color: '#ffffff',
        } as React.CSSProperties;
      case 'gradient':
      default:
        return {
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          border: `1px solid ${rgba(primary, 0.45)}`,
          color: '#ffffff',
          boxShadow: `0 18px 40px ${rgba(primary, 0.45)}`,
        } as React.CSSProperties;
    }
  }, [buttonStyleMode, page?.branding.primaryColor, page?.branding.secondaryColor, page?.theme.colors.primary, page?.theme.colors.secondary]);

  const heroPrimaryButtonStyle = useMemo(() => {
    if (buttonStyleMode !== 'outline') return primaryButtonStyle;
    return {
      ...primaryButtonStyle,
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.82)',
      backgroundColor: 'rgba(255,255,255,0.08)',
    } as React.CSSProperties;
  }, [buttonStyleMode, primaryButtonStyle]);

  const cardMotionClass = animationStyleMode === 'dynamic'
    ? 'transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl'
    : animationStyleMode === 'subtle'
      ? 'transition-all duration-300 hover:-translate-y-0.5'
      : '';

  const imageFrameStyle = useMemo(() => {
    const baseRadius = imageStyleMode === 'normal' ? 0 : Math.max(10, cornerRadiusPx - 8);
    switch (imageStyleMode) {
      case 'frame':
        return {
          borderRadius: `${baseRadius + 4}px`,
          padding: '6px',
          border: `1px solid ${isLightTheme ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.16)'}`,
          backgroundColor: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)',
        } as React.CSSProperties;
      case 'shadow':
        return {
          borderRadius: `${baseRadius}px`,
          overflow: 'hidden',
          boxShadow: isLightTheme ? '0 14px 35px rgba(15,23,42,0.12)' : '0 16px 40px rgba(2,6,23,0.46)',
        } as React.CSSProperties;
      case 'normal':
        return { borderRadius: '0px', overflow: 'hidden' } as React.CSSProperties;
      case 'rounded':
      default:
        return { borderRadius: `${baseRadius}px`, overflow: 'hidden' } as React.CSSProperties;
    }
  }, [cornerRadiusPx, imageStyleMode, isLightTheme]);

  const heroLayoutVariant = useMemo<'cinematic' | 'split' | 'centered'>(() => {
    const layout = page?.theme.layout || 'modern';
    if (layout === 'minimal') return 'split';
    if (layout === 'classic' || layout === 'elegant') return 'centered';
    return 'cinematic';
  }, [page?.theme.layout]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const headingFamily = toGoogleFontFamily(appliedHeadingFont);
    const bodyFamily = toGoogleFontFamily(appliedBodyFont);
    const families = Array.from(new Set([headingFamily, bodyFamily].filter(Boolean))) as string[];
    if (families.length === 0) return;

    const id = `landing-page-fonts-${slug}`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${families.map((family) => `family=${family}:wght@400;500;600;700`).join('&')}&display=swap`;
  }, [appliedHeadingFont, appliedBodyFont, slug]);

  const sections = page?.sections || {};
  const requiredFields = page?.leadCapture?.requiredFields || ['name', 'email', 'phone'];
  const showLeadCapture = page?.leadCapture?.enabled !== false;
  const socialProofLabel = page?.content?.socialProofText || null;
  const hasRichListingContent = Boolean(
    safeGalleryPhotos.length ||
    page?.content.features?.length ||
    page?.listing?.description ||
    page?.content.videoUrl ||
    page?.content.virtualTourUrl ||
    page?.content.floorPlanUrl ||
    page?.content.neighborhoodDescription ||
    page?.content.testimonials?.length,
  );
  const showSparseGuidance = !hasRichListingContent;
  const locationLabel = [page?.listing?.city, page?.listing?.state].filter(Boolean).join(', ');
  const basePublicUrl = page && typeof window !== 'undefined' ? `${window.location.origin}/sites/${page.slug}` : '/';
  const listingQrToken = page?.content.qrListingToken?.trim() || '';
  const tokenizedListingQrUrl = listingQrToken && page ? buildTrackedLandingQrUrl(basePublicUrl, page.slug, listingQrToken) : '';
  const listingQrUrl = page?.content.qrListingUrl?.trim() || tokenizedListingQrUrl || basePublicUrl;
  const personalQrUrl = page?.content.qrPersonalUrl?.trim() || page?.agent.websiteUrl || (page?.agent.email ? `mailto:${page.agent.email}` : '');
  const hasPersonalQr = Boolean(personalQrUrl);
  const showHeaderQr = Boolean(page?.content.showHeaderQr && (listingQrUrl || personalQrUrl));
  const qrTokenFromUrl = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('lpqr') || new URLSearchParams(window.location.search).get('utm_content') || '').trim()
    : '';
  const qrLeadAttribution = qrTokenFromUrl ? `QR token: ${qrTokenFromUrl}` : '';
  const activeHeaderQrVariant = headerQrVariant === 'personal' && hasPersonalQr ? 'personal' : 'listing';
  const activeHeaderQrUrl = activeHeaderQrVariant === 'personal' ? personalQrUrl : listingQrUrl;
  const activeHeaderQrLabel = activeHeaderQrVariant === 'personal'
    ? (page?.content.qrPersonalLabel?.trim() || 'Agent info')
    : 'Listing QR';
  const headerMetaChips = useMemo(() => {
    const chips = [
      formatCurrency(page?.listing?.price),
      page?.listing?.beds != null && page?.listing?.baths != null
        ? `${page.listing.beds} bd • ${page.listing.baths} ba`
        : null,
      locationLabel || null,
      page?.listing?.mlsNumber ? `MLS #${page.listing.mlsNumber}` : null,
      showLeadCapture ? 'Lead capture active' : null,
    ].filter(Boolean) as string[];
    return chips.slice(0, 4);
  }, [locationLabel, page, showLeadCapture]);
  const agentBioText = page?.agent.bio?.trim() ||
    `${page?.agent.name || 'Your agent'} provides personalized guidance${locationLabel ? ` across ${locationLabel}` : ''}. Share your goals and you'll get a clear game plan, pricing insight, and next available showing times.`;
  const mobileActionCount = page?.agent.phone ? 3 : 1;
  const heroBadges = useMemo(() => {
    const badges: string[] = [];
    const priceText = formatCurrency(page?.listing?.price);
    if (priceText) badges.push(priceText);
    if (page?.listing?.beds != null && page?.listing?.baths != null) {
      badges.push(`${page.listing.beds} bd • ${page.listing.baths} ba${page.listing?.sqft ? ` • ${page.listing.sqft.toLocaleString()} sqft` : ''}`);
    }
    if (page?.listing?.mlsNumber) badges.push(`MLS #${page.listing.mlsNumber}`);
    if (socialProofLabel) badges.push(socialProofLabel);

    if (badges.length === 0) {
      badges.push('Private listing preview');
      if (locationLabel) badges.push(locationLabel);
      badges.push('Fast agent follow-up');
    }

    return badges.slice(0, 4);
  }, [locationLabel, page, socialProofLabel]);

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!page || submitting) return;

    const { firstName, lastName } = splitFullName(form.name);
    if (!firstName || !form.email.trim()) {
      setSubmitMessage({ type: 'error', text: 'Name and email are required.' });
      return;
    }

    try {
      setSubmitting(true);
      setSubmitMessage(null);

      const res = await fetch(`/api/sites/${encodeURIComponent(page.slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: [form.message.trim(), form.prequalified ? 'Pre-qualified buyer' : '', qrLeadAttribution].filter(Boolean).join(' | '),
          source: 'LANDING_PAGE',
          qrToken: qrTokenFromUrl || undefined,
          qrUrl: qrTokenFromUrl && typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toDisplayErrorMessage(data?.error ?? data, 'Failed to send your request'));
      }

      setSubmitMessage({
        type: 'success',
        text: page.leadCapture?.successMessage || 'Thanks. The agent will be in touch shortly.',
      });
      setForm({ name: '', email: '', phone: '', message: '', prequalified: false });
    } catch (submitError) {
      setSubmitMessage({
        type: 'error',
        text: toDisplayErrorMessage(submitError, 'Failed to submit your inquiry'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitValuation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!page || valuationSubmitting) return;
    const address = valuationForm.address.trim();
    const email = valuationForm.email.trim();
    if (!address || !email) {
      setValuationMessage({ type: 'error', text: 'Property address and email are required.' });
      return;
    }
    const { firstName, lastName } = splitFullName(valuationForm.name);
    try {
      setValuationSubmitting(true);
      setValuationMessage(null);
      const res = await fetch(`/api/sites/${encodeURIComponent(page.slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || 'Home Value',
          lastName: lastName || 'Request',
          email,
          phone: valuationForm.phone.trim() || undefined,
          message: [`Home value request for: ${address}`, qrLeadAttribution].filter(Boolean).join(' | '),
          source: 'LANDING_PAGE_VALUATION',
          qrToken: qrTokenFromUrl || undefined,
          qrUrl: qrTokenFromUrl && typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toDisplayErrorMessage(data?.error ?? data, 'Failed to submit request'));
      }
      setValuationMessage({ type: 'success', text: "Thanks! We'll prepare a custom home value report and reach out shortly." });
      setValuationForm({ address: '', name: '', email: '', phone: '' });
    } catch (err) {
      setValuationMessage({ type: 'error', text: toDisplayErrorMessage(err, 'Failed to submit request') });
    } finally {
      setValuationSubmitting(false);
    }
  };

  // Force-capture gate: session persistence + delay
  const gatePersistMode = page?.forceCapture?.persistMode === 'ALWAYS' ? 'ALWAYS' : 'SESSION';
  const gateStorageKey = gatePersistMode === 'SESSION' && page?.slug ? `aep_gate_unlocked_${page.slug}` : null;
  const gateRequiresPhone = Boolean(page?.forceCapture?.requirePhone);
  const gateForcedByUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('gate') === '1';
  const gateEnabled = Boolean(page?.forceCapture?.enabled || gateForcedByUrl);
  useEffect(() => {
    if (!gateEnabled) return;
    if (gateStorageKey && typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem(gateStorageKey) === '1') {
          setGateUnlocked(true);
          return;
        }
      } catch { /* ignore */ }
    }
    const delay = Math.max(0, Number(page?.forceCapture?.delay || 0));
    const t = window.setTimeout(() => setGateVisible(true), delay);
    return () => window.clearTimeout(t);
  }, [gateEnabled, page?.forceCapture?.delay, gateStorageKey]);

  const submitGate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!page || gateSubmitting) return;
    const { firstName, lastName } = splitFullName(gateForm.name);
    if (!firstName || !gateForm.email.trim()) {
      setGateError('Name and email are required.');
      return;
    }
    if (gateRequiresPhone && !gateForm.phone.trim()) {
      setGateError('Phone number is required to continue.');
      return;
    }
    try {
      setGateSubmitting(true);
      setGateError(null);
      const res = await fetch(`/api/sites/${encodeURIComponent(page.slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: gateForm.email.trim(),
          phone: gateForm.phone.trim() || undefined,
          message: ['Unlocked via force-capture gate', qrLeadAttribution].filter(Boolean).join(' | '),
          source: 'LANDING_PAGE_GATE',
          qrToken: qrTokenFromUrl || undefined,
          qrUrl: qrTokenFromUrl && typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(toDisplayErrorMessage(d?.error ?? d, 'Failed to submit'));
      }
      setGateUnlocked(true);
      setGateVisible(false);
      if (gateStorageKey) {
        try { window.sessionStorage.setItem(gateStorageKey, '1'); } catch { /* ignore */ }
      }
    } catch (err) {
      setGateError(toDisplayErrorMessage(err, 'Failed to submit'));
    } finally {
      setGateSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading property page...
        </div>
      </div>
    );
  }  if (error || !page) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-2xl font-semibold">Landing page unavailable</div>
          <div className="mt-3 text-sm text-slate-400">{error || 'This page is not available right now.'}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: page.theme.colors.background,
        backgroundImage: `radial-gradient(circle at top left, ${rgba(page.branding.primaryColor, isLightTheme ? 0.16 : 0.22)}, transparent 28%), radial-gradient(circle at top right, ${rgba(page.theme.colors.secondary, isLightTheme ? 0.14 : 0.18)}, transparent 24%)${backgroundPattern.layer ? `, ${backgroundPattern.layer}` : ''}`,
        backgroundSize: backgroundPattern.layer ? `auto, auto, ${backgroundPattern.size}` : undefined,
        color: page.theme.colors.text,
        fontFamily: appliedBodyFont,
        ['--lp-card-radius' as any]: `${cornerRadiusPx}px`,
      } as React.CSSProperties}
    >
      {page.content.urgencyText && (
        <div className="px-4 py-2 text-center text-sm font-semibold text-white" style={{ backgroundColor: page.branding.primaryColor }}>
          {page.content.urgencyText}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className={`relative overflow-hidden border p-4 backdrop-blur-xl sm:p-5 ${cardMotionClass}`} style={{ ...surfaceStyle, borderRadius: `${cornerRadiusPx}px` }}>
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-[90px]" style={{ backgroundColor: rgba(page.branding.primaryColor, isLightTheme ? 0.16 : 0.3) }} />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full blur-[90px]" style={{ backgroundColor: rgba(page.theme.colors.secondary, isLightTheme ? 0.14 : 0.25) }} />

          <div className="relative space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0 space-y-3">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="w-full min-w-0 shrink-0 sm:w-auto">
                    {safeBrandLogo ? (
                      <img
                        src={safeBrandLogo}
                        alt={brandName}
                        className={brokerageLogoClass}
                        style={{ width: `min(${headerBrokerageLogoWidth}px, 78vw)`, maxWidth: '100%' }}
                        onError={() => setFailedImages((current) => ({ ...current, brand: true }))}
                      />
                    ) : (
                      <div className="flex w-full max-w-[420px] min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 shadow-sm sm:w-[420px]" style={nestedSurfaceStyle}>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white shadow-sm" style={{ backgroundColor: page.branding.primaryColor }}>
                          {brandInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{brandName}</div>
                          <div className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: mutedTextColor }}>Real Estate Brokerage</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {safeBrandLogo && (
                        <div className="text-base font-semibold sm:text-lg" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{brandName}</div>
                      )}
                      {gateEnabled && (
                        <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#9a3412' : '#fdba74' }}>
                          Registration Required
                        </span>
                      )}
                    </div>
                    <div className={`${safeBrandLogo ? 'mt-1' : ''} text-xs sm:text-sm`} style={{ color: mutedTextColor }}>{page.listing?.address || page.title}</div>
                  </div>
                </div>

                {headerMetaChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {headerMetaChips.map((chip, index) => (
                      <span key={`header-chip-${index}`} className="rounded-full border px-3 py-1 text-[10px] font-semibold sm:text-xs" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#e2e8f0' }}>
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {showLeadCapture && (
                    <a href="#lead-form" className="min-w-[210px] rounded-full px-5 py-2.5 text-center text-xs font-semibold shadow-lg transition-transform hover:scale-[1.02] sm:min-w-0 sm:text-sm" style={primaryButtonStyle}>
                      {page.content.ctaText || page.leadCapture?.buttonText || 'Request Information'}
                    </a>
                  )}
                  {page.agent.phone && (
                    <a href={`tel:${page.agent.phone}`} className="rounded-full border px-5 py-2.5 text-xs font-semibold transition-colors hover:bg-white/10 sm:text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                      Call
                    </a>
                  )}
                  <a href={`mailto:${page.agent.email}`} className="rounded-full border px-5 py-2.5 text-xs font-semibold transition-colors hover:bg-white/10 sm:text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                    Email
                  </a>
                </div>

                {showHeaderQr && activeHeaderQrUrl && (
                  <div className="w-full rounded-2xl border p-3 shadow-sm lg:w-[330px]" style={nestedSurfaceStyle}>
                    <div className="grid grid-cols-[auto_1fr] gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                        <QRCodeSVG
                          value={activeHeaderQrUrl}
                          size={92}
                          level="M"
                          marginSize={1}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                          title={`QR code for ${activeHeaderQrLabel}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setHeaderQrVariant('listing')}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${activeHeaderQrVariant === 'listing' ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}
                          >
                            Listing QR
                          </button>
                          {hasPersonalQr && (
                            <button
                              type="button"
                              onClick={() => setHeaderQrVariant('personal')}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${activeHeaderQrVariant === 'personal' ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}
                            >
                              {page.content.qrPersonalLabel?.trim() || 'Personal QR'}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: eyebrowColor }}>{activeHeaderQrLabel}</div>
                        <div className="mt-1 truncate text-xs" title={activeHeaderQrUrl} style={{ color: mutedTextColor }}>{activeHeaderQrUrl}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined' && navigator.clipboard) {
                                void navigator.clipboard.writeText(activeHeaderQrUrl);
                              }
                            }}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-white/10"
                          >
                            Copy
                          </button>
                          <a
                            href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&format=png&data=${encodeURIComponent(activeHeaderQrUrl)}`}
                            download={`${page.slug}-${activeHeaderQrVariant}-qr.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-white/10"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {page.agent.websiteUrl && (
                <a href={page.agent.websiteUrl} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-[11px] font-medium hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : 'rgba(255,255,255,0.92)' }}>
                  Website
                </a>
              )}
              {page.agent.facebookUrl && (
                <a href={page.agent.facebookUrl} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-[11px] font-medium hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : 'rgba(255,255,255,0.92)' }}>
                  Facebook
                </a>
              )}
              {page.agent.instagramUrl && (
                <a href={page.agent.instagramUrl} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-[11px] font-medium hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : 'rgba(255,255,255,0.92)' }}>
                  Instagram
                </a>
              )}
              {page.agent.linkedinUrl && (
                <a href={page.agent.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-[11px] font-medium hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : 'rgba(255,255,255,0.92)' }}>
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className={`overflow-hidden border shadow-[0_40px_100px_rgba(0,0,0,0.55)] ${cardMotionClass}`} style={{ ...surfaceStyle, borderRadius: `${Math.max(cornerRadiusPx + 4, 16)}px` }}>
          <div className="relative" style={{ minHeight: `${heroMinHeightPx}px` }}>
            {(safeHeroImage || safeGalleryPhotos[0]) ? (
              <img src={safeHeroImage || safeGalleryPhotos[0]} alt={page.title} className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedImages((current) => ({ ...current, hero: true }))} />
            ) : (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 20% 20%, ${rgba(page.branding.primaryColor, 0.55)}, transparent 45%), radial-gradient(circle at 85% 15%, ${rgba(page.theme.colors.secondary, 0.50)}, transparent 40%), radial-gradient(circle at 50% 100%, ${rgba(page.theme.colors.accent, 0.35)}, transparent 50%), linear-gradient(135deg, #0b1220 0%, #0f172a 50%, #1e293b 100%)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.08]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 30h60M30 0v60'/%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                />
                <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full blur-[110px]" style={{ backgroundColor: rgba(page.branding.primaryColor, 0.55) }} />
                <div className="pointer-events-none absolute -bottom-24 -right-20 h-80 w-80 rounded-full blur-[110px]" style={{ backgroundColor: rgba(page.theme.colors.secondary, 0.45) }} />
              </>
            )}
            {heroLayoutVariant === 'split' ? (
              <>
                <div className="absolute inset-0" style={{ background: `linear-gradient(95deg, rgba(255,255,255,${isLightTheme ? '0.88' : '0.14'}), rgba(255,255,255,0))` }} />
                <div className="relative z-10 grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:px-12 lg:py-14">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap gap-2">
                      {heroBadges.map((badge, index) => (
                        <span key={`split-badge-${index}`} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                          {badge}
                        </span>
                      ))}
                    </div>
                    <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: isLightTheme ? '#0f172a' : '#ffffff', fontFamily: appliedHeadingFont }}>
                      {page.content.headline}
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-7 sm:text-lg" style={{ color: isLightTheme ? 'rgba(15,23,42,0.82)' : 'rgba(226,232,240,0.92)' }}>
                      {fallbackSubheadline}
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      {showLeadCapture && (
                        <a href="#lead-form" className="group relative rounded-full px-6 py-3.5 text-sm font-semibold shadow-xl transition-transform hover:scale-[1.03]" style={primaryButtonStyle}>
                          {page.content.ctaText || page.leadCapture?.buttonText || 'Request Information'}
                        </a>
                      )}
                      {page.agent.phone && (
                        <a href={`tel:${page.agent.phone}`} className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                          Call Agent
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div style={imageFrameStyle}>
                      {(safeHeroImage || safeGalleryPhotos[0]) ? (
                        <img src={safeHeroImage || safeGalleryPhotos[0]} alt={page.title} className="h-[360px] w-full object-cover" />
                      ) : (
                        <div className="h-[360px] w-full" style={{ background: `linear-gradient(135deg, ${rgba(page.branding.primaryColor, 0.55)}, ${rgba(page.theme.colors.secondary, 0.55)})` }} />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SnapshotItem label="Price" value={formatCurrency(page.listing?.price) || 'Contact agent'} />
                      <SnapshotItem label="Beds/Baths" value={page.listing?.beds != null && page.listing?.baths != null ? `${page.listing.beds}/${page.listing.baths}` : 'Ask agent'} />
                    </div>
                  </div>
                </div>
              </>
            ) : heroLayoutVariant === 'centered' ? (
              <>
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${page.theme.colors.heroOverlay}, rgba(2,6,23,${safeHeroImage || safeGalleryPhotos[0] ? (isLightTheme ? '0.36' : '0.52') : '0.24'}))` }} />
                <div className="relative z-10 mx-auto max-w-4xl px-6 py-12 text-center sm:px-10 lg:py-16">
                  <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
                    {heroBadges.map((badge, index) => (
                      <span key={`center-badge-${index}`} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                        {badge}
                      </span>
                    ))}
                  </div>

                  <h1 className="mt-6 text-4xl font-bold tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl" style={{ fontFamily: appliedHeadingFont }}>
                    {page.content.headline}
                  </h1>
                  <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-white/95 sm:text-lg">
                    {fallbackSubheadline}
                  </p>

                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    {showLeadCapture && (
                      <a href="#lead-form" className="rounded-full px-6 py-3.5 text-sm font-semibold shadow-2xl transition-transform hover:scale-[1.03]" style={heroPrimaryButtonStyle}>
                        {page.content.ctaText || page.leadCapture?.buttonText || 'Request Information'}
                      </a>
                    )}
                    {page.agent.phone && (
                      <a href={`tel:${page.agent.phone}`} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25">
                        Call Agent
                      </a>
                    )}
                  </div>

                  <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-4">
                    <SnapshotItem label="Price" value={formatCurrency(page.listing?.price) || 'Contact agent'} />
                    <SnapshotItem label="MLS" value={page.listing?.mlsNumber || 'Private'} />
                    <SnapshotItem label="Bedrooms" value={page.listing?.beds != null ? String(page.listing.beds) : 'Ask agent'} />
                    <SnapshotItem label="Bathrooms" value={page.listing?.baths != null ? String(page.listing.baths) : 'Ask agent'} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${page.theme.colors.heroOverlay}, rgba(2,6,23,${safeHeroImage || safeGalleryPhotos[0] ? (isLightTheme ? '0.45' : '0.65') : '0.30'}))` }} />
                <div className="relative z-10 grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-14">
                  <div className="max-w-3xl self-end">
                    <div className="flex flex-wrap gap-2">
                      {heroBadges.map((badge, index) => (
                        <span key={`cinematic-badge-${index}`} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                          {badge}
                        </span>
                      ))}
                    </div>

                    <h1 className="mt-5 text-4xl font-bold tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl" style={{ fontFamily: appliedHeadingFont }}>
                      {page.content.headline}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-lg">
                      {fallbackSubheadline}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      {showLeadCapture && (
                        <a href="#lead-form" className="group relative rounded-full px-6 py-3.5 text-sm font-semibold shadow-2xl transition-transform hover:scale-[1.03]" style={heroPrimaryButtonStyle}>
                          <span className="relative z-10">{page.content.ctaText || page.leadCapture?.buttonText || 'Request Information'}</span>
                          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(135deg, ${rgba('#ffffff', 0.2, '255,255,255')}, transparent 60%)` }} />
                        </a>
                      )}
                      {page.agent.phone && (
                        <a href={`tel:${page.agent.phone}`} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call Agent
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="self-end lg:justify-self-end">
                    <div className="border border-white/15 p-6 text-white backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]" style={{ backgroundColor: 'rgba(2,6,23,0.72)', borderRadius: `${Math.max(cornerRadiusPx, 14)}px` }}>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#a5f3fc' }}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
                        Property snapshot
                      </div>
                      <div className="mt-3 text-xl font-bold text-white">{page.listing?.address || page.title}</div>
                      <div className="mt-2 text-sm text-white/75">
                        {[page.listing?.city, page.listing?.state, page.listing?.zip].filter(Boolean).join(', ') || 'Private listing'}
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <SnapshotItem label="Price" value={formatCurrency(page.listing?.price) || 'Contact agent'} />
                        <SnapshotItem label="MLS" value={page.listing?.mlsNumber || 'Private'} />
                        <SnapshotItem label="Bedrooms" value={page.listing?.beds != null ? String(page.listing.beds) : 'Ask agent'} />
                        <SnapshotItem label="Bathrooms" value={page.listing?.baths != null ? String(page.listing.baths) : 'Ask agent'} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {page.content.stats && (page.content.stats.yearsExperience || page.content.stats.homesSold || page.content.stats.avgDaysOnMarket || page.content.stats.clientRating) && (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className={`grid gap-3 border p-5 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4 ${cardMotionClass}`} style={{ ...surfaceStyle, borderRadius: `${cornerRadiusPx}px` }}>
            {page.content.stats.yearsExperience != null && (
              <StatBlock label="Years Experience" value={String(page.content.stats.yearsExperience)} accent={page.branding.primaryColor} mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
            {page.content.stats.homesSold != null && (
              <StatBlock label="Homes Sold" value={String(page.content.stats.homesSold)} accent={page.theme.colors.secondary} mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
            {page.content.stats.avgDaysOnMarket != null && (
              <StatBlock label="Avg Days on Market" value={String(page.content.stats.avgDaysOnMarket)} accent={page.theme.colors.accent} mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
            {page.content.stats.clientRating != null && (
              <StatBlock label="Client Rating" value={`${page.content.stats.clientRating}/5`} accent="#fbbf24" mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
          </div>
        </section>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="space-y-6">
          {sections.gallery !== false && safeGalleryPhotos.length > 0 && (
            <SurfaceCard title="Photo gallery" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="grid gap-3 sm:grid-cols-2">
                {safeGalleryPhotos.slice(0, 4).map((photo, index) => (
                  <div key={`${photo}-${index}`} style={imageFrameStyle}>
                    <img src={photo} alt={`${page.title} ${index + 1}`} className="h-56 w-full object-cover" onError={() => setFailedImages((current) => ({ ...current, [`gallery-${index}`]: true }))} />
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}

          {sections.features !== false && (page.content.features?.length || page.listing?.description) ? (
            <SurfaceCard title="Why this property stands out" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              {page.content.features?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {page.content.features.map((feature) => (
                    <div key={feature} className="rounded-2xl border px-4 py-3 text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#f8fafc' }}>
                      {feature}
                    </div>
                  ))}
                </div>
              ) : null}
              {page.listing?.description && (
                <p className="mt-4 text-sm leading-7" style={{ color: mutedTextColor }}>{page.listing.description}</p>
              )}
            </SurfaceCard>
          ) : null}

          {showSparseGuidance && (
            <SurfaceCard title="Your next steps" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <p className="text-sm leading-7" style={{ color: mutedTextColor }}>
                This listing is being shared as a private preview. Submit a quick request to unlock full details, upcoming showing availability, and personalized guidance from {page.agent.name}.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  'Get the full property packet and disclosures',
                  'See earliest private-tour time slots',
                  'Receive pricing strategy and offer guidance',
                ].map((item, index) => (
                  <div key={`sparse-step-${index}`} className="rounded-2xl border px-3 py-3 text-xs font-medium" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#f8fafc' }}>
                    {item}
                  </div>
                ))}
              </div>
              {showLeadCapture && (
                <a href="#lead-form" className="mt-4 inline-flex rounded-full px-5 py-2.5 text-xs font-semibold shadow-lg transition-transform hover:scale-[1.02]" style={primaryButtonStyle}>
                  Unlock full property details
                </a>
              )}
            </SurfaceCard>
          )}

          {sections.video !== false && page.content.videoUrl && toEmbedUrl(page.content.videoUrl) && (
            <SurfaceCard title="Property video tour" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={toEmbedUrl(page.content.videoUrl) || undefined}
                  className="absolute inset-0 h-full w-full"
                  title="Property video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </SurfaceCard>
          )}

          {sections.virtualTour !== false && page.content.virtualTourUrl && (
            <SurfaceCard title="Virtual tour" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ paddingBottom: '62%' }}>
                <iframe
                  src={toEmbedUrl(page.content.virtualTourUrl) || undefined}
                  className="absolute inset-0 h-full w-full"
                  title="Virtual tour"
                  allow="xr-spatial-tracking; fullscreen; vr; gyroscope; accelerometer"
                  allowFullScreen
                />
              </div>
              <a href={page.content.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: page.branding.primaryColor }}>
                Open full-screen tour
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </SurfaceCard>
          )}

          {sections.floorPlan !== false && page.content.floorPlanUrl && (
            <SurfaceCard title="Floor plan" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <a href={page.content.floorPlanUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden border border-white/10" style={{ borderRadius: `${Math.max(10, cornerRadiusPx - 8)}px` }}>
                <img src={page.content.floorPlanUrl} alt="Floor plan" className="w-full object-contain bg-white" style={{ borderRadius: imageStyleMode === 'normal' ? '0px' : `${Math.max(10, cornerRadiusPx - 8)}px` }} />
              </a>
            </SurfaceCard>
          )}

          {sections.mortgage !== false && page.listing?.price && (
            <SurfaceCard title="Mortgage calculator" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <MortgageCalculator
                listingPrice={page.listing.price}
                primaryColor={page.branding.primaryColor}
                surfaceStyle={nestedSurfaceStyle}
                nestedSurfaceStyle={nestedSurfaceStyle}
                isLightTheme={isLightTheme}
                mutedTextColor={mutedTextColor}
              />
            </SurfaceCard>
          )}

          {page.otherListings && page.otherListings.length > 0 && (
            <SurfaceCard title={`More listings from ${page.agent.name}`} surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="grid gap-3 sm:grid-cols-2">
                {page.otherListings.map((l) => (
                  <a key={l.slug} href={`/sites/${l.slug}`} className={`group overflow-hidden border transition-transform hover:scale-[1.02] ${cardMotionClass}`} style={{ ...nestedSurfaceStyle, borderRadius: `${Math.max(10, cornerRadiusPx - 8)}px` }}>
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-800" style={imageFrameStyle}>
                      {l.photo ? (
                        <img src={l.photo} alt={l.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-xs" style={{ color: mutedTextColor }}>
                          <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ backgroundColor: isLightTheme ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }}>Preview</span>
                          <span className="mt-2">Photo coming soon</span>
                        </div>
                      )}
                      {l.price && (
                        <div className="absolute bottom-2 left-2 rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg" style={{ backgroundColor: page.branding.primaryColor }}>
                          {formatCurrency(l.price)}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-semibold truncate" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{l.address || l.title}</div>
                      <div className="mt-1 text-xs" style={{ color: mutedTextColor }}>
                        {[l.city, l.state].filter(Boolean).join(', ')}
                      </div>
                      {(l.beds || l.baths || l.sqft) && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium" style={{ color: mutedTextColor }}>
                          {l.beds != null && <span>{l.beds} bd</span>}
                          {l.baths != null && <span>{l.baths} ba</span>}
                          {l.sqft != null && <span>{l.sqft.toLocaleString()} sqft</span>}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </SurfaceCard>
          )}

          {page.content.whyChooseBullets && page.content.whyChooseBullets.length > 0 && (
            <SurfaceCard title="Why work with me" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {page.content.whyChooseBullets.map((bullet, i) => (
                  <li key={`${bullet}-${i}`} className="flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#f8fafc' }}>
                    <svg className="mt-0.5 h-4 w-4 flex-none" fill="none" viewBox="0 0 24 24" stroke={page.branding.primaryColor} strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}

          {sections.neighborhood !== false && page.content.neighborhoodDescription && (
            <SurfaceCard title="Neighborhood" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <p className="text-sm leading-7" style={{ color: mutedTextColor }}>{page.content.neighborhoodDescription}</p>
            </SurfaceCard>
          )}

          {sections.amenities !== false && page.content.nearbyAmenities && page.content.nearbyAmenities.length > 0 && (
            <SurfaceCard title="Nearby amenities" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="grid gap-3 sm:grid-cols-2">
                {page.content.nearbyAmenities.map((amenity) => (
                  <div key={`${amenity.name}-${amenity.distance}`} className="rounded-2xl border px-4 py-3" style={nestedSurfaceStyle}>
                    <div className="text-sm font-medium" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{amenity.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em]" style={{ color: mutedTextColor }}>{amenity.type || 'Local'} • {amenity.distance || 'Nearby'}</div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}

          {sections.testimonials !== false && page.content.testimonials && page.content.testimonials.length > 0 && (
            <SurfaceCard title="What clients say" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="grid gap-4 sm:grid-cols-2">
                {page.content.testimonials.map((testimonial, index) => (
                  <div key={`${testimonial.author}-${index}`} className="rounded-2xl border p-4" style={nestedSurfaceStyle}>
                    <div className="text-sm leading-7" style={{ color: isLightTheme ? '#0f172a' : '#e2e8f0' }}>“{testimonial.text}”</div>
                    <div className="mt-3 text-xs" style={{ color: mutedTextColor }}>{testimonial.author}{testimonial.role ? ` • ${testimonial.role}` : ''}</div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>

        <div className="space-y-6">
          {sections.openHouse !== false && page.content.openHouses && page.content.openHouses.length > 0 && (
            <SurfaceCard title="Upcoming open houses" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="space-y-3">
                {page.content.openHouses.map((openHouse, index) => (
                  <div key={`${openHouse.date}-${index}`} className="rounded-2xl border px-4 py-3" style={nestedSurfaceStyle}>
                    <div className="text-sm font-medium" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{formatOpenHouseDate(openHouse.date)}</div>
                    <div className="mt-1 text-xs" style={{ color: mutedTextColor }}>{openHouse.startTime} - {openHouse.endTime}</div>
                    {openHouse.notes && <div className="mt-2 text-xs" style={{ color: mutedTextColor }}>{openHouse.notes}</div>}
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}

          {sections.homeValuation === true && (
            <SurfaceCard title="What's your home worth?" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <p className="text-sm" style={{ color: mutedTextColor }}>
                Get a free, no-obligation custom valuation report based on recent comparable sales in your neighborhood.
              </p>
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitValuation}>
                <input
                  type="text"
                  value={valuationForm.address}
                  onChange={(e) => setValuationForm((c) => ({ ...c, address: e.target.value }))}
                  placeholder="Property address"
                  className="sm:col-span-2 w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                  required
                />
                <input
                  type="text"
                  value={valuationForm.name}
                  onChange={(e) => setValuationForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                />
                <input
                  type="tel"
                  value={valuationForm.phone}
                  onChange={(e) => setValuationForm((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="Phone (optional)"
                  className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                />
                <input
                  type="email"
                  value={valuationForm.email}
                  onChange={(e) => setValuationForm((c) => ({ ...c, email: e.target.value }))}
                  placeholder="Email address"
                  className="sm:col-span-2 w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                  required
                />
                {valuationMessage && (
                  <div className={`sm:col-span-2 rounded-2xl px-4 py-3 text-sm ${valuationMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-200 border border-rose-500/20'}`}>
                    {valuationMessage.text}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={valuationSubmitting}
                  className="sm:col-span-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={primaryButtonStyle}
                >
                  {valuationSubmitting ? 'Sending...' : 'Get my free home value report'}
                </button>
              </form>
            </SurfaceCard>
          )}

          {sections.agent !== false && (
            <SurfaceCard title="Meet your agent" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="flex items-start gap-4">
                {safeAgentPhoto ? (
                  <img src={safeAgentPhoto} alt={page.agent.name} className="h-16 w-16 rounded-2xl object-cover" onError={() => setFailedImages((current) => ({ ...current, agent: true }))} />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-semibold text-white" style={{ backgroundColor: page.branding.primaryColor }}>
                    {page.agent.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-lg font-semibold" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{page.agent.name}</div>
                  <div className="mt-1 text-sm" style={{ color: mutedTextColor }}>{page.agent.title || page.brokerage.name || 'Real Estate Professional'}</div>
                  {page.agent.licenseNumber && <div className="mt-1 text-xs" style={{ color: mutedTextColor }}>License {page.agent.licenseNumber}</div>}
                </div>
              </div>
              <p className="mt-4 text-sm leading-7" style={{ color: mutedTextColor }}>{agentBioText}</p>
              <div className="mt-4 grid gap-2 text-sm" style={{ color: isLightTheme ? '#0f172a' : '#e2e8f0' }}>
                <a href={`mailto:${page.agent.email}`} className="rounded-xl border px-3 py-2 hover:bg-white/10" style={nestedSurfaceStyle}>{page.agent.email}</a>
                {page.agent.phone && <a href={`tel:${page.agent.phone}`} className="rounded-xl border px-3 py-2 hover:bg-white/10" style={nestedSurfaceStyle}>{page.agent.phone}</a>}
                {page.brokerage.phone && <div className="rounded-xl border px-3 py-2" style={nestedSurfaceStyle}>{page.brokerage.phone}</div>}
                {page.brokerage.address && <div className="rounded-xl border px-3 py-2" style={nestedSurfaceStyle}>{page.brokerage.address}</div>}
                {page.brokerage.license && <div className="rounded-xl border px-3 py-2" style={nestedSurfaceStyle}>Brokerage License {page.brokerage.license}</div>}
              </div>
            </SurfaceCard>
          )}

          {showLeadCapture && sections.contact !== false && (
            <SurfaceCard title={page.leadCapture?.formTitle || 'Request information'} id="lead-form" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <p className="text-sm" style={{ color: mutedTextColor }}>{page.leadCapture?.formSubtitle || 'Tell us how to reach you and we will follow up shortly.'}</p>

              <form className="mt-4 space-y-3" onSubmit={submitLead}>
                {requiredFields.includes('name') && (
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                    required
                  />
                )}
                {requiredFields.includes('email') && (
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Email address"
                    className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                    required
                  />
                )}
                {requiredFields.includes('phone') && (
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Phone number"
                    className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                  />
                )}
                {requiredFields.includes('message') && (
                  <textarea
                    value={form.message}
                    onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                    placeholder="What would you like to know?"
                    rows={4}
                    className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                  />
                )}
                {requiredFields.includes('prequalified') && (
                  <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#e2e8f0' }}>
                    <input
                      type="checkbox"
                      checked={form.prequalified}
                      onChange={(event) => setForm((current) => ({ ...current, prequalified: event.target.checked }))}
                    />
                    I am already pre-qualified
                  </label>
                )}

                {submitMessage && (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${submitMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-200 border border-rose-500/20'}`}>
                    {submitMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={primaryButtonStyle}
                >
                  {submitting ? 'Sending...' : page.leadCapture?.buttonText || page.content.ctaText || 'Send request'}
                </button>
              </form>
            </SurfaceCard>
          )}
        </div>
      </div>

      {/* Bottom CTA band */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className={`relative overflow-hidden border p-8 text-center backdrop-blur-xl sm:p-12 ${cardMotionClass}`} style={{ ...surfaceStyle, borderRadius: `${Math.max(cornerRadiusPx + 4, 16)}px` }}>
          <div className="pointer-events-none absolute -top-16 left-1/4 h-56 w-56 rounded-full blur-[90px]" style={{ backgroundColor: rgba(page.branding.primaryColor, 0.35) }} />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 h-56 w-56 rounded-full blur-[90px]" style={{ backgroundColor: rgba(page.theme.colors.secondary, 0.3) }} />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: eyebrowColor }}>Let's get started</div>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: isLightTheme ? '#0f172a' : '#ffffff', fontFamily: appliedHeadingFont }}>
              Ready to make your next move?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base" style={{ color: mutedTextColor }}>
              Whether you're buying, selling, or exploring options, {page.agent.name.split(' ')[0]} is here to guide you every step of the way.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {showLeadCapture && (
                <a href="#lead-form" className="rounded-full px-6 py-3 text-sm font-semibold shadow-xl transition-transform hover:scale-[1.03]" style={primaryButtonStyle}>
                  {page.content.ctaText || 'Schedule a Showing'}
                </a>
              )}
              {page.agent.phone && (
                <a href={`tel:${page.agent.phone}`} className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                  Call {page.agent.phone}
                </a>
              )}
              <a href={`mailto:${page.agent.email}`} className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                Email Agent
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-7xl px-4 pb-28 text-center text-xs sm:px-6 lg:px-8 lg:pb-10" style={{ color: mutedTextColor }}>
        <div className="flex flex-col items-center gap-2">
          <div>
            &copy; {new Date().getFullYear()} {page.brokerage.name || page.agent.name}. All rights reserved.
          </div>
          {(page.agent.licenseNumber || page.brokerage.license) && (
            <div>
              {page.agent.licenseNumber && `Agent License ${page.agent.licenseNumber}`}
              {page.agent.licenseNumber && page.brokerage.license && ' • '}
              {page.brokerage.license && `Brokerage License ${page.brokerage.license}`}
            </div>
          )}
        </div>
      </footer>

      {/* Force-capture gate */}
      {gateEnabled && !gateUnlocked && gateVisible && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(10px)' }} role="dialog" aria-modal="true">
          <div className="w-full max-w-md border border-white/10 bg-slate-950/95 p-7 shadow-2xl" style={{ borderRadius: `${Math.max(cornerRadiusPx, 16)}px` }}>
            <div className="flex items-center gap-3">
              {safeBrandLogo ? (
                <img
                  src={safeBrandLogo}
                  alt=""
                  className={compactBrokerageLogoClass}
                  style={{ width: compactBrokerageLogoWidth, maxWidth: '48vw' }}
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: page.branding.primaryColor }}>
                  {(page.brokerage.name || page.agent.name).slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-white">{page.brokerage.name || page.agent.name}</div>
                <div className="text-[11px] text-slate-400">Exclusive access</div>
              </div>
            </div>
            <h2 className="mt-5 text-2xl font-bold text-white">
              {page.forceCapture?.headline || 'Get instant access'}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {page.forceCapture?.subheadline || 'Enter your details to unlock full property photos, pricing, and schedule a private tour.'}
            </p>
            <form className="mt-5 space-y-2.5" onSubmit={submitGate}>
              <input
                type="text"
                value={gateForm.name}
                onChange={(e) => setGateForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                required
              />
              <input
                type="email"
                value={gateForm.email}
                onChange={(e) => setGateForm((c) => ({ ...c, email: e.target.value }))}
                placeholder="Email address"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                required
              />
              <input
                type="tel"
                value={gateForm.phone}
                onChange={(e) => setGateForm((c) => ({ ...c, phone: e.target.value }))}
                placeholder={gateRequiresPhone ? 'Phone number (required)' : 'Phone (optional)'}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                required={gateRequiresPhone}
              />
              {gateError && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{gateError}</div>
              )}
              <button
                type="submit"
                disabled={gateSubmitting}
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-lg transition-opacity disabled:opacity-60"
                style={primaryButtonStyle}
              >
                {gateSubmitting ? 'Unlocking...' : page.forceCapture?.ctaText || 'Unlock property details'}
              </button>
              <p className="pt-2 text-center text-[11px] text-slate-500">
                Your info is sent directly to {page.agent.name}'s lead inbox for fast follow-up.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Sticky mobile contact bar */}
      {(page.agent.phone || page.agent.email) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur-xl lg:hidden">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${mobileActionCount}, minmax(0, 1fr))` }}>
            {page.agent.phone && (
              <a href={`tel:${page.agent.phone}`} className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] font-semibold text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                Call
              </a>
            )}
            {page.agent.phone && (
              <a href={`sms:${page.agent.phone}`} className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] font-semibold text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                Text
              </a>
            )}
            <a href="#lead-form" className="flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold shadow-lg" style={primaryButtonStyle}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Inquire
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function SurfaceCard({
  title,
  children,
  id,
  surfaceStyle,
  eyebrowColor,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
  surfaceStyle?: React.CSSProperties;
  eyebrowColor?: string;
}) {
  return (
    <section id={id} className="border p-5 backdrop-blur-xl sm:p-6" style={{ ...surfaceStyle, borderRadius: 'var(--lp-card-radius, 28px)' }}>
      <div className="text-xs uppercase tracking-[0.18em]" style={{ color: eyebrowColor || '#a5f3fc' }}>{title}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/15 bg-white/10 px-3 py-3" style={{ borderRadius: 'var(--lp-card-radius, 28px)' }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function StatBlock({ label, value, accent, mutedTextColor, isLightTheme }: { label: string; value: string; accent: string; mutedTextColor: string; isLightTheme: boolean }) {
  return (
    <div className="relative overflow-hidden border border-white/10 bg-white/5 px-5 py-4" style={{ borderRadius: 'var(--lp-card-radius, 28px)' }}>
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl" style={{ backgroundColor: accent, opacity: 0.2 }} />
      <div className="relative">
        <div className="text-3xl font-bold" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{value}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>{label}</div>
      </div>
    </div>
  );
}

export default PublicLandingPage;