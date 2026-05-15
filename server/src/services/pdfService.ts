/**
 * PDF Generation Service
 * Handles filling PDF forms with contract data using pdf-lib
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface RepcData {
  // Property Info
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  mlsId?: string;
  taxId?: string;
  legalDescription?: string;
  
  // Buyer/Seller
  buyerNames?: string;
  buyerEmail?: string;
  sellerNames?: string;
  sellerEmail?: string;
  
  // Price & Terms
  purchasePrice?: number;
  earnestMoney?: number;
  earnestMoneyDeliveryDays?: number;
  downPayment?: number;
  loanAmount?: number;
  
  // Dates
  acceptanceDeadline?: string;
  dueDiligenceDeadline?: string;
  financingAppraisalDeadline?: string;
  settlementDeadline?: string;
  possessionDate?: string;
  
  // Financing
  financingType?: string;
  loanType?: string;
  interestRateMax?: number;
  loanTermYears?: number;
  
  // Additional Terms
  personalPropertyIncluded?: string;
  personalPropertyExcluded?: string;
  additionalTerms?: string;
  
  // Agent Info
  buyerAgentName?: string;
  buyerAgentLicense?: string;
  buyerBrokerageName?: string;
  listingAgentName?: string;
  listingAgentLicense?: string;
  listingBrokerageName?: string;
  
  // Signatures
  buyerSignature?: string;
  buyerSignedDate?: string;
  sellerSignature?: string;
  sellerSignedDate?: string;
}

interface SigningGuideSigner {
  role: string;
  name?: string;
  signedAt?: string;
  initials?: string;
  completedFields?: Array<{ id?: string; type?: string; value?: unknown }>;
}

interface SigningGuideField {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
  value?: string;
  placeholder?: string;
  assignedTo?: string;
  required?: boolean;
}

const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Fill a Utah REPC PDF with contract data.
 * Returns the raw template as-is; overlay markers are added separately
 * by addSigningGuidesToPdf() using the exact form-field coordinates.
 */
export async function fillRepcPdf(templatePath: string, _data: RepcData): Promise<Buffer> {
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate a summary cover page for a signed contract
 */
export async function generateSignedContractPdf(
  contractData: RepcData,
  signers: Array<{ name: string; signedAt?: string; role: string }>
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter size
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  const margin = 50;
  let yPos = height - margin;
  
  // Title
  page.drawText('SIGNED CONTRACT SUMMARY', {
    x: margin,
    y: yPos,
    size: 18,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.4),
  });
  yPos -= 30;
  
  // Property address
  page.drawText('Property:', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  yPos -= 18;
  
  const fullAddress = [
    contractData.street,
    [contractData.city, contractData.state, contractData.zip].filter(Boolean).join(', ')
  ].filter(Boolean).join('\n');
  
  page.drawText(fullAddress || 'No address specified', {
    x: margin + 20,
    y: yPos,
    size: 11,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPos -= 40;
  
  // Parties
  page.drawText('Parties:', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  yPos -= 18;
  
  if (contractData.buyerNames) {
    page.drawText(`Buyer: ${contractData.buyerNames}`, {
      x: margin + 20,
      y: yPos,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPos -= 16;
  }
  
  if (contractData.sellerNames) {
    page.drawText(`Seller: ${contractData.sellerNames}`, {
      x: margin + 20,
      y: yPos,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPos -= 16;
  }
  yPos -= 25;
  
  // Key Terms
  page.drawText('Key Terms:', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  yPos -= 18;
  
  const terms = [
    contractData.purchasePrice ? `Purchase Price: ${formatCurrency(contractData.purchasePrice)}` : null,
    contractData.earnestMoney ? `Earnest Money: ${formatCurrency(contractData.earnestMoney)}` : null,
    contractData.dueDiligenceDeadline ? `Due Diligence: ${formatDate(contractData.dueDiligenceDeadline)}` : null,
    contractData.financingAppraisalDeadline ? `Financing Deadline: ${formatDate(contractData.financingAppraisalDeadline)}` : null,
    contractData.settlementDeadline ? `Settlement Date: ${formatDate(contractData.settlementDeadline)}` : null,
  ].filter(Boolean);
  
  for (const term of terms) {
    page.drawText(term as string, {
      x: margin + 20,
      y: yPos,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPos -= 16;
  }
  yPos -= 25;
  
  // Signatures
  page.drawText('Signatures:', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  yPos -= 18;
  
  for (const signer of signers) {
    const status = signer.signedAt 
      ? `Signed ${formatDate(signer.signedAt)}`
      : 'Pending';
    page.drawText(`${signer.role}: ${signer.name} - ${status}`, {
      x: margin + 20,
      y: yPos,
      size: 11,
      font: helvetica,
      color: signer.signedAt ? rgb(0.1, 0.5, 0.1) : rgb(0.6, 0.4, 0),
    });
    yPos -= 16;
  }
  yPos -= 30;
  
  // Footer
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  page.drawText(`Generated: ${timestamp}`, {
    x: margin,
    y: margin,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  page.drawText('AgentEase Pro - Utah Real Estate Contract Management', {
    x: width - margin - 280,
    y: margin,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Overlay signature / initial guidance markers throughout the packet.
 * For REPC, positions are derived from the exact Widget annotation
 * rectangles embedded in the official Utah REPC template PDF.
 */
export async function addSigningGuidesToPdf(
  pdfBuffer: Buffer,
  params: {
    signers: SigningGuideSigner[];
    currentSignerRole?: string;
    currentSignerName?: string;
    formCode?: string;
    fields?: SigningGuideField[];
    propertyAddress?: string;
    mlsId?: string;
    purchasePrice?: number | string;
    buyerNames?: string;
    sellerNames?: string;
  },
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const getSigner = (role: string) =>
    params.signers.find((s) => s.role === role);

  const initialsFromName = (name?: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('');
  };

  const formatAuditTime = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const signers = params.signers.length
    ? params.signers
    : [{ role: 'SIGNER', name: undefined }];
  const normalizedFormCode = (params.formCode || '').toUpperCase();
  const isRepc = normalizedFormCode === 'REPC';

  const buyers = signers
    .filter((s) => String(s.role || '').toUpperCase() === 'BUYER')
    .slice(0, 2);
  const sellers = signers
    .filter((s) => String(s.role || '').toUpperCase() === 'SELLER')
    .slice(0, 2);

  /* ------------------------------------------------------------------ */
  /*  REPC exact form-field coordinates (from template Widget annots)    */
  /*  Rect = [x1  y1  x2  y2]  where y1 = bottom, y2 = top in pts     */
  /* ------------------------------------------------------------------ */
  // Per-page Y of the "Buyer's Initials / Seller's Initials" footer row
  const REPC_INIT_Y: Record<number, number> = {
    0: 73.08,
    1: 77.08,
    2: 73.08,
    3: 73.08,
    4: 73.08,
    5: 73.08,
  };
  // Left-edge X of the initials fields  (≈83 pts wide each)
  const REPC_BUYER_IX  = 185.52;
  const REPC_SELLER_IX = 418.68;
  // Offsets within the field for dual co-borrower slots
  const SLOT0_DX = 2;
  const SLOT1_DX = 44;

  // Signature fields on the last page (page index 5)
  // Signature2 = Buyer offer area   |  Signature4 = Seller offer area
  const REPC_SIG: Record<'BUYER' | 'SELLER', { x: number; y: number; w: number; h: number }> = {
    BUYER:  { x: 31.94,  y: 386.13, w: 172.8, h: 18.7 },
    SELLER: { x: 309.47, y: 387.17, w: 225.9, h: 18.7 },
  };

  /* ------------------------------------------------------------------ */
  /*  drawInitial  –  render a single initial slot at absolute coords   */
  /* ------------------------------------------------------------------ */
  const drawInitial = (
    pageIndex: number,
    x: number,
    y: number,
    signer: SigningGuideSigner | undefined,
  ) => {
    if (!signer) return;

    const page = pages[pageIndex];
    const slotW = 36;
    const slotH = 11;
    const signerName = signer?.name;
    const initials = (signer?.initials || initialsFromName(signerName))
      .slice(0, 4)
      .toUpperCase();
    const signedAt = signer?.signedAt;
    const isCurrent = normalizeGuideRole(params.currentSignerRole) === normalizeGuideRole(signer.role);

    if (signedAt && initials) {
      // Signed → compact initials text, no box
      page.drawText(initials, {
        x: x + 2,
        y: y + 1,
        size: 9,
        font: helveticaOblique,
        color: rgb(0.08, 0.08, 0.08),
      });
      return;
    }

    if (!isCurrent) {
      return;
    }

    // Unsigned → highlighted placeholder box
    const border = isCurrent
      ? rgb(0.95, 0.6, 0.04)
      : rgb(0.15, 0.45, 0.85);
    const fill = isCurrent
      ? rgb(1, 0.96, 0.62)
      : rgb(0.94, 0.97, 1);

    page.drawRectangle({
      x,
      y,
      width: slotW,
      height: slotH,
      color: fill,
      borderColor: border,
      borderWidth: 0.8,
      opacity: 0.9,
    });
    page.drawText('INT', {
      x: x + 8,
      y: y + 2.5,
      size: 6,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15),
    });
  };

  /* ------------------------------------------------------------------ */
  /*  drawSignature  –  render a signature slot at absolute coords      */
  /* ------------------------------------------------------------------ */
  const drawSignature = (
    pageIndex: number,
    x: number,
    y: number,
    w: number,
    h: number,
    signer: SigningGuideSigner | undefined,
  ) => {
    if (!signer) return;

    const page = pages[pageIndex];
    const signerName = signer?.name || '';
    const signedAt = signer?.signedAt;
    const isCurrent = normalizeGuideRole(params.currentSignerRole) === normalizeGuideRole(signer.role);

    if (signedAt && signerName) {
      // Signed → italic name + tiny audit stamp
      page.drawText(signerName, {
        x: x + 3,
        y: y + 5,
        size: 11,
        font: helveticaOblique,
        color: rgb(0.08, 0.08, 0.08),
      });
      const audit = formatAuditTime(signedAt);
      if (audit) {
        page.drawText(audit, {
          x: x + 2,
          y: Math.max(2, y - 7),
          size: 4.5,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
      }
      return;
    }

    if (!isCurrent) {
      return;
    }

    // Unsigned → SIGN HERE box
    const border = isCurrent
      ? rgb(0.95, 0.6, 0.04)
      : rgb(0.15, 0.45, 0.85);
    const fill = isCurrent
      ? rgb(1, 0.96, 0.62)
      : rgb(0.94, 0.97, 1);

    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: fill,
      borderColor: border,
      borderWidth: 1.2,
      opacity: 0.9,
    });
    page.drawText('SIGN HERE', {
      x: x + w / 2 - 22,
      y: y + h / 2 - 4,
      size: 9,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const normalizeGuideRole = (value?: string) => (value || '').trim().toUpperCase();

  const getCurrentSigner = () => {
    const currentRole = normalizeGuideRole(params.currentSignerRole);
    if (!currentRole) return undefined;
    return signers.find((s) => normalizeGuideRole(s.role) === currentRole);
  };

  const getFieldSigner = (field: SigningGuideField) => {
    const assignedRole = normalizeGuideRole(field.assignedTo);
    if (assignedRole) {
      return signers.find((s) => normalizeGuideRole(s.role) === assignedRole);
    }
    return getCurrentSigner() || (signers.length === 1 ? signers[0] : undefined);
  };

  const getCompletedFieldValue = (signer: SigningGuideSigner | undefined, field: SigningGuideField) => {
    if (!signer?.completedFields || !field.id) return '';
    const completed = signer.completedFields.find((entry) => entry?.id === field.id);
    if (!completed) return '';
    if (typeof completed.value === 'boolean') return completed.value ? 'checked' : '';
    return String(completed.value ?? '').trim();
  };

  const formatSignedDateOnly = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const getFieldDisplayValue = (field: SigningGuideField, signer: SigningGuideSigner | undefined) => {
    const fieldType = String(field.type || '').toLowerCase();
    const completedValue = getCompletedFieldValue(signer, field);

    if (fieldType === 'signature') {
      return signer?.signedAt ? signer.name || completedValue : completedValue;
    }
    if (fieldType === 'initials') {
      return completedValue || (signer?.signedAt ? signer.initials || initialsFromName(signer.name) : '');
    }
    if (fieldType === 'date') {
      return completedValue || (signer?.signedAt ? formatSignedDateOnly(signer.signedAt) : '');
    }
    if (fieldType === 'checkbox') {
      const normalized = completedValue.toLowerCase();
      return normalized === 'checked' || normalized === 'true' || normalized === 'yes' ? 'X' : '';
    }

    return completedValue || (signer?.signedAt ? String(field.value || '').trim() : '');
  };

  const getPendingFieldLabel = (field: SigningGuideField) => {
    const fieldType = String(field.type || '').toLowerCase();
    if (fieldType === 'signature') return 'SIGN HERE';
    if (fieldType === 'initials') return 'INT';
    if (fieldType === 'date') return 'DATE';
    if (fieldType === 'checkbox') return 'CHECK';
    return String(field.placeholder || 'COMPLETE').trim().slice(0, 24).toUpperCase() || 'COMPLETE';
  };

  const drawExplicitField = (field: SigningGuideField) => {
    if (!field?.id || !field?.type) return;
    const pageIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(field.page || 1)) - 1));
    const page = pages[pageIndex];
    if (!page) return;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const fieldX = Number(field.x);
    const fieldY = Number(field.y);
    const fieldWidth = Number(field.width);
    const fieldHeight = Number(field.height);
    if (![fieldX, fieldY, fieldWidth, fieldHeight].every(Number.isFinite)) return;

    const scaledWidth = Math.max(18, (Math.max(fieldWidth, 18) / 612) * pageWidth);
    const scaledHeight = Math.max(12, (Math.max(fieldHeight, 12) / 792) * pageHeight);
    const x = Math.max(0, Math.min(pageWidth - scaledWidth, (fieldX / 612) * pageWidth));
    const yFromTop = (fieldY / 792) * pageHeight;
    const y = Math.max(0, Math.min(pageHeight - scaledHeight, pageHeight - yFromTop - scaledHeight));
    const signer = getFieldSigner(field);
    const currentRole = normalizeGuideRole(params.currentSignerRole);
    const signerRole = normalizeGuideRole(signer?.role);
    const displayValue = getFieldDisplayValue(field, signer);
    const hidePendingForOtherSigner = Boolean(signerRole && currentRole && signerRole !== currentRole && !displayValue);
    if (hidePendingForOtherSigner) return;

    const fieldType = String(field.type || '').toLowerCase();
    const fontSize = fieldType === 'signature'
      ? Math.min(15, Math.max(9, scaledHeight * 0.42))
      : Math.min(11, Math.max(7, scaledHeight * 0.38));

    if (displayValue) {
      if (fieldType === 'checkbox') {
        page.drawRectangle({
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
          borderColor: rgb(0.08, 0.08, 0.08),
          borderWidth: 0.8,
          opacity: 0.95,
        });
        page.drawText('X', {
          x: x + Math.max(3, scaledWidth * 0.28),
          y: y + Math.max(2, scaledHeight * 0.18),
          size: Math.min(14, scaledHeight * 0.68),
          font: helveticaBold,
          color: rgb(0.05, 0.05, 0.05),
        });
        return;
      }

      const text = String(displayValue).replace(/\s+/g, ' ').slice(0, 80);
      page.drawText(text, {
        x: x + 3,
        y: y + Math.max(3, scaledHeight / 2 - fontSize / 2),
        size: fontSize,
        font: fieldType === 'signature' ? helveticaOblique : helvetica,
        color: rgb(0.06, 0.06, 0.06),
      });

      if (fieldType === 'signature' && signer?.signedAt) {
        const audit = formatAuditTime(signer.signedAt);
        if (audit) {
          page.drawText(audit, {
            x: x + 2,
            y: Math.max(2, y - 7),
            size: 4.5,
            font: helvetica,
            color: rgb(0.4, 0.4, 0.4),
          });
        }
      }
      return;
    }

    const isCurrent = !currentRole || !signerRole || signerRole === currentRole;
    const border = isCurrent ? rgb(0.95, 0.6, 0.04) : rgb(0.15, 0.45, 0.85);
    const fill = isCurrent ? rgb(1, 0.96, 0.62) : rgb(0.94, 0.97, 1);
    page.drawRectangle({
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
      color: fill,
      borderColor: border,
      borderWidth: 1,
      opacity: 0.9,
    });
    page.drawText(getPendingFieldLabel(field), {
      x: x + Math.min(8, scaledWidth * 0.08),
      y: y + Math.max(3, scaledHeight / 2 - 4),
      size: Math.min(9, Math.max(6, scaledHeight * 0.32)),
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const explicitFields = !isRepc && Array.isArray(params.fields)
    ? params.fields.filter((field) => field?.id && field?.type)
    : [];

  /* ------------------------------------------------------------------ */
  /*  Render overlays                                                    */
  /* ------------------------------------------------------------------ */
  if (explicitFields.length > 0) {
    explicitFields.forEach(drawExplicitField);
  } else if (isRepc) {
    // ── REPC: exact field-coordinate overlays ──────────────────────

    // Initials on every page (footer row)
    for (let pi = 0; pi < pages.length; pi++) {
      const iy = REPC_INIT_Y[pi] ?? 73.08;

      // Buyer initials  (slot 0 + optional co-borrower slot 1)
      drawInitial(pi, REPC_BUYER_IX + SLOT0_DX, iy, buyers[0]);
      if (buyers[1]) {
        drawInitial(pi, REPC_BUYER_IX + SLOT1_DX, iy, buyers[1]);
      }

      // Seller initials
      drawInitial(pi, REPC_SELLER_IX + SLOT0_DX, iy, sellers[0]);
      if (sellers[1]) {
        drawInitial(pi, REPC_SELLER_IX + SLOT1_DX, iy, sellers[1]);
      }
    }

    // Signatures on last page only
    if (pages.length > 0) {
      const lastIdx = pages.length - 1;
      drawSignature(
        lastIdx,
        REPC_SIG.BUYER.x,
        REPC_SIG.BUYER.y,
        REPC_SIG.BUYER.w,
        REPC_SIG.BUYER.h,
        buyers[0],
      );
      drawSignature(
        lastIdx,
        REPC_SIG.SELLER.x,
        REPC_SIG.SELLER.y,
        REPC_SIG.SELLER.w,
        REPC_SIG.SELLER.h,
        sellers[0],
      );
    }
  } else {
    // ── Non-REPC: percentage-based fallback ────────────────────────
    const lastIdx = pages.length - 1;
    const lastPage = pages[lastIdx];
    const { width, height } = lastPage.getSize();

    // Signature markers on last page
    signers.forEach((s, i) => {
      const sigX = width * 0.08;
      const sigY = height * (0.14 + i * 0.09);
      const sigW = Math.min(280, width * 0.42);
      const sigH = 24;
      drawSignature(lastIdx, sigX, sigY, sigW, sigH, s);
    });

    // Initials on last page near footer
    const footerY = 40;
    drawInitial(lastIdx, width * 0.30, footerY, buyers[0]);
    drawInitial(lastIdx, width * 0.68, footerY, sellers[0]);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export default {
  fillRepcPdf,
  generateSignedContractPdf,
};
