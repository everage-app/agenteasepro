import { Router } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { AuthenticatedRequest } from '../middleware/auth';

export const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const monthMap: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

const normalizeDate = (year: number, month: number, day: number) => {
  const y = year < 100 ? 2000 + year : year;
  return `${y}-${pad(month)}-${pad(day)}`;
};

const extractDateFromText = (text: string): string | null => {
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const numericMatch = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2,4})\b/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    const year = Number(numericMatch[3]);
    return normalizeDate(year, month, day);
  }

  const monthMatch = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (monthMatch) {
    const monthKey = monthMatch[1].toLowerCase();
    const month = monthMap[monthKey];
    const day = Number(monthMatch[2]);
    const year = Number(monthMatch[3]);
    if (month) {
      return normalizeDate(year, month, day);
    }
  }

  return null;
};

const findDateNearKeywords = (text: string, keywords: string[]) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      const window = lines.slice(Math.max(0, i - 1), i + 3).join(' ');
      const date = extractDateFromText(`${line} ${window}`);
      if (date) return date;
    }
  }

  return null;
};

router.post('/parse-dates', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const buffer = req.file.buffer;
    const text = req.file.mimetype.includes('pdf')
      ? (await pdfParse(buffer)).text
      : buffer.toString('utf-8');

    const dueDiligenceDeadline = findDateNearKeywords(text, [
      'due diligence',
      'inspection deadline',
      'resolution deadline',
    ]);
    const financingAppraisalDeadline = findDateNearKeywords(text, [
      'financing',
      'loan approval',
      'appraisal',
    ]);
    const settlementDeadline = findDateNearKeywords(text, [
      'settlement',
      'closing date',
      'close of escrow',
    ]);

    return res.json({
      dates: {
        dueDiligenceDeadline,
        financingAppraisalDeadline,
        settlementDeadline,
      },
    });
  } catch (error: any) {
    console.error('Contract parsing error:', error);
    return res.status(500).json({ error: 'Failed to parse contract dates' });
  }
});

export default router;
