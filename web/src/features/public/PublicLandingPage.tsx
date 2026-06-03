import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, Award, Calendar, Check, Copy, ExternalLink, FileDown, Home, Link2, Mail, Phone, Share2, ShieldCheck, Star, Zap, type LucideIcon } from 'lucide-react';
import { getTemplateMediaPack } from '../landing/templateMediaSuggestions';
import { toDisplayErrorMessage } from '../../lib/errorMessages';
import { buildTrackedLandingQrUrl } from '../../lib/landingQr';
import { downloadLandingPagePdf } from '../../lib/landingPdf';
import { getLandingPageIntent, looksLikePersonalHeadline, looksLikePersonalSubheadline } from '../../lib/landingPageIntent';

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
  pageKind?: string | null;
  publicUrl?: string;
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
    pageKind?: string | null;
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
    profileUrl?: string | null;
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

type HeaderQrItem = {
  key: 'listing' | 'personal';
  label: string;
  switchLabel: string;
  url: string;
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

function getQrDisplayLabel(value: string | undefined | null, fallback: string) {
  const label = String(value || '').trim();
  if (!label || /free\s*search/i.test(label)) return fallback;
  if (/agent\s*info/i.test(fallback) && /^agent\s*(info|contact)(\s*qr)?$/i.test(label)) return fallback;
  return label;
}

function slugToTitle(value: string | undefined | null) {
  return String(value || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function compactQrCardLabel(value: string | undefined | null, fallback: string, maxLength = 24) {
  const label = String(value || '').replace(/\s+/g, ' ').replace(/^free\s+/i, '').trim();
  if (!label) return fallback;
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(8, maxLength - 3)).trimEnd()}...`;
}

function normalizeLeadCtaText(value: string | undefined | null, hasValuationSection: boolean, hasListing: boolean) {
  const label = String(value || '').trim();
  if (!label) return hasListing ? 'Request listing info' : 'Request agent info';
  if (!hasValuationSection && /home\s*value|valuation\s*report/i.test(label)) {
    return hasListing ? 'Request listing info' : 'Request agent info';
  }
  return label;
}

function buildUtahRealEstateMlsUrl(mlsNumber: string) {
  const normalized = mlsNumber.replace(/[^0-9A-Za-z-]/g, '').trim();
  return normalized ? `https://www.utahrealestate.com/${encodeURIComponent(normalized)}` : '';
}

function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value;
}

function toRoundedNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10;
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
  const [quickQuestionOpen, setQuickQuestionOpen] = useState(false);
  const [quickQuestionSubmitting, setQuickQuestionSubmitting] = useState(false);
  const [quickQuestionMessage, setQuickQuestionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [quickQuestionForm, setQuickQuestionForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'building' | 'ready' | 'error'>('idle');
  const [qrCopyStatus, setQrCopyStatus] = useState<'listing' | 'personal' | null>(null);
  const [activeHeaderQrKey, setActiveHeaderQrKey] = useState<'listing' | 'personal'>('listing');

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
  const brandLogoCandidates = Array.from(new Set([
    page?.brokerage.logoUrl,
    page?.branding.logoUrl,
  ].filter(Boolean) as string[]));
  const safeBrandLogo = brandLogoCandidates.find((url) => !failedImages[`brand:${url}`]) || null;
  const markBrandLogoFailed = (url: string | null) => {
    if (!url) return;
    setFailedImages((current) => ({ ...current, [`brand:${url}`]: true }));
  };
  const brokerageLogoWidth = clampBrokerageLogoWidth(page?.brokerage.logoWidth);
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
  const agentInitials = (page?.agent.name || 'Agent')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'A';
  const compactBrokerageLogoClass = brokerageLogoBackground === 'TRANSPARENT'
    ? 'h-11 rounded-xl object-contain'
    : 'h-11 rounded-xl border border-white/10 bg-white/90 p-2 object-contain shadow-sm';
  const sections = page?.sections || {};
  const locationLabel = [page?.listing?.city, page?.listing?.state].filter(Boolean).join(', ');
  const pageIntent = getLandingPageIntent({
    title: page?.title,
    description: page?.description,
    pageKind: page?.pageKind || page?.content.pageKind,
    content: page?.content,
    sections,
    listing: page?.listing,
  });
  const heroHeadline = page
    ? pageIntent.kind === 'listing' && page.listing && looksLikePersonalHeadline(page.content.headline, page.agent.name)
      ? page.listing.address || page.title || page.content.headline
      : page.content.headline || page.listing?.address || page.title
    : '';
  const listingSubheadlineFallback = page?.listing
    ? page.listing.description ||
      [
        [
          page.listing.beds != null && page.listing.baths != null ? `${page.listing.beds} beds, ${page.listing.baths} baths` : '',
          page.listing.sqft ? `${Number(page.listing.sqft).toLocaleString()} sqft` : '',
        ].filter(Boolean).join(' - '),
        locationLabel,
        'showing options and direct listing guidance',
      ].filter(Boolean).join(' - ')
    : '';
  const fallbackSubheadline = page
    ? pageIntent.kind === 'listing' && page.listing && looksLikePersonalSubheadline(page.content.subheadline)
      ? listingSubheadlineFallback || page.description || `Private showings, pricing guidance, and direct listing insight with ${page.agent.name}.`
      : page.content.subheadline || page.description || (
          pageIntent.kind === 'agent-profile'
            ? `Connect with ${page.agent.name} for buying, selling, home value questions, and next-step real estate guidance.`
            : `Private showings, pricing guidance, and direct local insight with ${page.agent.name}.`
        )
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
    const primaryLuminance = luminance(primary);
    const secondaryLuminance = luminance(secondary);
    const primaryTextColor = primaryLuminance > 0.56 ? '#0f172a' : '#ffffff';
    const gradientTextColor = (primaryLuminance + secondaryLuminance) / 2 > 0.58 ? '#0f172a' : '#ffffff';

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
          color: primaryTextColor,
          boxShadow: `0 18px 40px ${rgba(primary, 0.55)}`,
        } as React.CSSProperties;
      case 'solid':
        return {
          backgroundColor: primary,
          border: `1px solid ${rgba(primary, 0.45)}`,
          color: primaryTextColor,
        } as React.CSSProperties;
      case 'gradient':
      default:
        return {
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          border: `1px solid ${rgba(primary, 0.45)}`,
          color: gradientTextColor,
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

  const requiredFields = page?.leadCapture?.requiredFields || ['name', 'email', 'phone'];
  const showLeadCapture = page?.leadCapture?.enabled !== false;
  const leadCtaText = normalizeLeadCtaText(page?.content.ctaText || page?.leadCapture?.buttonText, sections.homeValuation === true, Boolean(page?.listing));
  const landingContextLabel = pageIntent.publicLabel;
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
  const basePublicUrl = page?.publicUrl || (page && typeof window !== 'undefined' ? `${window.location.origin}/sites/${page.slug}` : '/');
  const listingQrToken = page?.content.qrListingToken?.trim() || '';
  const tokenizedListingQrUrl = listingQrToken && page ? buildTrackedLandingQrUrl(basePublicUrl, page.slug, listingQrToken) : '';
  const listingQrUrl = tokenizedListingQrUrl || page?.content.qrListingUrl?.trim() || basePublicUrl;
  const personalQrUrl = page?.content.qrPersonalUrl?.trim() || page?.agent.profileUrl || page?.agent.websiteUrl || (page?.agent.email ? `mailto:${page.agent.email}` : '');
  const showHeaderQr = Boolean(page?.content.showHeaderQr && (listingQrUrl || personalQrUrl));
  const qrTokenFromUrl = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('lpqr') || new URLSearchParams(window.location.search).get('utm_content') || '').trim()
    : '';
  const qrLeadAttribution = qrTokenFromUrl ? `QR token: ${qrTokenFromUrl}` : '';
  const personalQrLabel = getQrDisplayLabel(page?.content.qrPersonalLabel, 'Agent Info');
  const agentPhone = page?.agent.phone?.trim() || '';
  const agentPhoneLabel = agentPhone ? formatPhoneDisplay(agentPhone) : '';
  const agentPhoneHref = agentPhone ? `tel:${agentPhone.replace(/[^\d+]/g, '') || agentPhone}` : '';
  const listingMlsNumber = page?.listing?.mlsNumber?.trim() || '';
  const utahRealEstateMlsUrl = listingMlsNumber ? buildUtahRealEstateMlsUrl(listingMlsNumber) : '';
  const shareUrl = basePublicUrl;
  const landingQrCardLabel = useMemo(() => {
    if (!page) return 'Landing Page';

    if (!page.listing && sections.homeValuation === true) {
      const searchable = `${page.title || ''} ${page.content.headline || ''}`;
      if (/home\s*value|valuation|worth|sell\s*for/i.test(searchable)) return 'Home Value Report';
    }

    const rawLabel = page.listing?.address || page.title || page.content.headline || slugToTitle(page.slug);
    return compactQrCardLabel(rawLabel, pageIntent.publicLabel, page.listing ? 26 : 24);
  }, [page, pageIntent.publicLabel, sections.homeValuation]);
  const headerQrItems = useMemo(() => {
    const items: HeaderQrItem[] = [];
    const pageSwitchLabel = compactQrCardLabel(landingQrCardLabel.replace(/\s+report$/i, ''), 'Landing Page', 16);
    if (listingQrUrl) {
      items.push({
        key: 'listing',
        label: landingQrCardLabel,
        switchLabel: pageSwitchLabel,
        url: listingQrUrl,
      });
    }
    if (personalQrUrl) {
      items.push({
        key: 'personal',
        label: compactQrCardLabel(personalQrLabel || 'Agent Info', 'Agent Info', 22),
        switchLabel: 'Agent Info',
        url: personalQrUrl,
      });
    }
    return items.slice(0, 2);
  }, [landingQrCardLabel, listingQrToken, listingQrUrl, page?.slug, personalQrLabel, personalQrUrl]);
  const activeHeaderQrItem = useMemo(
    () => headerQrItems.find((item) => item.key === activeHeaderQrKey) || headerQrItems[0] || null,
    [activeHeaderQrKey, headerQrItems],
  );
  const headerMetaChips = useMemo(() => {
    const chips = [
      formatCurrency(page?.listing?.price),
      page?.listing?.beds != null && page?.listing?.baths != null
        ? `${page.listing.beds} bd • ${page.listing.baths} ba`
        : null,
      locationLabel || null,
      listingMlsNumber ? `UtahRealEstate.com MLS #${listingMlsNumber}` : null,
    ].filter(Boolean) as string[];
    return chips.slice(0, 3);
  }, [listingMlsNumber, locationLabel, page]);

  const hasListingFacts = useMemo(() => {
    const l = page?.listing;
    return Boolean(l && (l.price != null || (l.beds != null && l.baths != null) || listingMlsNumber));
  }, [page?.listing, listingMlsNumber]);

  const heroTrustBadges = useMemo(() => (
    [
      { icon: ShieldCheck, label: 'Free • No obligation' },
      { icon: Zap, label: '24-hour reply' },
      { icon: Home, label: 'Local market data' },
    ]
  ), []);

  const topCardHighlights = useMemo(() => {
    const highlights: string[] = [];
    const priceText = formatCurrency(page?.listing?.price);
    if (priceText) highlights.push(priceText);
    if (page?.listing?.beds != null && page?.listing?.baths != null) {
      highlights.push(`${page.listing.beds} bd • ${page.listing.baths} ba`);
    }

    const yearsExperience = page?.content?.stats?.yearsExperience;
    if (yearsExperience != null && String(yearsExperience).trim()) {
      highlights.push(`${yearsExperience} years experience`);
    }

    const homesSold = page?.content?.stats?.homesSold;
    if (homesSold != null && String(homesSold).trim()) {
      highlights.push(`${homesSold} homes sold`);
    }

    const avgDom = page?.content?.stats?.avgDaysOnMarket;
    if (avgDom != null && String(avgDom).trim()) {
      highlights.push(`${avgDom} day avg DOM`);
    }

    const clientRating = page?.content?.stats?.clientRating;
    if (clientRating != null && String(clientRating).trim()) {
      highlights.push(`${clientRating}/5 client rating`);
    }

    if (highlights.length === 0) {
      highlights.push('Free no-obligation guidance');
      highlights.push('24-hour follow-up');
      highlights.push('Local market expertise');
    } else if (highlights.length < 3) {
      const fallback = ['Free no-obligation guidance', '24-hour follow-up', 'Local market expertise'];
      for (const item of fallback) {
        if (!highlights.includes(item)) highlights.push(item);
        if (highlights.length >= 3) break;
      }
    }

    return highlights.slice(0, 3);
  }, [
    page?.content?.stats?.avgDaysOnMarket,
    page?.content?.stats?.clientRating,
    page?.content?.stats?.homesSold,
    page?.content?.stats?.yearsExperience,
    page?.listing?.baths,
    page?.listing?.beds,
    page?.listing?.price,
  ]);

  const agentNameParts = (page?.agent.name || '').split(/\s+/).filter(Boolean);
  const agentFirstName = agentNameParts[0] || 'agent';
  const agentLastName = agentNameParts.length > 1 ? agentNameParts[agentNameParts.length - 1] : '';
  const agentDisplayName = page?.agent.name || 'Your agent';
  const agentProfessionalLine = [page?.agent.title, brandName].filter(Boolean).join(' • ') || 'Real Estate Professional';
  const visibleOtherListings = useMemo(() => (
    (page?.otherListings || []).filter((l) => Boolean(l.photo))
  ), [page?.otherListings]);
  const agentBioText = page?.agent.bio?.trim() ||
    `${page?.agent.name || 'Your agent'} provides personalized guidance${locationLabel ? ` across ${locationLabel}` : ''}. Share your goals and you'll get a clear game plan, pricing insight, and next available showing times.`;
  const heroBadges = useMemo(() => {
    const badges: string[] = [];
    const priceText = formatCurrency(page?.listing?.price);
    if (priceText) badges.push(priceText);
    if (page?.listing?.beds != null && page?.listing?.baths != null) {
      badges.push(`${page.listing.beds} bd • ${page.listing.baths} ba${page.listing?.sqft ? ` • ${page.listing.sqft.toLocaleString()} sqft` : ''}`);
    }
    if (listingMlsNumber) badges.push(`UtahRealEstate.com MLS #${listingMlsNumber}`);

    if (badges.length === 0) {
      if (pageIntent.kind === 'agent-profile') {
        badges.push('Agent profile');
        badges.push('Buyer and seller guidance');
        badges.push('Fast follow-up');
      } else if (pageIntent.kind === 'seller') {
        badges.push('Home value strategy');
        if (locationLabel) badges.push(locationLabel);
        badges.push('Local pricing guidance');
      } else if (pageIntent.kind === 'buyer') {
        badges.push('Buyer game plan');
        if (locationLabel) badges.push(locationLabel);
        badges.push('Showing strategy');
      } else {
        badges.push(pageIntent.kind === 'listing' ? 'Listing preview' : landingContextLabel);
        if (locationLabel) badges.push(locationLabel);
        badges.push('Fast agent follow-up');
      }
    }

    return badges.slice(0, 4);
  }, [landingContextLabel, listingMlsNumber, locationLabel, page, pageIntent.kind]);

  const agentValuePillars = useMemo(() => {
    if (!page) return [];

    const pillars: Array<{
      label: string;
      value: string;
      icon: LucideIcon;
      accent: string;
    }> = [];

    const yearsExperience = toRoundedNumber(page.content?.stats?.yearsExperience);
    if (yearsExperience && yearsExperience > 0) {
      pillars.push({
        label: 'Experience',
        value: `${yearsExperience}+ years guiding clients`,
        icon: Award,
        accent: page.branding.primaryColor,
      });
    }

    const homesSold = toRoundedNumber(page.content?.stats?.homesSold);
    if (homesSold && homesSold > 0) {
      pillars.push({
        label: 'Track Record',
        value: `${homesSold}+ homes successfully navigated`,
        icon: Star,
        accent: page.theme.colors.accent,
      });
    }

    if (locationLabel) {
      pillars.push({
        label: 'Local Focus',
        value: `Hyper-local strategy for ${locationLabel}`,
        icon: Home,
        accent: page.theme.colors.secondary,
      });
    }

    if (pillars.length < 3) {
      pillars.push({
        label: 'Fast Follow-Up',
        value: 'Most inquiries receive a response within 24 hours',
        icon: Zap,
        accent: page.theme.colors.secondary,
      });
    }

    if (pillars.length < 3) {
      pillars.push({
        label: 'Trusted Process',
        value: 'Clear steps, low-pressure guidance, and direct communication',
        icon: ShieldCheck,
        accent: page.branding.primaryColor,
      });
    }

    return pillars.slice(0, 3);
  }, [locationLabel, page]);

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!page || submitting) return;

    const { firstName, lastName } = splitFullName(form.name);
    if (!firstName || !form.email.trim()) {
      setSubmitMessage({ type: 'error', text: 'Name and email are required.' });
      return;
    }
    if (!isValidEmailAddress(form.email)) {
      setSubmitMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (requiredFields.includes('phone') && !form.phone.trim()) {
      setSubmitMessage({ type: 'error', text: 'Phone number is required.' });
      return;
    }
    if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
      setSubmitMessage({ type: 'error', text: 'Enter a valid phone number.' });
      return;
    }
    if (requiredFields.includes('message') && !form.message.trim()) {
      setSubmitMessage({ type: 'error', text: 'Message is required.' });
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

  const submitQuickQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!page || quickQuestionSubmitting) return;

    const { firstName, lastName } = splitFullName(quickQuestionForm.name);
    const email = quickQuestionForm.email.trim();
    const question = quickQuestionForm.message.trim();
    if (!firstName || !email || !question) {
      setQuickQuestionMessage({ type: 'error', text: 'Name, email, and your question are required.' });
      return;
    }
    if (!isValidEmailAddress(email)) {
      setQuickQuestionMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (quickQuestionForm.phone.trim() && !isValidPhoneNumber(quickQuestionForm.phone)) {
      setQuickQuestionMessage({ type: 'error', text: 'Enter a valid phone number.' });
      return;
    }

    try {
      setQuickQuestionSubmitting(true);
      setQuickQuestionMessage(null);

      const res = await fetch(`/api/sites/${encodeURIComponent(page.slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: quickQuestionForm.phone.trim() || undefined,
          message: [`Quick question: ${question}`, qrLeadAttribution].filter(Boolean).join(' | '),
          source: 'LANDING_PAGE_EMAIL',
          contactIntent: 'EMAIL_QUESTION',
          qrToken: qrTokenFromUrl || undefined,
          qrUrl: qrTokenFromUrl && typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toDisplayErrorMessage(data?.error ?? data, 'Failed to send your question'));
      }

      setQuickQuestionMessage({ type: 'success', text: `Thanks. Your question was sent to ${page.agent.name}.` });
      setQuickQuestionForm({ name: '', email: '', phone: '', message: '' });
    } catch (submitError) {
      setQuickQuestionMessage({ type: 'error', text: toDisplayErrorMessage(submitError, 'Failed to send your question') });
    } finally {
      setQuickQuestionSubmitting(false);
    }
  };

  const submitValuation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!page || valuationSubmitting) return;
    const address = valuationForm.address.trim();
    const email = valuationForm.email.trim();
    const phone = valuationForm.phone.trim();
    if (!address || !valuationForm.name.trim() || !email || !phone) {
      setValuationMessage({ type: 'error', text: 'Property address, name, email, and phone are required.' });
      return;
    }
    if (!isValidEmailAddress(email)) {
      setValuationMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setValuationMessage({ type: 'error', text: 'Enter a valid phone number.' });
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
          phone,
          propertyAddress: address,
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
    if (!isValidEmailAddress(gateForm.email)) {
      setGateError('Enter a valid email address.');
      return;
    }
    if (gateRequiresPhone && !gateForm.phone.trim()) {
      setGateError('Phone number is required to continue.');
      return;
    }
    if (gateForm.phone.trim() && !isValidPhoneNumber(gateForm.phone)) {
      setGateError('Enter a valid phone number.');
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

  const copyShareUrl = async () => {
    if (!shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('copied');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setShareStatus('idle'), 2200);
      }
    } catch {
      setShareStatus('idle');
    }
  };

  const shareLandingPage = async () => {
    if (!page || !shareUrl) return;
    const shareText = page.listing?.address
      ? `${page.listing.address} shared by ${page.agent.name}`
      : `${heroHeadline || page.title} shared by ${page.agent.name}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: page.title, text: shareText, url: shareUrl });
        setShareStatus('shared');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus('copied');
      }
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setShareStatus('idle'), 2200);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setShareStatus('idle');
      }
    }
  };

  const exportLandingPdf = async () => {
    if (!page || pdfStatus === 'building') return;
    if (typeof document === 'undefined') return;

    const rootElement = document.getElementById('public-landing-root');
    if (!rootElement) {
      setPdfStatus('error');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setPdfStatus('idle'), 2800);
      }
      return;
    }

    try {
      setPdfStatus('building');
      setShareMenuOpen(false);

      if (typeof window !== 'undefined') {
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
        });
      }

      await downloadLandingPagePdf({
        rootElement,
        fileName: `${page.slug || 'landing-page'}-full-page.pdf`,
      });

      setPdfStatus('ready');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setPdfStatus('idle'), 2800);
      }
    } catch {
      setPdfStatus('error');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setPdfStatus('idle'), 3200);
      }
    }
  };

  const copyHeaderQrUrl = async (key: 'listing' | 'personal', url: string) => {
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setQrCopyStatus(key);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          setQrCopyStatus((current) => (current === key ? null : current));
        }, 1800);
      }
    } catch {
      setQrCopyStatus(null);
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

  const heroAgentCard = (
    <div
      className="w-full overflow-hidden border border-white/[0.18] p-4 text-white shadow-[0_28px_76px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:p-5"
      style={{
        background: 'linear-gradient(145deg, rgba(2,6,23,0.90), rgba(15,23,42,0.76))',
        borderRadius: `${Math.max(cornerRadiusPx + 2, 20)}px`,
      }}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
          {safeAgentPhoto ? (
            <img
              src={safeAgentPhoto}
              alt={agentDisplayName}
              className="h-[4.5rem] w-[4.5rem] rounded-2xl border border-white/[0.35] object-cover shadow-[0_16px_36px_rgba(0,0,0,0.38)] ring-2 ring-white/70"
              onError={() => setFailedImages((current) => ({ ...current, agent: true }))}
            />
          ) : (
            <div
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/25 text-xl font-black text-white shadow-[0_16px_36px_rgba(0,0,0,0.34)]"
              style={{ background: `linear-gradient(135deg, ${page.branding.primaryColor}, ${page.theme.colors.secondary})` }}
            >
              {agentInitials}
            </div>
          )}
          {safeBrandLogo && (
            <div className="absolute -bottom-2 -right-2.5 flex h-8 w-12 items-center justify-center rounded-xl border border-white/[0.35] bg-white p-1.5 shadow-lg">
              <img
                src={safeBrandLogo}
                alt={brandName}
                className="h-full w-full object-contain"
                onError={() => markBrandLogoFailed(safeBrandLogo)}
              />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Presented by</div>
          <div className="mt-1 truncate text-xl font-black leading-none text-white sm:text-[1.55rem]">
            {agentDisplayName}
          </div>
          <div className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5 text-white/[0.80] sm:text-[13px]">
            {agentProfessionalLine}
          </div>
        </div>
      </div>

      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-white/10 pt-3">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/[0.78]">
          {agentLastName ? `${agentLastName} standard` : 'Local guidance'}
        </span>
        <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/[0.76]">
          Fast reply
        </span>
      </div>
    </div>
  );

  return (
    <div
      id="public-landing-root"
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

      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className={`relative overflow-hidden border p-3 backdrop-blur-xl sm:p-4 ${cardMotionClass}`} style={{ ...surfaceStyle, borderRadius: `${cornerRadiusPx}px` }}>
          <div className="relative grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(206px,268px)] lg:grid-cols-[minmax(0,1fr)_minmax(230px,286px)] sm:items-stretch">
            <div className="min-w-0 sm:pr-1 lg:pr-2 sm:flex sm:flex-col sm:gap-2.5">
              <div className="rounded-2xl border p-2.5" style={nestedSurfaceStyle}>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`${safeAgentPhoto || !safeBrandLogo ? 'h-14 w-14' : 'h-14 w-20'} relative shrink-0`}>
                      {safeAgentPhoto ? (
                        <img
                          src={safeAgentPhoto}
                          alt={page.agent.name}
                          className="h-14 w-14 rounded-2xl border border-white/40 object-cover shadow-[0_16px_32px_rgba(2,6,23,0.24)] ring-2 ring-white/70"
                          onError={() => setFailedImages((current) => ({ ...current, agent: true }))}
                        />
                      ) : safeBrandLogo ? (
                        <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-2.5 shadow-[0_14px_28px_rgba(2,6,23,0.16)]">
                          <img
                            src={safeBrandLogo}
                            alt={brandName}
                            className="h-full w-full object-contain"
                            onError={() => markBrandLogoFailed(safeBrandLogo)}
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm" style={{ backgroundColor: page.branding.primaryColor }}>
                          {agentInitials}
                        </div>
                      )}
                      {safeAgentPhoto && safeBrandLogo && (
                        <div className="absolute -bottom-1 -right-4 flex h-7 w-11 items-center justify-center rounded-lg border border-white/[0.35] bg-white p-1.5 shadow-lg">
                          <img
                            src={safeBrandLogo}
                            alt={brandName}
                            className="h-full w-full object-contain"
                            onError={() => markBrandLogoFailed(safeBrandLogo)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: eyebrowColor }}>Presented by</div>
                      <div className="mt-0.5 truncate text-lg font-bold sm:text-[1.35rem]" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{agentDisplayName}</div>
                      <div className="mt-0.5 truncate text-sm font-semibold" style={{ color: mutedTextColor }}>
                        {agentProfessionalLine}
                      </div>
                    </div>
                  </div>

                  {utahRealEstateMlsUrl ? (
                    <a
                      href={utahRealEstateMlsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-bold shadow-sm transition-transform hover:-translate-y-0.5"
                      style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                    >
                      <span>MLS #{listingMlsNumber}</span>
                      <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                    </a>
                  ) : listingMlsNumber ? (
                    <div className="inline-flex w-fit items-center rounded-full border px-3 py-2 text-xs font-bold shadow-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                      MLS #{listingMlsNumber}
                    </div>
                  ) : null}
                </div>

                {(gateEnabled || headerMetaChips.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {gateEnabled && (
                      <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#9a3412' : '#fdba74' }}>
                        Registration Required
                      </span>
                    )}
                    {headerMetaChips.map((chip, index) => {
                      const isMlsChip = Boolean(utahRealEstateMlsUrl && chip.includes('MLS #'));
                      return isMlsChip ? (
                        <a key={`header-chip-${index}`} href={utahRealEstateMlsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold sm:text-xs" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#e2e8f0' }}>
                          {chip}
                          <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                        </a>
                      ) : (
                        <span key={`header-chip-${index}`} className="rounded-full border px-3 py-1 text-[10px] font-semibold sm:text-xs" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#e2e8f0' }}>
                          {chip}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative rounded-2xl border p-2.5" style={nestedSurfaceStyle}>
                <div className={`grid gap-2 ${showLeadCapture ? 'sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.9fr)_repeat(3,minmax(128px,1fr))]' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {showLeadCapture && (
                    <a href="#lead-form" className="group inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 text-center text-sm font-semibold shadow-lg transition-transform hover:scale-[1.01]" style={primaryButtonStyle}>
                      <span>{leadCtaText}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
                    </a>
                  )}
                  {agentPhone && (
                    <a
                      href={agentPhoneHref}
                      className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border px-3 text-[13px] font-semibold transition-colors hover:bg-white/10"
                      style={{
                        ...nestedSurfaceStyle,
                        color: isLightTheme ? '#0f172a' : '#ffffff',
                        borderColor: isLightTheme ? 'rgba(148,163,184,0.32)' : 'rgba(255,255,255,0.16)',
                      }}
                    >
                      <Phone className="h-3.5 w-3.5" strokeWidth={2.2} />
                      <span className="truncate">{agentPhoneLabel}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => { setQuickQuestionOpen(true); setQuickQuestionMessage(null); }}
                    className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl border px-3 text-[13px] font-semibold transition-colors hover:bg-white/10"
                    style={{
                      ...nestedSurfaceStyle,
                      color: isLightTheme ? '#0f172a' : '#ffffff',
                      borderColor: isLightTheme ? 'rgba(148,163,184,0.32)' : 'rgba(255,255,255,0.16)',
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareMenuOpen((current) => !current)}
                    aria-expanded={shareMenuOpen}
                    className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 text-[13px] font-semibold shadow-sm transition-colors hover:bg-white/10"
                    style={{
                      ...nestedSurfaceStyle,
                      color: isLightTheme ? '#0f172a' : '#ffffff',
                      borderColor: isLightTheme ? 'rgba(148,163,184,0.32)' : 'rgba(255,255,255,0.16)',
                      background: isLightTheme
                        ? `linear-gradient(135deg, ${rgba(page.branding.primaryColor, 0.14)} 0%, ${rgba(page.theme.colors.secondary, 0.12)} 100%)`
                        : `linear-gradient(135deg, ${rgba(page.branding.primaryColor, 0.28)} 0%, ${rgba(page.theme.colors.secondary, 0.22)} 100%)`,
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Share
                  </button>
                </div>

                {shareMenuOpen && (
                  <div className="relative z-40 mt-2 w-full rounded-2xl border p-3 shadow-2xl backdrop-blur-xl" style={{ ...surfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: eyebrowColor }}>
                      <Link2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                      Share URL
                    </div>
                    <div className="mt-2 flex flex-col gap-2 rounded-xl border px-3 py-2 sm:flex-row sm:items-center" style={nestedSurfaceStyle}>
                      <div className="min-w-0 flex-1 break-all text-xs sm:truncate" title={shareUrl} style={{ color: mutedTextColor }}>{shareUrl}</div>
                      <button
                        type="button"
                        onClick={copyShareUrl}
                        className="inline-flex shrink-0 self-end items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-white/10 sm:self-auto"
                        style={{ borderColor: isLightTheme ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.16)', color: isLightTheme ? '#0f172a' : '#ffffff' }}
                      >
                        {shareStatus === 'copied' ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />}
                        {shareStatus === 'copied' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={shareLandingPage}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-transform hover:scale-[1.01]"
                      style={primaryButtonStyle}
                    >
                      <Share2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                      Share from device
                    </button>
                    <button
                      type="button"
                      onClick={exportLandingPdf}
                      disabled={pdfStatus === 'building'}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                      style={{ borderColor: isLightTheme ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.16)', color: isLightTheme ? '#0f172a' : '#ffffff' }}
                    >
                      <FileDown className="h-3.5 w-3.5" strokeWidth={2.2} />
                      {pdfStatus === 'building' ? 'Building PDF...' : 'Download full page PDF'}
                    </button>
                    {pdfStatus === 'ready' && (
                      <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-200">
                        PDF downloaded.
                      </div>
                    )}
                    {pdfStatus === 'error' && (
                      <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200">
                        Could not generate PDF on this device. Try again.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {topCardHighlights.length > 0 && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {topCardHighlights.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold"
                      style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#e2e8f0' }}
                    >
                      <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full" style={{ backgroundColor: rgba(page.branding.primaryColor, 0.16), color: page.branding.primaryColor }}>
                        {index + 1}
                      </span>
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 border-t pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0" style={{ borderColor: isLightTheme ? 'rgba(148,163,184,0.20)' : 'rgba(255,255,255,0.10)' }}>
              {showHeaderQr && activeHeaderQrItem ? (
                <div className="ml-auto w-full max-w-[270px] rounded-2xl border p-1.5" style={{ borderColor: isLightTheme ? 'rgba(148,163,184,0.26)' : 'rgba(255,255,255,0.12)', backgroundColor: isLightTheme ? 'rgba(255,255,255,0.62)' : 'rgba(15,23,42,0.28)' }}>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: eyebrowColor }}>QR CODES</div>
                        <a
                          href={activeHeaderQrItem.url}
                          target={activeHeaderQrItem.url.startsWith('mailto:') || activeHeaderQrItem.url.startsWith('tel:') ? undefined : '_blank'}
                          rel={activeHeaderQrItem.url.startsWith('mailto:') || activeHeaderQrItem.url.startsWith('tel:') ? undefined : 'noreferrer'}
                          className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] font-bold leading-tight transition-colors hover:underline"
                          title={activeHeaderQrItem.url}
                          style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}
                        >
                          <span className="min-w-0 break-words">{activeHeaderQrItem.label}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2.2} />
                        </a>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={qrCopyStatus === activeHeaderQrItem.key ? `${activeHeaderQrItem.label} URL copied` : `Copy ${activeHeaderQrItem.label} URL`}
                          title={qrCopyStatus === activeHeaderQrItem.key ? 'Copied' : `Copy ${activeHeaderQrItem.label} URL`}
                          onClick={() => void copyHeaderQrUrl(activeHeaderQrItem.key, activeHeaderQrItem.url)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors hover:bg-white/10"
                          style={{ borderColor: isLightTheme ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.14)', color: isLightTheme ? '#334155' : '#f8fafc' }}
                        >
                          {qrCopyStatus === activeHeaderQrItem.key ? <Check className="h-3 w-3" strokeWidth={2.4} /> : <Copy className="h-3 w-3" strokeWidth={2.2} />}
                        </button>
                      </div>
                    </div>

                    {headerQrItems.length > 1 && (
                      <div className="grid w-full grid-cols-2 rounded-full border p-1" style={{ borderColor: isLightTheme ? 'rgba(148,163,184,0.30)' : 'rgba(255,255,255,0.14)', backgroundColor: isLightTheme ? 'rgba(248,250,252,0.86)' : 'rgba(2,6,23,0.35)' }}>
                        {headerQrItems.map((item) => {
                          const active = activeHeaderQrItem.key === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setActiveHeaderQrKey(item.key)}
                              className="min-h-6 rounded-full px-2 text-[10px] font-bold leading-none transition-colors sm:px-3"
                              style={active ? { ...primaryButtonStyle, boxShadow: 'none' } : { color: mutedTextColor }}
                            >
                              <span className="block truncate whitespace-nowrap">{item.switchLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="grid gap-2">
                      <a
                        href={activeHeaderQrItem.url}
                        target={activeHeaderQrItem.url.startsWith('mailto:') || activeHeaderQrItem.url.startsWith('tel:') ? undefined : '_blank'}
                        rel={activeHeaderQrItem.url.startsWith('mailto:') || activeHeaderQrItem.url.startsWith('tel:') ? undefined : 'noreferrer'}
                        aria-label={`Open ${activeHeaderQrItem.label} scan link`}
                        title={`Open ${activeHeaderQrItem.label}: ${activeHeaderQrItem.url}`}
                        className="mx-auto inline-flex rounded-2xl border border-slate-200 bg-white p-0.5 shadow-sm transition-transform hover:scale-[1.02]"
                      >
                        <QRCodeSVG
                          value={activeHeaderQrItem.url}
                          size={108}
                          level="M"
                          marginSize={2}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                          title={`QR code for ${activeHeaderQrItem.label}`}
                        />
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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

        {agentValuePillars.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div
              className={`grid gap-3 border p-4 backdrop-blur-xl sm:grid-cols-3 ${cardMotionClass}`}
              style={{ ...surfaceStyle, borderRadius: `${cornerRadiusPx}px` }}
            >
              {agentValuePillars.map((pillar, index) => {
                const PillarIcon = pillar.icon;
                return (
                  <div
                    key={`${pillar.label}-${index}`}
                    className="relative overflow-hidden rounded-2xl border px-4 py-3"
                    style={nestedSurfaceStyle}
                  >
                    <div
                      className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl"
                      style={{ backgroundColor: rgba(pillar.accent, isLightTheme ? 0.3 : 0.4) }}
                    />
                    <div className="relative flex items-start gap-3">
                      <span
                        className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl border"
                        style={{
                          backgroundColor: rgba(pillar.accent, isLightTheme ? 0.18 : 0.28),
                          borderColor: rgba(pillar.accent, isLightTheme ? 0.45 : 0.35),
                          color: isLightTheme ? '#0f172a' : '#ffffff',
                        }}
                      >
                        <PillarIcon className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>
                          {pillar.label}
                        </div>
                        <div className="mt-1 text-sm font-semibold leading-5" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                          {pillar.value}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
                <div className="absolute inset-0" style={{ background: `linear-gradient(96deg, rgba(255,255,255,${isLightTheme ? '0.92' : '0.16'}) 0%, rgba(255,255,255,${isLightTheme ? '0.78' : '0.10'}) 43%, rgba(2,6,23,${isLightTheme ? '0.08' : '0.24'}) 100%)` }} />
                <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block" style={{ background: `linear-gradient(270deg, rgba(2,6,23,${isLightTheme ? '0.12' : '0.42'}), transparent 68%)` }} />
                <div className="relative z-10 grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.78fr)] lg:items-end lg:px-12 lg:py-14" style={{ minHeight: `${heroMinHeightPx}px` }}>
                  <div className="max-w-2xl self-center lg:pb-8">
                    <div className="flex flex-wrap gap-2">
                      {heroBadges.map((badge, index) => (
                        <span key={`split-badge-${index}`} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                          {badge}
                        </span>
                      ))}
                    </div>
                    <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: isLightTheme ? '#0f172a' : '#ffffff', fontFamily: appliedHeadingFont }}>
                      {heroHeadline}
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-7 line-clamp-2 sm:text-lg" style={{ color: isLightTheme ? 'rgba(15,23,42,0.82)' : 'rgba(226,232,240,0.92)' }}>
                      {fallbackSubheadline}
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      {showLeadCapture && (
                        <a href="#lead-form" className="group relative rounded-full px-6 py-3.5 text-sm font-semibold shadow-xl transition-transform hover:scale-[1.03]" style={primaryButtonStyle}>
                          {leadCtaText}
                        </a>
                      )}
                      {page.agent.phone && (
                        <a href={`tel:${page.agent.phone}`} className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                          Call {agentFirstName}
                        </a>
                      )}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: isLightTheme ? 'rgba(15,23,42,0.75)' : 'rgba(226,232,240,0.85)' }}>
                      {heroTrustBadges.map(({ icon: Icon, label }) => (
                        <span key={label} className="inline-flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="self-end lg:justify-self-end">
                    <div className="ml-auto w-full max-w-[390px] space-y-3">
                      {heroAgentCard}
                      {hasListingFacts && (
                        <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-white/15 bg-slate-950/70 p-3 text-white shadow-[0_20px_50px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
                          <SnapshotItem label="Price" value={formatCurrency(page.listing?.price) || 'Contact agent'} />
                          <SnapshotItem label="Beds/Baths" value={page.listing?.beds != null && page.listing?.baths != null ? `${page.listing.beds}/${page.listing.baths}` : 'Ask agent'} />
                        </div>
                      )}
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
                    {heroHeadline}
                  </h1>
                  <p className="mx-auto mt-4 max-w-3xl text-base leading-7 line-clamp-2 text-white/95 sm:text-lg">
                    {fallbackSubheadline}
                  </p>

                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    {showLeadCapture && (
                      <a href="#lead-form" className="rounded-full px-6 py-3.5 text-sm font-semibold shadow-2xl transition-transform hover:scale-[1.03]" style={heroPrimaryButtonStyle}>
                        {leadCtaText}
                      </a>
                    )}
                    {page.agent.phone && (
                      <a href={`tel:${page.agent.phone}`} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25">
                        Call {agentFirstName}
                      </a>
                    )}
                  </div>

                  <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                    {heroTrustBadges.map(({ icon: Icon, label }) => (
                      <span key={label} className="inline-flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                    ))}
                  </div>

                  {hasListingFacts && (
                    <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-4">
                      <SnapshotItem label="Price" value={formatCurrency(page.listing?.price) || 'Contact agent'} />
                      <SnapshotItem label="MLS Source" value={listingMlsNumber ? `UtahRealEstate.com #${listingMlsNumber}` : 'Private'} />
                      <SnapshotItem label="Bedrooms" value={page.listing?.beds != null ? String(page.listing.beds) : 'Ask agent'} />
                      <SnapshotItem label="Bathrooms" value={page.listing?.baths != null ? String(page.listing.baths) : 'Ask agent'} />
                    </div>
                  )}
                  <div className="mx-auto mt-8 max-w-sm text-left xl:hidden">
                    {heroAgentCard}
                  </div>
                </div>
                <div className="absolute bottom-7 right-7 z-20 hidden w-[340px] xl:block">
                  {heroAgentCard}
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${page.theme.colors.heroOverlay}, rgba(2,6,23,${safeHeroImage || safeGalleryPhotos[0] ? (isLightTheme ? '0.45' : '0.65') : '0.30'}))` }} />
                <div className="relative z-10 grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:px-12 lg:py-14" style={{ minHeight: `${heroMinHeightPx}px` }}>
                  <div className="max-w-3xl self-end">
                    <div className="flex flex-wrap gap-2">
                      {heroBadges.map((badge, index) => (
                        <span key={`cinematic-badge-${index}`} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                          {badge}
                        </span>
                      ))}
                    </div>

                    <h1 className="mt-5 text-4xl font-bold tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl" style={{ fontFamily: appliedHeadingFont }}>
                      {heroHeadline}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 line-clamp-2 text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-lg">
                      {fallbackSubheadline}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      {showLeadCapture && (
                        <a href="#lead-form" className="group relative rounded-full px-6 py-3.5 text-sm font-semibold shadow-2xl transition-transform hover:scale-[1.03]" style={heroPrimaryButtonStyle}>
                          <span className="relative z-10">{leadCtaText}</span>
                          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(135deg, ${rgba('#ffffff', 0.2, '255,255,255')}, transparent 60%)` }} />
                        </a>
                      )}
                      {page.agent.phone && (
                        <a href={`tel:${page.agent.phone}`} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call {agentFirstName}
                        </a>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
                      {heroTrustBadges.map(({ icon: Icon, label }) => (
                        <span key={label} className="inline-flex items-center gap-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="self-end lg:justify-self-end">
                    <div className="ml-auto w-full max-w-[350px] space-y-3">
                      {heroAgentCard}
                      {hasListingFacts && (
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
                            <SnapshotItem label="MLS Source" value={listingMlsNumber ? `UtahRealEstate.com #${listingMlsNumber}` : 'Private'} />
                            <SnapshotItem label="Bedrooms" value={page.listing?.beds != null ? String(page.listing.beds) : 'Ask agent'} />
                            <SnapshotItem label="Bathrooms" value={page.listing?.baths != null ? String(page.listing.baths) : 'Ask agent'} />
                          </div>
                        </div>
                      )}
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
              <StatBlock label="Years Experience" value={String(page.content.stats.yearsExperience)} icon={Award} accent={page.branding.primaryColor} mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
            {page.content.stats.homesSold != null && (
              <StatBlock label="Homes Sold" value={String(page.content.stats.homesSold)} icon={Home} accent={page.theme.colors.secondary} mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
            {page.content.stats.avgDaysOnMarket != null && (
              <StatBlock label="Avg Days on Market" value={`${page.content.stats.avgDaysOnMarket} days`} icon={Calendar} accent={page.theme.colors.accent} mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
            )}
            {page.content.stats.clientRating != null && (
              <StatBlock label="Client Rating" value={`${page.content.stats.clientRating}/5 ★`} icon={Star} accent="#fbbf24" mutedTextColor={mutedTextColor} isLightTheme={isLightTheme} />
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
                    <div key={feature} className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#f8fafc' }}>
                      <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ backgroundColor: rgba(page.branding.primaryColor, 0.18), color: page.branding.primaryColor }}>
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      </span>
                      <span className="leading-6">{feature}</span>
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

          {visibleOtherListings.length > 0 && (
            <SurfaceCard title={`More listings from ${page.agent.name}`} surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleOtherListings.map((l) => (
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
              <ul className="grid gap-3 sm:grid-cols-2">
                {page.content.whyChooseBullets.map((bullet, i) => (
                  <li key={`${bullet}-${i}`} className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#f8fafc' }}>
                    <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full" style={{ backgroundColor: rgba(page.branding.primaryColor, 0.18), color: page.branding.primaryColor }}>
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <span className="leading-6">{bullet}</span>
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
            <SurfaceCard title="What's your home worth?" id="lead-form" surfaceStyle={surfaceStyle} eyebrowColor={eyebrowColor}>
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
                <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium" style={{ color: mutedTextColor }}>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Free & no obligation</span>
                  <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Reply within 24 hrs</span>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> We never share your info</span>
                </div>
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
                <button
                  type="button"
                  onClick={() => { setQuickQuestionOpen(true); setQuickQuestionMessage(null); }}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left hover:bg-white/10"
                  style={nestedSurfaceStyle}
                >
                  <Mail className="h-4 w-4 flex-none" />
                  <span>Email {agentFirstName}</span>
                </button>
                {agentPhone && (
                  <a href={agentPhoneHref} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-white/10" style={nestedSurfaceStyle}>
                    <Phone className="h-4 w-4 flex-none" />
                    <span>{agentPhoneLabel || agentPhone}</span>
                  </a>
                )}
                {page.brokerage.phone && (
                  <div className="inline-flex items-center gap-2 rounded-xl border px-3 py-2" style={nestedSurfaceStyle}>
                    <Phone className="h-4 w-4 flex-none opacity-60" />
                    <span>{formatPhoneDisplay(page.brokerage.phone)} <span className="text-xs opacity-70">(brokerage)</span></span>
                  </div>
                )}
                {page.brokerage.address && <div className="rounded-xl border px-3 py-2" style={nestedSurfaceStyle}>{page.brokerage.address}</div>}
                {page.brokerage.license && <div className="rounded-xl border px-3 py-2" style={nestedSurfaceStyle}>Brokerage License {page.brokerage.license}</div>}
              </div>
            </SurfaceCard>
          )}

          {showLeadCapture && sections.contact !== false && sections.homeValuation !== true && (
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
                  {submitting ? 'Sending...' : leadCtaText || 'Send request'}
                </button>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium" style={{ color: mutedTextColor }}>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Free & no obligation</span>
                  <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Reply within 24 hrs</span>
                </div>
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
                  {leadCtaText}
                </a>
              )}
              {agentPhone && (
                <a href={agentPhoneHref} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10" style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}>
                  <Phone className="h-4 w-4" />
                  Call {agentPhoneLabel || agentPhone}
                </a>
              )}
              <button
                type="button"
                onClick={() => { setQuickQuestionOpen(true); setQuickQuestionMessage(null); }}
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
                style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
              >
                <Mail className="h-4 w-4" />
                Email {agentFirstName}
              </button>
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

      {quickQuestionOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(10px)' }} role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close email form"
            onClick={() => setQuickQuestionOpen(false)}
          />
          <div className="relative w-full max-w-lg border p-6 shadow-2xl sm:p-7" style={{ ...surfaceStyle, borderRadius: `${Math.max(cornerRadiusPx, 18)}px` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: eyebrowColor }}>Email {page.agent.name}</div>
                <h2 className="mt-2 text-2xl font-bold" style={{ color: isLightTheme ? '#0f172a' : '#ffffff', fontFamily: appliedHeadingFont }}>Ask a quick question</h2>
                <p className="mt-2 text-sm" style={{ color: mutedTextColor }}>
                  Your note goes to {page.agent.email} and creates a lead so {page.agent.name.split(' ')[0]} can follow up cleanly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickQuestionOpen(false)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
              >
                Close
              </button>
            </div>

            <form className="mt-5 grid gap-3" onSubmit={submitQuickQuestion}>
              <input
                type="text"
                value={quickQuestionForm.name}
                onChange={(event) => setQuickQuestionForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Full name"
                className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="email"
                  value={quickQuestionForm.email}
                  onChange={(event) => setQuickQuestionForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Email address"
                  className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                  required
                />
                <input
                  type="tel"
                  value={quickQuestionForm.phone}
                  onChange={(event) => setQuickQuestionForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Phone (optional)"
                  className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                />
              </div>
              <textarea
                value={quickQuestionForm.message}
                onChange={(event) => setQuickQuestionForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="What would you like to know?"
                rows={5}
                className="w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                style={{ ...nestedSurfaceStyle, color: isLightTheme ? '#0f172a' : '#ffffff' }}
                required
              />
              {quickQuestionMessage && (
                <div className={`rounded-2xl px-4 py-3 text-sm ${quickQuestionMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-200 border border-rose-500/20'}`}>
                  {quickQuestionMessage.text}
                </div>
              )}
              <button
                type="submit"
                disabled={quickQuestionSubmitting}
                className="rounded-2xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={primaryButtonStyle}
              >
                {quickQuestionSubmitting ? 'Sending...' : 'Send question'}
              </button>
            </form>
          </div>
        </div>
      )}

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
                  onError={() => markBrandLogoFailed(safeBrandLogo)}
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

function StatBlock({ label, value, accent, mutedTextColor, isLightTheme, icon: Icon }: { label: string; value: string; accent: string; mutedTextColor: string; isLightTheme: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="relative overflow-hidden border border-white/10 bg-white/5 px-5 py-4" style={{ borderRadius: 'var(--lp-card-radius, 28px)' }}>
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl" style={{ backgroundColor: accent, opacity: 0.2 }} />
      <div className="relative flex items-start gap-3">
        {Icon && (
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}26`, color: accent }}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-3xl font-bold leading-none" style={{ color: isLightTheme ? '#0f172a' : '#ffffff' }}>{value}</div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: mutedTextColor }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

export default PublicLandingPage;
