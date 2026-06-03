const PDF_PAGE_MARGIN_PT = 24;

const waitForDomSettle = async () => {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
};

const sanitizePdfFilename = (value: string) => {
  const cleaned = value.replace(/[^a-zA-Z0-9._ -]/g, '').trim();
  if (!cleaned) return 'landing-page.pdf';
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
};

export async function downloadLandingPagePdf(options: {
  rootElement: HTMLElement;
  fileName: string;
}) {
  const { rootElement, fileName } = options;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF export is only available in browser environments.');
  }
  if (!rootElement) {
    throw new Error('Landing page root element was not found.');
  }

  await waitForDomSettle();

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const viewportWidth = Math.max(
    window.innerWidth,
    document.documentElement.scrollWidth,
    rootElement.scrollWidth,
  );
  const viewportHeight = Math.max(
    window.innerHeight,
    document.documentElement.scrollHeight,
    rootElement.scrollHeight,
  );

  const renderScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = await html2canvas(rootElement, {
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale: renderScale,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: viewportWidth,
    windowHeight: viewportHeight,
  });

  if (!canvas.width || !canvas.height) {
    throw new Error('Failed to render the landing page for PDF export.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - PDF_PAGE_MARGIN_PT * 2;
  const printableHeight = pageHeight - PDF_PAGE_MARGIN_PT * 2;

  const imageData = canvas.toDataURL('image/jpeg', 0.94);
  const renderedImageHeight = (canvas.height * printableWidth) / canvas.width;

  let remainingHeight = renderedImageHeight;
  let topOffset = PDF_PAGE_MARGIN_PT;

  pdf.addImage(imageData, 'JPEG', PDF_PAGE_MARGIN_PT, topOffset, printableWidth, renderedImageHeight, undefined, 'FAST');
  remainingHeight -= printableHeight;

  while (remainingHeight > 0) {
    pdf.addPage();
    topOffset = PDF_PAGE_MARGIN_PT - (renderedImageHeight - remainingHeight);
    pdf.addImage(imageData, 'JPEG', PDF_PAGE_MARGIN_PT, topOffset, printableWidth, renderedImageHeight, undefined, 'FAST');
    remainingHeight -= printableHeight;
  }

  pdf.save(sanitizePdfFilename(fileName));

  return { pageCount: pdf.getNumberOfPages() };
}
