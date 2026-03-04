type PriceRow = { name: string; monthly: number };

export type HerokuPricingSnapshot = {
  scannedAt: string;
  source: string;
  dynos: PriceRow[];
  postgres: PriceRow[];
};

const HEROKU_PRICING_URL = 'https://www.heroku.com/pricing';

const DYNO_PLAN_ORDER = ['Eco', 'Basic', 'Standard-1X', 'Standard-2X', 'Performance-M', 'Performance-L'];
const POSTGRES_PLAN_ORDER = ['Essential-0', 'Standard-0'];

function extractRows(html: string) {
  const rows: Array<{ rawName: string; monthly: number }> = [];
  const rowRegex = /<tr[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>\s*<td>\$([0-9,]+)<\/td>[\s\S]*?<\/tr>/gi;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const nameFragment = match[1] || '';
    const amount = Number((match[2] || '').replace(/,/g, ''));
    if (!Number.isFinite(amount)) continue;

    const cleanedName = nameFragment
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedName) continue;

    rows.push({ rawName: cleanedName, monthly: amount });
  }

  return rows;
}

function pickPlans(rows: Array<{ rawName: string; monthly: number }>, plans: string[]): PriceRow[] {
  const selected: PriceRow[] = [];

  for (const plan of plans) {
    const exact = rows.find((r) => r.rawName === plan);
    if (exact) {
      selected.push({ name: plan, monthly: exact.monthly });
      continue;
    }

    const fuzzy = rows.find((r) => r.rawName.toLowerCase().includes(plan.toLowerCase()));
    if (fuzzy) {
      selected.push({ name: plan, monthly: fuzzy.monthly });
    }
  }

  return selected;
}

export async function fetchHerokuPricingSnapshot(): Promise<HerokuPricingSnapshot> {
  const response = await fetch(HEROKU_PRICING_URL, {
    method: 'GET',
    headers: {
      'user-agent': 'AgentEasePro-Internal-Pricing-Scanner',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Heroku pricing fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const rows = extractRows(html);

  const dynos = pickPlans(rows, DYNO_PLAN_ORDER);
  const postgres = pickPlans(rows, POSTGRES_PLAN_ORDER);

  if (dynos.length === 0 && postgres.length === 0) {
    throw new Error('Could not parse Heroku pricing rows from HTML response');
  }

  return {
    scannedAt: new Date().toISOString(),
    source: HEROKU_PRICING_URL,
    dynos,
    postgres,
  };
}
