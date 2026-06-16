/**
 * PdfAnnotator - Interactive PDF annotation tool for e-signatures
 * Features:
 * - View PDF pages with zoom/pan
 * - Add text, signatures, initials, dates, addresses
 * - Drag & drop positioning of fields
 * - Assign fields to specific signers
 * - Auto-populate deal, property, client data
 * - Smart field insertion with pre-filled values
 * - Export annotated PDF
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, BadgeDollarSign, CalendarDays, Check, CheckSquare, FileText, Hash, Home, Mail, PenLine, RectangleHorizontal, Ruler, Sparkles, Type, UserRound, X, Square } from 'lucide-react';
import { installPdfJsCompat } from '../../lib/pdfJsCompat';
import { clonePdfBytes, PDF_DOCUMENT_LOAD_OPTIONS, renderPdfPageToImage } from '../../lib/pdfRendering';

installPdfJsCompat();
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Annotation types
export type AnnotationType = 'text' | 'signature' | 'initials' | 'date' | 'address' | 'checkbox' | 'name' | 'email' | 'price' | 'mls';

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  value: string;
  placeholder: string;
  assignedTo?: string; // signer role
  fontSize?: number;
  required: boolean;
  autoPopulated?: boolean;
}

interface Signer {
  role: string;
  name: string;
  email: string;
}

// Extended deal info for auto-population
interface DealData {
  // Property info
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  mlsNumber?: string;
  taxId?: string;
  // Financial
  purchasePrice?: number;
  earnestMoney?: number;
  // Dates
  settlementDate?: string;
  dueDiligenceDeadline?: string;
  offerExpiration?: string;
  // Parties
  buyerName?: string;
  buyerEmail?: string;
  sellerName?: string;
  sellerEmail?: string;
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
  brokerageName?: string;
}

interface PdfAnnotatorProps {
  pdfUrl: string | null;
  pdfData?: ArrayBuffer | Uint8Array | null;
  expectedPageCount?: number;
  signers: Signer[];
  onSave?: (annotations: Annotation[]) => void;
  onCancel?: () => void;
  onSend?: (annotations: Annotation[]) => void;
  dealData?: DealData;
  requiredFields?: Array<{ id: string; label: string }>;
  // Legacy support
  dealInfo?: {
    address: string;
    price: number;
    settlementDate?: string;
  };
  sending?: boolean;
}

// Tool definitions - Basic fields
const BASIC_TOOLS: { type: AnnotationType; label: string; icon: LucideIcon; placeholder: string; defaultWidth: number; defaultHeight: number }[] = [
  { type: 'signature', label: 'Signature', icon: PenLine, placeholder: 'Sign here', defaultWidth: 200, defaultHeight: 50 },
  { type: 'initials', label: 'Initials', icon: Type, placeholder: 'Initials', defaultWidth: 80, defaultHeight: 40 },
  { type: 'date', label: 'Date', icon: CalendarDays, placeholder: 'MM/DD/YYYY', defaultWidth: 120, defaultHeight: 30 },
  { type: 'text', label: 'Text', icon: FileText, placeholder: 'Enter text...', defaultWidth: 150, defaultHeight: 30 },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, placeholder: '', defaultWidth: 24, defaultHeight: 24 },
];

// Smart auto-populate fields
const SMART_FIELDS: { type: AnnotationType; label: string; icon: LucideIcon; placeholder: string; defaultWidth: number; defaultHeight: number; dataKey: keyof DealData }[] = [
  { type: 'address', label: 'Property Address', icon: Home, placeholder: 'Property address', defaultWidth: 280, defaultHeight: 30, dataKey: 'address' },
  { type: 'price', label: 'Purchase Price', icon: BadgeDollarSign, placeholder: '$0.00', defaultWidth: 120, defaultHeight: 30, dataKey: 'purchasePrice' },
  { type: 'mls', label: 'MLS #', icon: Hash, placeholder: 'MLS Number', defaultWidth: 100, defaultHeight: 30, dataKey: 'mlsNumber' },
  { type: 'name', label: 'Buyer Name', icon: UserRound, placeholder: 'Buyer name', defaultWidth: 180, defaultHeight: 30, dataKey: 'buyerName' },
  { type: 'name', label: 'Seller Name', icon: UserRound, placeholder: 'Seller name', defaultWidth: 180, defaultHeight: 30, dataKey: 'sellerName' },
  { type: 'email', label: 'Buyer Email', icon: Mail, placeholder: 'buyer@email.com', defaultWidth: 200, defaultHeight: 30, dataKey: 'buyerEmail' },
  { type: 'email', label: 'Seller Email', icon: Mail, placeholder: 'seller@email.com', defaultWidth: 200, defaultHeight: 30, dataKey: 'sellerEmail' },
];

// All tools combined
const TOOLS = BASIC_TOOLS;

// Color mapping for signers
const SIGNER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BUYER: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  SELLER: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
  AGENT: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
  OTHER: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
};

export function PdfAnnotator({ pdfUrl, pdfData, expectedPageCount, signers, onSave, onCancel, onSend, dealData, dealInfo, sending, requiredFields }: PdfAnnotatorProps) {
  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const GRID_SIZE = 8;
  const ALIGN_THRESHOLD = 6;
  const MIN_FIELD_WIDTH = 60;
  const MIN_FIELD_HEIGHT = 24;
  const MIN_CHECKBOX_SIZE = 20;
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedTool, setSelectedTool] = useState<AnnotationType | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [assignTo, setAssignTo] = useState<string>(signers[0]?.role || 'BUYER');
  const [activeInteraction, setActiveInteraction] = useState<
    | {
      mode: 'drag' | 'resize';
      annotationId: string;
      dragOffsetX?: number;
      dragOffsetY?: number;
      startMouseX: number;
      startMouseY: number;
      startWidth?: number;
      startHeight?: number;
    }
    | null
  >(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [showFieldPanel, setShowFieldPanel] = useState(true);
  const [showSmartFields, setShowSmartFields] = useState(false);
  const [showRequiredPanel, setShowRequiredPanel] = useState(false);
  const [smartFieldOverrides, setSmartFieldOverrides] = useState<Partial<Record<keyof DealData, string>>>({});
  const [smartPlacementNotice, setSmartPlacementNotice] = useState('');
  const [alignmentGuide, setAlignmentGuide] = useState<{ page: number | null; x: number | null; y: number | null }>({ page: null, x: null, y: null });
  const smartPlacementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoFitRef = useRef(false);
  const clampZoom = (value: number) => Math.max(0.5, Math.min(1.5, value));
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'Not set';
    return `$${amount.toLocaleString()}`;
  };
  
  // Merge dealData with legacy dealInfo
  const mergedDealData: DealData = {
    ...dealData,
    address: dealData?.address || dealInfo?.address,
    mlsNumber: dealData?.mlsNumber || (dealData as any)?.mlsId,
    purchasePrice: dealData?.purchasePrice || dealInfo?.price,
    settlementDate: dealData?.settlementDate || dealInfo?.settlementDate,
    buyerName: dealData?.buyerName || signers.find(s => s.role === 'BUYER')?.name,
    buyerEmail: dealData?.buyerEmail || signers.find(s => s.role === 'BUYER')?.email,
    sellerName: dealData?.sellerName || signers.find(s => s.role === 'SELLER')?.name,
    sellerEmail: dealData?.sellerEmail || signers.find(s => s.role === 'SELLER')?.email,
  };

  const getSmartFieldValue = (key: keyof DealData): string => {
    if (key === 'address') {
      const street = mergedDealData.address;
      const city = mergedDealData.city;
      const state = mergedDealData.state;
      const zip = mergedDealData.zip;
      if (street && city && state) {
        const lowerStreet = street.toLowerCase();
        if (lowerStreet.includes(city.toLowerCase()) && lowerStreet.includes(state.toLowerCase())) {
          return street;
        }
        return [street, city, state, zip].filter(Boolean).join(', ');
      }
      return street || '';
    }
    if (key === 'purchasePrice') {
      return typeof mergedDealData.purchasePrice === 'number'
        ? formatCurrency(mergedDealData.purchasePrice)
        : '';
    }
    if (key === 'settlementDate') {
      return mergedDealData.settlementDate
        ? new Date(mergedDealData.settlementDate).toLocaleDateString()
        : '';
    }
    const value = mergedDealData[key];
    return value === undefined || value === null ? '' : String(value);
  };

  const getDraftSmartFieldValue = (key: keyof DealData): string => {
    const override = smartFieldOverrides[key];
    if (typeof override === 'string') return override;
    return getSmartFieldValue(key);
  };

  const setSmartFieldOverride = (key: keyof DealData, value: string) => {
    setSmartFieldOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const showSmartPlacementNotice = (message: string) => {
    setSmartPlacementNotice(message);
    if (smartPlacementTimerRef.current) {
      clearTimeout(smartPlacementTimerRef.current);
    }
    smartPlacementTimerRef.current = setTimeout(() => {
      setSmartPlacementNotice('');
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (smartPlacementTimerRef.current) {
        clearTimeout(smartPlacementTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeInteraction) {
      setAlignmentGuide({ page: null, x: null, y: null });
    }
  }, [activeInteraction]);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfPageImages, setPdfPageImages] = useState<Record<number, string>>({});
  const [pdfRenderErrors, setPdfRenderErrors] = useState<Record<number, string>>({});
  const [pdfRenderingPages, setPdfRenderingPages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDocument: pdfjsLib.PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      setPdfLoaded(false);
      setPdfDoc(null);
      setPdfPageImages({});
      setPdfRenderErrors({});
      setPdfRenderingPages({});
      setTotalPages(1);
      setCurrentPage(1);
      pageRefs.current = {};
      didAutoFitRef.current = false;

      const sourcePdfUrl = pdfUrl;
      if (!sourcePdfUrl && !pdfData) {
        return;
      }

      try {
        if (pdfData) {
          loadingTask = pdfjsLib.getDocument({ data: clonePdfBytes(pdfData), ...PDF_DOCUMENT_LOAD_OPTIONS });
        } else if (sourcePdfUrl && /^(blob|data):/i.test(sourcePdfUrl)) {
          const pdfBytes = await fetch(sourcePdfUrl).then((response) => response.arrayBuffer());
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes), ...PDF_DOCUMENT_LOAD_OPTIONS });
        } else if (sourcePdfUrl) {
          const absolutePdfUrl = new URL(sourcePdfUrl, window.location.origin).toString();
          loadingTask = pdfjsLib.getDocument({ url: absolutePdfUrl, ...PDF_DOCUMENT_LOAD_OPTIONS });
        } else {
          return;
        }
        const loadedPdf = await loadingTask.promise;
        loadedDocument = loadedPdf;

        if (cancelled) {
          await loadedPdf.destroy();
          return;
        }

        setPdfDoc(loadedPdf);
        setTotalPages(Math.max(1, loadedPdf.numPages));
        setPdfLoaded(true);
      } catch (error) {
        console.error('Failed to load PDF for e-sign field placement:', error);
        if (!cancelled) {
          setPdfRenderErrors({
            1: 'The fast preview could not open this PDF. The original file is still preserved for e-sign delivery; use a freshly downloaded copy only if the browser preview is also blank.',
          });
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
      loadedDocument?.destroy();
    };
  }, [pdfUrl, pdfData]);

  useEffect(() => {
    let cancelled = false;

    const renderPages = async () => {
      if (!pdfDoc) {
        setPdfPageImages({});
        setPdfRenderingPages({});
        return;
      }

      const pageCount = Math.max(1, pdfDoc.numPages);
      setPdfPageImages({});
      setPdfRenderErrors({});
      setPdfRenderingPages(
        Array.from({ length: pageCount }, (_, index) => index + 1).reduce<Record<number, boolean>>((acc, pageNumber) => {
          acc[pageNumber] = true;
          return acc;
        }, {}),
      );

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        try {
          const page = await pdfDoc.getPage(pageNumber);
          const rendered = await renderPdfPageToImage(page, {
            maxWidth: PAGE_WIDTH,
            maxHeight: PAGE_HEIGHT,
            outputScale: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
            imageType: 'image/png',
            throwOnBlank: false,
          });

          if (cancelled) return;
          setPdfPageImages((prev) => ({ ...prev, [pageNumber]: rendered.imageSrc }));
        } catch (error) {
          console.error(`Failed to render PDF page ${pageNumber} for e-sign field placement:`, error);
          if (cancelled) return;
          const errorMessage = error instanceof Error ? error.message : '';
          setPdfRenderErrors((prev) => ({
            ...prev,
            [pageNumber]: /blank/i.test(errorMessage)
              ? 'The fast preview rendered this page blank, so the studio kept the original PDF bytes and switched to the browser fallback where available.'
              : 'This page could not be displayed in the fast preview. The studio will use the browser PDF fallback when available.',
          }));
        } finally {
          if (!cancelled) {
            setPdfRenderingPages((prev) => ({ ...prev, [pageNumber]: false }));
          }
        }
      }
    };

    renderPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, PAGE_WIDTH, PAGE_HEIGHT]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const generateId = () => `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const clampPosition = (x: number, y: number, width: number, height: number) => ({
    x: Math.max(0, Math.min(PAGE_WIDTH - width, x)),
    y: Math.max(0, Math.min(PAGE_HEIGHT - height, y)),
  });

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const snapAxisToCandidates = (
    start: number,
    size: number,
    candidates: number[],
  ): { start: number; guide: number | null } => {
    const offsets = [0, size / 2, size];
    let bestStart = start;
    let bestGuide: number | null = null;
    let bestDistance = Infinity;

    offsets.forEach((offset) => {
      candidates.forEach((candidate) => {
        const candidateStart = candidate - offset;
        const distance = Math.abs(start - candidateStart);
        if (distance <= ALIGN_THRESHOLD && distance < bestDistance) {
          bestDistance = distance;
          bestStart = candidateStart;
          bestGuide = candidate;
        }
      });
    });

    return { start: bestStart, guide: bestGuide };
  };

  const snapValueToCandidates = (
    value: number,
    candidates: number[],
  ): { value: number; guide: number | null } => {
    let bestValue = value;
    let bestGuide: number | null = null;
    let bestDistance = Infinity;

    candidates.forEach((candidate) => {
      const distance = Math.abs(value - candidate);
      if (distance <= ALIGN_THRESHOLD && distance < bestDistance) {
        bestDistance = distance;
        bestValue = candidate;
        bestGuide = candidate;
      }
    });

    return { value: bestValue, guide: bestGuide };
  };

  const isPointInsidePage = (clientX: number, clientY: number, pageRect: DOMRect) => (
    clientX >= pageRect.left &&
    clientX <= pageRect.right &&
    clientY >= pageRect.top &&
    clientY <= pageRect.bottom
  );

  const getViewportContextForPage = useCallback((pageNumber = currentPage) => {
    const containerEl = containerRef.current;
    const pageEl = pageRefs.current[pageNumber];
    if (!containerEl || !pageEl) return null;

    return {
      containerEl,
      containerRect: containerEl.getBoundingClientRect(),
      page: pageNumber,
      pageEl,
      pageRect: pageEl.getBoundingClientRect(),
    };
  }, [currentPage]);

  const getViewportContextForPoint = useCallback((clientX: number, clientY: number, preferredPage = currentPage) => {
    const preferredContext = getViewportContextForPage(preferredPage);
    if (preferredContext && isPointInsidePage(clientX, clientY, preferredContext.pageRect)) {
      return preferredContext;
    }

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber === preferredPage) continue;
      const context = getViewportContextForPage(pageNumber);
      if (context && isPointInsidePage(clientX, clientY, context.pageRect)) {
        return context;
      }
    }

    return null;
  }, [currentPage, totalPages, getViewportContextForPage]);

  const autoScrollViewer = (containerEl: HTMLDivElement, containerRect: DOMRect, clientX: number, clientY: number) => {
    const edgeBuffer = 72;
    const scrollStep = 28;

    if (clientX <= containerRect.left + edgeBuffer) {
      containerEl.scrollLeft -= scrollStep;
    } else if (clientX >= containerRect.right - edgeBuffer) {
      containerEl.scrollLeft += scrollStep;
    }

    if (clientY <= containerRect.top + edgeBuffer) {
      containerEl.scrollTop -= scrollStep;
    } else if (clientY >= containerRect.bottom - edgeBuffer) {
      containerEl.scrollTop += scrollStep;
    }
  };

  const endInteraction = useCallback(() => {
    setActiveInteraction(null);
    setAlignmentGuide({ page: null, x: null, y: null });
  }, []);

  const buildAnnotation = (type: AnnotationType, x: number, y: number, page = currentPage): Annotation | null => {
    const tool = TOOLS.find((t) => t.type === type);
    if (!tool) return null;
    const position = clampPosition(x, y, tool.defaultWidth, tool.defaultHeight);

    return {
      id: generateId(),
      type,
      x: position.x,
      y: position.y,
      width: tool.defaultWidth,
      height: tool.defaultHeight,
      page,
      value: type === 'date' ? new Date().toLocaleDateString() : '',
      placeholder: tool.placeholder,
      assignedTo: assignTo,
      fontSize: type === 'signature' ? 24 : 14,
      required: true,
    };
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedTool || !!activeInteraction) return;

    const context = getViewportContextForPoint(e.clientX, e.clientY);
    if (!context) return;

    const x = (e.clientX - context.pageRect.left) / zoom;
    const y = (e.clientY - context.pageRect.top) / zoom;

    const newAnnotation = buildAnnotation(selectedTool, x, y, context.page);
    if (!newAnnotation) return;

    setAnnotations(prev => [...prev, newAnnotation]);
    setSelectedAnnotation(newAnnotation.id);
    setCurrentPage(context.page);
    setSelectedTool(null);
  }, [selectedTool, zoom, activeInteraction, getViewportContextForPoint]);

  const handleFieldDragStart = (e: React.DragEvent<HTMLButtonElement>, type: AnnotationType) => {
    e.dataTransfer.setData('application/x-ae-field', type);
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedType = (e.dataTransfer.getData('application/x-ae-field') || e.dataTransfer.getData('text/plain')) as AnnotationType;
    if (!droppedType) return;

    const context = getViewportContextForPoint(e.clientX, e.clientY);
    if (!context) return;

    const x = (e.clientX - context.pageRect.left) / zoom;
    const y = (e.clientY - context.pageRect.top) / zoom;
    const newAnnotation = buildAnnotation(droppedType, x, y, context.page);
    if (!newAnnotation) return;
    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotation(newAnnotation.id);
    setCurrentPage(context.page);
  }, [zoom, getViewportContextForPoint]);

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleAnnotationMouseDown = (e: React.MouseEvent, annId: string) => {
    e.stopPropagation();
    setSelectedAnnotation(annId);

    const ann = annotations.find(a => a.id === annId);
    if (ann) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setCurrentPage(ann.page);
      setActiveInteraction({
        mode: 'drag',
        annotationId: annId,
        dragOffsetX: e.clientX - rect.left,
        dragOffsetY: e.clientY - rect.top,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
      });
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, annId: string) => {
    e.stopPropagation();
    setSelectedAnnotation(annId);

    const ann = annotations.find((a) => a.id === annId);
    if (!ann) return;
    setCurrentPage(ann.page);

    setActiveInteraction({
      mode: 'resize',
      annotationId: annId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: ann.width,
      startHeight: ann.height,
    });
  };

  const updateActiveInteraction = useCallback((clientX: number, clientY: number) => {
    if (!activeInteraction) return;

    const target = annotations.find((ann) => ann.id === activeInteraction.annotationId);
    if (!target) return;

    const context = getViewportContextForPage(target.page);
    if (!context) return;

    autoScrollViewer(context.containerEl, context.containerRect, clientX, clientY);

    const livePageRect = context.pageEl.getBoundingClientRect();
    if (!livePageRect) return;

    const peerAnnotations = annotations.filter(
      (ann) => ann.page === target.page && ann.id !== activeInteraction.annotationId,
    );
    const candidateX = [PAGE_WIDTH / 2, ...peerAnnotations.flatMap((ann) => [ann.x, ann.x + ann.width / 2, ann.x + ann.width])];
    const candidateY = [PAGE_HEIGHT / 2, ...peerAnnotations.flatMap((ann) => [ann.y, ann.y + ann.height / 2, ann.y + ann.height])];

    if (activeInteraction.mode === 'drag') {
      const rawX = (clientX - livePageRect.left - (activeInteraction.dragOffsetX || 0)) / zoom;
      const rawY = (clientY - livePageRect.top - (activeInteraction.dragOffsetY || 0)) / zoom;
      const gridX = snapToGrid(rawX);
      const gridY = snapToGrid(rawY);
      const snappedX = snapAxisToCandidates(gridX, target.width, candidateX);
      const snappedY = snapAxisToCandidates(gridY, target.height, candidateY);
      const clamped = clampPosition(snappedX.start, snappedY.start, target.width, target.height);

      setAlignmentGuide({
        page: target.page,
        x: snappedX.guide,
        y: snappedY.guide,
      });

      setAnnotations(prev => prev.map(ann =>
        ann.id === activeInteraction.annotationId
          ? { ...ann, x: clamped.x, y: clamped.y }
          : ann,
      ));
      return;
    }

    const deltaX = (clientX - activeInteraction.startMouseX) / zoom;
    const deltaY = (clientY - activeInteraction.startMouseY) / zoom;
    const startWidth = activeInteraction.startWidth ?? target.width;
    const startHeight = activeInteraction.startHeight ?? target.height;
    const minWidth = target.type === 'checkbox' ? MIN_CHECKBOX_SIZE : MIN_FIELD_WIDTH;
    const minHeight = target.type === 'checkbox' ? MIN_CHECKBOX_SIZE : MIN_FIELD_HEIGHT;
    let width = Math.max(minWidth, snapToGrid(startWidth + deltaX));
    let height = Math.max(minHeight, snapToGrid(startHeight + deltaY));

    if (target.type === 'checkbox') {
      const size = Math.max(width, height);
      width = size;
      height = size;
    }

    const snappedRight = snapValueToCandidates(target.x + width, candidateX);
    const snappedBottom = snapValueToCandidates(target.y + height, candidateY);
    width = Math.max(minWidth, snappedRight.value - target.x);
    height = Math.max(minHeight, snappedBottom.value - target.y);

    if (target.type === 'checkbox') {
      const size = Math.max(width, height);
      width = size;
      height = size;
    }

    setAlignmentGuide({
      page: target.page,
      x: snappedRight.guide,
      y: snappedBottom.guide,
    });

    width = Math.min(width, PAGE_WIDTH - target.x);
    height = Math.min(height, PAGE_HEIGHT - target.y);

    setAnnotations(prev => prev.map(ann =>
      ann.id === activeInteraction.annotationId
        ? { ...ann, width, height }
        : ann,
    ));
  }, [activeInteraction, zoom, annotations, PAGE_WIDTH, PAGE_HEIGHT, MIN_CHECKBOX_SIZE, MIN_FIELD_HEIGHT, MIN_FIELD_WIDTH, getViewportContextForPage]);

  useEffect(() => {
    if (!activeInteraction) return;

    const handleWindowMouseMove = (event: MouseEvent) => {
      updateActiveInteraction(event.clientX, event.clientY);
    };

    const handleWindowMouseUp = () => {
      endInteraction();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeInteraction, updateActiveInteraction, endInteraction]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
      }

      if (event.key === 'Escape') {
        setSelectedTool(null);
        setSelectedAnnotation(null);
        endInteraction();
        return;
      }

      if (!selectedAnnotation) return;

      const step = GRID_SIZE * (event.shiftKey ? 4 : 1);
      const moveX = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const moveY = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      if (!moveX && !moveY) return;

      event.preventDefault();
      setAnnotations((prev) => prev.map((ann) => {
        if (ann.id !== selectedAnnotation) return ann;
        const position = clampPosition(ann.x + moveX, ann.y + moveY, ann.width, ann.height);
        return { ...ann, x: position.x, y: position.y };
      }));
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [selectedAnnotation, GRID_SIZE, endInteraction]);

  const fitDocumentWidth = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const sidePadding = containerEl.clientWidth < 640 ? 24 : 72;
    const availableWidth = Math.max(320, containerEl.clientWidth - sidePadding);
    setZoom(clampZoom(Math.min(1, availableWidth / PAGE_WIDTH)));
  }, [PAGE_WIDTH]);

  useEffect(() => {
    if (!pdfLoaded || didAutoFitRef.current) return;
    didAutoFitRef.current = true;
    fitDocumentWidth();
  }, [pdfLoaded, fitDocumentWidth]);

  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(ann => 
      ann.id === id ? { ...ann, ...updates } : ann
    ));
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    setSelectedAnnotation(null);
  };

  const duplicateAnnotation = (id: string) => {
    const source = annotations.find((ann) => ann.id === id);
    if (!source) return;
    const position = clampPosition(source.x + 16, source.y + 16, source.width, source.height);
    const clone: Annotation = {
      ...source,
      id: generateId(),
      x: position.x,
      y: position.y,
    };
    setAnnotations((prev) => [...prev, clone]);
    setSelectedAnnotation(clone.id);
  };

  const getSignerColor = (role?: string) => {
    return SIGNER_COLORS[role || 'OTHER'] || SIGNER_COLORS.OTHER;
  };

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );
  const annotationCountsByPage = useMemo(() => {
    const counts = new Map<number, number>();
    annotations.forEach((annotation) => {
      counts.set(annotation.page, (counts.get(annotation.page) || 0) + 1);
    });
    return counts;
  }, [annotations]);
  const pageCountMismatch = Boolean(
    expectedPageCount &&
    pdfLoaded &&
    totalPages !== expectedPageCount,
  );
  const getNativePreviewUrl = useCallback((pageNumber: number) => (
    pdfUrl
      ? `${pdfUrl}${pdfUrl.includes('#') ? '&' : '#'}page=${pageNumber}&toolbar=0&navpanes=0&view=FitH`
      : null
  ), [pdfUrl]);

  const scrollToPage = useCallback((pageNumber: number, behavior: ScrollBehavior = 'smooth') => {
    const boundedPage = Math.max(1, Math.min(totalPages, pageNumber));
    setCurrentPage(boundedPage);

    const containerEl = containerRef.current;
    const pageEl = pageRefs.current[boundedPage];
    if (!containerEl || !pageEl) return;

    containerEl.scrollTo({
      top: Math.max(0, pageEl.offsetTop - 24),
      behavior,
    });
  }, [totalPages]);

  const handleDocumentScroll = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const anchorY = containerRect.top + Math.min(containerRect.height * 0.35, 260);
    let closestPage = currentPage;
    let closestDistance = Infinity;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const pageEl = pageRefs.current[pageNumber];
      if (!pageEl) continue;
      const rect = pageEl.getBoundingClientRect();
      const distance = Math.abs(rect.top - anchorY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNumber;
      }
    }

    setCurrentPage((prev) => (prev === closestPage ? prev : closestPage));
  }, [currentPage, totalPages]);

  // Helper to add a smart field with auto-populated value
  const addSmartField = (field: typeof SMART_FIELDS[0], x: number, y: number) => {
    const value = getDraftSmartFieldValue(field.dataKey);

    // Determine assignedTo based on field type
    let assignedRole = assignTo;
    if (field.dataKey === 'buyerName' || field.dataKey === 'buyerEmail') {
      assignedRole = 'BUYER';
    } else if (field.dataKey === 'sellerName' || field.dataKey === 'sellerEmail') {
      assignedRole = 'SELLER';
    }

    const position = clampPosition(x, y, field.defaultWidth, field.defaultHeight);

    const newAnnotation: Annotation = {
      id: generateId(),
      type: field.type,
      x: position.x,
      y: position.y,
      width: field.defaultWidth,
      height: field.defaultHeight,
      page: currentPage,
      value,
      placeholder: field.placeholder,
      assignedTo: assignedRole,
      fontSize: 14,
      required: true,
      autoPopulated: !!value,
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setSelectedAnnotation(newAnnotation.id);
    setShowSmartFields(false);
  };

  const autoPlaceKnownSmartFields = () => {
    const knownFields: Array<{
      field: typeof SMART_FIELDS[0];
      x: number;
      y: number;
      assignedTo?: string;
    }> = [
      { field: SMART_FIELDS[0], x: 40, y: 90 },
      { field: SMART_FIELDS[1], x: 40, y: 128 },
      { field: SMART_FIELDS[2], x: 40, y: 166 },
      { field: SMART_FIELDS[3], x: 40, y: 220, assignedTo: 'BUYER' },
      { field: SMART_FIELDS[5], x: 40, y: 258, assignedTo: 'BUYER' },
      { field: SMART_FIELDS[4], x: 320, y: 220, assignedTo: 'SELLER' },
      { field: SMART_FIELDS[6], x: 320, y: 258, assignedTo: 'SELLER' },
    ];

    const settlementValue = getDraftSmartFieldValue('settlementDate');
    let placedCount = 0;

    setAnnotations((prev) => {
      const next = [...prev];

      for (const item of knownFields) {
        const value = getDraftSmartFieldValue(item.field.dataKey);
        if (!value) continue;

        const assignedRole = item.assignedTo
          || (item.field.dataKey === 'buyerName' || item.field.dataKey === 'buyerEmail'
            ? 'BUYER'
            : item.field.dataKey === 'sellerName' || item.field.dataKey === 'sellerEmail'
              ? 'SELLER'
              : assignTo);

        const duplicate = next.some((ann) =>
          ann.page === currentPage
          && ann.type === item.field.type
          && (ann.assignedTo || '') === (assignedRole || '')
          && ann.value === value,
        );
        if (duplicate) continue;

        const position = clampPosition(item.x, item.y, item.field.defaultWidth, item.field.defaultHeight);
        next.push({
          id: generateId(),
          type: item.field.type,
          x: position.x,
          y: position.y,
          width: item.field.defaultWidth,
          height: item.field.defaultHeight,
          page: currentPage,
          value,
          placeholder: item.field.placeholder,
          assignedTo: assignedRole,
          fontSize: 14,
          required: true,
          autoPopulated: true,
        });
        placedCount += 1;
      }

      if (settlementValue) {
        const existsSettlement = next.some((ann) =>
          ann.page === currentPage
          && ann.type === 'date'
          && ann.value === settlementValue,
        );
        if (!existsSettlement) {
          const width = 120;
          const height = 30;
          const position = clampPosition(40, 204, width, height);
          next.push({
            id: generateId(),
            type: 'date',
            x: position.x,
            y: position.y,
            width,
            height,
            page: currentPage,
            value: settlementValue,
            placeholder: 'Settlement Date',
            assignedTo: assignTo,
            fontSize: 14,
            required: true,
            autoPopulated: true,
          });
          placedCount += 1;
        }
      }

      return next;
    });

    showSmartPlacementNotice(
      placedCount > 0
        ? `Placed ${placedCount} smart field${placedCount === 1 ? '' : 's'}`
        : 'No additional known fields to place',
    );
    setShowSmartFields(false);
  };

  const addRequiredMarker = (label: string, x: number, y: number) => {
    const newAnnotation: Annotation = {
      id: generateId(),
      type: 'text',
      x,
      y,
      width: 220,
      height: 30,
      page: currentPage,
      value: label,
      placeholder: `Required: ${label}`,
      assignedTo: assignTo,
      fontSize: 12,
      required: true,
      autoPopulated: true,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setSelectedAnnotation(newAnnotation.id);
  };

  const autoPlaceRequiredMarkers = (labels: string[]) => {
    if (!labels.length) return;
    const startX = 40;
    const startY = 80;
    const gap = 36;
    labels.forEach((label, idx) => {
      addRequiredMarker(label, startX, startY + idx * gap);
    });
    setShowRequiredPanel(false);
  };

  const autoPlaceSignatureFields = () => {
    const startX = 60;
    const startY = 620;
    const blockGap = 80;
    const baseY = startY;
    const next: Annotation[] = [];

    signers.forEach((signer, idx) => {
      const y = baseY + idx * blockGap;
      next.push({
        id: generateId(),
        type: 'signature',
        x: startX,
        y,
        width: 200,
        height: 50,
        page: currentPage,
        value: '',
        placeholder: `${signer.role} Signature`,
        assignedTo: signer.role,
        required: true,
      });
      next.push({
        id: generateId(),
        type: 'date',
        x: startX + 210,
        y: y + 10,
        width: 110,
        height: 30,
        page: currentPage,
        value: new Date().toLocaleDateString(),
        placeholder: 'Date',
        assignedTo: signer.role,
        required: true,
      });
      next.push({
        id: generateId(),
        type: 'initials',
        x: startX + 330,
        y: y + 10,
        width: 70,
        height: 30,
        page: currentPage,
        value: '',
        placeholder: 'Init',
        assignedTo: signer.role,
        required: true,
      });
    });

    if (next.length) {
      setAnnotations(prev => [...prev, ...next]);
    }
  };

  const autoPlaceInitialsOnAllPages = () => {
    const next: Annotation[] = [];
    const signersToUse = signers.length > 0 ? signers : [{ role: assignTo, name: '', email: '' }];

    for (let page = 1; page <= totalPages; page += 1) {
      signersToUse.forEach((signer, idx) => {
        const position = clampPosition(PAGE_WIDTH - 112, PAGE_HEIGHT - 58 - idx * 38, 76, 28);
        next.push({
          id: generateId(),
          type: 'initials',
          x: position.x,
          y: position.y,
          width: 76,
          height: 28,
          page,
          value: '',
          placeholder: `${signer.role} Initials`,
          assignedTo: signer.role,
          fontSize: 14,
          required: true,
        });
      });
    }

    if (next.length) {
      setAnnotations((prev) => [...prev, ...next]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Top Toolbar */}
      <div className="flex-shrink-0 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:gap-4 sm:p-3">
          {/* Left: Basic Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="hidden text-xs font-bold text-slate-500 uppercase tracking-wider sm:inline">Fields:</span>
            {BASIC_TOOLS.map(tool => {
              const ToolIcon = tool.icon;
              return (
              <button
                key={tool.type}
                onClick={() => setSelectedTool(selectedTool === tool.type ? null : tool.type)}
                draggable
                onDragStart={(e) => handleFieldDragStart(e, tool.type)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-all sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:gap-2 ${
                  selectedTool === tool.type
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                }`}
                title={`${tool.label} (click to place or drag onto document)`}
              >
                <ToolIcon className="h-4 w-4" />
                <span className="hidden md:inline">{tool.label}</span>
              </button>
              );
            })}
            
            {/* Smart Fields Toggle */}
            <button
              onClick={() => setShowSmartFields(!showSmartFields)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-all sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:gap-2 ${
                showSmartFields
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
              }`}
              title="Auto-populate fields from deal data"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:inline">Smart Fields</span>
            </button>

            {requiredFields && requiredFields.length > 0 && (
              <button
                onClick={() => setShowRequiredPanel(!showRequiredPanel)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  showRequiredPanel
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                }`}
                title="Show missing required fields"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden md:inline">Required</span>
              </button>
            )}
          </div>

          {/* Right: Assign to dropdown */}
          <div className="flex items-center gap-3">
            <button
              onClick={autoPlaceSignatureFields}
              className="hidden lg:inline-flex px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20"
            >
              Auto-place signature fields
            </button>
            <button
              onClick={autoPlaceInitialsOnAllPages}
              className="hidden lg:inline-flex px-3 py-2 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/20"
            >
              Initial all pages
            </button>
            <button
              onClick={autoPlaceKnownSmartFields}
              className="hidden lg:inline-flex px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
            >
              Auto-fill known fields
            </button>
            <span className="text-xs text-slate-500 hidden sm:inline">Assign to:</span>
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="max-w-[54vw] bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:max-w-none"
            >
              {signers.map(s => (
                <option key={s.role} value={s.role}>{s.role} - {s.name || 'TBD'}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 border-t px-4 py-2 text-xs ${
          pageCountMismatch
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
        }`}>
          <div className="flex items-center gap-2">
            {pageCountMismatch ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="font-semibold">
              {!pdfLoaded
                ? `Preparing ${expectedPageCount || totalPages} page${(expectedPageCount || totalPages) === 1 ? '' : 's'} for review`
                : pageCountMismatch
                  ? `Studio loaded ${totalPages} of ${expectedPageCount} expected pages`
                  : `Studio loaded all ${totalPages} page${totalPages === 1 ? '' : 's'}`}
            </span>
          </div>
          <span className="hidden sm:inline text-white/60">
            Scroll the full document or use the page rail to jump before sending.
          </span>
        </div>

        {/* Smart Fields Panel */}
        {showSmartFields && (
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-900/30 to-green-900/20 border-t border-emerald-500/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Smart fields
                </h3>
                <p className="text-xs text-emerald-400/70 mt-0.5">Click to add pre-filled fields from deal data</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={autoPlaceKnownSmartFields}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 hover:bg-emerald-500/30"
                >
                  Auto-place all known
                </button>
                <button
                  onClick={() => setShowSmartFields(false)}
                  className="p-1 text-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {smartPlacementNotice && (
              <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
                {smartPlacementNotice}
              </div>
            )}

            <div className="mb-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">Edit Smart Values</h4>
              <p className="mt-1 text-[10px] text-emerald-300/80">Type to override before placing fields on the PDF.</p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={getDraftSmartFieldValue('buyerName')}
                  onChange={(e) => setSmartFieldOverride('buyerName', e.target.value)}
                  placeholder="Buyer Name"
                  className="w-full rounded-lg border border-blue-500/30 bg-slate-900/80 px-2 py-1.5 text-xs text-blue-100 placeholder:text-blue-300/50 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                />
                <input
                  type="text"
                  value={getDraftSmartFieldValue('sellerName')}
                  onChange={(e) => setSmartFieldOverride('sellerName', e.target.value)}
                  placeholder="Seller Name"
                  className="w-full rounded-lg border border-emerald-500/30 bg-slate-900/80 px-2 py-1.5 text-xs text-emerald-100 placeholder:text-emerald-300/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                />
                <input
                  type="email"
                  value={getDraftSmartFieldValue('buyerEmail')}
                  onChange={(e) => setSmartFieldOverride('buyerEmail', e.target.value)}
                  placeholder="Buyer Email"
                  className="w-full rounded-lg border border-blue-500/30 bg-slate-900/80 px-2 py-1.5 text-xs text-blue-100 placeholder:text-blue-300/50 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                />
                <input
                  type="email"
                  value={getDraftSmartFieldValue('sellerEmail')}
                  onChange={(e) => setSmartFieldOverride('sellerEmail', e.target.value)}
                  placeholder="Seller Email"
                  className="w-full rounded-lg border border-emerald-500/30 bg-slate-900/80 px-2 py-1.5 text-xs text-emerald-100 placeholder:text-emerald-300/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                />
                <input
                  type="text"
                  value={getDraftSmartFieldValue('address')}
                  onChange={(e) => setSmartFieldOverride('address', e.target.value)}
                  placeholder="Property Address"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/80 px-2 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                />
                <input
                  type="text"
                  value={getDraftSmartFieldValue('purchasePrice')}
                  onChange={(e) => setSmartFieldOverride('purchasePrice', e.target.value)}
                  placeholder="Purchase Price"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/80 px-2 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                />
                <input
                  type="text"
                  value={getDraftSmartFieldValue('mlsNumber')}
                  onChange={(e) => setSmartFieldOverride('mlsNumber', e.target.value)}
                  placeholder="MLS Number"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/80 px-2 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {/* Property Address */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[0], 50, 100)}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Home className="h-4 w-4" />
                  <span className="text-xs font-bold text-white">Address</span>
                </div>
                <p className="text-[10px] text-emerald-400 truncate">
                  {getDraftSmartFieldValue('address') || 'Not set'}
                </p>
              </button>

              {/* Purchase Price */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[1], 50, 140)}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BadgeDollarSign className="h-4 w-4" />
                  <span className="text-xs font-bold text-white">Price</span>
                </div>
                <p className="text-[10px] text-emerald-400 truncate">
                  {getDraftSmartFieldValue('purchasePrice') || 'Not set'}
                </p>
              </button>

              {/* MLS # */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[2], 50, 180)}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="h-4 w-4" />
                  <span className="text-xs font-bold text-white">MLS #</span>
                </div>
                <p className="text-[10px] text-emerald-400 truncate">
                  {getDraftSmartFieldValue('mlsNumber') || 'Not set'}
                </p>
              </button>

              {/* Buyer Name */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[3], 50, 220)}
                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserRound className="h-4 w-4" />
                  <span className="text-xs font-bold text-blue-300">Buyer</span>
                </div>
                <p className="text-[10px] text-blue-400 truncate">
                  {getDraftSmartFieldValue('buyerName') || 'Not set'}
                </p>
              </button>

              {/* Seller Name */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[4], 50, 260)}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserRound className="h-4 w-4" />
                  <span className="text-xs font-bold text-emerald-300">Seller</span>
                </div>
                <p className="text-[10px] text-emerald-400 truncate">
                  {getDraftSmartFieldValue('sellerName') || 'Not set'}
                </p>
              </button>

              {/* Settlement Date */}
              <button
                onClick={() => {
                  const settlementValue = getDraftSmartFieldValue('settlementDate');
                  const newAnnotation: Annotation = {
                    id: generateId(),
                    type: 'date',
                    x: 50,
                    y: 300,
                    width: 120,
                    height: 30,
                    page: currentPage,
                    value: settlementValue,
                    placeholder: 'Settlement Date',
                    assignedTo: assignTo,
                    fontSize: 14,
                    required: true,
                    autoPopulated: !!settlementValue,
                  };
                  setAnnotations(prev => [...prev, newAnnotation]);
                  setSelectedAnnotation(newAnnotation.id);
                  setShowSmartFields(false);
                }}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs font-bold text-white">Settlement</span>
                </div>
                <p className="text-[10px] text-emerald-400 truncate">
                  {getDraftSmartFieldValue('settlementDate') || 'Not set'}
                </p>
              </button>

              {/* Buyer Email */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[5], 50, 338)}
                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-bold text-blue-300">Buyer Email</span>
                </div>
                <p className="text-[10px] text-blue-400 truncate">
                  {getDraftSmartFieldValue('buyerEmail') || 'Not set'}
                </p>
              </button>

              {/* Seller Email */}
              <button
                onClick={() => addSmartField(SMART_FIELDS[6], 50, 376)}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-bold text-emerald-300">Seller Email</span>
                </div>
                <p className="text-[10px] text-emerald-400 truncate">
                  {getDraftSmartFieldValue('sellerEmail') || 'Not set'}
                </p>
              </button>

              {/* Today's Date */}
              <button
                onClick={() => {
                  const newAnnotation: Annotation = {
                    id: generateId(),
                    type: 'date',
                    x: 50,
                    y: 340,
                    width: 120,
                    height: 30,
                    page: currentPage,
                    value: new Date().toLocaleDateString(),
                    placeholder: 'Today\'s Date',
                    assignedTo: assignTo,
                    fontSize: 14,
                    required: true,
                    autoPopulated: true,
                  };
                  setAnnotations(prev => [...prev, newAnnotation]);
                  setSelectedAnnotation(newAnnotation.id);
                  setShowSmartFields(false);
                }}
                className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs font-bold text-purple-300">Today</span>
                </div>
                <p className="text-[10px] text-purple-400 truncate">
                  {new Date().toLocaleDateString()}
                </p>
              </button>
            </div>
          </div>
        )}

        {showRequiredPanel && requiredFields && requiredFields.length > 0 && (
          <div className="px-4 py-3 bg-gradient-to-r from-amber-900/30 to-slate-900/40 border-t border-amber-500/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Missing Required Fields
                </h3>
                <p className="text-xs text-amber-400/70 mt-0.5">Place markers directly on the PDF</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => autoPlaceRequiredMarkers(requiredFields.map((f) => f.label))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/40"
                >
                  Auto-place all
                </button>
                <button
                  onClick={() => setShowRequiredPanel(false)}
                  className="p-1 text-slate-500 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {requiredFields.map((field) => (
                <button
                  key={field.id}
                  onClick={() => addRequiredMarker(field.label, 40, 80)}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-amber-500/10 hover:border-amber-500/30"
                >
                  <div className="text-xs font-semibold text-amber-200">{field.label}</div>
                  <div className="text-[10px] text-amber-400/70">Click to place marker</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tool hint */}
        {selectedTool && (
          <div className="hidden px-4 py-2 bg-blue-500/10 border-t border-blue-500/20 text-sm text-blue-300 sm:flex sm:items-center sm:gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Click anywhere on the document or drag a field button onto the page to place a <strong className="mx-1">{BASIC_TOOLS.find(t => t.type === selectedTool)?.label}</strong> field for <strong className="mx-1">{assignTo}</strong>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden md:flex-row">
        <aside className="shrink-0 border-b border-white/10 bg-slate-950/95 md:w-24 md:border-b-0 md:border-r">
          <div className="hidden border-b border-white/10 px-3 py-3 md:block">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pages</div>
            <div className="mt-0.5 text-sm font-bold text-white">{totalPages}</div>
          </div>
          <div className="flex flex-wrap gap-2 p-2 md:block md:flex-1 md:space-y-2 md:overflow-y-auto">
            {pageNumbers.map((pageNumber) => {
              const isActivePage = pageNumber === currentPage;
              const fieldCount = annotationCountsByPage.get(pageNumber) || 0;

              return (
                <button
                  key={pageNumber}
                  type="button"
                  aria-label={`Jump to page ${pageNumber}`}
                  onClick={() => {
                    scrollToPage(pageNumber);
                    setSelectedTool(null);
                  }}
                  className={`relative flex h-12 w-14 flex-col items-center justify-center rounded-lg border text-[11px] transition-all md:h-16 md:w-full md:text-xs ${
                    isActivePage
                      ? 'border-blue-400 bg-blue-500/20 text-white shadow-lg shadow-blue-950/30'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-blue-400/60 hover:bg-blue-500/10'
                  }`}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span className="mt-1 font-bold leading-none">Page {pageNumber}</span>
                  {fieldCount > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full border border-slate-950 bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                      {fieldCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* PDF Viewer */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 relative overflow-auto bg-slate-800/50"
          onClick={handleCanvasClick}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onScroll={handleDocumentScroll}
          style={{ cursor: selectedTool ? 'crosshair' : activeInteraction?.mode === 'drag' ? 'grabbing' : activeInteraction?.mode === 'resize' ? 'nwse-resize' : 'default' }}
        >
          <div className="mx-auto flex min-w-full flex-col items-center gap-6 px-3 py-5 sm:px-6">
            {pageNumbers.map((pageNumber) => {
              const pageImage = pdfPageImages[pageNumber];
              const pageRenderError = pdfRenderErrors[pageNumber];
              const pageRendering = Boolean(pdfRenderingPages[pageNumber]);
              const nativePreviewUrl = getNativePreviewUrl(pageNumber);
              const pageAnnotations = annotations.filter((ann) => ann.page === pageNumber);
              const isActivePage = currentPage === pageNumber;

              return (
                <section
                  key={pageNumber}
                  className="flex flex-col items-center"
                  aria-label={`Page ${pageNumber} of ${totalPages}`}
                >
                  <div className={`mb-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isActivePage
                      ? 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                      : 'border-white/10 bg-slate-950/60 text-slate-400'
                  }`}>
                    Page {pageNumber}
                  </div>

                  <div
                    ref={(element) => {
                      pageRefs.current[pageNumber] = element;
                    }}
                    data-page-number={pageNumber}
                    className="relative select-none"
                    style={{
                      width: `${PAGE_WIDTH * zoom}px`,
                      height: `${PAGE_HEIGHT * zoom}px`,
                      minHeight: `${PAGE_HEIGHT * zoom}px`,
                      backgroundColor: 'white',
                      boxShadow: isActivePage
                        ? '0 0 0 2px rgba(59,130,246,0.35), 0 4px 24px rgba(0,0,0,0.55)'
                        : '0 4px 20px rgba(0,0,0,0.5)',
                      borderRadius: '4px',
                    }}
                  >
                    {pageImage && (
                      <img
                        src={pageImage}
                        alt={`PDF page ${pageNumber}`}
                        className="absolute inset-0 h-full w-full rounded object-contain"
                        draggable={false}
                      />
                    )}

                    {pageRenderError && nativePreviewUrl && !pageImage && (
                      <iframe
                        src={nativePreviewUrl}
                        title={`PDF page ${pageNumber} fallback preview`}
                        className="absolute inset-0 h-full w-full rounded bg-white"
                        style={{ pointerEvents: 'none' }}
                      />
                    )}

                    {(pageRendering || (!pageImage && !pageRenderError)) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white text-sm font-semibold text-slate-500">
                        Rendering PDF page {pageNumber}...
                      </div>
                    )}

                    {pageRenderError && !pageImage && !nativePreviewUrl && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white px-8 text-center">
                        <div>
                          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" aria-hidden="true" />
                          <p className="text-sm font-semibold text-slate-800">PDF preview unavailable</p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{pageRenderError}</p>
                        </div>
                      </div>
                    )}

                    {pageRenderError && nativePreviewUrl && !pageImage && (
                      <div className="absolute left-4 right-4 top-4 z-20 rounded-xl border border-amber-300/40 bg-amber-50/95 px-3 py-2 text-xs font-medium leading-5 text-amber-950 shadow-lg">
                        {pageRenderError}
                      </div>
                    )}

                    {/* Annotation Overlays */}
                    <div className="absolute inset-0 pointer-events-none" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                      {alignmentGuide.page === pageNumber && alignmentGuide.x !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-blue-500/70"
                          style={{ left: alignmentGuide.x }}
                        />
                      )}
                      {alignmentGuide.page === pageNumber && alignmentGuide.y !== null && (
                        <div
                          className="absolute left-0 right-0 h-px bg-blue-500/70"
                          style={{ top: alignmentGuide.y }}
                        />
                      )}
                      {pageAnnotations.map(ann => {
                        const colors = getSignerColor(ann.assignedTo);
                        const isSelected = selectedAnnotation === ann.id;

                        return (
                          <div
                            key={ann.id}
                            className={`group absolute pointer-events-auto cursor-grab select-none transition-shadow active:cursor-grabbing ${colors.bg} ${colors.border} border-2 rounded ${
                              isSelected ? 'ring-2 ring-white/90 ring-offset-2 ring-offset-slate-900 shadow-lg' : ''
                            } ${ann.type === 'checkbox' ? 'rounded-md' : ''}`}
                            style={{
                              left: ann.x,
                              top: ann.y,
                              width: ann.width,
                              height: ann.height,
                              minWidth: ann.type === 'checkbox' ? 24 : 60,
                              touchAction: 'none',
                            }}
                            onMouseDown={(e) => handleAnnotationMouseDown(e, ann.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnnotation(ann.id);
                              setCurrentPage(ann.page);
                            }}
                          >
                            {/* Field content */}
                            <div className="w-full h-full flex items-center justify-center px-2 overflow-hidden">
                              {ann.type === 'signature' && (
                                <div className="text-center">
                                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${colors.text}`}><PenLine className="h-3 w-3" /> SIGN</span>
                                  <div className={`text-[10px] ${colors.text} opacity-70`}>{ann.assignedTo}</div>
                                </div>
                              )}
                              {ann.type === 'initials' && (
                                <span className={`text-xs font-bold ${colors.text}`}>INIT</span>
                              )}
                              {ann.type === 'date' && (
                                <span className={`inline-flex items-center gap-1 text-xs ${colors.text}`}><CalendarDays className="h-3 w-3" /> {ann.value || 'Date'}</span>
                              )}
                              {ann.type === 'text' && (
                                <input
                                  type="text"
                                  value={ann.value}
                                  onChange={(e) => updateAnnotation(ann.id, { value: e.target.value })}
                                  placeholder={ann.placeholder}
                                  className="w-full h-full bg-transparent text-xs text-slate-800 outline-none"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              {ann.type === 'address' && (
                                <span className={`text-xs ${colors.text}`}>{ann.value || getSmartFieldValue('address') || 'Address'}</span>
                              )}
                              {ann.type === 'name' && (
                                <span className={`text-xs ${colors.text}`}>{ann.value || ann.placeholder || 'Name'}</span>
                              )}
                              {ann.type === 'email' && (
                                <span className={`text-xs ${colors.text}`}>{ann.value || ann.placeholder || 'Email'}</span>
                              )}
                              {ann.type === 'price' && (
                                <span className={`text-xs ${colors.text}`}>{ann.value || getSmartFieldValue('purchasePrice') || 'Price'}</span>
                              )}
                              {ann.type === 'mls' && (
                                <span className={`text-xs ${colors.text}`}>{ann.value || getSmartFieldValue('mlsNumber') || 'MLS #'}</span>
                              )}
                              {ann.type === 'checkbox' && (
                                <button
                                  type="button"
                                  className={`text-sm ${colors.text}`}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateAnnotation(ann.id, { value: ann.value === 'checked' ? '' : 'checked' });
                                  }}
                                >
                                  {ann.value === 'checked' ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </button>
                              )}
                            </div>

                            {/* Resize handle */}
                            {isSelected && (
                              <div
                                className="absolute -right-2 -bottom-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-[9px] text-blue-600 shadow-lg cursor-se-resize"
                                onMouseDown={(e) => handleResizeMouseDown(e, ann.id)}
                              >
                                <Ruler className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar - Field Properties & Summary */}
        <div className={`${showFieldPanel ? 'hidden lg:flex' : 'hidden'} w-72 xl:w-80 shrink-0 border-l border-white/10 bg-slate-900/80 flex-col transition-all`}>
          {/* Selected Field Properties */}
          {selectedAnnotation && (() => {
            const ann = annotations.find(a => a.id === selectedAnnotation);
            if (!ann) return null;
            const colors = getSignerColor(ann.assignedTo);
            
            return (
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colors.border.replace('border-', 'bg-')}`}></span>
                    {TOOLS.find(t => t.type === ann.type)?.label} Field
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => duplicateAnnotation(ann.id)}
                      className="p-1.5 rounded-lg text-blue-300 hover:bg-blue-500/20 transition-colors"
                      title="Duplicate field"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteAnnotation(ann.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete field"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Assigned To */}
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Assigned To</label>
                    <select
                      value={ann.assignedTo || 'BUYER'}
                      onChange={(e) => updateAnnotation(ann.id, { assignedTo: e.target.value })}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      {signers.map(s => (
                        <option key={s.role} value={s.role}>{s.role}</option>
                      ))}
                    </select>
                  </div>

                  {/* Value (for text/date) */}
                  {(ann.type === 'text' || ann.type === 'date') && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">
                        {ann.type === 'date' ? 'Date Value' : 'Text Value'}
                      </label>
                      <input
                        type={ann.type === 'date' ? 'date' : 'text'}
                        value={ann.value}
                        onChange={(e) => updateAnnotation(ann.id, { value: e.target.value })}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                  )}

                  {/* Required toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500">Required Field</label>
                    <button
                      onClick={() => updateAnnotation(ann.id, { required: !ann.required })}
                      className={`w-10 h-6 rounded-full transition-colors ${ann.required ? 'bg-blue-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${ann.required ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>

                  {/* Size controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Width</label>
                      <input
                        type="number"
                        value={Math.round(ann.width)}
                        onChange={(e) => updateAnnotation(ann.id, { width: parseInt(e.target.value) || 50 })}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Height</label>
                      <input
                        type="number"
                        value={Math.round(ann.height)}
                        onChange={(e) => updateAnnotation(ann.id, { height: parseInt(e.target.value) || 30 })}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fields Summary */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Fields ({annotations.length})
            </h3>

            {annotations.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">No fields added yet</p>
                <p className="text-xs text-slate-600 mt-1">Select a tool above and click on the document</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Group by signer */}
                {signers.map(signer => {
                  const signerAnnotations = annotations.filter(a => a.assignedTo === signer.role);
                  if (signerAnnotations.length === 0) return null;
                  const colors = getSignerColor(signer.role);

                  return (
                    <div key={signer.role} className="mb-4">
                      <div className={`text-xs font-bold ${colors.text} uppercase tracking-wider mb-2 flex items-center gap-2`}>
                        <span className={`w-2 h-2 rounded-full ${colors.border.replace('border-', 'bg-')}`}></span>
                        {signer.role} ({signerAnnotations.length})
                      </div>
                      <div className="space-y-1">
                        {signerAnnotations.map(ann => {
                          const tool = TOOLS.find(t => t.type === ann.type);
                          const Icon = tool?.icon;

                          return (
                            <button
                              key={ann.id}
                              onClick={() => {
                                setSelectedAnnotation(ann.id);
                                scrollToPage(ann.page);
                              }}
                              className={`w-full p-2 rounded-lg text-left text-xs transition-colors ${
                                selectedAnnotation === ann.id
                                  ? `${colors.bg} ${colors.border} border`
                                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                                <span className="text-white">{tool?.label || ann.type}</span>
                                <span className="text-slate-500 ml-auto">pg {ann.page}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Add Presets */}
          <div className="p-4 border-t border-white/5 bg-slate-900">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Add Presets</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  // Add standard signature block for buyer
                  const buyerSig: Annotation = {
                    id: generateId(),
                    type: 'signature',
                    x: 50,
                    y: 700,
                    width: 200,
                    height: 50,
                    page: currentPage,
                    value: '',
                    placeholder: 'Buyer Signature',
                    assignedTo: 'BUYER',
                    required: true,
                  };
                  const buyerDate: Annotation = {
                    id: generateId(),
                    type: 'date',
                    x: 260,
                    y: 710,
                    width: 100,
                    height: 30,
                    page: currentPage,
                    value: new Date().toLocaleDateString(),
                    placeholder: 'Date',
                    assignedTo: 'BUYER',
                    required: true,
                  };
                  setAnnotations(prev => [...prev, buyerSig, buyerDate]);
                }}
                className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 hover:bg-blue-500/20 transition-colors"
              >
                + Buyer Sig Block
              </button>
              <button
                onClick={() => {
                  const sellerSig: Annotation = {
                    id: generateId(),
                    type: 'signature',
                    x: 50,
                    y: 750,
                    width: 200,
                    height: 50,
                    page: currentPage,
                    value: '',
                    placeholder: 'Seller Signature',
                    assignedTo: 'SELLER',
                    required: true,
                  };
                  const sellerDate: Annotation = {
                    id: generateId(),
                    type: 'date',
                    x: 260,
                    y: 760,
                    width: 100,
                    height: 30,
                    page: currentPage,
                    value: new Date().toLocaleDateString(),
                    placeholder: 'Date',
                    assignedTo: 'SELLER',
                    required: true,
                  };
                  setAnnotations(prev => [...prev, sellerSig, sellerDate]);
                }}
                className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                + Seller Sig Block
              </button>
              <button
                onClick={() => {
                  const initials: Annotation = {
                    id: generateId(),
                    type: 'initials',
                    x: 500,
                    y: 50,
                    width: 60,
                    height: 30,
                    page: currentPage,
                    value: '',
                    placeholder: 'Init',
                    assignedTo: 'BUYER',
                    required: true,
                  };
                  setAnnotations(prev => [...prev, initials]);
                }}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors"
              >
                + Buyer Initials
              </button>
              <button
                onClick={() => {
                  const initials: Annotation = {
                    id: generateId(),
                    type: 'initials',
                    x: 560,
                    y: 50,
                    width: 60,
                    height: 30,
                    page: currentPage,
                    value: '',
                    placeholder: 'Init',
                    assignedTo: 'SELLER',
                    required: true,
                  };
                  setAnnotations(prev => [...prev, initials]);
                }}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors"
              >
                + Seller Initials
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="flex-shrink-0 border-t border-white/10 bg-slate-900/80 p-2 flex items-center justify-between gap-2 overflow-x-auto sm:p-4">
        {/* Left: Page navigation & zoom */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm text-white px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom(z => clampZoom(z - 0.25))}
              className="p-2 rounded hover:bg-white/10 text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm text-white px-2">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => clampZoom(z + 0.25))}
              className="p-2 rounded hover:bg-white/10 text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white lg:hidden">
            Fields ({annotations.length})
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={fitDocumentWidth}
              className="px-3 py-2 rounded text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              Fit width
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-3 py-2 rounded text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              100%
            </button>
          </div>

          {selectedAnnotation && (
            <div className="hidden xl:block text-xs text-slate-400">
              Drag to place. Use arrow keys to nudge and Shift plus arrow for larger moves.
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowFieldPanel(!showFieldPanel)}
            className={`hidden px-4 py-2 rounded-lg text-sm font-medium transition-all lg:inline-flex ${
              showFieldPanel
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {showFieldPanel ? 'Hide Panel' : 'Show Panel'}
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all sm:px-5 sm:py-2.5"
            >
              Back
            </button>
          )}

          {onSend && (
            <button
              onClick={() => onSave?.(annotations)}
              className="px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5 transition-all sm:px-5 sm:py-2.5"
            >
              Save Field Layout
            </button>
          )}

          {onSend && (
            <button
              onClick={() => {
                onSave?.(annotations);
                onSend(annotations);
              }}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50 flex items-center gap-2 sm:px-6 sm:py-2.5"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send for Signature
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PdfAnnotator;
