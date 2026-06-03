import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Calculator,
  CalendarDays,
  Camera,
  Check,
  Clipboard,
  Copy,
  DollarSign,
  Eye,
  FileText,
  Flame,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  Lightbulb,
  Loader2,
  LockKeyhole,
  Mail,
  MapPinned,
  MessageSquare,
  Monitor,
  Palette,
  PenLine,
  Phone,
  QrCode,
  RefreshCcw,
  Ruler,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Tablet,
  Trophy,
  Type as TypeIcon,
  UserRound,
  UsersRound,
  Video,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../auth/authStore';
import { getTemplateMediaPack } from '../landing/templateMediaSuggestions';
import { toDisplayErrorMessage } from '../../lib/errorMessages';
import { buildLandingPageQrToken, buildTrackedLandingQrUrl } from '../../lib/landingQr';
import { getLandingPageIntent, type LandingPageKind } from '../../lib/landingPageIntent';

function EditorIconBadge({ icon: Icon, tone = 'cyan' }: { icon: LucideIcon; tone?: 'blue' | 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' | 'pink' | 'red' }) {
  const toneClass = {
    blue: 'bg-blue-500/20 text-blue-200 border-blue-400/20',
    cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/20',
    emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/20',
    amber: 'bg-amber-500/20 text-amber-200 border-amber-400/20',
    purple: 'bg-purple-500/20 text-purple-200 border-purple-400/20',
    rose: 'bg-rose-500/20 text-rose-200 border-rose-400/20',
    pink: 'bg-pink-500/20 text-pink-200 border-pink-400/20',
    red: 'bg-red-500/20 text-red-200 border-red-400/20',
  }[tone];

  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-lg border ${toneClass}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

interface LandingPageAnalyticsData {
  summary: {
    pageViews: number;
    uniqueVisitors: number;
    leads: number;
    conversionRate: number;
    qrViews?: number;
    qrLeads?: number;
    qrConversionRate?: number;
    funnel?: {
      views: number;
      uniqueVisitors: number;
      qrScans: number;
      leads: number;
      qrLeads: number;
    };
  };
  topSources: Array<{
    utmSource: string | null;
    _count: {
      utmSource: number;
    };
  }>;
  topCampaigns?: Array<{
    utmCampaign: string | null;
    _count: {
      utmCampaign: number;
    };
  }>;
  topMediums?: Array<{
    utmMedium: string | null;
    _count: {
      utmMedium: number;
    };
  }>;
  deviceBreakdown: Array<{
    device: string | null;
    _count: {
      device: number;
    };
  }>;
  locationData: Array<{
    city: string | null;
    region: string | null;
    country: string | null;
    _count: {
      city: number;
    };
  }>;
}

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

type LandingEditorTab = 'theme' | 'content' | 'sections' | 'style' | 'seo' | 'preview';

interface LandingPageData {
  id: string;
  title: string;
  slug: string;
  description?: string;
  heroImage?: string;
  templateId: string;
  isActive: boolean;
  customContent?: {
    pageKind?: string;
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    ctaSecondaryText?: string;
    agentDisplayName?: string;
    agentTitle?: string;
    agentEmail?: string;
    agentPhone?: string;
    agentPhotoUrl?: string;
    agentWebsiteUrl?: string;
    agentFacebookUrl?: string;
    agentInstagramUrl?: string;
    agentLinkedinUrl?: string;
    brokerageDisplayName?: string;
    brokerageLogoUrl?: string;
    brokerageAddress?: string;
    brokeragePhone?: string;
    galleryImages?: string[];
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
    showHeaderQr?: boolean;
    qrListingUrl?: string;
    qrListingToken?: string;
    qrPersonalUrl?: string;
    qrPersonalLabel?: string;
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
    propertyType?: string;
    description?: string;
    photos?: string[];
  };
}

interface LandingPageAccountDefaults {
  agentDisplayName: string;
  agentEmail: string;
  agentPhone: string;
  agentPhotoUrl: string;
  agentBio: string;
  brokerageDisplayName: string;
  brokerageLogoUrl: string;
  brokerageLogoWidth: number;
  brokerageLogoBackground: 'CARD' | 'TRANSPARENT';
  brokerageAddress: string;
  brokeragePhone: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  agentWebsiteUrl: string;
  defaultAgentPageUrl: string;
  defaultAgentPageSlug: string;
  agentFacebookUrl: string;
  agentInstagramUrl: string;
  agentLinkedinUrl: string;
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

const getHeadlineIdeas = (kind: LandingPageKind, listingName: string, agentName: string) => {
  switch (kind) {
    case 'listing':
      return [
        listingName,
        `Private tour of ${listingName}`,
        'Fresh listing with room to move',
        'See the details before you tour',
        'A smarter look at this property',
        'Schedule your private showing',
      ];
    case 'agent-profile':
      return [
        `Meet ${agentName}`,
        'Your local real estate guide',
        'Buying, selling, or planning your next move?',
        'Real estate help without the pressure',
        'A clearer next step for your move',
        'Local guidance from first question to closing',
      ];
    case 'seller':
      return [
        'What could your home sell for right now?',
        'Get a local pricing strategy before you list',
        'Know your home value before the next move',
        'A smarter seller plan starts here',
        'See what local buyers may pay',
        'Prepare to sell with confidence',
      ];
    case 'buyer':
      return [
        'Find the right home with a sharper plan',
        'Start your home search with local strategy',
        'Know what to tour, offer, and avoid',
        'Get a buyer game plan before you shop',
        'See homes with a clearer next step',
        'A better path to your next home',
      ];
    default:
      return [
        'Start your next real estate step here',
        'Get local real estate guidance',
        'A smarter real estate conversation starts here',
        'Tell us what you need next',
        'Simple real estate help, fast follow-up',
        'Connect with a local expert',
      ];
  }
};

const getSubheadlineIdeas = (kind: LandingPageKind, listingFacts: string, agentName: string) => {
  switch (kind) {
    case 'listing':
      return [
        listingFacts || 'Get photos, pricing context, showing options, and direct guidance from the listing agent.',
        'See the property highlights, ask questions, and request a private showing in one place.',
        'Get direct follow-up on disclosures, showing times, and next steps before you tour.',
        'Everything a serious buyer needs to decide whether this home is worth seeing.',
      ];
    case 'agent-profile':
      return [
        `Connect with ${agentName} for buying, selling, home value questions, and next-step guidance.`,
        'Share what you are working on and get a clear, low-pressure next step.',
        'One simple place to ask about buying, selling, pricing, or local market timing.',
        'Fast follow-up, local strategy, and a direct line to your agent.',
      ];
    case 'seller':
      return [
        'Request a local pricing read using comps, timing, and prep-to-sell strategy.',
        'Get a realistic selling snapshot before you commit to listing.',
        'See what your home may be worth and what could improve your net.',
        'Send the address and get a focused next-step seller plan.',
      ];
    case 'buyer':
      return [
        'Share your search goals and get showing options, offer strategy, and local guidance.',
        'Get clear next steps before you spend weekends chasing the wrong homes.',
        'Tell us budget, area, and timing so the agent can build a sharper search plan.',
        'Move from browsing to a confident buyer plan.',
      ];
    default:
      return [
        'Share what you need and the agent will follow up with a clear next step.',
        'A simple way to start the right real estate conversation.',
        'Fast local follow-up for your next real estate move.',
        'Tell us the goal and we will help route the next step.',
      ];
  }
};

const getCtaIdeas = (kind: LandingPageKind) => {
  switch (kind) {
    case 'listing':
      return ['Schedule a Showing', 'Request Listing Info', 'Ask About This Home', 'Get Disclosures', 'Book Virtual Tour', 'Contact Listing Agent'];
    case 'agent-profile':
      return ['Connect With Me', 'Ask a Question', 'Start a Conversation', 'Get Local Guidance', 'Contact Agent', 'Send Message'];
    case 'seller':
      return ['Get My Home Value', 'Request Pricing Strategy', 'See What My Home Could Sell For', 'Start Seller Plan', 'Request Report', 'Talk Selling Timeline'];
    case 'buyer':
      return ['Get Buyer Game Plan', 'Share My Search Goals', 'Find Homes With a Plan', 'Start Home Search', 'Ask Buyer Question', 'Book Buyer Consult'];
    default:
      return ['Request Info', 'Ask a Question', 'Get Started', 'Contact Agent', 'Send Message', 'Book Consult'];
  }
};

const getQuickHighlightIdeas = (kind: LandingPageKind) => {
  switch (kind) {
    case 'listing':
      return [
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
      ];
    case 'agent-profile':
      return [
        'Fast Follow-Up',
        'Local Market Insight',
        'Buyer and Seller Guidance',
        'Clear Next Steps',
        'Low-Pressure Advice',
        'Brokerage Support',
        'Referral Ready',
        'QR Friendly',
      ];
    case 'seller':
      return [
        'Local Comp Review',
        'Pricing Range',
        'Prep-to-Sell Plan',
        'Net Sheet Guidance',
        'Market Timing',
        'Listing Strategy',
        'Showing Prep',
        'Offer Review',
      ];
    case 'buyer':
      return [
        'Search Strategy',
        'Showing Plan',
        'Offer Guidance',
        'Lender Prep',
        'Neighborhood Fit',
        'Budget Clarity',
        'Tour Shortlist',
        'Negotiation Help',
      ];
    default:
      return [
        'Fast Follow-Up',
        'Local Strategy',
        'Clear Next Steps',
        'Market Guidance',
        'Simple Contact',
        'Agent Support',
      ];
  }
};

export function LandingPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const authToken = token || localStorage.getItem('utahcontracts_token') || '';
  const [showCreationGuide, setShowCreationGuide] = useState(Boolean((location.state as { justCreated?: boolean } | null)?.justCreated));
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<LandingPageData | null>(null);
  const [accountDefaults, setAccountDefaults] = useState<LandingPageAccountDefaults | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig | null>(null);
  const [activeTab, setActiveTab] = useState<LandingEditorTab>('theme');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewNonce, setPreviewNonce] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareQrVariant, setShareQrVariant] = useState<'page' | 'gated' | 'capture' | 'personal'>('page');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [analytics, setAnalytics] = useState<LandingPageAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState<Record<string, boolean>>({});
  const [hasViewedPreview, setHasViewedPreview] = useState(false);
  const [hasSavedSinceCreate, setHasSavedSinceCreate] = useState(false);
  const heroImageUploadRef = useRef<HTMLInputElement | null>(null);
  const agentPhotoUploadRef = useRef<HTMLInputElement | null>(null);
  const brokerageLogoUploadRef = useRef<HTMLInputElement | null>(null);
  const galleryUploadRef = useRef<HTMLInputElement | null>(null);
  const [spotlightSection, setSpotlightSection] = useState<string | null>(null);
  
  // Custom content state
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [ctaText, setCtaText] = useState('Schedule a Showing');
  const [ctaSecondaryText, setCtaSecondaryText] = useState('Download Brochure');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [agentDisplayName, setAgentDisplayName] = useState('');
  const [agentTitle, setAgentTitle] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentPhotoUrl, setAgentPhotoUrl] = useState('');
  const [agentWebsiteUrl, setAgentWebsiteUrl] = useState('');
  const [agentFacebookUrl, setAgentFacebookUrl] = useState('');
  const [agentInstagramUrl, setAgentInstagramUrl] = useState('');
  const [agentLinkedinUrl, setAgentLinkedinUrl] = useState('');
  const [brokerageDisplayName, setBrokerageDisplayName] = useState('');
  const [brokerageLogoUrl, setBrokerageLogoUrl] = useState('');
  const [brokerageAddress, setBrokerageAddress] = useState('');
  const [brokeragePhone, setBrokeragePhone] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryImageDraft, setGalleryImageDraft] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [agentBio, setAgentBio] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [virtualTourUrl, setVirtualTourUrl] = useState('');
  const [floorPlanUrl, setFloorPlanUrl] = useState('');
  const [neighborhoodDescription, setNeighborhoodDescription] = useState('');
  const [urgencyText, setUrgencyText] = useState('');
  const [socialProofText, setSocialProofText] = useState('');
  const [showHeaderQr, setShowHeaderQr] = useState(false);
  const [qrListingUrl, setQrListingUrl] = useState('');
  const [qrListingToken, setQrListingToken] = useState('');
  const [qrPersonalUrl, setQrPersonalUrl] = useState('');
  const [qrPersonalLabel, setQrPersonalLabel] = useState('Agent info');
  const [whyChooseBullets, setWhyChooseBullets] = useState<string[]>([]);
  const [newWhyBullet, setNewWhyBullet] = useState('');
  const [statsYearsExperience, setStatsYearsExperience] = useState('');
  const [statsHomesSold, setStatsHomesSold] = useState('');
  const [statsAvgDaysOnMarket, setStatsAvgDaysOnMarket] = useState('');
  const [statsClientRating, setStatsClientRating] = useState('');
  
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
  const [formTitle, setFormTitle] = useState('How can I help?');
  const [formSubtitle, setFormSubtitle] = useState('Fill out the form and we\'ll get back to you within 24 hours.');
  const [leadFormFields, setLeadFormFields] = useState<string[]>(['name', 'email', 'phone']);
  const [leadButtonText, setLeadButtonText] = useState('Request Information');
  const [successMessage, setSuccessMessage] = useState('Thank you! We\'ll be in touch soon.');

  // Force-capture gate state
  const [forceCaptureEnabled, setForceCaptureEnabled] = useState(false);
  const [forceCaptureDelay, setForceCaptureDelay] = useState(0);
  const [forceCaptureHeadline, setForceCaptureHeadline] = useState('Get instant access');
  const [forceCaptureSubheadline, setForceCaptureSubheadline] = useState('Enter your details to unlock the next step and direct agent follow-up.');
  const [forceCaptureRequirePhone, setForceCaptureRequirePhone] = useState(false);
  const [forceCapturePersistMode, setForceCapturePersistMode] = useState<'SESSION' | 'ALWAYS'>('SESSION');
  const [forceCaptureCtaText, setForceCaptureCtaText] = useState('Get access');
  
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

  const showToast = (type: 'success' | 'error', message: unknown) => {
    setToast({ type, message: toDisplayErrorMessage(message) });
    setTimeout(() => setToast(null), 3000);
  };

  const buildQrListingToken = useCallback(() => buildLandingPageQrToken(), []);

  useEffect(() => {
    if (id) {
      fetchPage();
      fetchAccountDefaults();
      fetchAnalytics(id);
    }
  }, [id]);

  useEffect(() => {
    const state = location.state as { justCreated?: boolean } | null;
    if (!state?.justCreated) {
      return;
    }

    setHasViewedPreview(false);
    setHasSavedSinceCreate(false);
    setShowCreationGuide(true);
    setActiveTab('theme');
    showToast('success', 'Landing page created. Finish the theme, content, and preview here.');
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (activeTab === 'preview') {
      setHasViewedPreview(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!page || !accountDefaults || !selectedTheme) {
      return;
    }

    const savedPrimary = page.customStyles?.primaryColor;
    const savedSecondary = page.customStyles?.secondaryColor;
    const looksLikeTemplateDefaults = (!savedPrimary && !savedSecondary) ||
      (savedPrimary === selectedTheme.colors.primary && savedSecondary === selectedTheme.colors.secondary);

    if (!looksLikeTemplateDefaults) {
      return;
    }

    if (accountDefaults.brandPrimaryColor) {
      setPrimaryColor(accountDefaults.brandPrimaryColor);
    }
    if (accountDefaults.brandSecondaryColor) {
      setSecondaryColor(accountDefaults.brandSecondaryColor);
    }
  }, [
    accountDefaults?.brandPrimaryColor,
    accountDefaults?.brandSecondaryColor,
    page?.id,
    page?.customStyles?.primaryColor,
    page?.customStyles?.secondaryColor,
    selectedTheme?.id,
  ]);

  const fetchAccountDefaults = async () => {
    try {
      const [profileRes, brandingRes] = await Promise.all([
        fetch('/api/settings/profile', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/settings/branding', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : null;
      const brandingData = brandingRes.ok ? await brandingRes.json() : null;
      const settings = profileData?.settings || {};

      setAccountDefaults({
        agentDisplayName: [settings.firstName, settings.lastName].filter(Boolean).join(' ') || profileData?.name || '',
        agentEmail: profileData?.email || '',
        agentPhone: settings.phone || '',
        agentPhotoUrl: settings.photoUrl || '',
        agentBio: settings.bio || '',
        brokerageDisplayName: settings.brokerageName || profileData?.brokerageName || '',
        brokerageLogoUrl: settings.brokerageLogoUrl || brandingData?.logoUrl || '',
        brokerageLogoWidth: Math.min(420, Math.max(140, Number(settings.brokerageLogoWidth || 260))),
        brokerageLogoBackground: settings.brokerageLogoBackground === 'TRANSPARENT' ? 'TRANSPARENT' : 'CARD',
        brokerageAddress: settings.brokerageAddress || '',
        brokeragePhone: settings.brokeragePhone || '',
        brandPrimaryColor: brandingData?.primaryColor || settings.brandColor || '',
        brandSecondaryColor: brandingData?.secondaryColor || settings.accentColor || '',
        agentWebsiteUrl: brandingData?.websiteUrl || '',
        defaultAgentPageUrl: profileData?.defaultAgentPage?.url || '',
        defaultAgentPageSlug: profileData?.defaultAgentPage?.slug || '',
        agentFacebookUrl: brandingData?.facebookUrl || '',
        agentInstagramUrl: brandingData?.instagramUrl || '',
        agentLinkedinUrl: brandingData?.linkedinUrl || '',
      });
    } catch (error) {
      console.error('Failed to fetch landing page account defaults', error);
    }
  };

  const fetchAnalytics = useCallback(async (landingPageId: string) => {
    try {
      setAnalyticsLoading(true);
      const res = await fetch(`/api/landing-pages/${landingPageId}/analytics?days=30`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch landing page analytics', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [authToken]);

  const fetchPage = async () => {
    try {
      const res = await fetch(`/api/landing-pages/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPage(data);
        setHeroImageUrl(data.heroImage || '');
        
        // Initialize from existing data
        const theme = themes.find(t => t.id === data.templateId) || themes[0];
        setSelectedTheme(theme);
        
        if (data.customContent) {
          setHeadline(data.customContent.headline || '');
          setSubheadline(data.customContent.subheadline || '');
          setCtaText(data.customContent.ctaText || 'Schedule a Showing');
          setCtaSecondaryText(data.customContent.ctaSecondaryText || 'Download Brochure');
          setAgentDisplayName(data.customContent.agentDisplayName || '');
          setAgentTitle(data.customContent.agentTitle || '');
          setAgentEmail(data.customContent.agentEmail || '');
          setAgentPhone(data.customContent.agentPhone || '');
          setAgentPhotoUrl(data.customContent.agentPhotoUrl || '');
          setAgentWebsiteUrl(data.customContent.agentWebsiteUrl || '');
          setAgentFacebookUrl(data.customContent.agentFacebookUrl || '');
          setAgentInstagramUrl(data.customContent.agentInstagramUrl || '');
          setAgentLinkedinUrl(data.customContent.agentLinkedinUrl || '');
          setBrokerageDisplayName(data.customContent.brokerageDisplayName || '');
          setBrokerageLogoUrl(data.customContent.brokerageLogoUrl || '');
          setBrokerageAddress(data.customContent.brokerageAddress || '');
          setBrokeragePhone(data.customContent.brokeragePhone || '');
          setGalleryImages(data.customContent.galleryImages || []);
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
          const nextShowHeaderQr = Boolean(data.customContent.showHeaderQr);
          const nextQrListingUrl = data.customContent.qrListingUrl || '';
          setShowHeaderQr(nextShowHeaderQr);
          setQrListingUrl(nextQrListingUrl);
          setQrListingToken(data.customContent.qrListingToken || (nextShowHeaderQr && !nextQrListingUrl ? buildQrListingToken() : ''));
          setQrPersonalUrl(data.customContent.qrPersonalUrl || '');
          setQrPersonalLabel(data.customContent.qrPersonalLabel || 'Agent info');
          setWhyChooseBullets(data.customContent.whyChooseBullets || []);
          const s = data.customContent.stats || {};
          setStatsYearsExperience(s.yearsExperience != null ? String(s.yearsExperience) : '');
          setStatsHomesSold(s.homesSold != null ? String(s.homesSold) : '');
          setStatsAvgDaysOnMarket(s.avgDaysOnMarket != null ? String(s.avgDaysOnMarket) : '');
          setStatsClientRating(s.clientRating != null ? String(s.clientRating) : '');
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
          setFormTitle(data.leadCapture.formTitle || 'How can I help?');
          setFormSubtitle(data.leadCapture.formSubtitle || "Fill out the form and we'll get back to you within 24 hours.");
          setLeadFormFields(data.leadCapture.requiredFields || ['name', 'email', 'phone']);
          setLeadButtonText(data.leadCapture.buttonText || 'Request Information');
          setSuccessMessage(data.leadCapture.successMessage || "Thank you! We'll be in touch soon.");
        }

        const fc = data.forceCapture || data.customContent?.forceCapture;
        if (fc) {
          setForceCaptureEnabled(Boolean(fc.enabled));
          setForceCaptureDelay(Number(fc.delay) || 0);
          setForceCaptureHeadline(fc.headline || 'Get instant access');
          setForceCaptureSubheadline(fc.subheadline || 'Enter your details to unlock the next step and direct agent follow-up.');
          setForceCaptureRequirePhone(Boolean(fc.requirePhone));
          setForceCapturePersistMode(fc.persistMode === 'ALWAYS' ? 'ALWAYS' : 'SESSION');
          setForceCaptureCtaText(fc.ctaText || 'Get access');
        }

        if (data.sections) {
          setSections((current) => ({ ...current, ...data.sections }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch page', error);
      showToast('error', 'Failed to load landing page');
    } finally {
      setLoading(false);
    }
  };

  const activeTemplateId = selectedTheme?.id || page?.templateId;
  const templateMediaPack = getTemplateMediaPack(activeTemplateId);
  const listingHasPhotoFeed = Boolean(page?.listing?.photos?.length);
  const listingIsLinked = Boolean(page?.listing?.addressLine1);
  const pageIntent = getLandingPageIntent({
    title: page?.title,
    description: page?.description,
    customContent: page?.customContent,
    sections,
    listing: page?.listing,
  });
  const effectiveAgentName = (agentDisplayName || accountDefaults?.agentDisplayName || page?.customContent?.agentDisplayName || 'your local agent').trim();
  const effectiveAgentEmail = (agentEmail || accountDefaults?.agentEmail || page?.customContent?.agentEmail || '').trim();
  const effectiveAgentPhone = (agentPhone || accountDefaults?.agentPhone || page?.customContent?.agentPhone || '').trim();
  const effectiveAgentPhotoUrl = (agentPhotoUrl || accountDefaults?.agentPhotoUrl || page?.customContent?.agentPhotoUrl || '').trim();
  const effectiveBrokerageName = (brokerageDisplayName || accountDefaults?.brokerageDisplayName || page?.customContent?.brokerageDisplayName || '').trim();
  const effectiveBrokerageLogoUrl = (brokerageLogoUrl || accountDefaults?.brokerageLogoUrl || page?.customContent?.brokerageLogoUrl || '').trim();
  const brandColorSynced = Boolean(
    accountDefaults?.brandPrimaryColor &&
    primaryColor.toLowerCase() === accountDefaults.brandPrimaryColor.toLowerCase(),
  );
  const brandingGaps = [
    !effectiveAgentName && 'agent name',
    !effectiveAgentEmail && 'agent email',
    !effectiveAgentPhone && 'agent phone',
    !(effectiveBrokerageName || effectiveBrokerageLogoUrl) && 'brokerage name or logo',
  ].filter(Boolean) as string[];
  const listingHeadline = typeof (page?.listing as { headline?: unknown } | undefined)?.headline === 'string'
    ? (page?.listing as { headline?: string }).headline?.trim()
    : '';
  const listingDisplayName = (listingHeadline || page?.listing?.addressLine1 || page?.title || 'this property').trim();
  const listingFactLine = [
    page?.listing?.beds != null && page?.listing?.baths != null ? `${page.listing.beds} beds, ${page.listing.baths} baths` : '',
    page?.listing?.sqft ? `${Number(page.listing.sqft).toLocaleString()} sqft` : '',
    [page?.listing?.city, page?.listing?.state].filter(Boolean).join(', '),
  ].filter(Boolean).join(' - ');
  const headlineIdeas = getHeadlineIdeas(pageIntent.kind, listingDisplayName, effectiveAgentName);
  const subheadlineIdeas = getSubheadlineIdeas(pageIntent.kind, listingFactLine, effectiveAgentName);
  const ctaIdeas = getCtaIdeas(pageIntent.kind);
  const quickHighlightIdeas = getQuickHighlightIdeas(pageIntent.kind);
  const seoTitleFallback = pageIntent.kind === 'listing'
    ? `${listingDisplayName} | For Sale`
    : pageIntent.kind === 'agent-profile'
      ? `${effectiveAgentName} | Real Estate`
      : pageIntent.kind === 'seller'
        ? 'Free Home Value Report | Local Pricing Strategy'
        : pageIntent.kind === 'buyer'
          ? 'Buyer Game Plan | Local Home Search Strategy'
          : `${pageIntent.label} | Real Estate`;
  const seoDescriptionFallback = subheadline || subheadlineIdeas[0] || pageIntent.editorDescription;
  const leadFormTitleFallback = pageIntent.kind === 'listing'
    ? 'Interested in this property?'
    : pageIntent.kind === 'seller'
      ? 'Request your home value report'
      : pageIntent.kind === 'buyer'
        ? 'Tell me what you are looking for'
        : `Connect with ${effectiveAgentName}`;
  const leadButtonFallback = pageIntent.kind === 'listing'
    ? 'Request Information'
    : pageIntent.kind === 'seller'
      ? 'Request my report'
      : pageIntent.kind === 'buyer'
        ? 'Send my game plan'
        : 'Send message';
  const forceGateSubheadlinePlaceholder = pageIntent.kind === 'listing'
    ? 'Enter your details to unlock full property photos, pricing, and schedule a private tour.'
    : 'Enter your details to unlock this page and direct agent follow-up.';
  const forceGateCtaPlaceholder = pageIntent.kind === 'listing' ? 'Unlock property details' : 'Get access';
  const socialProofPlaceholder = pageIntent.kind === 'listing'
    ? '47 people viewed this property today'
    : pageIntent.kind === 'seller'
      ? 'Local seller reports requested this week'
      : pageIntent.kind === 'buyer'
        ? 'Buyer plans started this week'
        : 'Fast local follow-up available today';
  const urgencyPresets = pageIntent.kind === 'listing'
    ? ['Hot Property!', 'Price Reduced!', 'Open House Sunday', 'Just Listed', 'Multiple Offers']
    : pageIntent.kind === 'seller'
      ? ['Free Home Value Report', 'Market Shift Update', 'Seller Prep Window', 'Pricing Strategy Ready', 'Local Comps Available']
      : pageIntent.kind === 'buyer'
        ? ['Buyer Game Plan', 'Tour Shortlist Ready', 'New Search Strategy', 'Offer Prep Help', 'Local Market Update']
        : ['Fast Reply', 'Local Guidance', 'No Obligation', 'Ask a Question', 'Start Here'];
  const editorPreviewHeroImage =
    heroImageUrl.trim() ||
    galleryImages[0] ||
    page?.listing?.photos?.[0] ||
    selectedTheme?.preview ||
    templateMediaPack.hero;
  const heroImageCandidates = Array.from(new Map([
    ...(heroImageUrl.trim() ? [{ url: heroImageUrl.trim(), label: 'Current hero' }] : []),
    ...((page?.listing?.photos || []).slice(0, 8).map((url, index) => ({ url, label: `Listing photo ${index + 1}` }))),
    ...(galleryImages.filter(Boolean).map((url, index) => ({ url, label: `Uploaded image ${index + 1}` }))),
    ...(templateMediaPack.hero ? [{ url: templateMediaPack.hero, label: 'Style hero' }] : []),
    ...templateMediaPack.gallery.slice(0, 6).map((url, index) => ({ url, label: `Style image ${index + 1}` })),
  ]
    .filter((item) => item.url && String(item.url).trim())
    .map((item) => [item.url, item] as const)).values()).slice(0, 14);
  const editorOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const defaultListingUrl = page ? `${editorOrigin}/sites/${page.slug}` : '';
  const trimmedQrListingToken = qrListingToken.trim();
  const generatedListingQrUrl = trimmedQrListingToken && defaultListingUrl && page
    ? buildTrackedLandingQrUrl(defaultListingUrl, page.slug, trimmedQrListingToken)
    : '';
  const effectiveListingQrDestination = generatedListingQrUrl || qrListingUrl.trim() || defaultListingUrl;
  const handleShowHeaderQrChange = (checked: boolean) => {
    setShowHeaderQr(checked);
    if (checked && !qrListingToken.trim() && !qrListingUrl.trim()) {
      setQrListingToken(buildQrListingToken());
    }
  };

  const applyTemplateMediaSuggestions = useCallback(
    (templateId?: string | null, options?: { replaceHero?: boolean }) => {
      const resolvedTemplateId = templateId || selectedTheme?.id || page?.templateId;
      const mediaPack = getTemplateMediaPack(resolvedTemplateId);
      const existingHero = heroImageUrl.trim();
      const existingGallery = galleryImages.filter((image) => image && image.trim());
      const shouldApplyHero = Boolean(mediaPack.hero) && (options?.replaceHero || !existingHero);
      const nextGallery = Array.from(new Set([...existingGallery, ...mediaPack.gallery])).slice(0, 8);
      const galleryAdded = Math.max(0, nextGallery.length - existingGallery.length);

      if (shouldApplyHero) {
        setHeroImageUrl(mediaPack.hero);
      }
      if (galleryAdded > 0) {
        setGalleryImages(nextGallery);
      }

      return {
        heroApplied: shouldApplyHero,
        galleryAdded,
        themeName: themes.find((theme) => theme.id === resolvedTemplateId)?.name || 'selected template',
      };
    },
    [galleryImages, heroImageUrl, page?.templateId, selectedTheme?.id],
  );

  const handleAiGenerate = async () => {
    if (!page || aiGenerating) return;
    setAiGenerating(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/ai/landing-pages/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          address: page.listing?.addressLine1 || page.title,
          beds: page.listing?.beds,
          baths: page.listing?.baths,
          sqft: page.listing?.sqft,
          price: page.listing?.price,
          propertyType: page.listing?.propertyType,
          notes: page.listing?.description,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toDisplayErrorMessage(data?.error ?? data, 'AI generation failed'));
      }
      const data = await res.json();
      if (data.headline) setHeadline(data.headline);
      if (data.subheadline) setSubheadline(data.subheadline);
      if (Array.isArray(data.features) && data.features.length > 0) {
        setFeatures((current) => (current.length === 0 ? data.features.slice(0, 8) : current));
      }
      let successText = 'AI suggestions applied! Review and save when ready.';
      const needsMediaBootstrap = !listingHasPhotoFeed && !heroImageUrl.trim() && galleryImages.length === 0;
      if (needsMediaBootstrap) {
        const mediaSeed = applyTemplateMediaSuggestions(selectedTheme?.id || page.templateId, { replaceHero: true });
        if (mediaSeed.heroApplied || mediaSeed.galleryAdded > 0) {
          successText = `AI suggestions applied plus ${mediaSeed.themeName} starter images so the page already looks polished.`;
        }
      }
      setAiMessage({ type: 'success', text: successText });
    } catch (err) {
      setAiMessage({ type: 'error', text: toDisplayErrorMessage(err, 'AI generation failed') });
    } finally {
      setAiGenerating(false);
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
          heroImage: heroImageUrl.trim() || null,
          templateId: selectedTheme?.id,
          customContent: {
            pageKind: page.customContent?.pageKind || pageIntent.storageKind,
            headline,
            subheadline,
            ctaText,
            ctaSecondaryText,
            agentDisplayName: agentDisplayName.trim(),
            agentTitle: agentTitle.trim(),
            agentEmail: agentEmail.trim(),
            agentPhone: agentPhone.trim(),
            agentPhotoUrl: agentPhotoUrl.trim(),
            agentWebsiteUrl: agentWebsiteUrl.trim(),
            agentFacebookUrl: agentFacebookUrl.trim(),
            agentInstagramUrl: agentInstagramUrl.trim(),
            agentLinkedinUrl: agentLinkedinUrl.trim(),
            brokerageDisplayName: brokerageDisplayName.trim(),
            brokerageLogoUrl: brokerageLogoUrl.trim(),
            brokerageAddress: brokerageAddress.trim(),
            brokeragePhone: brokeragePhone.trim(),
            galleryImages,
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
            showHeaderQr,
            qrListingUrl,
            qrListingToken,
            qrPersonalUrl,
            qrPersonalLabel,
            whyChooseBullets,
            stats: {
              yearsExperience: statsYearsExperience ? Number(statsYearsExperience) || statsYearsExperience : undefined,
              homesSold: statsHomesSold ? Number(statsHomesSold) || statsHomesSold : undefined,
              avgDaysOnMarket: statsAvgDaysOnMarket ? Number(statsAvgDaysOnMarket) || statsAvgDaysOnMarket : undefined,
              clientRating: statsClientRating ? Number(statsClientRating) || statsClientRating : undefined,
            },
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
          forceCapture: {
            enabled: forceCaptureEnabled,
            delay: Math.max(0, Number(forceCaptureDelay) || 0),
            headline: forceCaptureHeadline,
            subheadline: forceCaptureSubheadline,
            requirePhone: forceCaptureRequirePhone,
            persistMode: forceCapturePersistMode,
            ctaText: forceCaptureCtaText,
          },
          sections,
        }),
      });

      if (res.ok) {
        await fetchAnalytics(page.id);
        if (showCreationGuide) {
          setHasSavedSinceCreate(true);
        }
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

    const needsMediaBootstrap = !page?.listing?.photos?.length && !heroImageUrl.trim() && galleryImages.length === 0;
    if (needsMediaBootstrap) {
      const mediaSeed = applyTemplateMediaSuggestions(theme.id, { replaceHero: true });
      if (mediaSeed.heroApplied || mediaSeed.galleryAdded > 0) {
        showToast('success', `${theme.name} starter images added. You can swap any image in Content.`);
      }
    }
  };

  const contentReady = Boolean(
    headline.trim() ||
    subheadline.trim() ||
    heroImageUrl.trim() ||
    galleryImages.length ||
    features.length ||
    page?.listing?.photos?.length,
  );

  const brandingReady = brandingGaps.length === 0;

  const leadCaptureReady = Boolean(
    !leadCaptureEnabled ||
    (formTitle.trim() && leadButtonText.trim() && leadFormFields.length > 0),
  );
  const seoReady = Boolean(metaTitle.trim() && metaDescription.trim());
  const qrReady = Boolean(!showHeaderQr || trimmedQrListingToken || qrListingUrl.trim());

  const creationChecklist = [
    {
      id: 'theme',
      label: 'Choose a theme',
      description: 'Pick the visual direction for the live page.',
      complete: Boolean(selectedTheme),
      targetTab: 'theme' as const,
      targetSection: 'theme-picker',
      actionLabel: selectedTheme ? 'Review theme' : 'Choose theme',
    },
    {
      id: 'content',
      label: 'Add hero and content',
      description: pageIntent.kind === 'listing' ? 'Set the property headline, media, and listing story.' : 'Set the headline, media, and lead offer.',
      complete: contentReady,
      targetTab: 'content' as const,
      targetSection: 'hero-content',
      actionLabel: contentReady ? 'Review content' : 'Add content',
    },
    {
      id: 'branding',
      label: 'Confirm agent branding',
      description: brandingReady
        ? `${effectiveAgentName}${effectiveBrokerageName ? ` - ${effectiveBrokerageName}` : ''}`
        : `Missing ${brandingGaps.join(', ')}.`,
      complete: brandingReady,
      targetTab: 'content' as const,
      targetSection: 'agent-branding',
      actionLabel: brandingReady ? 'Review branding' : 'Fix branding',
    },
    {
      id: 'leads',
      label: 'Review lead capture',
      description: 'Confirm the form title, fields, and CTA text.',
      complete: leadCaptureReady,
      targetTab: 'seo' as const,
      targetSection: 'lead-capture',
      actionLabel: leadCaptureReady ? 'Review form' : 'Fix form',
    },
    {
      id: 'seo',
      label: 'Set SEO preview text',
      description: 'Add title and description for search and social previews.',
      complete: seoReady,
      targetTab: 'seo' as const,
      targetSection: 'seo-preview',
      actionLabel: seoReady ? 'Review SEO' : 'Add SEO',
    },
    {
      id: 'qr',
      label: 'Confirm QR tracking',
      description: 'Keep the public QR tied to a tracked page token.',
      complete: qrReady,
      targetTab: 'seo' as const,
      targetSection: 'qr-tracking',
      actionLabel: qrReady ? 'Review QR' : 'Fix QR',
    },
    {
      id: 'preview',
      label: 'Preview the live page',
      description: 'Check how the public route looks before publishing.',
      complete: hasViewedPreview,
      targetTab: 'preview' as const,
      targetSection: 'full-preview',
      actionLabel: hasViewedPreview ? 'Open preview' : 'Preview page',
    },
    {
      id: 'save',
      label: 'Save your page',
      description: 'Persist the final version so the setup is complete.',
      complete: hasSavedSinceCreate,
      targetTab: activeTab,
      targetSection: null,
      actionLabel: hasSavedSinceCreate ? 'Save again' : 'Save now',
    },
  ];

  const completedChecklistCount = creationChecklist.filter((item) => item.complete).length;
  const nextChecklistItem = creationChecklist.find((item) => !item.complete);
  const sectionSpotlightClass = (sectionId: string) =>
    spotlightSection === sectionId ? 'ring-2 ring-cyan-300/70 shadow-[0_0_0_1px_rgba(103,232,249,0.22),0_24px_80px_-44px_rgba(34,211,238,0.95)]' : '';

  const jumpToWorkflowItem = (item: typeof creationChecklist[number]) => {
    if (item.id === 'save') {
      void handleSave();
      return;
    }

    setActiveTab(item.targetTab);

    const targetSection = item.targetSection;
    if (!targetSection) {
      return;
    }

    setSpotlightSection(targetSection);
    window.setTimeout(() => {
      document
        .querySelector(`[data-editor-section="${targetSection}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    window.setTimeout(() => {
      setSpotlightSection((current) => (current === targetSection ? null : current));
    }, 2200);
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

  const applyAccountDefaultsToOverrides = () => {
    if (!accountDefaults) return;
    setAgentDisplayName(accountDefaults.agentDisplayName);
    setAgentEmail(accountDefaults.agentEmail);
    setAgentPhone(accountDefaults.agentPhone);
    setAgentPhotoUrl(accountDefaults.agentPhotoUrl);
    setAgentWebsiteUrl(accountDefaults.agentWebsiteUrl);
    setAgentFacebookUrl(accountDefaults.agentFacebookUrl);
    setAgentInstagramUrl(accountDefaults.agentInstagramUrl);
    setAgentLinkedinUrl(accountDefaults.agentLinkedinUrl);
    setBrokerageDisplayName(accountDefaults.brokerageDisplayName);
    setBrokerageLogoUrl(accountDefaults.brokerageLogoUrl);
    setBrokerageAddress(accountDefaults.brokerageAddress);
    setBrokeragePhone(accountDefaults.brokeragePhone);
    if (accountDefaults.brandPrimaryColor) {
      setPrimaryColor(accountDefaults.brandPrimaryColor);
    }
    if (accountDefaults.brandSecondaryColor) {
      setSecondaryColor(accountDefaults.brandSecondaryColor);
    }
    if (!agentBio.trim()) {
      setAgentBio(accountDefaults.agentBio);
    }
    showToast('success', 'Account branding loaded into this landing page. Save to publish it.');
  };

  const clearPageIdentityOverrides = () => {
    setAgentDisplayName('');
    setAgentTitle('');
    setAgentEmail('');
    setAgentPhone('');
    setAgentPhotoUrl('');
    setAgentWebsiteUrl('');
    setAgentFacebookUrl('');
    setAgentInstagramUrl('');
    setAgentLinkedinUrl('');
    setBrokerageDisplayName('');
    setBrokerageLogoUrl('');
    setBrokerageAddress('');
    setBrokeragePhone('');
  };

  const setAssetUploading = (slot: string, value: boolean) => {
    setUploadingAssets((current) => ({ ...current, [slot]: value }));
  };

  const uploadAsset = async (kind: 'hero' | 'agent-photo' | 'brokerage-logo' | 'gallery', file?: File | null) => {
    if (!page || !file) return;

    setAssetUploading(kind, true);
    try {
      const formData = new FormData();
      formData.append('asset', file);
      formData.append('kind', kind);

      const res = await fetch(`/api/landing-pages/${page.id}/assets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.assetUrl) {
        throw new Error(toDisplayErrorMessage(data?.error ?? data, 'Upload failed'));
      }

      if (kind === 'hero') {
        setHeroImageUrl(data.assetUrl);
      } else if (kind === 'agent-photo') {
        setAgentPhotoUrl(data.assetUrl);
      } else if (kind === 'brokerage-logo') {
        setBrokerageLogoUrl(data.assetUrl);
      } else if (kind === 'gallery') {
        setGalleryImages((current) => Array.from(new Set([...current, data.assetUrl])));
      }

      showToast('success', 'Image uploaded successfully');
    } catch (error: any) {
      console.error('Failed to upload landing page asset', error);
      showToast('error', toDisplayErrorMessage(error, 'Failed to upload image'));
    } finally {
      setAssetUploading(kind, false);
    }
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
          onClick={() => navigate('/landing-pages')}
          className="mt-4 text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Landing Pages
        </button>
      </div>
    );
  }

  return (
    <div className="ae-settings-content min-h-screen bg-slate-950">
      <input
        ref={heroImageUploadRef}
        data-upload-slot="hero"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void uploadAsset('hero', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={agentPhotoUploadRef}
        data-upload-slot="agent-photo"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void uploadAsset('agent-photo', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={brokerageLogoUploadRef}
        data-upload-slot="brokerage-logo"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void uploadAsset('brokerage-logo', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryUploadRef}
        data-upload-slot="gallery"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void uploadAsset('gallery', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
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
                onClick={() => navigate('/landing-pages')}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-white">{page.title}</h1>
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                    {pageIntent.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  /sites/{page.slug} - {pageIntent.dashboardDetail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/settings/profile"
                className="hidden lg:flex px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Profile & Branding
              </a>
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
                type="button"
                onClick={() => setShowShareModal(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2"
                title="Share link & QR code"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
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
              { id: 'theme', label: 'Theme', icon: Palette },
              { id: 'content', label: 'Content', icon: PenLine },
              { id: 'sections', label: 'Sections', icon: LayoutGrid },
              { id: 'style', label: 'Style', icon: TypeIcon },
              { id: 'seo', label: 'SEO & Leads', icon: Search },
              { id: 'preview', label: 'Preview', icon: Eye },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TabIcon className="mr-2 inline h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400" />
                )}
              </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {showCreationGuide && (
          <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-emerald-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">New page workflow</p>
                <h2 className="mt-2 text-lg font-semibold text-white">You are editing a {pageIntent.label.toLowerCase()}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  {pageIntent.editorDescription} Choose the theme, tune the copy and sections, preview the live route, then save when the page is ready to publish.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                  <span className="font-semibold text-cyan-200">{completedChecklistCount}/{creationChecklist.length}</span>
                  steps complete
                </div>
                {nextChecklistItem && (
                  <button
                    type="button"
                    onClick={() => jumpToWorkflowItem(nextChecklistItem)}
                    className="ml-0 mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25 sm:ml-3 sm:mt-4"
                  >
                    Next: {nextChecklistItem.actionLabel}
                    <span aria-hidden="true">-&gt;</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpToWorkflowItem(creationChecklist.find((item) => item.id === 'content') || creationChecklist[1])}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Go To Content
                </button>
                <button
                  type="button"
                  onClick={() => jumpToWorkflowItem(creationChecklist.find((item) => item.id === 'preview') || creationChecklist[6])}
                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 hover:text-cyan-100"
                >
                  Jump To Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreationGuide(false)}
                  className="rounded-xl border border-white/10 bg-slate-950/20 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Hide Guide
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {creationChecklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => jumpToWorkflowItem(item)}
                  className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                    item.complete
                      ? 'border-emerald-500/25 bg-emerald-500/10 hover:border-emerald-300/45 hover:bg-emerald-500/15'
                      : 'border-white/10 bg-slate-950/20 hover:border-cyan-500/35 hover:bg-cyan-500/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <p className={`mt-1 line-clamp-2 text-xs ${item.complete ? 'text-emerald-100/80' : item.id === 'branding' && !item.complete ? 'text-amber-100' : 'text-slate-300'}`}>
                        {item.description}
                      </p>
                    </div>
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border ${
                        item.complete
                          ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      {item.complete ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-semibold">Go</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.complete
                        ? 'bg-emerald-400/15 text-emerald-100'
                        : 'bg-cyan-400/10 text-cyan-100 group-hover:bg-cyan-400/20'
                    }`}>
                      {item.actionLabel}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-300">
                      {item.complete ? 'Ready' : 'Open'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {completedChecklistCount === creationChecklist.length && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Setup complete. This landing page has been themed, reviewed, previewed, and saved.
              </div>
            )}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Live page wiring</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{pageIntent.label}: profile, branding, preview, and live link are aligned</h2>
              </div>
              <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 border border-emerald-500/20">
                Public route active
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              {pageIntent.kind === 'listing'
                ? 'This public route should lead with the property details first, then support the agent with brokerage identity, contact actions, QR tracking, and lead capture.'
                : `${pageIntent.editorDescription} Agent profile, brokerage identity, contact details, and brand styling render on the live page visitors see.`}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">30-day performance</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Live page analytics</h2>
              </div>
              {analyticsLoading && <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label="Views" value={String(analytics?.summary.pageViews ?? 0)} />
              <MetricCard label="Unique" value={String(analytics?.summary.uniqueVisitors ?? 0)} />
              <MetricCard label="Leads" value={String(analytics?.summary.leads ?? 0)} />
              <MetricCard label="QR scans" value={String(analytics?.summary.qrViews ?? 0)} />
              <MetricCard label="QR leads" value={String(analytics?.summary.qrLeads ?? 0)} />
              <MetricCard label="Conversion" value={`${(analytics?.summary.conversionRate ?? 0).toFixed(1)}%`} />
              <MetricCard label="QR conversion" value={`${(analytics?.summary.qrConversionRate ?? 0).toFixed(1)}%`} />
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-400">
              <div>
                Page QR: <span className="text-slate-200">{showHeaderQr ? (trimmedQrListingToken ? `Active token ${trimmedQrListingToken}` : 'Active page QR') : 'Hidden from public top tile'}</span>
              </div>
              <div>
                Top source: <span className="text-slate-200">{analytics?.topSources?.[0]?.utmSource || 'Direct / uncategorized'}</span>
              </div>
              <div>
                Top campaign: <span className="text-slate-200">{analytics?.topCampaigns?.[0]?.utmCampaign || 'No campaign data yet'}</span>
              </div>
              <div>
                Top medium: <span className="text-slate-200">{analytics?.topMediums?.[0]?.utmMedium || 'No medium data yet'}</span>
              </div>
              <div>
                Top device: <span className="text-slate-200">{analytics?.deviceBreakdown?.[0]?.device || 'Unknown'}</span>
              </div>
              <div>
                Top market: <span className="text-slate-200">{[analytics?.locationData?.[0]?.city, analytics?.locationData?.[0]?.region, analytics?.locationData?.[0]?.country].filter(Boolean).join(', ') || 'Not enough data yet'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Selection */}
        {activeTab === 'theme' && (
          <div data-editor-section="theme-picker" className={`scroll-mt-56 space-y-6 rounded-2xl transition-all duration-300 ${sectionSpotlightClass('theme-picker')}`}>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Choose Your Theme</h2>
              <p className="text-slate-400 text-sm">
                Select a theme that matches this {pageIntent.label.toLowerCase()}. You can customize colors in the Style tab.
              </p>
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
                    <Palette className="h-7 w-7 text-white" />
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">{pageIntent.editorHeading}</h2>
                <p className="text-slate-400 text-sm">{pageIntent.editorDescription}</p>
              </div>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                className="group relative inline-flex items-center gap-2 rounded-xl border border-purple-400/30 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 px-4 py-2.5 text-sm font-semibold text-purple-100 shadow-lg shadow-purple-500/20 transition-all hover:from-purple-500/30 hover:to-fuchsia-500/30 disabled:opacity-60"
              >
                {aiGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {aiGenerating ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
            {aiMessage && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${aiMessage.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
                {aiMessage.text}
              </div>
            )}

            {!listingHasPhotoFeed && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Media quick start</p>
                    <p className="mt-1 text-sm text-amber-100">
                      {listingIsLinked
                        ? 'This listing is linked but has no photos yet. Start with template images now, then replace them when listing photos arrive.'
                        : pageIntent.heroImageHelper}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const mediaSeed = applyTemplateMediaSuggestions(activeTemplateId, { replaceHero: true });
                        if (mediaSeed.heroApplied || mediaSeed.galleryAdded > 0) {
                          showToast('success', `${mediaSeed.themeName} image suggestions applied.`);
                        } else {
                          showToast('success', 'Template images are already in use.');
                        }
                      }}
                      className="rounded-xl border border-amber-300/30 bg-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/30"
                    >
                      Apply {selectedTheme?.name || 'template'} images
                    </button>
                    {pageIntent.kind === 'listing' && !listingIsLinked && (
                      <a
                        href="/landing-pages"
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                      >
                        Link Listing Later
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[templateMediaPack.hero, ...templateMediaPack.gallery].slice(0, 4).map((imageUrl, index) => (
                    <button
                      key={`template-media-${index}`}
                      type="button"
                      onClick={() => {
                        setHeroImageUrl(imageUrl);
                        setGalleryImages((current) => Array.from(new Set([imageUrl, ...current])).slice(0, 8));
                      }}
                      className="group overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-left"
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <img src={imageUrl} alt={index === 0 ? 'Suggested hero image' : 'Suggested gallery image'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      </div>
                      <div className="px-2 py-1.5 text-[10px] font-medium text-slate-200">
                        {index === 0 ? 'Set as hero + gallery' : 'Use in hero/gallery'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              data-editor-section="hero-content"
              className={`scroll-mt-56 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-950/80 via-cyan-500/10 to-blue-500/10 p-5 shadow-[0_22px_60px_-42px_rgba(34,211,238,0.65)] transition-all duration-300 ${sectionSpotlightClass('hero-content')}`}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] lg:items-start">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
                  <div className="relative aspect-[16/10]">
                    {editorPreviewHeroImage ? (
                      <img src={editorPreviewHeroImage} alt="Current hero preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-900 text-sm text-slate-400">
                        No hero selected
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">Hero image</div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                        {heroImageUrl.trim() ? 'Custom hero selected' : 'Using first available page image'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <EditorIconBadge icon={ImageIcon} tone="cyan" />
                          Hero Image Studio
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{pageIntent.heroImageHelper}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => heroImageUploadRef.current?.click()}
                          disabled={Boolean(uploadingAssets.hero)}
                          className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadingAssets.hero ? 'Uploading...' : 'Upload hero'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const firstGallery = galleryImages[0] || page?.listing?.photos?.[0] || templateMediaPack.hero;
                            if (firstGallery) setHeroImageUrl(firstGallery);
                          }}
                          disabled={!galleryImages[0] && !page?.listing?.photos?.[0] && !templateMediaPack.hero}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Use first image
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeroImageUrl('')}
                          disabled={!heroImageUrl.trim()}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Clear custom
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 mb-2">Hero image URL</label>
                      <input
                        type="url"
                        value={heroImageUrl}
                        onChange={(e) => setHeroImageUrl(e.target.value)}
                        placeholder="https://example.com/hero-image.jpg"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {heroImageCandidates.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Pick from available images</p>
                        <span className="text-[11px] text-slate-500">{heroImageCandidates.length} ready</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {heroImageCandidates.map((candidate) => {
                          const isActiveHero = candidate.url === (heroImageUrl.trim() || editorPreviewHeroImage);
                          return (
                            <button
                              key={candidate.url}
                              type="button"
                              onClick={() => setHeroImageUrl(candidate.url)}
                              className={`group overflow-hidden rounded-xl border bg-slate-950 text-left transition-all ${
                                isActiveHero
                                  ? 'border-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,0.55)]'
                                  : 'border-white/10 hover:border-cyan-400/45'
                              }`}
                            >
                              <div className="aspect-[4/3] overflow-hidden">
                                <img src={candidate.url} alt={candidate.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              </div>
                              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                <span className="truncate text-[10px] font-medium text-slate-200">{candidate.label}</span>
                                {isActiveHero && <Check className="h-3.5 w-3.5 shrink-0 text-cyan-200" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left column - inputs */}
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={PenLine} tone="blue" />
                    Headlines & Copy
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{pageIntent.headlineLabel}</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder={headlineIdeas[0]}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                    <p className="mt-2 text-xs text-slate-500">{pageIntent.headlineHelper}</p>
                    {/* Headline suggestions */}
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">Headline Ideas:</p>
                      <div className="flex flex-wrap gap-1">
                        {headlineIdeas.map((suggestion) => (
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
                      placeholder={subheadlineIdeas[0]}
                      rows={2}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                    />
                    {/* Subheadline suggestions */}
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">Subheadline Ideas:</p>
                      <div className="flex flex-wrap gap-1">
                        {subheadlineIdeas.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setSubheadline(suggestion)}
                            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 transition-colors"
                          >
                            {suggestion.length > 42 ? `${suggestion.slice(0, 40)}...` : suggestion}
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
                      {ctaIdeas.map((cta) => (
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
                    <EditorIconBadge icon={Sparkles} tone="emerald" />
                    {pageIntent.kind === 'listing' ? 'Property Features' : 'Page Highlights'}
                  </h3>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 space-y-3">
                    <div>
                      <div className="text-sm font-medium text-white">Gallery Images</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {pageIntent.kind === 'listing'
                          ? 'Add extra property images to the public page gallery. Listing and MLS photos still flow through automatically.'
                          : 'Add page imagery that supports this campaign. Profile, brokerage, and lead capture still flow through automatically.'}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => galleryUploadRef.current?.click()}
                        disabled={Boolean(uploadingAssets.gallery)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uploadingAssets.gallery ? 'Uploading...' : 'Upload image'}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={galleryImageDraft}
                        onChange={(e) => setGalleryImageDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && galleryImageDraft.trim()) {
                            e.preventDefault();
                            setGalleryImages((current) => Array.from(new Set([...current, galleryImageDraft.trim()])));
                            setGalleryImageDraft('');
                          }
                        }}
                        placeholder={pageIntent.kind === 'listing' ? 'https://example.com/property-photo.jpg' : 'https://example.com/page-photo.jpg'}
                        className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-sm"
                      />
                      <button
                        onClick={() => {
                          if (!galleryImageDraft.trim()) return;
                          setGalleryImages((current) => Array.from(new Set([...current, galleryImageDraft.trim()])));
                          setGalleryImageDraft('');
                        }}
                        disabled={!galleryImageDraft.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {galleryImages.length > 0 && (
                      <div className="space-y-2">
                        {galleryImages.map((imageUrl) => (
                          <div key={imageUrl} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="h-10 w-12 overflow-hidden rounded-lg bg-slate-900">
                              <img src={imageUrl} alt="Gallery preview" className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1 truncate text-xs text-slate-300">{imageUrl}</div>
                            <button
                              onClick={() => setHeroImageUrl(imageUrl)}
                              className={`rounded-lg px-2 py-1 text-xs ${
                                heroImageUrl.trim() === imageUrl
                                  ? 'bg-cyan-500/15 text-cyan-200'
                                  : 'text-cyan-300 hover:bg-cyan-500/10'
                              }`}
                            >
                              {heroImageUrl.trim() === imageUrl ? 'Hero' : 'Set hero'}
                            </button>
                            <button
                              onClick={() => setGalleryImages((current) => current.filter((item) => item !== imageUrl))}
                              className="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick feature suggestions */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Quick Add</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {quickHighlightIdeas.filter(f => !features.includes(f)).slice(0, 6).map((feature) => (
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
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">{features.length}/8 features added</p>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={BarChart3} tone="amber" />
                    Agent Stats
                  </h3>
                  <p className="text-xs text-slate-400 -mt-2">Shown in the hero stats bar when the "Agent Stats Bar" section is enabled.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Years Experience</label>
                      <input type="number" value={statsYearsExperience} onChange={(e) => setStatsYearsExperience(e.target.value)} placeholder="12" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Homes Sold</label>
                      <input type="number" value={statsHomesSold} onChange={(e) => setStatsHomesSold(e.target.value)} placeholder="287" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Avg Days on Market</label>
                      <input type="number" value={statsAvgDaysOnMarket} onChange={(e) => setStatsAvgDaysOnMarket(e.target.value)} placeholder="18" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Client Rating</label>
                      <input type="number" step="0.1" min="0" max="5" value={statsClientRating} onChange={(e) => setStatsClientRating(e.target.value)} placeholder="4.9" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={Trophy} tone="purple" />
                    Why Work With Me
                  </h3>
                  <p className="text-xs text-slate-400 -mt-2">Checkmark bullets shown in the "Why Work With Me" section.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newWhyBullet}
                      onChange={(e) => setNewWhyBullet(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newWhyBullet.trim() && whyChooseBullets.length < 8) {
                          setWhyChooseBullets([...whyChooseBullets, newWhyBullet.trim()]);
                          setNewWhyBullet('');
                        }
                      }}
                      placeholder="e.g. Top 1% of agents in Salt Lake County"
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newWhyBullet.trim() && whyChooseBullets.length < 8) {
                          setWhyChooseBullets([...whyChooseBullets, newWhyBullet.trim()]);
                          setNewWhyBullet('');
                        }
                      }}
                      disabled={!newWhyBullet.trim() || whyChooseBullets.length >= 8}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {whyChooseBullets.length > 0 && (
                    <div className="space-y-2">
                      {whyChooseBullets.map((bullet, index) => (
                        <div key={`${bullet}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                          <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-300" /> {bullet}</span>
                          <button type="button" onClick={() => setWhyChooseBullets(whyChooseBullets.filter((_, i) => i !== index))} className="text-rose-300 hover:text-rose-200 text-xs">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  data-editor-section="agent-branding"
                  className={`scroll-mt-56 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5 transition-all duration-300 ${sectionSpotlightClass('agent-branding')}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <EditorIconBadge icon={UsersRound} tone="cyan" />
                        Agent & Brokerage Overrides
                      </h3>
                      <p className="mt-2 text-xs text-slate-400">Leave any field blank to keep using the account-level Profile and Brokerage settings. Fill a field here when this specific landing page needs different contact or branding details.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={applyAccountDefaultsToOverrides}
                        className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                      >
                        Sync account branding
                      </button>
                      <button
                        onClick={clearPageIdentityOverrides}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
                      >
                        Clear Overrides
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-4 ${brandingReady ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-amber-400/25 bg-amber-500/10'}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className={`text-xs font-bold uppercase tracking-[0.16em] ${brandingReady ? 'text-emerald-200' : 'text-amber-200'}`}>
                          {brandingReady ? 'Branding ready' : 'Branding needs attention'}
                        </div>
                        <p className="mt-1 text-sm text-slate-200">
                          This page will show {effectiveAgentName || 'the agent name'}
                          {effectiveBrokerageName ? ` with ${effectiveBrokerageName}` : effectiveBrokerageLogoUrl ? ' with the brokerage logo' : ''}.
                        </p>
                        {!brandingReady && (
                          <p className="mt-1 text-xs text-amber-100">
                            Add {brandingGaps.join(', ')} or click Sync account branding.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="/settings/profile"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                        >
                          Profile settings
                        </a>
                        <a
                          href="/settings/branding"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                        >
                          Brand settings
                        </a>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Contact</div>
                        <div className="mt-2 text-sm font-semibold text-white">{effectiveAgentName || 'Agent name missing'}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{effectiveAgentEmail || 'Email missing'}</div>
                        <div className="truncate text-xs text-slate-400">{effectiveAgentPhone || 'Phone missing'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Brokerage</div>
                        <div className="mt-2 text-sm font-semibold text-white">{effectiveBrokerageName || 'Brokerage name missing'}</div>
                        <div className="mt-1 text-xs text-slate-400">{effectiveBrokerageLogoUrl ? 'Logo ready' : 'Logo optional, name required'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Brand colors</div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: primaryColor }} />
                          <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: secondaryColor }} />
                          <span className="text-xs font-semibold text-slate-200">{brandColorSynced ? 'Synced' : 'Page custom'}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {accountDefaults?.brandPrimaryColor ? 'Account brand available' : 'Set brand colors in settings'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-slate-300">Agent Photo URL</label>
                        <button
                          type="button"
                          onClick={() => agentPhotoUploadRef.current?.click()}
                          disabled={Boolean(uploadingAssets['agent-photo'])}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadingAssets['agent-photo'] ? 'Uploading...' : 'Upload image'}
                        </button>
                      </div>
                      <input
                        type="url"
                        value={agentPhotoUrl}
                        onChange={(e) => setAgentPhotoUrl(e.target.value)}
                        placeholder={
                          accountDefaults?.agentPhotoUrl && !accountDefaults.agentPhotoUrl.startsWith('data:')
                            ? accountDefaults.agentPhotoUrl
                            : 'Uses your profile photo by default'
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Agent Name</label>
                      <input
                        type="text"
                        value={agentDisplayName}
                        onChange={(e) => setAgentDisplayName(e.target.value)}
                        placeholder={accountDefaults?.agentDisplayName || 'Uses your profile name by default'}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Agent Title</label>
                      <input
                        type="text"
                        value={agentTitle}
                        onChange={(e) => setAgentTitle(e.target.value)}
                        placeholder="Listing Specialist, Broker Associate, Team Lead..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Agent Email</label>
                      <input
                        type="email"
                        value={agentEmail}
                        onChange={(e) => setAgentEmail(e.target.value)}
                        placeholder={accountDefaults?.agentEmail || 'Uses your account email by default'}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Agent Phone</label>
                      <input
                        type="text"
                        value={agentPhone}
                        onChange={(e) => setAgentPhone(e.target.value)}
                        placeholder={accountDefaults?.agentPhone || 'Uses your profile phone by default'}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Brokerage Name</label>
                      <input
                        type="text"
                        value={brokerageDisplayName}
                        onChange={(e) => setBrokerageDisplayName(e.target.value)}
                        placeholder={accountDefaults?.brokerageDisplayName || 'Uses your brokerage settings by default'}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-slate-300">Brokerage Logo URL</label>
                        <button
                          type="button"
                          onClick={() => brokerageLogoUploadRef.current?.click()}
                          disabled={Boolean(uploadingAssets['brokerage-logo'])}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadingAssets['brokerage-logo'] ? 'Uploading...' : 'Upload image'}
                        </button>
                      </div>
                      <input
                        type="url"
                        value={brokerageLogoUrl}
                        onChange={(e) => setBrokerageLogoUrl(e.target.value)}
                        placeholder={
                          accountDefaults?.brokerageLogoUrl && !accountDefaults.brokerageLogoUrl.startsWith('data:')
                            ? accountDefaults.brokerageLogoUrl
                            : 'Uses your brokerage logo by default'
                        }
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Brokerage Phone</label>
                      <input
                        type="text"
                        value={brokeragePhone}
                        onChange={(e) => setBrokeragePhone(e.target.value)}
                        placeholder={accountDefaults?.brokeragePhone || 'Uses your brokerage phone by default'}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Brokerage Address</label>
                    <textarea
                      value={brokerageAddress}
                      onChange={(e) => setBrokerageAddress(e.target.value)}
                      placeholder={accountDefaults?.brokerageAddress || 'Uses your brokerage address by default'}
                      rows={2}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="url"
                      value={agentWebsiteUrl}
                      onChange={(e) => setAgentWebsiteUrl(e.target.value)}
                      placeholder={accountDefaults?.agentWebsiteUrl || 'Website URL'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                    <input
                      type="url"
                      value={agentFacebookUrl}
                      onChange={(e) => setAgentFacebookUrl(e.target.value)}
                      placeholder={accountDefaults?.agentFacebookUrl || 'Facebook URL'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                    <input
                      type="url"
                      value={agentInstagramUrl}
                      onChange={(e) => setAgentInstagramUrl(e.target.value)}
                      placeholder={accountDefaults?.agentInstagramUrl || 'Instagram URL'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                    <input
                      type="url"
                      value={agentLinkedinUrl}
                      onChange={(e) => setAgentLinkedinUrl(e.target.value)}
                      placeholder={accountDefaults?.agentLinkedinUrl || 'LinkedIn URL'}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Agent photo preview</div>
                      <div className="mt-3 flex items-center gap-3">
                        {(agentPhotoUrl || accountDefaults?.agentPhotoUrl) ? (
                          <img src={agentPhotoUrl || accountDefaults?.agentPhotoUrl} alt="Agent preview" className="h-14 w-14 rounded-2xl object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                            {(agentDisplayName || accountDefaults?.agentDisplayName || 'AG').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-semibold text-white">{agentDisplayName || accountDefaults?.agentDisplayName || 'Agent name'}</div>
                          <div className="text-xs text-slate-400">{agentTitle || 'Profile + landing page override'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Brokerage logo preview</div>
                      <div className="mt-3 flex items-center gap-3">
                        {(brokerageLogoUrl || accountDefaults?.brokerageLogoUrl) ? (
                          <img
                            src={brokerageLogoUrl || accountDefaults?.brokerageLogoUrl}
                            alt="Brokerage preview"
                            className={accountDefaults?.brokerageLogoBackground === 'TRANSPARENT'
                              ? 'h-14 rounded-2xl object-contain'
                              : 'h-14 rounded-2xl border border-white/10 bg-white/90 p-2 object-contain'}
                            style={{ width: Math.min(accountDefaults?.brokerageLogoWidth || 260, 220), maxWidth: '100%' }}
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                            {(brokerageDisplayName || accountDefaults?.brokerageDisplayName || 'BR').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-semibold text-white">{brokerageDisplayName || accountDefaults?.brokerageDisplayName || 'Brokerage name'}</div>
                          <div className="text-xs text-slate-400">{brokeragePhone || accountDefaults?.brokeragePhone || 'Brokerage phone'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={UserRound} tone="purple" />
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
                        src={editorPreviewHeroImage || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'}
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
                          {headline || page.listing?.addressLine1 || headlineIdeas[0]}
                        </h2>
                        <p 
                          className="text-xs mt-1 opacity-80"
                          style={{ color: selectedTheme?.colors.text || '#f1f5f9' }}
                        >
                          {subheadline || subheadlineIdeas[0]}
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

                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
                        {(agentPhotoUrl || accountDefaults?.agentPhotoUrl) ? (
                          <img src={agentPhotoUrl || accountDefaults?.agentPhotoUrl} alt="Agent preview" className="h-8 w-8 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[10px] font-semibold text-white">
                            {(agentDisplayName || accountDefaults?.agentDisplayName || 'AG').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-[10px] font-semibold text-white">{agentDisplayName || accountDefaults?.agentDisplayName || 'Agent name'}</div>
                          <div className="truncate text-[9px] text-slate-300">{agentTitle || brokerageDisplayName || accountDefaults?.brokerageDisplayName || 'Brokerage name'}</div>
                        </div>
                      </div>
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
                    <EditorIconBadge icon={Palette} tone="blue" />
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
                    <EditorIconBadge icon={Lightbulb} tone="amber" />
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
                    <EditorIconBadge icon={Ruler} tone="cyan" />
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
                    <EditorIconBadge icon={Sparkles} tone="pink" />
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
              <p className="text-slate-400 text-sm">Choose which sections fit this {pageIntent.label.toLowerCase()}.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Section toggles */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'hero', name: 'Hero Banner', icon: ImageIcon, description: pageIntent.kind === 'listing' ? 'Property-first header with agent presenter card' : 'Campaign header with agent presenter card' },
                    { id: 'gallery', name: 'Photo Gallery', icon: Camera, description: pageIntent.kind === 'listing' ? 'Showcase all property photos' : 'Showcase page or brand images' },
                    { id: 'features', name: pageIntent.kind === 'listing' ? 'Property Features' : 'Page Highlights', icon: Sparkles, description: pageIntent.kind === 'listing' ? 'Highlight key amenities' : 'Highlight the offer and agent value' },
                    { id: 'video', name: pageIntent.kind === 'listing' ? 'Property Video' : 'Campaign Video', icon: Video, description: pageIntent.kind === 'listing' ? 'Embed walkthrough video' : 'Embed agent, offer, or market video' },
                    { id: 'virtualTour', name: pageIntent.kind === 'listing' ? 'Virtual Tour' : 'Featured Tour Link', icon: Home, description: pageIntent.kind === 'listing' ? '3D tour or Matterport embed' : 'Add a featured tour or resource link' },
                    { id: 'floorPlan', name: pageIntent.kind === 'listing' ? 'Floor Plan' : 'Resource PDF', icon: Ruler, description: pageIntent.kind === 'listing' ? 'Interactive floor plan view' : 'Attach a guide, checklist, or campaign PDF' },
                    { id: 'neighborhood', name: 'Neighborhood', icon: MapPinned, description: pageIntent.kind === 'listing' ? 'Area description and highlights' : 'Service area description and highlights' },
                    { id: 'amenities', name: 'Nearby Amenities', icon: MapPinned, description: 'Schools, restaurants, parks' },
                    { id: 'testimonials', name: 'Testimonials', icon: Star, description: 'Client reviews and ratings' },
                    { id: 'agent', name: 'Agent Profile', icon: UserRound, description: 'Your bio and contact info' },
                    { id: 'contact', name: 'Contact Form', icon: Mail, description: 'Lead capture form' },
                    { id: 'openHouse', name: 'Open House', icon: CalendarDays, description: 'Scheduled showing times' },
                    { id: 'mortgage', name: 'Mortgage Calculator', icon: Calculator, description: 'Interactive payment estimator' },
                    { id: 'homeValuation', name: 'Home Value Tool', icon: DollarSign, description: 'Capture seller leads with a free home value request' },
                    { id: 'stats', name: 'Agent Stats Bar', icon: BarChart3, description: 'Years experience, homes sold, avg days on market' },
                    { id: 'whyChoose', name: 'Why Work With Me', icon: Trophy, description: 'Bullet list selling points' },
                    { id: 'otherListings', name: 'More Listings', icon: Home, description: 'Carousel of your other active landing pages' },
                  ].map((section) => {
                    const SectionIcon = section.icon;
                    return (
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
                        <SectionIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-cyan-200" />
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
                    );
                  })}
                </div>
              </div>

              {/* Section-specific settings */}
              <div className="space-y-4">
                {sections.video && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Video className="h-4 w-4 text-cyan-300" /> Video Settings
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
                      <Home className="h-4 w-4 text-cyan-300" /> Virtual Tour Settings
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
                      <Ruler className="h-4 w-4 text-cyan-300" /> Floor Plan
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
                      <MapPinned className="h-4 w-4 text-cyan-300" /> Neighborhood Info
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
                      <MapPinned className="h-4 w-4 text-cyan-300" /> Nearby Amenities
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
                          <option value="school">School</option>
                          <option value="restaurant">Restaurant</option>
                          <option value="shopping">Shopping</option>
                          <option value="park">Park</option>
                          <option value="gym">Gym</option>
                          <option value="hospital">Hospital</option>
                          <option value="transit">Transit</option>
                          <option value="other">Other</option>
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
                      <CalendarDays className="h-4 w-4 text-cyan-300" /> Open House Schedule
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
                      <Star className="h-4 w-4 text-amber-300" /> Client Testimonials
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
                              className={`${star <= (newTestimonial.rating || 5) ? 'text-yellow-400' : 'text-slate-600'}`}
                            >
                              <Star className="h-4 w-4" fill="currentColor" />
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
                <div
                  data-editor-section="seo-preview"
                  className={`scroll-mt-56 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5 transition-all duration-300 ${sectionSpotlightClass('seo-preview')}`}
                >
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={Search} tone="blue" />
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
                      placeholder={seoTitleFallback}
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
                      placeholder={seoDescriptionFallback}
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
                        {metaTitle || seoTitleFallback}
                      </p>
                      <p className="text-emerald-400 text-xs">
                        {window.location.origin}/sites/{page.slug}
                      </p>
                      <p className="text-slate-400 text-xs line-clamp-2">
                        {metaDescription || seoDescriptionFallback}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Social Sharing */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={Smartphone} tone="pink" />
                    Social Sharing Preview
                  </h3>
                  
                  <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-slate-700">
                      <img 
                        src={editorPreviewHeroImage || ''} 
                        alt="Social preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-white text-sm font-medium truncate">
                      {metaTitle || seoTitleFallback}
                    </p>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                      {metaDescription || seoDescriptionFallback}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">{window.location.host}</p>
                  </div>
                </div>
              </div>

              {/* Lead Capture Settings */}
              <div className="space-y-6">
                <div
                  data-editor-section="lead-capture"
                  className={`scroll-mt-56 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5 transition-all duration-300 ${sectionSpotlightClass('lead-capture')}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <EditorIconBadge icon={Mail} tone="emerald" />
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
                          placeholder={leadFormTitleFallback}
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
                            { id: 'name', label: 'Full Name', icon: UserRound },
                            { id: 'email', label: 'Email Address', icon: Mail },
                            { id: 'phone', label: 'Phone Number', icon: Phone },
                            { id: 'message', label: 'Message', icon: MessageSquare },
                            { id: 'prequalified', label: 'Pre-qualified?', icon: Check },
                          ].map((field) => {
                            const FieldIcon = field.icon;
                            return (
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
                              <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                                <FieldIcon className="h-4 w-4 text-cyan-300" /> {field.label}
                              </span>
                            </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Submit Button Text</label>
                        <input
                          type="text"
                          value={leadButtonText}
                          onChange={(e) => setLeadButtonText(e.target.value)}
                          placeholder={leadButtonFallback}
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

                {/* Force Lead Capture (Gate) */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-500/10 to-amber-500/10 border border-rose-500/20 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <EditorIconBadge icon={LockKeyhole} tone="rose" />
                        Force Lead Capture Gate
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {pageIntent.kind === 'listing'
                          ? 'Require visitors to submit their info before seeing the page. Great for high-value listings and paid ads.'
                          : 'Require visitors to submit their info before seeing the page. Useful for paid campaigns and high-intent offers.'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-none">
                      <input type="checkbox" checked={forceCaptureEnabled} onChange={(e) => setForceCaptureEnabled(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-checked:bg-rose-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-rose-500/40 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>

                  {forceCaptureEnabled && (
                    <div className="space-y-4 pt-2 border-t border-white/10">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Gate Headline</label>
                        <input
                          type="text"
                          value={forceCaptureHeadline}
                          onChange={(e) => setForceCaptureHeadline(e.target.value)}
                          placeholder="Get instant access"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Gate Subheadline</label>
                        <textarea
                          value={forceCaptureSubheadline}
                          onChange={(e) => setForceCaptureSubheadline(e.target.value)}
                          rows={2}
                          placeholder={forceGateSubheadlinePlaceholder}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Show gate after (seconds)</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={Math.round(forceCaptureDelay / 1000)}
                          onChange={(e) => setForceCaptureDelay(Math.max(0, Number(e.target.value)) * 1000)}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">0 = show immediately on page load</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Gate submit button text</label>
                        <input
                          type="text"
                          value={forceCaptureCtaText}
                          onChange={(e) => setForceCaptureCtaText(e.target.value)}
                          placeholder={forceGateCtaPlaceholder}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                          Require phone number
                          <input
                            type="checkbox"
                            checked={forceCaptureRequirePhone}
                            onChange={(e) => setForceCaptureRequirePhone(e.target.checked)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-rose-500"
                          />
                        </label>

                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Remember unlocked state</label>
                          <select
                            value={forceCapturePersistMode}
                            onChange={(e) => setForceCapturePersistMode(e.target.value === 'ALWAYS' ? 'ALWAYS' : 'SESSION')}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white"
                          >
                            <option value="SESSION">Yes, once per session</option>
                            <option value="ALWAYS">No, ask every visit</option>
                          </select>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
                          Best conversion setup: show immediately, require phone for ad traffic, and use "ask every visit" on high-intent campaigns.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Header QR destinations */}
                <div
                  data-editor-section="qr-tracking"
                  className={`scroll-mt-56 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5 transition-all duration-300 ${sectionSpotlightClass('qr-tracking')}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <EditorIconBadge icon={QrCode} tone="cyan" />
                        Header QR Options
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Let visitors scan this landing page or your personal profile card directly from the hero/header area.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-none">
                      <input type="checkbox" checked={showHeaderQr} onChange={(e) => handleShowHeaderQrChange(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-checked:bg-cyan-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500/40 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>

                  {showHeaderQr && (
                    <div className="space-y-4 pt-2 border-t border-white/10">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Landing page QR destination (optional override)</label>
                        <input
                          type="url"
                          value={qrListingUrl}
                          onChange={(e) => setQrListingUrl(e.target.value)}
                          placeholder={defaultListingUrl}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                        <p className="mt-1 text-xs text-slate-500">Leave blank to use the generated tracked page scan URL with lpqr and UTM tracking automatically. If a token exists, that unique URL is used first.</p>
                        <p className="mt-1 text-[11px] text-slate-500 break-all">Active page scan destination: {effectiveListingQrDestination || 'Not available yet'}</p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Unique page scan token</label>
                          {trimmedQrListingToken && (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={qrListingToken}
                            onChange={(e) => setQrListingToken(e.target.value.replace(/\s+/g, '').slice(0, 32))}
                            placeholder="lpabc123..."
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextToken = buildQrListingToken();
                              setQrListingToken(nextToken);
                              setQrListingUrl('');
                              showToast('success', 'Generated a new tracked page scan token.');
                            }}
                            className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
                          >
                            Generate New QR
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrListingToken('')}
                            disabled={!trimmedQrListingToken}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Clear
                          </button>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Generated tracked page scan URL</div>
                          <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs break-all text-slate-200">
                            {generatedListingQrUrl || `${defaultListingUrl}?lpqr=...`}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">Scans are counted as QR traffic in analytics and leads carry this token in their activity details. Manual override above always wins.</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Personal info QR destination</label>
                        <input
                          type="url"
                          value={qrPersonalUrl}
                          onChange={(e) => setQrPersonalUrl(e.target.value)}
                          placeholder={accountDefaults?.defaultAgentPageUrl || accountDefaults?.agentWebsiteUrl || 'https://your-site.com/about'}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                        <p className="mt-1 text-xs text-slate-500">Leave blank to use your default AgentEasePro profile page.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Personal QR label</label>
                        <input
                          type="text"
                          value={qrPersonalLabel}
                          onChange={(e) => setQrPersonalLabel(e.target.value)}
                          placeholder="Agent info"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Urgency & Social Proof */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <EditorIconBadge icon={Flame} tone="red" />
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
                      placeholder={socialProofPlaceholder}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500"
                    />
                  </div>

                  {/* Quick urgency presets */}
                  <div className="flex flex-wrap gap-2">
                    {urgencyPresets.map((preset) => (
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
                        {formTitle || leadFormTitleFallback}
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
                          {leadButtonText || leadButtonFallback}
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
          <div data-editor-section="full-preview" className={`scroll-mt-56 space-y-6 rounded-2xl transition-all duration-300 ${sectionSpotlightClass('full-preview')}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Full Preview</h2>
                <p className="text-slate-400 text-sm">See how your landing page will look to visitors.</p>
                <p className="mt-1 text-xs text-amber-300/80">Preview reflects the saved live page. Save and refresh after edits.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleSave();
                    setPreviewNonce((current) => current + 1);
                  }}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save + Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewNonce((current) => current + 1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                >
                  Refresh
                </button>
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${previewDevice === 'desktop' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'}`}
                  title="Desktop (1280px)"
                >
                  <Monitor className="h-4 w-4" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${previewDevice === 'tablet' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'}`}
                  title="Tablet (768px)"
                >
                  <Tablet className="h-4 w-4" />
                  Tablet
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${previewDevice === 'mobile' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'}`}
                  title="Mobile (390px)"
                >
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Ownership</div>
                <div className="mt-3 text-sm text-slate-300">
                  This landing page is scoped to the creating agent account and tracks performance independently from every other landing page.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Live stats</div>
                <div className="mt-3 text-sm text-slate-300">
                  {analytics
                    ? `${analytics.summary.pageViews} views, ${analytics.summary.uniqueVisitors} unique visitors, ${analytics.summary.leads} leads in the last 30 days.`
                    : 'Analytics will populate here after the first tracked visits.'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Profile powered</div>
                <div className="mt-3 text-sm text-slate-300">
                  Agent photo, contact details, brokerage information, and brand colors feed the live page from your profile settings.
                </div>
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
              
              <div className="flex justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4 sm:p-8">
                <div
                  className={`transition-all duration-300 ${previewDevice !== 'desktop' ? 'rounded-[28px] border border-white/10 shadow-2xl overflow-hidden' : 'w-full'}`}
                  style={{
                    width: previewDevice === 'mobile' ? '390px' : previewDevice === 'tablet' ? '768px' : '100%',
                    maxWidth: '100%',
                  }}
                >
                  <iframe
                    src={`/sites/${page.slug}?preview=${previewNonce}`}
                    className="w-full bg-white"
                    style={{ height: previewDevice === 'mobile' ? '780px' : '700px' }}
                    title="Landing Page Preview"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share & QR Code Modal */}
      {showShareModal && (() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const baseUrl = `${origin}/sites/${page.slug}`;
        const listingUrl = (trimmedQrListingToken ? buildTrackedLandingQrUrl(baseUrl, page.slug, trimmedQrListingToken) : '') || qrListingUrl.trim() || baseUrl;
        const gatedUrl = `${listingUrl}${listingUrl.includes('?') ? '&' : '?'}gate=1`;
        const captureUrl = `${origin}/api/integrations/lead-capture?landingPageId=${page.id}&label=${encodeURIComponent(page.title)}`;
        const personalUrl = qrPersonalUrl.trim() || accountDefaults?.defaultAgentPageUrl || accountDefaults?.agentWebsiteUrl || `mailto:${agentEmail || accountDefaults?.agentEmail || ''}`;
        const pageScanName = (headline.trim() || page.title || 'Landing page').replace(/^free\s+/i, '').trim() || 'Landing page';
        const variants = [
          {
            id: 'page',
            label: trimmedQrListingToken ? 'Tracked page scan' : 'Landing page scan',
            description: trimmedQrListingToken
              ? `${pageScanName}: unique QR URL with scan tracking for this page`
              : `${pageScanName}: scan to open the full page`,
            url: listingUrl,
            accent: 'cyan',
          },
          { id: 'gated', label: 'Gated preview', description: 'Forces lead capture before reveal (when enabled)', url: gatedUrl, accent: 'rose' },
          { id: 'capture', label: 'Direct capture', description: 'Tags lead to this landing page', url: captureUrl, accent: 'emerald' },
          { id: 'personal', label: qrPersonalLabel.trim() || 'Personal info', description: 'Scan to open your personal profile link', url: personalUrl, accent: 'cyan' },
        ] as const;
        const active = variants.find((v) => v.id === shareQrVariant) || variants[0];
        const shareCaption = [
          headline.trim() || page.title,
          subheadline.trim() || page.description || 'Private details, showing options, and direct agent follow-up are ready here:',
          active.url,
        ].filter(Boolean).join('\n');
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowShareModal(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 to-[#101525] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Share & QR codes</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Pick a link variant, then scan, copy, or send it anywhere.</p>

            {/* Variant selector */}
            <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-950/60 border border-white/10 p-1 sm:grid-cols-4">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setShareQrVariant(v.id)}
                  className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${shareQrVariant === v.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  title={v.description}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{active.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextToken = buildQrListingToken();
                  setQrListingToken(nextToken);
                  setQrListingUrl('');
                  setShareQrVariant('page');
                  showToast('success', 'Generated a new tracked page scan QR. Save changes to persist it.');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/25"
              >
                <QrCode className="h-3.5 w-3.5" />
                Generate New Page QR
              </button>
              {trimmedQrListingToken && (
                <span className="inline-flex items-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200">
                  Token: {trimmedQrListingToken}
                </span>
              )}
            </div>

            <div className="mt-4 flex justify-center rounded-2xl border border-white/10 bg-white p-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(active.url)}`}
                alt={`QR code for ${active.label}`}
                className="h-60 w-60"
              />
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{active.label} link</div>
              <div className="mt-1 break-all text-xs text-slate-200">{active.url}</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(active.url);
                  showToast('success', 'Share link copied.');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent(page.title)}&body=${encodeURIComponent(active.url)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
              <a
                href={`sms:?&body=${encodeURIComponent(`${page.title} — ${active.url}`)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Text
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(shareCaption);
                  showToast('success', 'Ad caption copied.');
                }}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#f2d894]/25 bg-[#d6b56d]/15 px-4 py-2.5 text-xs font-semibold text-[#f7e7b0] hover:bg-[#d6b56d]/25 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Copy Ad Caption
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
                Tip: Use <span className="text-rose-300 font-semibold">Gated preview</span> on yard signs & paid ads — every scan becomes a qualified lead.
              </span>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
