import * as pdfjsLib from 'pdfjs-dist';

export const PDF_DOCUMENT_LOAD_OPTIONS = {
  enableScripting: false,
  enableXfa: true,
  isEvalSupported: false,
  stopAtErrors: false,
  useSystemFonts: true,
} as const;

export type RenderedPdfPageImage = {
  imageSrc: string;
  renderedWidth: number;
  renderedHeight: number;
  baseWidth: number;
  baseHeight: number;
  inkRatio: number;
};

type RenderPdfPageImageOptions = {
  maxWidth: number;
  maxHeight?: number;
  outputScale?: number;
  imageType?: 'image/png' | 'image/jpeg';
  imageQuality?: number;
  throwOnBlank?: boolean;
};

type CanvasVisibility = {
  isBlank: boolean;
  inkRatio: number;
};

const MAX_SAMPLED_PIXELS = 160_000;
const WHITE_THRESHOLD = 253;
const MIN_VISIBLE_INK_RATIO = 0.00008;

export const toExactArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const clonePdfBytes = (pdfData: ArrayBuffer | Uint8Array): Uint8Array => {
  if (pdfData instanceof Uint8Array) {
    return new Uint8Array(pdfData);
  }
  return new Uint8Array(pdfData.slice(0));
};

const getAnnotationMode = () =>
  pdfjsLib.AnnotationMode?.ENABLE_STORAGE ?? pdfjsLib.AnnotationMode?.ENABLE ?? 1;

const analyzeCanvasVisibility = (canvas: HTMLCanvasElement): CanvasVisibility => {
  const context = canvas.getContext('2d');
  if (!context || canvas.width === 0 || canvas.height === 0) {
    return { isBlank: true, inkRatio: 0 };
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const totalPixels = canvas.width * canvas.height;
  const step = Math.max(1, Math.ceil(Math.sqrt(totalPixels / MAX_SAMPLED_PIXELS)));
  let sampled = 0;
  let nonWhite = 0;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const index = (y * canvas.width + x) * 4;
      const alpha = imageData.data[index + 3];
      if (alpha < 12) continue;

      sampled += 1;
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];

      if (red < WHITE_THRESHOLD || green < WHITE_THRESHOLD || blue < WHITE_THRESHOLD) {
        nonWhite += 1;
        if (nonWhite / sampled >= MIN_VISIBLE_INK_RATIO) {
          return { isBlank: false, inkRatio: nonWhite / sampled };
        }
      }
    }
  }

  const inkRatio = sampled > 0 ? nonWhite / sampled : 0;
  return { isBlank: inkRatio < MIN_VISIBLE_INK_RATIO, inkRatio };
};

const renderToCanvas = async ({
  page,
  displayScale,
  outputScale,
  intent,
}: {
  page: pdfjsLib.PDFPageProxy;
  displayScale: number;
  outputScale: number;
  intent: 'display' | 'print';
}) => {
  const canvas = document.createElement('canvas');
  const renderViewport = page.getViewport({ scale: displayScale * outputScale });
  canvas.width = Math.max(1, Math.ceil(renderViewport.width));
  canvas.height = Math.max(1, Math.ceil(renderViewport.height));

  await page.render({
    canvas,
    viewport: renderViewport,
    annotationMode: getAnnotationMode(),
    intent,
    background: '#ffffff',
  }).promise;

  return canvas;
};

export const renderPdfPageToImage = async (
  page: pdfjsLib.PDFPageProxy,
  options: RenderPdfPageImageOptions,
): Promise<RenderedPdfPageImage> => {
  const baseViewport = page.getViewport({ scale: 1 });
  const scaleForWidth = options.maxWidth / baseViewport.width;
  const scaleForHeight = options.maxHeight ? options.maxHeight / baseViewport.height : scaleForWidth;
  const displayScale = Math.min(scaleForWidth, scaleForHeight);
  const displayViewport = page.getViewport({ scale: displayScale });
  const outputScale = Math.max(1, Math.min(2.5, options.outputScale || window.devicePixelRatio || 1));
  const attempts: Array<'display' | 'print'> = ['display', 'print'];
  let bestCanvas: HTMLCanvasElement | null = null;
  let bestVisibility: CanvasVisibility = { isBlank: true, inkRatio: 0 };

  for (const intent of attempts) {
    const canvas = await renderToCanvas({ page, displayScale, outputScale, intent });
    const visibility = analyzeCanvasVisibility(canvas);

    if (!bestCanvas || visibility.inkRatio > bestVisibility.inkRatio) {
      bestCanvas = canvas;
      bestVisibility = visibility;
    }

    if (!visibility.isBlank) {
      bestCanvas = canvas;
      bestVisibility = visibility;
      break;
    }
  }

  if (!bestCanvas) {
    throw new Error('PDF page could not be painted to canvas.');
  }

  const shouldRejectBlank = options.throwOnBlank !== false && bestVisibility.isBlank;

  if (shouldRejectBlank) {
    throw new Error('PDF.js rendered this page blank even though the document contains visible content.');
  }

  return {
    imageSrc: bestCanvas.toDataURL(options.imageType || 'image/png', options.imageQuality),
    renderedWidth: displayViewport.width,
    renderedHeight: displayViewport.height,
    baseWidth: baseViewport.width,
    baseHeight: baseViewport.height,
    inkRatio: bestVisibility.inkRatio,
  };
};
