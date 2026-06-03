/**
 * PdfEditor - A simple PDF editor for agents
 * Features:
 * - View imported PDFs
 * - Merge multiple PDFs together
 * - Remove/reorder pages
 * - Rename documents
 * - Download edited PDFs
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import api from '../../lib/api';
import {
  EnvelopeLink,
  buildEnvelopeSendToast,
  getEnvelopeLinkDeliveryLabel,
  getEnvelopeLinkPrimaryLabel,
  getEnvelopeLinkSubtitle,
} from '../../lib/esignDelivery';
import { leadsApi } from '../../lib/leadsApi';
import type { Lead } from '../../types/leads';
import PdfAnnotator, { type Annotation as EsignFieldPlacement } from './PdfAnnotator';
import { installPdfJsCompat } from '../../lib/pdfJsCompat';
import { PDF_DOCUMENT_LOAD_OPTIONS, renderPdfPageToImage, toExactArrayBuffer } from '../../lib/pdfRendering';

installPdfJsCompat();
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

interface PdfFile {
  id: string;
  name: string;
  data: ArrayBuffer;
  pageCount: number;
  pages: number[]; // selected pages (1-indexed)
  thumbnail?: string;
}

interface PagePreview {
  fileId: string;
  pageNumber: number;
  thumbnail: string;
  selected: boolean;
}

type SelectedPageEntry = {
  file: PdfFile;
  preview: PagePreview;
};

type PreparedEsignPdf = {
  data: ArrayBuffer;
  pageCount: number;
  source: 'original' | 'merged' | 'rasterized';
};

interface DealSummary {
  id: string;
  title?: string;
  status?: string;
  property?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    mlsId?: string;
    taxId?: string;
  };
  repc?: {
    id?: string;
    purchasePrice?: number;
    settlementDeadline?: string;
    dueDiligenceDeadline?: string;
    financingAppraisalDeadline?: string;
  };
  buyer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  seller?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface ClientSummary {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
}

type EsignRole = 'BUYER' | 'SELLER' | 'AGENT' | 'OTHER';
type WorkflowIntent = 'merge' | 'packet' | 'esign';

interface EsignSigner {
  role: EsignRole;
  name: string;
  email: string;
  included: boolean;
}

export function PdfEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentOnlyMode = searchParams.get('mode') === 'document-esign';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [outputName, setOutputName] = useState('merged-document');
  const [bundleName, setBundleName] = useState('contract-packet');
  const [bundleTarget, setBundleTarget] = useState<'deal' | 'client' | 'lead'>('deal');
  const [bundleRef, setBundleRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload');
  const [workflowIntent, setWorkflowIntent] = useState<WorkflowIntent>(documentOnlyMode ? 'esign' : 'merge');
  const [contextType, setContextType] = useState<'deal' | 'client' | 'lead' | 'new'>(documentOnlyMode ? 'new' : 'deal');
  const [contextSearch, setContextSearch] = useState('');
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [showEsign, setShowEsign] = useState(false);
  const [esignStep, setEsignStep] = useState<'recipients' | 'preview'>('recipients');
  const [esignPreviewUrl, setEsignPreviewUrl] = useState<string | null>(null);
  const [esignPreviewData, setEsignPreviewData] = useState<ArrayBuffer | null>(null);
  const [esignPreviewPageCount, setEsignPreviewPageCount] = useState(0);
  const [esignSigners, setEsignSigners] = useState<EsignSigner[]>([]);
  const [esignSubject, setEsignSubject] = useState('Please review and sign');
  const [esignMessage, setEsignMessage] = useState('Please review and sign the attached documents.');
  const [esignSending, setEsignSending] = useState(false);
  const [esignResending, setEsignResending] = useState(false);
  const [esignEnvelopeId, setEsignEnvelopeId] = useState<string | null>(null);
  const [esignSentAt, setEsignSentAt] = useState<string | null>(null);
  const [esignCanResend, setEsignCanResend] = useState(false);
  const [esignDeliveryStatus, setEsignDeliveryStatus] = useState<{ sent: number; failed: number; skipped: number; label: string } | null>(null);
  const [esignCelebrating, setEsignCelebrating] = useState(false);
  const [esignLinks, setEsignLinks] = useState<EnvelopeLink[] | null>(null);
  const [esignFieldPlacements, setEsignFieldPlacements] = useState<EsignFieldPlacement[]>([]);
  const esignResendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esignCelebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyPrefillAppliedRef = useRef(false);

  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (documentOnlyMode) {
      setContextType('new');
    }
  }, [documentOnlyMode]);

  useEffect(() => {
    if (propertyPrefillAppliedRef.current) return;

    const propertyParam = searchParams.get('property') || '';
    const mlsParam = searchParams.get('mls') || '';
    let propertyContext: any = null;
    try {
      const raw = sessionStorage.getItem('agentease_property_workspace_pdf_context');
      propertyContext = raw ? JSON.parse(raw) : null;
    } catch {
      propertyContext = null;
    }

    const address = propertyContext?.address || [propertyContext?.street, propertyContext?.city, propertyContext?.state, propertyContext?.zip]
      .filter(Boolean)
      .join(', ') || propertyParam;
    const label = propertyContext?.headline || address || (mlsParam ? `MLS #${mlsParam}` : '');
    if (!label && !documentOnlyMode) return;

    propertyPrefillAppliedRef.current = true;
    const safeLabel = String(label || 'Property packet')
      .replace(/[^\w\s#.,-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Property packet';
    const packetName = propertyContext?.packetName || `${safeLabel} packet`;

    setWorkflowIntent('esign');
    setContextType('new');
    setOutputName(packetName);
    setBundleName(packetName);
    setContextSearch(address || safeLabel);
    setEsignSubject(`Please review and sign: ${safeLabel}`);
    setEsignMessage(`Please review and sign the attached property packet for ${address || safeLabel}.`);
  }, [documentOnlyMode, searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      setLoadingContext(true);
      try {
        const [dealsRes, clientsRes, leadsRes] = await Promise.all([
          api.get('/deals'),
          api.get('/clients'),
          leadsApi.getLeads({ converted: false }),
        ]);

        if (cancelled) return;
        const dealList = (dealsRes.data || []) as DealSummary[];
        const clientList = (clientsRes.data || []) as ClientSummary[];
        const leadList = (leadsRes.data || []) as Lead[];

        setDeals(dealList);
        setClients(clientList);
        setLeads(leadList);

        if (!selectedDealId && dealList.length > 0) {
          setSelectedDealId(dealList[0].id);
        }
        if (!selectedClientId && clientList.length > 0) {
          setSelectedClientId(clientList[0].id);
        }
        if (!selectedLeadId && leadList.length > 0) {
          setSelectedLeadId(leadList[0].id);
        }
      } catch (error) {
        console.error('Failed to load context lists:', error);
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    };

    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDeal = useMemo(() => deals.find(d => d.id === selectedDealId) || null, [deals, selectedDealId]);
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) || null, [clients, selectedClientId]);
  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || null, [leads, selectedLeadId]);

  const searchValue = contextSearch.trim().toLowerCase();
  const filteredDeals = useMemo(() => {
    if (!searchValue) return deals;
    return deals.filter((deal) => {
      const label = `${deal.title || ''} ${deal.property?.street || ''} ${deal.property?.city || ''}`.toLowerCase();
      return label.includes(searchValue);
    });
  }, [deals, searchValue]);

  const filteredClients = useMemo(() => {
    if (!searchValue) return clients;
    return clients.filter((client) => {
      const label = `${client.firstName || ''} ${client.lastName || ''} ${client.email || ''}`.toLowerCase();
      return label.includes(searchValue);
    });
  }, [clients, searchValue]);

  const filteredLeads = useMemo(() => {
    if (!searchValue) return leads;
    return leads.filter((lead) => {
      const label = `${lead.firstName || ''} ${lead.lastName || ''} ${lead.email || ''}`.toLowerCase();
      return label.includes(searchValue);
    });
  }, [leads, searchValue]);

  const contextLabel = useMemo(() => {
    if (contextType === 'deal' && selectedDeal) {
      return selectedDeal.property?.street || selectedDeal.title || 'Selected deal';
    }
    if (contextType === 'client' && selectedClient) {
      return `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim() || 'Selected client';
    }
    if (contextType === 'lead' && selectedLead) {
      return `${selectedLead.firstName || ''} ${selectedLead.lastName || ''}`.trim() || 'Selected lead';
    }
    return outputName && outputName !== 'merged-document' ? outputName : 'Standalone document';
  }, [contextType, selectedDeal, selectedClient, selectedLead, outputName]);

  const contextSubtitle = useMemo(() => {
    if (contextType === 'deal' && selectedDeal) {
      return `${selectedDeal.property?.city || ''} ${selectedDeal.property?.state || ''}`.trim();
    }
    if (contextType === 'client' && selectedClient) {
      return selectedClient.email || selectedClient.phone || '';
    }
    if (contextType === 'lead' && selectedLead) {
      return selectedLead.email || selectedLead.phone || '';
    }
    return 'No deal required';
  }, [contextType, selectedDeal, selectedClient, selectedLead]);

  // Generate page thumbnails using PDF.js
  const generateThumbnails = async (pdfFile: PdfFile) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfFile.data.slice(0)), ...PDF_DOCUMENT_LOAD_OPTIONS });
      const pdfDoc = await loadingTask.promise;
      const previews: PagePreview[] = [];

      for (let i = 1; i <= pdfDoc.numPages; i += 1) {
        const page = await pdfDoc.getPage(i);
        const rendered = await renderPdfPageToImage(page, {
          maxWidth: 220,
          outputScale: 1,
          imageType: 'image/jpeg',
          imageQuality: 0.78,
        });

        previews.push({
          fileId: pdfFile.id,
          pageNumber: i,
          thumbnail: rendered.imageSrc,
          selected: true,
        });
      }

      return previews;
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      return [];
    }
  };

  const generateFallbackPreviews = (pdfFile: PdfFile): PagePreview[] => {
    return Array.from({ length: pdfFile.pageCount }, (_, index) => {
      const pageNumber = index + 1;
      const canvas = document.createElement('canvas');
      canvas.width = 220;
      canvas.height = 284;
      const context = canvas.getContext('2d');

      if (context) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#cbd5e1';
        context.lineWidth = 2;
        context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        context.fillStyle = '#334155';
        context.font = 'bold 18px sans-serif';
        context.textAlign = 'center';
        context.fillText(`Page ${pageNumber}`, canvas.width / 2, canvas.height / 2 - 8);
        context.font = '12px sans-serif';
        context.fillStyle = '#64748b';
        context.fillText('Preview needs verification', canvas.width / 2, canvas.height / 2 + 18);
      }

      return {
        fileId: pdfFile.id,
        pageNumber,
        thumbnail: canvas.toDataURL('image/png'),
        selected: true,
      };
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setLoading(true);
    const newFiles: PdfFile[] = [];
    const newPreviews: PagePreview[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      if (file.type !== 'application/pdf') {
        showToast('error', `Skipped ${file.name} - not a PDF file`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();

        const pdfFile: PdfFile = {
          id: `file-${Date.now()}-${i}`,
          name: file.name.replace('.pdf', ''),
          data: arrayBuffer,
          pageCount,
          pages: Array.from({ length: pageCount }, (_, i) => i + 1),
        };

        newFiles.push(pdfFile);

        const renderedPreviews = await generateThumbnails(pdfFile);
        const previews = renderedPreviews.length > 0
          ? renderedPreviews
          : generateFallbackPreviews(pdfFile);
        previews.forEach((preview) => {
          newPreviews.push(preview);
          selectedPages.add(`${preview.fileId}-${preview.pageNumber}`);
        });
      } catch (error) {
        console.error('Error loading PDF:', error);
        showToast('error', `Failed to load ${file.name}`);
      }
    }

    setFiles([...files, ...newFiles]);
    setPagePreviews([...pagePreviews, ...newPreviews]);
    setSelectedPages(new Set(selectedPages));
    setLoading(false);
    
    if (newFiles.length > 0) {
      showToast('success', `Added ${newFiles.length} PDF${newFiles.length > 1 ? 's' : ''} (${newPreviews.length} pages total)`);
      // Auto-set output name from first file if not set
      if (outputName === 'merged-document' && newFiles.length > 0) {
        setOutputName(newFiles[0].name);
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePageSelection = (fileId: string, pageNumber: number) => {
    const key = `${fileId}-${pageNumber}`;
    const newSelected = new Set(selectedPages);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelectedPages(newSelected);
    setPagePreviews(pagePreviews.map(p => 
      p.fileId === fileId && p.pageNumber === pageNumber 
        ? { ...p, selected: !p.selected }
        : p
    ));
  };

  const selectAllPages = (fileId?: string) => {
    const newSelected = new Set<string>();
    const updatedPreviews = pagePreviews.map(p => {
      if (!fileId || p.fileId === fileId) {
        newSelected.add(`${p.fileId}-${p.pageNumber}`);
        return { ...p, selected: true };
      }
      if (selectedPages.has(`${p.fileId}-${p.pageNumber}`)) {
        newSelected.add(`${p.fileId}-${p.pageNumber}`);
      }
      return p;
    });
    setSelectedPages(newSelected);
    setPagePreviews(updatedPreviews);
  };

  const deselectAllPages = (fileId?: string) => {
    const newSelected = new Set<string>();
    const updatedPreviews = pagePreviews.map(p => {
      if (!fileId || p.fileId === fileId) {
        return { ...p, selected: false };
      }
      if (selectedPages.has(`${p.fileId}-${p.pageNumber}`)) {
        newSelected.add(`${p.fileId}-${p.pageNumber}`);
      }
      return p;
    });
    setSelectedPages(newSelected);
    setPagePreviews(updatedPreviews);
  };

  const removeFile = (fileId: string) => {
    setFiles(files.filter(f => f.id !== fileId));
    setPagePreviews(pagePreviews.filter(p => p.fileId !== fileId));
    const newSelected = new Set<string>();
    selectedPages.forEach(key => {
      if (!key.startsWith(fileId)) {
        newSelected.add(key);
      }
    });
    setSelectedPages(newSelected);
  };

  const removePage = (fileId: string, pageNumber: number) => {
    const key = `${fileId}-${pageNumber}`;
    const nextPreviews = pagePreviews.filter(p => !(p.fileId === fileId && p.pageNumber === pageNumber));
    setPagePreviews(nextPreviews);
    if (selectedPages.has(key)) {
      const newSelected = new Set(selectedPages);
      newSelected.delete(key);
      setSelectedPages(newSelected);
    }
    if (!nextPreviews.some(p => p.fileId === fileId)) {
      setFiles(files.filter(f => f.id !== fileId));
    }
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    const newPreviews = [...pagePreviews];
    const [movedPage] = newPreviews.splice(fromIndex, 1);
    newPreviews.splice(toIndex, 0, movedPage);
    setPagePreviews(newPreviews);
  };

  const generateMergedPdf = async (): Promise<ArrayBuffer> => {
    const mergedPdf = await PDFDocument.create();

    for (const preview of pagePreviews) {
      if (!selectedPages.has(`${preview.fileId}-${preview.pageNumber}`)) continue;

      const file = files.find(f => f.id === preview.fileId);
      if (!file) continue;

      try {
        const sourcePdf = await PDFDocument.load(file.data);
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [preview.pageNumber - 1]);
        mergedPdf.addPage(copiedPage);
      } catch (error) {
        console.error(`Error copying page ${preview.pageNumber} from ${file.name}:`, error);
      }
    }

    const pdfBytes = await mergedPdf.save();
    return toExactArrayBuffer(pdfBytes);
  };

  const buildName = (first?: string, last?: string) => `${first || ''} ${last || ''}`.trim();

  const dealData = useMemo(() => {
    if (contextType === 'deal' && selectedDeal) {
      return {
        address: selectedDeal.property?.street,
        city: selectedDeal.property?.city,
        state: selectedDeal.property?.state,
        zip: selectedDeal.property?.zip,
        county: selectedDeal.property?.county,
        mlsNumber: selectedDeal.property?.mlsId,
        taxId: selectedDeal.property?.taxId,
        purchasePrice: selectedDeal.repc?.purchasePrice,
        settlementDate: selectedDeal.repc?.settlementDeadline,
        dueDiligenceDeadline: selectedDeal.repc?.dueDiligenceDeadline,
        buyerName: buildName(selectedDeal.buyer?.firstName, selectedDeal.buyer?.lastName),
        buyerEmail: selectedDeal.buyer?.email,
        sellerName: buildName(selectedDeal.seller?.firstName, selectedDeal.seller?.lastName),
        sellerEmail: selectedDeal.seller?.email,
      };
    }

    if (contextType === 'client' && selectedClient) {
      const role = (selectedClient.role || '').toUpperCase();
      return {
        buyerName: role === 'SELLER' ? undefined : buildName(selectedClient.firstName, selectedClient.lastName),
        buyerEmail: role === 'SELLER' ? undefined : selectedClient.email,
        sellerName: role === 'SELLER' ? buildName(selectedClient.firstName, selectedClient.lastName) : undefined,
        sellerEmail: role === 'SELLER' ? selectedClient.email : undefined,
      };
    }

    if (contextType === 'lead' && selectedLead) {
      return {
        buyerName: buildName(selectedLead.firstName, selectedLead.lastName),
        buyerEmail: selectedLead.email,
      };
    }

    return {};
  }, [contextType, selectedDeal, selectedClient, selectedLead]);

  const buildDefaultSigners = (): EsignSigner[] => {
    if (contextType === 'deal' && selectedDeal) {
      return [
        {
          role: 'BUYER',
          name: buildName(selectedDeal.buyer?.firstName, selectedDeal.buyer?.lastName),
          email: selectedDeal.buyer?.email || '',
          included: true,
        },
        {
          role: 'SELLER',
          name: buildName(selectedDeal.seller?.firstName, selectedDeal.seller?.lastName),
          email: selectedDeal.seller?.email || '',
          included: true,
        },
        {
          role: 'AGENT',
          name: '',
          email: '',
          included: false,
        },
      ];
    }

    if (contextType === 'client' && selectedClient) {
      const role = (selectedClient.role || '').toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER';
      return [
        {
          role,
          name: buildName(selectedClient.firstName, selectedClient.lastName),
          email: selectedClient.email || '',
          included: true,
        },
      ];
    }

    if (contextType === 'lead' && selectedLead) {
      return [
        {
          role: 'BUYER',
          name: buildName(selectedLead.firstName, selectedLead.lastName),
          email: selectedLead.email || '',
          included: true,
        },
      ];
    }

    return [
      { role: 'BUYER', name: '', email: '', included: true },
    ];
  };

  const getSelectedPagesForFile = (fileId: string) =>
    pagePreviews
      .filter(p => p.fileId === fileId && selectedPages.has(`${p.fileId}-${p.pageNumber}`))
      .map(p => p.pageNumber);

  const getSelectedPageEntries = (): SelectedPageEntry[] =>
    pagePreviews
      .filter((preview) => selectedPages.has(`${preview.fileId}-${preview.pageNumber}`))
      .map((preview) => {
        const file = files.find((entry) => entry.id === preview.fileId);
        return file ? { file, preview } : null;
      })
      .filter((entry): entry is SelectedPageEntry => Boolean(entry));

  const getUnchangedSingleFileSelection = (entries: SelectedPageEntry[]) => {
    if (entries.length === 0) return null;

    const firstFile = entries[0].file;
    const isSingleFile = entries.every((entry) => entry.file.id === firstFile.id);
    if (!isSingleFile || entries.length !== firstFile.pageCount) return null;

    const isOriginalOrder = entries.every((entry, index) => entry.preview.pageNumber === index + 1);
    return isOriginalOrder ? firstFile : null;
  };

  const generatePdfForFile = async (file: PdfFile): Promise<ArrayBuffer> => {
    const selectedPageNumbers = getSelectedPagesForFile(file.id);
    const sourcePdf = await PDFDocument.load(file.data);
    const outPdf = await PDFDocument.create();

    for (const pageNumber of selectedPageNumbers) {
      const [copiedPage] = await outPdf.copyPages(sourcePdf, [pageNumber - 1]);
      outPdf.addPage(copiedPage);
    }

    const pdfBytes = await outPdf.save();
    return toExactArrayBuffer(pdfBytes);
  };

  const dataUrlToBytes = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  };

  const generateRasterizedPdfForEntries = async (entries: SelectedPageEntry[]): Promise<ArrayBuffer> => {
    const outputPdf = await PDFDocument.create();
    const pdfDocCache = new Map<string, pdfjsLib.PDFDocumentProxy>();

    const getPdfDoc = async (file: PdfFile) => {
      const cached = pdfDocCache.get(file.id);
      if (cached) return cached;

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(file.data.slice(0)),
        ...PDF_DOCUMENT_LOAD_OPTIONS,
      });
      const pdfDoc = await loadingTask.promise;
      pdfDocCache.set(file.id, pdfDoc);
      return pdfDoc;
    };

    try {
      for (const entry of entries) {
        const pdfDoc = await getPdfDoc(entry.file);
        const page = await pdfDoc.getPage(entry.preview.pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const rendered = await renderPdfPageToImage(page, {
          maxWidth: Math.max(baseViewport.width * 2, 1224),
          maxHeight: Math.max(baseViewport.height * 2, 1584),
          outputScale: 1,
          imageType: 'image/jpeg',
          imageQuality: 0.94,
          throwOnBlank: false,
        });
        const image = await outputPdf.embedJpg(dataUrlToBytes(rendered.imageSrc));
        const outputPage = outputPdf.addPage([rendered.baseWidth, rendered.baseHeight]);
        outputPage.drawImage(image, {
          x: 0,
          y: 0,
          width: rendered.baseWidth,
          height: rendered.baseHeight,
        });
      }

      const pdfBytes = await outputPdf.save();
      return toExactArrayBuffer(pdfBytes);
    } finally {
      await Promise.all(Array.from(pdfDocCache.values()).map((pdfDoc) => pdfDoc.destroy()));
    }
  };

  const verifyEsignPdfCandidate = async (
    pdfBuffer: ArrayBuffer,
    label: string,
    expectedPageCount: number,
  ) => {
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

    try {
      loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer.slice(0)),
        ...PDF_DOCUMENT_LOAD_OPTIONS,
      });
      pdfDoc = await loadingTask.promise;
      const actualPageCount = pdfDoc.numPages;

      if (actualPageCount !== expectedPageCount) {
        console.warn(
          `E-sign PDF candidate "${label}" has ${actualPageCount} page(s), expected ${expectedPageCount}. Trying the next preparation strategy.`,
        );
        return { ready: false, pageCount: actualPageCount };
      }

      const pagesToCheck = Math.min(actualPageCount, 3);
      let hasVisiblePage = false;

      for (let pageNumber = 1; pageNumber <= pagesToCheck; pageNumber += 1) {
        try {
          const page = await pdfDoc.getPage(pageNumber);
          await renderPdfPageToImage(page, {
            maxWidth: 360,
            outputScale: 1,
            imageType: 'image/jpeg',
            imageQuality: 0.72,
            throwOnBlank: true,
          });
          hasVisiblePage = true;
          break;
        } catch (error) {
          console.warn(`E-sign PDF visibility check could not render ${label} page ${pageNumber}:`, error);
        }
      }

      return { ready: hasVisiblePage, pageCount: actualPageCount };
    } catch (error) {
      console.warn(`E-sign PDF visibility check failed for ${label}:`, error);
      return { ready: false, pageCount: 0 };
    } finally {
      await pdfDoc?.destroy();
      loadingTask?.destroy();
    }
  };

  const generateEsignPdf = async (): Promise<PreparedEsignPdf> => {
    const entries = getSelectedPageEntries();
    const expectedPageCount = entries.length;
    if (expectedPageCount === 0) {
      throw new Error('Select at least one page before preparing an e-sign packet.');
    }

    const unchangedFile = getUnchangedSingleFileSelection(entries);

    if (unchangedFile) {
      const originalBytes = unchangedFile.data.slice(0);
      const check = await verifyEsignPdfCandidate(originalBytes, 'original upload', expectedPageCount);
      if (check.ready) {
        return { data: originalBytes, pageCount: check.pageCount, source: 'original' };
      }
    }

    try {
      const copiedBytes = await generateMergedPdf();
      const check = await verifyEsignPdfCandidate(copiedBytes, 'merged copy', expectedPageCount);
      if (check.ready) {
        return { data: copiedBytes, pageCount: check.pageCount, source: 'merged' };
      }
    } catch (error) {
      console.warn('E-sign merged-copy preparation failed; trying rasterized packet:', error);
    }

    const rasterizedBytes = await generateRasterizedPdfForEntries(entries);
    const rasterizedCheck = await verifyEsignPdfCandidate(rasterizedBytes, 'rasterized packet', expectedPageCount);
    if (rasterizedCheck.ready) {
      return { data: rasterizedBytes, pageCount: rasterizedCheck.pageCount, source: 'rasterized' };
    }

    throw new Error(`The selected PDF pages could not be prepared with all ${expectedPageCount} page(s). Try re-uploading a freshly downloaded or flattened PDF.`);
  };

  const createPreviewUrl = async () => {
    const pdfBuffer = await generateMergedPdf();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  };

  const createPreviewDocument = async () => {
    const preparedPdf = await generateEsignPdf();
    const blob = new Blob([preparedPdf.data], { type: 'application/pdf' });
    return {
      data: preparedPdf.data.slice(0),
      url: URL.createObjectURL(blob),
      pageCount: preparedPdf.pageCount,
      source: preparedPdf.source,
    };
  };

  const handlePreview = async () => {
    if (selectedPages.size === 0) {
      showToast('error', 'Select at least one page to preview');
      return;
    }

    setProcessing(true);
    try {
      const url = await createPreviewUrl();

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(url);
      setActiveTab('preview');
    } catch (error) {
      console.error('Error generating preview:', error);
      showToast('error', 'Failed to generate preview');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (selectedPages.size === 0) {
      showToast('error', 'Select at least one page to download');
      return;
    }

    setProcessing(true);
    try {
      const pdfBuffer = await generateMergedPdf();
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${outputName || 'document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      showToast('success', `Downloaded ${outputName}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('error', 'Failed to download PDF');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenEsign = async () => {
    if (selectedPages.size === 0) {
      showToast('error', 'Select at least one page to prepare for e-sign');
      return;
    }

    setProcessing(true);
    try {
      const previewDocument = await createPreviewDocument();
      if (esignPreviewUrl) {
        URL.revokeObjectURL(esignPreviewUrl);
      }
      setEsignPreviewUrl(previewDocument.url);
      setEsignPreviewData(previewDocument.data);
      setEsignPreviewPageCount(previewDocument.pageCount);
      setEsignSigners(buildDefaultSigners());
      setEsignSubject(`Please sign: ${contextLabel}`);
      setEsignMessage('Please review and sign the attached document.');
      setEsignFieldPlacements([]);
      setEsignEnvelopeId(null);
      setEsignSentAt(null);
      setEsignCanResend(false);
      setEsignDeliveryStatus(null);
      setEsignCelebrating(false);
      setEsignLinks(null);
      if (esignResendTimerRef.current) {
        clearTimeout(esignResendTimerRef.current);
        esignResendTimerRef.current = null;
      }
      if (esignCelebrateTimerRef.current) {
        clearTimeout(esignCelebrateTimerRef.current);
        esignCelebrateTimerRef.current = null;
      }
      setEsignStep('recipients');
      setShowEsign(true);
      showToast('success', `E-sign studio prepared ${previewDocument.pageCount} page${previewDocument.pageCount === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Error preparing e-sign preview:', error);
      showToast('error', 'Failed to prepare e-sign preview');
    } finally {
      setProcessing(false);
    }
  };

  const closeEsign = () => {
    setShowEsign(false);
    setEsignStep('recipients');
    setEsignPreviewPageCount(0);
    if (esignPreviewUrl) {
      URL.revokeObjectURL(esignPreviewUrl);
    }
    setEsignPreviewUrl(null);
    setEsignPreviewData(null);
    setEsignEnvelopeId(null);
    setEsignSentAt(null);
    setEsignCanResend(false);
    setEsignDeliveryStatus(null);
    setEsignCelebrating(false);
    setEsignLinks(null);
    if (esignResendTimerRef.current) {
      clearTimeout(esignResendTimerRef.current);
      esignResendTimerRef.current = null;
    }
    if (esignCelebrateTimerRef.current) {
      clearTimeout(esignCelebrateTimerRef.current);
      esignCelebrateTimerRef.current = null;
    }
  };

  const updateEsignSigner = (index: number, field: keyof EsignSigner, value: string | boolean) => {
    setEsignSigners((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as EsignSigner;
      return next;
    });
  };

  const addEsignSigner = () => {
    setEsignSigners((prev) => [...prev, { role: 'OTHER', name: '', email: '', included: true }]);
  };

  const removeEsignSigner = (index: number) => {
    setEsignSigners((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSendEsign = async (fieldPlacements = esignFieldPlacements) => {
    const included = esignSigners.filter(s => s.included);
    if (included.length === 0) {
      showToast('error', 'Add at least one signer before sending.');
      return;
    }

    if (included.some((signer) => !signer.name.trim())) {
      showToast('error', 'Add a name for every included signer before sending.');
      return;
    }

    if (included.some((signer) => signer.email.trim() && !isValidEmailAddress(signer.email))) {
      showToast('error', 'Fix any invalid email addresses, or leave them blank to share the signing link manually.');
      return;
    }

    if (!esignSubject.trim() || !esignMessage.trim()) {
      showToast('error', 'Add a subject and message before sending.');
      return;
    }

    setEsignSending(true);
    try {
      setEsignFieldPlacements(fieldPlacements);
      const preparedPdf = await generateEsignPdf();
      const pdfBuffer = preparedPdf.data;
      setEsignPreviewPageCount(preparedPdf.pageCount);
      const documentName = (outputName || contextLabel || 'document').trim() || 'document';
      const safeDocumentBaseName = documentName
        .replace(/\.pdf$/i, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .trim() || 'document';
      const fileName = `${safeDocumentBaseName}.pdf`;
      const formData = new FormData();
      formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName);
      formData.append('documentName', documentName);
      formData.append('contextType', contextType);
      formData.append('contextLabel', contextLabel);
      if (contextType === 'deal' && selectedDeal?.id) {
        formData.append('dealId', selectedDeal.id);
      }
      formData.append('signers', JSON.stringify(included.map(s => ({ role: s.role, name: s.name.trim(), email: s.email.trim() }))));
      formData.append('subject', esignSubject);
      formData.append('message', esignMessage);
      formData.append('sendEmails', String(included.some((signer) => Boolean(signer.email.trim()))));
      formData.append('fields', JSON.stringify(fieldPlacements));

      const res = await api.post('/esign/document-envelopes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const createdEnvelopeId = res.data?.envelope?.id as string | undefined;
      if (createdEnvelopeId) {
        setEsignEnvelopeId(createdEnvelopeId);
      }
      setEsignDeliveryStatus({
        sent: Number(res.data?.emailStatus?.sent || 0),
        failed: Number(res.data?.emailStatus?.failed || 0),
        skipped: Number(res.data?.emailStatus?.skipped || 0),
        label: 'Initial send',
      });
      const initialSent = Number(res.data?.emailStatus?.sent || 0);
      const initialFailed = Number(res.data?.emailStatus?.failed || 0);
      if (initialSent > 0 && initialFailed === 0) {
        setEsignCelebrating(true);
        if (esignCelebrateTimerRef.current) {
          clearTimeout(esignCelebrateTimerRef.current);
        }
        esignCelebrateTimerRef.current = setTimeout(() => {
          setEsignCelebrating(false);
        }, 2400);
      }
      setEsignSentAt(new Date().toISOString());
      setEsignCanResend(false);
      if (esignResendTimerRef.current) {
        clearTimeout(esignResendTimerRef.current);
      }
      esignResendTimerRef.current = setTimeout(() => {
        setEsignCanResend(true);
      }, 15000);

      setEsignLinks(res.data?.links || null);
      const feedback = buildEnvelopeSendToast(res.data?.emailStatus);
      showToast(feedback.type, feedback.message);
      setEsignStep('recipients');
    } catch (error: any) {
      console.error('Failed to send for signature:', error);
      const apiMessage = error?.response?.data?.error as string | undefined;
      showToast('error', apiMessage || 'Failed to send document for signature');
    } finally {
      setEsignSending(false);
    }
  };

  const handleResendEsign = async () => {
    if (!esignEnvelopeId) {
      showToast('error', 'Envelope not ready to resend yet');
      return;
    }

    setEsignResending(true);
    try {
      const res = await api.post(`/esign/envelopes/${esignEnvelopeId}/remind`);
      const sent = Number(res.data?.emailStatus?.sent || 0);
      const failed = Number(res.data?.emailStatus?.failed || 0);
      const skipped = Number(res.data?.emailStatus?.skipped || 0);
      if (sent > 0 && failed === 0 && skipped === 0) {
        showToast('success', `Reminder sent to ${sent} signer${sent > 1 ? 's' : ''}`);
      } else if (sent > 0 && failed === 0 && skipped > 0) {
        showToast('success', `Reminder sent to ${sent} signer${sent > 1 ? 's' : ''}. ${skipped} still need manual link sharing.`);
      } else if (sent > 0 && failed > 0) {
        showToast('error', `Reminder sent to ${sent}, but ${failed} failed`);
      } else if (skipped > 0) {
        showToast('warning', `${skipped} pending signer${skipped > 1 ? 's still need' : ' still needs'} manual link sharing. No emails were sent.`);
      } else {
        showToast('error', 'No pending signer reminders were sent');
      }

      setEsignDeliveryStatus({ sent, failed, skipped, label: 'Last resend' });
      if (sent > 0 && failed === 0) {
        setEsignCelebrating(true);
        if (esignCelebrateTimerRef.current) {
          clearTimeout(esignCelebrateTimerRef.current);
        }
        esignCelebrateTimerRef.current = setTimeout(() => {
          setEsignCelebrating(false);
        }, 2400);
      }

      setEsignSentAt(new Date().toISOString());
      setEsignCanResend(false);
      if (esignResendTimerRef.current) {
        clearTimeout(esignResendTimerRef.current);
      }
      esignResendTimerRef.current = setTimeout(() => {
        setEsignCanResend(true);
      }, 15000);
    } catch (error: any) {
      console.error('Failed to resend signature reminder:', error);
      showToast('error', error?.response?.data?.error || 'Failed to resend reminder');
    } finally {
      setEsignResending(false);
    }
  };

  const handleDownloadSplit = async () => {
    if (selectedPages.size === 0) {
      showToast('error', 'Select at least one page to download');
      return;
    }

    setProcessing(true);
    try {
      for (const file of files) {
        const selectedForFile = getSelectedPagesForFile(file.id);
        if (selectedForFile.length === 0) continue;

        const pdfBuffer = await generatePdfForFile(file);
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${file.name || 'document'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      showToast('success', 'Downloaded split PDFs');
    } catch (error) {
      console.error('Error downloading split PDFs:', error);
      showToast('error', 'Failed to download split PDFs');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadBundle = async () => {
    if (selectedPages.size === 0) {
      showToast('error', 'Select at least one page to download');
      return;
    }

    setExporting(true);
    try {
      const zip = new JSZip();
      const folderName = `${bundleTarget}${bundleRef ? `-${bundleRef}` : ''}`;
      const root = folderName ? zip.folder(folderName) : zip;
      if (!root) return;

      const mergedBuffer = await generateMergedPdf();
      root.file(`${outputName || 'merged-document'}.pdf`, mergedBuffer);

      for (const file of files) {
        const selectedForFile = getSelectedPagesForFile(file.id);
        if (selectedForFile.length === 0) continue;
        const pdfBuffer = await generatePdfForFile(file);
        root.file(`${file.name || 'document'}.pdf`, pdfBuffer);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${bundleName || 'contract-packet'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('success', 'Downloaded bundle zip');
    } catch (error) {
      console.error('Error downloading bundle:', error);
      showToast('error', 'Failed to download bundle');
    } finally {
      setExporting(false);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (esignResendTimerRef.current) {
        clearTimeout(esignResendTimerRef.current);
        esignResendTimerRef.current = null;
      }
      if (esignCelebrateTimerRef.current) {
        clearTimeout(esignCelebrateTimerRef.current);
        esignCelebrateTimerRef.current = null;
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (esignPreviewUrl) {
        URL.revokeObjectURL(esignPreviewUrl);
      }
    };
  }, [esignPreviewUrl]);

  const openUploadPicker = () => {
    setActiveTab('upload');
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const totalPages = pagePreviews.length;
  const selectedCount = selectedPages.size;
  const selectedOrderMap = useMemo(() => {
    const orderMap = new Map<string, number>();
    let index = 1;
    pagePreviews.forEach((preview) => {
      const key = `${preview.fileId}-${preview.pageNumber}`;
      if (selectedPages.has(key)) {
        orderMap.set(key, index);
        index += 1;
      }
    });
    return orderMap;
  }, [pagePreviews, selectedPages]);
  const includedEsignSigners = esignSigners.filter(s => s.included);
  const readyEsignSigners = includedEsignSigners.filter(s => s.name.trim() && (!s.email.trim() || isValidEmailAddress(s.email)));
  const emailedEsignSigners = includedEsignSigners.filter(s => s.name.trim() && s.email.trim() && isValidEmailAddress(s.email));
  const linkOnlyEsignSigners = includedEsignSigners.filter(s => s.name.trim() && !s.email.trim());
  const invalidEsignEmailCount = includedEsignSigners.filter((s) => s.email.trim() && !isValidEmailAddress(s.email)).length;
  const missingEsignNameCount = includedEsignSigners.filter((s) => !s.name.trim()).length;
  const canProceedEsign = includedEsignSigners.length > 0 && missingEsignNameCount === 0 && invalidEsignEmailCount === 0;
  const hasEsignMessage = Boolean(esignSubject.trim() && esignMessage.trim());
  const canSendEsign = canProceedEsign && hasEsignMessage;
  const isEsignSent = Boolean(esignEnvelopeId);
  const sendEsignActionLabel = emailedEsignSigners.length > 0 ? 'Send for Signature' : 'Create Signing Links';
  const esignChecklist = [
    { label: 'PDF pages selected', done: selectedCount > 0 },
    { label: 'Signer names ready', done: canProceedEsign },
    { label: 'Fields placed (optional)', done: esignFieldPlacements.length > 0 },
    { label: 'Subject and message ready', done: hasEsignMessage },
    { label: emailedEsignSigners.length > 0 ? 'Email delivery ready' : 'Secure links ready', done: canProceedEsign },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-500/90 text-white'
            : toast.type === 'warning'
              ? 'bg-amber-500/90 text-slate-950'
              : 'bg-red-500/90 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : toast.type === 'warning' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86l-7.5 13A1 1 0 003.66 18h16.68a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <PageHeader
        title="PDF & Packet Builder"
        subtitle="Merge PDFs, build contract packets, and send for e-sign from one simple workspace."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/contracts')}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Contracts
            </Button>
          </div>
        }
      />

      <Card className="p-4 sm:p-5 border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            {
              id: 'merge' as WorkflowIntent,
              title: 'Clean up PDFs',
              detail: 'Upload, select pages, reorder, merge, and download.',
              action: files.length > 0 ? 'Manage pages' : 'Upload PDFs',
              onClick: () => {
                setWorkflowIntent('merge');
                if (files.length === 0) {
                  openUploadPicker();
                } else {
                  setActiveTab('upload');
                }
              },
            },
            {
              id: 'packet' as WorkflowIntent,
              title: 'Build packet',
              detail: 'Name a bundle for a deal, client, or lead.',
              action: files.length > 0 ? 'Package files' : 'Start packet',
              onClick: () => {
                setWorkflowIntent('packet');
                if (files.length === 0) {
                  openUploadPicker();
                } else {
                  setActiveTab('upload');
                }
              },
            },
            {
              id: 'esign' as WorkflowIntent,
              title: 'Send e-sign',
              detail: 'Autofill recipients, place fields, and send links or emails.',
              action: selectedCount > 0 ? 'Open studio' : 'Upload first',
              onClick: () => {
                setWorkflowIntent('esign');
                if (selectedCount > 0) {
                  void handleOpenEsign();
                } else {
                  openUploadPicker();
                }
              },
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`rounded-2xl border p-4 text-left transition-all ${
                workflowIntent === item.id
                  ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-500/10'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{item.detail}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                  item.id === 'esign'
                    ? 'contract-esign-studio-pill'
                    : workflowIntent === item.id
                      ? 'border-emerald-300 bg-white text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-300 bg-white text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300'
                }`}>
                  {item.action}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-5 border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 shadow-sm dark:border-white/10 dark:bg-gradient-to-br dark:from-slate-950/80 dark:via-slate-900/80 dark:to-emerald-950/70">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300/70">Contract Context</div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-950 mt-1 dark:text-white">Attach context once, reuse it everywhere</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 dark:text-slate-400">Use deal, client, or lead details for signer defaults, smart fields, packet naming, and deal history.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setWorkflowIntent('esign');
                void handleOpenEsign();
              }}
              disabled={processing || selectedCount === 0}
              className="contract-esign-studio-button whitespace-nowrap"
            >
              Open E-sign Studio
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/contracts')}
              className="whitespace-nowrap"
            >
              View Contracts Hub
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1 dark:text-slate-400">Attach To</label>
                <select
                  value={contextType}
                  onChange={(event) => setContextType(event.target.value as 'deal' | 'client' | 'lead' | 'new')}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-slate-950/60 dark:border-white/10 dark:text-white"
                >
                  <option value="deal">Deal</option>
                  <option value="client">Client</option>
                  <option value="lead">Lead</option>
                  <option value="new">Standalone</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-600 block mb-1 dark:text-slate-400">Search</label>
                <input
                  type="text"
                  value={contextSearch}
                  onChange={(event) => setContextSearch(event.target.value)}
                  placeholder="Type a name, address, or email"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-slate-950/60 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            {contextType === 'deal' && (
              <div>
                <label className="text-xs text-slate-600 block mb-1 dark:text-slate-400">Select Deal</label>
                <select
                  value={selectedDealId}
                  onChange={(event) => setSelectedDealId(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-slate-950/60 dark:border-white/10 dark:text-white"
                >
                  <option value="">Select a deal</option>
                  {filteredDeals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.property?.street || deal.title || 'Untitled Deal'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {contextType === 'client' && (
              <div>
                <label className="text-xs text-slate-600 block mb-1 dark:text-slate-400">Select Client</label>
                <select
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-slate-950/60 dark:border-white/10 dark:text-white"
                >
                  <option value="">Select a client</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {buildName(client.firstName, client.lastName) || client.email || 'Unnamed Client'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {contextType === 'lead' && (
              <div>
                <label className="text-xs text-slate-600 block mb-1 dark:text-slate-400">Select Lead</label>
                <select
                  value={selectedLeadId}
                  onChange={(event) => setSelectedLeadId(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-slate-950/60 dark:border-white/10 dark:text-white"
                >
                  <option value="">Select a lead</option>
                  {filteredLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {buildName(lead.firstName, lead.lastName) || lead.email || 'Unnamed Lead'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {contextType === 'new' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/deals/new')}
                  className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors text-sm dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20"
                >
                  New Deal
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/clients')}
                  className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors text-sm dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20 dark:hover:bg-blue-500/20"
                >
                  New Client
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/leads')}
                  className="px-3 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors text-sm dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20 dark:hover:bg-purple-500/20"
                >
                  New Lead
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60 dark:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected</p>
                <p className="text-sm font-semibold text-slate-950 mt-1 dark:text-white">{contextLabel}</p>
                <p className="text-xs text-slate-600 mt-1 dark:text-slate-400">{contextSubtitle || 'No details yet'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Autofill</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{contextType === 'new' ? 'Off' : 'On'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Lists loaded</span>
                <span>{loadingContext ? 'Loading...' : `${deals.length} deals, ${clients.length} clients, ${leads.length} leads`}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>E-sign status</span>
                <span>{selectedCount > 0 ? 'Ready for document e-sign' : 'Upload a PDF first'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500 dark:bg-blue-500/20 dark:text-blue-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Documents & Pages
        </button>
        <button
          onClick={() => previewUrl && setActiveTab('preview')}
          disabled={!previewUrl}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === 'preview'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500 dark:bg-blue-500/20 dark:text-blue-300'
              : previewUrl
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5'
              : 'text-slate-400 cursor-not-allowed dark:text-slate-600'
          }`}
        >
          <svg className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Upload & File List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Upload Area */}
            <Card className="p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full border-2 border-dashed border-white/20 hover:border-blue-500/50 rounded-xl p-8 text-center transition-all group"
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    <span className="text-sm text-slate-400">Loading PDFs...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white">Upload PDFs</span>
                      <p className="text-xs text-slate-400 mt-1">Click or drag files here</p>
                    </div>
                  </div>
                )}
              </button>
            </Card>

            {/* File List */}
            {files.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Uploaded Documents</h3>
                  <span className="text-xs text-slate-400">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {files.map((file, index) => {
                    const filePages = pagePreviews.filter(p => p.fileId === file.id);
                    const fileSelectedCount = filePages.filter(p => selectedPages.has(`${p.fileId}-${p.pageNumber}`)).length;
                    
                    return (
                      <div key={file.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <input
                                type="text"
                                value={file.name}
                                onChange={(event) => {
                                  const nextName = event.target.value;
                                  setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name: nextName } : f));
                                }}
                                className="w-full bg-transparent border border-white/10 rounded-md px-2 py-1 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                placeholder="Document name"
                              />
                              <p className="text-xs text-slate-400">
                                {fileSelectedCount}/{filePages.length} pages selected
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => removeFile(file.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Remove file"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => selectAllPages(file.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Select all
                          </button>
                          <span className="text-slate-600">|</span>
                          <button
                            onClick={() => deselectAllPages(file.id)}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Deselect all
                          </button>
                          <span className="text-slate-600">|</span>
                          <button
                            onClick={() => {
                              const target = files.find(f => f.id === file.id);
                              if (!target) return;
                              setProcessing(true);
                              generatePdfForFile(target)
                                .then((pdfBuffer) => {
                                  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
                                  const url = URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = `${target.name || 'document'}.pdf`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(url);
                                  showToast('success', `Downloaded ${target.name}.pdf`);
                                })
                                .catch((error) => {
                                  console.error('Error downloading file PDF:', error);
                                  showToast('error', 'Failed to download file PDF');
                                })
                                .finally(() => setProcessing(false));
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            Download file
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Output Settings */}
            {files.length > 0 && (
              <Card className="p-4 space-y-4">
                <h3 className="text-sm font-semibold text-white">Output Settings</h3>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Document Name</label>
                  <input
                    type="text"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="Enter document name"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                  <p className="text-xs text-slate-500 mt-1">{outputName}.pdf</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={handlePreview}
                    disabled={processing || selectedCount === 0}
                    className="w-full"
                  >
                    {processing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Preview
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleDownload}
                    disabled={processing || selectedCount === 0}
                    className="w-full"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleDownloadSplit}
                    disabled={processing || selectedCount === 0}
                    className="w-full"
                  >
                    Split Download
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleDownloadBundle}
                    disabled={exporting || selectedCount === 0}
                    className="w-full"
                  >
                    {exporting ? 'Packaging...' : 'Download Bundle'}
                  </Button>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Bundle Name</label>
                    <input
                      type="text"
                      value={bundleName}
                      onChange={(event) => setBundleName(event.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Assign to</label>
                      <select
                        value={bundleTarget}
                        onChange={(event) => setBundleTarget(event.target.value as 'deal' | 'client' | 'lead')}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      >
                        <option value="deal">Deal</option>
                        <option value="client">Client</option>
                        <option value="lead">Lead</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Reference</label>
                      <input
                        type="text"
                        value={bundleRef}
                        onChange={(event) => setBundleRef(event.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Bundle folders will be named like {bundleTarget}-{bundleRef || 'reference'}.</p>
                </div>
              </Card>
            )}
          </div>

          {/* Right Panel - Page Grid */}
          <div className="lg:col-span-2">
            {files.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No PDFs uploaded yet</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Upload one or more PDF files to start editing. You can merge multiple documents, select specific pages, and download the result.
                </p>
              </Card>
            ) : (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">All Pages</h3>
                    <p className="text-xs text-slate-400">{selectedCount} of {totalPages} pages selected</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectAllPages()}
                      className="px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => deselectAllPages()}
                      className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {pagePreviews.map((preview, index) => {
                    const file = files.find(f => f.id === preview.fileId);
                    const isSelected = selectedPages.has(`${preview.fileId}-${preview.pageNumber}`);
                    
                    return (
                      <button
                        key={`${preview.fileId}-${preview.pageNumber}`}
                        onClick={() => togglePageSelection(preview.fileId, preview.pageNumber)}
                        className={`relative aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden group ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                            : 'border-white/10 bg-slate-900/50 hover:border-white/30'
                        }`}
                      >
                        {preview.thumbnail ? (
                          <img
                            src={preview.thumbnail}
                            alt={`Page ${preview.pageNumber}`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`text-4xl font-bold ${isSelected ? 'text-blue-400/50' : 'text-slate-700'}`}>
                              {preview.pageNumber}
                            </div>
                          </div>
                        )}
                        
                        {/* Selection indicator */}
                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-transparent border-white/30 group-hover:border-white/50'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        
                        {/* Page info footer */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                          <p className="text-[10px] text-white/80 truncate">{file?.name}</p>
                          <p className="text-[9px] text-slate-400">Page {preview.pageNumber}</p>
                        </div>

                        {/* Order indicator for selected pages */}
                        {isSelected && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">
                              {selectedOrderMap.get(`${preview.fileId}-${preview.pageNumber}`)}
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-10 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (index > 0) {
                                movePage(index, index - 1);
                              }
                            }}
                            className="w-6 h-6 rounded bg-black/60 text-white text-xs hover:bg-black/80"
                            title="Move up"
                          >
                            <svg className="mx-auto h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (index < pagePreviews.length - 1) {
                                movePage(index, index + 1);
                              }
                            }}
                            className="w-6 h-6 rounded bg-black/60 text-white text-xs hover:bg-black/80"
                            title="Move down"
                          >
                            <svg className="mx-auto h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removePage(preview.fileId, preview.pageNumber);
                            }}
                            className="w-6 h-6 rounded bg-red-500/80 text-white text-xs hover:bg-red-500"
                            title="Remove page"
                          >
                            <svg className="mx-auto h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {pagePreviews.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-300/80">
                      <strong>Tip:</strong> Click on pages to select/deselect them. Selected pages will be included in the final document in the order shown.
                    </p>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'preview' && previewUrl && (
        <Card className="p-0 overflow-hidden">
          <div className="h-[calc(100vh-200px)] min-h-[600px]">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>
        </Card>
      )}

      {showEsign && esignStep === 'recipients' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-slate-900/40 to-blue-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">E-sign Studio</p>
                <h3 className="text-xl sm:text-2xl font-semibold text-white">Recipients & Message</h3>
                <p className="text-xs text-slate-400 mt-1">{contextLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEsign}
                  className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setEsignStep('preview')}
                  disabled={!canProceedEsign}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  Review & Place Fields
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Recipients</h4>
                  <button
                    onClick={addEsignSigner}
                    className="text-xs text-emerald-300 hover:text-emerald-200"
                  >
                    + Add recipient
                  </button>
                </div>

                <div className="space-y-3">
                  {esignSigners.map((signer, index) => (
                    <div key={`${signer.role}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateEsignSigner(index, 'included', !signer.included)}
                            className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                              signer.included ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'
                            }`}
                          >
                            {signer.included && (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <select
                            value={signer.role}
                            onChange={(event) => updateEsignSigner(index, 'role', event.target.value as EsignRole)}
                            className="text-xs font-semibold uppercase tracking-wide bg-slate-950/70 border border-white/10 rounded px-2 py-1 text-slate-200"
                          >
                            <option value="BUYER">Buyer</option>
                            <option value="SELLER">Seller</option>
                            <option value="AGENT">Agent</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        {esignSigners.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEsignSigner(index)}
                            className="text-xs text-slate-400 hover:text-red-400"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={signer.name}
                          onChange={(event) => updateEsignSigner(index, 'name', event.target.value)}
                          placeholder="Full name"
                          disabled={!signer.included}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60"
                        />
                        <input
                          type="email"
                          value={signer.email}
                          onChange={(event) => updateEsignSigner(index, 'email', event.target.value)}
                          placeholder="Email address (optional)"
                          disabled={!signer.included}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60"
                        />
                      </div>
                      {signer.included && (
                        <div className="mt-2 text-[11px]">
                          {signer.name.trim() && signer.email.trim() && isValidEmailAddress(signer.email) ? (
                            <span className="text-emerald-300">Ready to email this signer automatically.</span>
                          ) : signer.name.trim() && !signer.email.trim() ? (
                            <span className="text-cyan-300">Link only. We will generate a secure signing link you can copy and share manually.</span>
                          ) : signer.email.trim() && !isValidEmailAddress(signer.email) ? (
                            <span className="text-rose-300">Fix the email address or clear it to use manual link sharing.</span>
                          ) : (
                            <span className="text-amber-200">Add the signer&apos;s name to continue.</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {contextType === 'deal' && selectedDeal
                    ? 'Deal attached: the uploaded PDF will be sent as its own e-sign packet and logged to this deal.'
                    : 'No deal required. Add an email to send automatically, or leave it blank to create secure signing links you can copy.'}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={esignSubject}
                    onChange={(event) => setEsignSubject(event.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Message</label>
                  <textarea
                    value={esignMessage}
                    onChange={(event) => setEsignMessage(event.target.value)}
                    className="w-full h-36 px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="mb-4 space-y-2">
                    {esignChecklist.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-300">{item.label}</span>
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                          item.done
                            ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-500/40 bg-white/5 text-slate-500'
                        }`}>
                          {item.done ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Recipients ready</span>
                    <span>{readyEsignSigners.length}/{includedEsignSigners.length}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {emailedEsignSigners.length > 0 && <span>{emailedEsignSigners.length} email</span>}
                    {emailedEsignSigners.length > 0 && linkOnlyEsignSigners.length > 0 && <span> - </span>}
                    {linkOnlyEsignSigners.length > 0 && <span>{linkOnlyEsignSigners.length} link only</span>}
                    {missingEsignNameCount > 0 && <span className="text-amber-300"> - {missingEsignNameCount} need name</span>}
                    {invalidEsignEmailCount > 0 && <span className="text-rose-300"> - {invalidEsignEmailCount} invalid email</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleSendEsign()}
                      disabled={!canSendEsign || esignSending || isEsignSent}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                        isEsignSent
                          ? 'bg-emerald-500/80 text-white'
                          : 'bg-emerald-500 text-white hover:bg-emerald-400'
                      }`}
                    >
                      {esignSending ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Sending...
                        </span>
                      ) : isEsignSent ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Sent
                        </span>
                      ) : (
                        sendEsignActionLabel
                      )}
                    </button>
                    <button
                      onClick={() => setEsignStep('preview')}
                      disabled={!canProceedEsign || esignSending}
                      className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      Preview
                    </button>
                  </div>
                  {isEsignSent && (
                    <div className="mt-2 rounded-lg border border-emerald-400/20 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 px-3 py-2.5 space-y-2 relative overflow-hidden">
                      {esignCelebrating && (
                        <>
                          <span className="pointer-events-none absolute -top-2 left-6 h-2 w-2 rounded-full bg-emerald-300/80 animate-ping" />
                          <span className="pointer-events-none absolute top-2 right-10 h-1.5 w-1.5 rounded-full bg-cyan-300/80 animate-ping" style={{ animationDelay: '150ms' }} />
                          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-2 w-2 rounded-full bg-blue-300/70 animate-ping" style={{ animationDelay: '280ms' }} />
                        </>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-emerald-100 font-medium">
                          {(esignDeliveryStatus?.sent ?? 0) > 0 ? 'Envelope sent' : 'Signing links ready'}{esignSentAt ? ` - ${new Date(esignSentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                        </div>
                        <button
                          type="button"
                          onClick={handleResendEsign}
                          disabled={!esignCanResend || esignResending || esignSending}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-emerald-300/30 text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-50"
                        >
                          {esignResending ? 'Resending...' : esignCanResend ? 'Resend' : 'Resend shortly'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="rounded-full border border-emerald-300/25 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">
                          Sent: {esignDeliveryStatus?.sent ?? 0}
                        </span>
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/20 px-2 py-0.5 text-cyan-100">
                          Links: {esignDeliveryStatus?.skipped ?? 0}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 ${
                          (esignDeliveryStatus?.failed ?? 0) > 0
                            ? 'border-amber-300/30 bg-amber-500/20 text-amber-100'
                            : 'border-slate-300/20 bg-white/10 text-slate-300'
                        }`}>
                          Failed: {esignDeliveryStatus?.failed ?? 0}
                        </span>
                        {esignDeliveryStatus?.label && (
                          <span className="text-slate-300/80">{esignDeliveryStatus.label}</span>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">Field layout saved: {esignFieldPlacements.length}</p>
                  <p className="mt-2 text-[11px] text-slate-500">This sends the uploaded PDF exactly as arranged here, including your placed signer fields.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEsign && esignStep === 'preview' && esignPreviewUrl && (
        <div className="fixed inset-0 z-[210] bg-slate-950">
          <PdfAnnotator
            pdfUrl={esignPreviewUrl}
            pdfData={esignPreviewData}
            expectedPageCount={esignPreviewPageCount || selectedPages.size}
            signers={includedEsignSigners.map(s => ({ role: s.role, name: s.name, email: s.email }))}
            dealData={dealData}
            onSave={(annotations) => {
              setEsignFieldPlacements(annotations);
              showToast('success', `Saved ${annotations.length} field${annotations.length === 1 ? '' : 's'} for this envelope`);
            }}
            onCancel={() => setEsignStep('recipients')}
            onSend={canSendEsign && !isEsignSent ? handleSendEsign : undefined}
            sending={esignSending}
          />
        </div>
      )}

      {esignLinks && esignLinks.length > 0 && (
        <CopyLinksModal links={esignLinks} onClose={() => setEsignLinks(null)} />
      )}
    </div>
  );
}

function CopyLinksModal({
  links,
  onClose,
}: {
  links: EnvelopeLink[];
  onClose: () => void;
}) {
  const allLinks = links.map((link) => link.url).join('\n');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Signing links ready</h2>
            <p className="text-xs text-slate-400 mt-1">{getEnvelopeLinkSubtitle(links)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            X
          </button>
        </div>

        <div className="p-6 space-y-3">
          {links.map((link, index) => (
            <div key={link.signerId} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="sm:w-44 min-w-0">
                <div className="text-xs font-semibold text-slate-100 truncate">{getEnvelopeLinkPrimaryLabel(link, index)}</div>
                <div className="text-[11px] text-slate-400 truncate">{getEnvelopeLinkDeliveryLabel(link)}</div>
              </div>
              <div className="flex-1 text-xs text-slate-200 break-all">{link.url}</div>
              <button
                type="button"
                onClick={() => handleCopy(link.url)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-slate-200 hover:bg-white/20"
              >
                Copy
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>{copied ? 'Copied to clipboard' : 'Copy all links at once'}</span>
            <button
              type="button"
              onClick={() => handleCopy(allLinks)}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
            >
              Copy All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
