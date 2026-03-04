#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'audits', 'market-readiness');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function walk(dirPath, matcher, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matcher, collected);
      continue;
    }
    if (matcher(fullPath)) collected.push(fullPath);
  }
  return collected;
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function extractRoutes(appTsxPath) {
  const text = readText(appTsxPath);
  const routeRegex = /<Route\s+path=\"([^\"]+)\"/g;
  const routes = [];
  let match;
  while ((match = routeRegex.exec(text)) !== null) {
    routes.push(match[1]);
  }
  return Array.from(new Set(routes)).sort();
}

function getFeatureFolders(featuresDir) {
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function getRouteFiles(routesDir) {
  return walk(routesDir, (filePath) => filePath.endsWith('.ts'))
    .map((filePath) => rel(filePath))
    .sort();
}

function findEvidence(files, patterns) {
  const hits = [];
  for (const file of files) {
    const text = readText(file);
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        if (text.includes(pattern)) {
          hits.push({ file: rel(file), pattern });
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(text)) {
          hits.push({ file: rel(file), pattern: pattern.toString() });
        }
      }
    }
  }
  return hits;
}

function scoreCapability(capability, files) {
  const requiredEvidence = findEvidence(files, capability.requiredPatterns || []);
  const optionalEvidence = findEvidence(files, capability.optionalPatterns || []);
  const evidence = [...requiredEvidence, ...optionalEvidence];

  const requiredTotal = (capability.requiredPatterns || []).length;
  const requiredHitCount = new Set(requiredEvidence.map((e) => e.pattern)).size;
  const requiredCoverage = requiredTotal === 0 ? 1 : requiredHitCount / requiredTotal;

  let status = 'Gap';
  if (requiredCoverage >= 1 && evidence.length >= capability.strongThreshold) status = 'Strong';
  else if (requiredHitCount > 0 || optionalEvidence.length > 0) status = 'Partial';

  return {
    id: capability.id,
    category: capability.category,
    title: capability.title,
    status,
    expectedByMarket: capability.expectedByMarket,
    priority: capability.priority,
    notes: capability.notes,
    requiredCoverage: `${requiredHitCount}/${requiredTotal}`,
    evidence: evidence.slice(0, 10),
  };
}

function summarize(capabilities) {
  const counts = { Strong: 0, Partial: 0, Gap: 0 };
  for (const c of capabilities) counts[c.status] += 1;
  return counts;
}

function todayIso() {
  return new Date().toISOString();
}

function compactDate(ts) {
  return ts.replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z');
}

function buildMarkdown(report) {
  const strong = report.capabilities.filter((c) => c.status === 'Strong');
  const partial = report.capabilities.filter((c) => c.status === 'Partial');
  const gaps = report.capabilities.filter((c) => c.status === 'Gap');
  const launchCritical = report.capabilities.filter((c) => c.priority === 'P0' && c.status !== 'Strong');

  const renderList = (items) =>
    items
      .map(
        (c) =>
          `- **${c.title}** (${c.status}, required: ${c.requiredCoverage}) — ${c.notes}`,
      )
      .join('\n');

  const launchBlockers = launchCritical.length
    ? launchCritical.map((c) => `- ${c.title} (${c.status})`).join('\n')
    : '- No current P0 blockers detected by automated scan.';

  return `# Market Readiness Audit (Automated)\n\nGenerated: ${report.generatedAt}\n\n## Inventory Snapshot\n- Frontend routes discovered: ${report.inventory.frontendRouteCount}\n- Feature modules discovered: ${report.inventory.featureCount}\n- Backend route files discovered: ${report.inventory.backendRouteCount}\n\n## Scorecard\n- Strong: ${report.summary.Strong}\n- Partial: ${report.summary.Partial}\n- Gap: ${report.summary.Gap}\n\n## Strong Coverage\n${strong.length ? renderList(strong) : '- None detected.'}\n\n## Partial Coverage\n${partial.length ? renderList(partial) : '- None detected.'}\n\n## Gap Coverage\n${gaps.length ? renderList(gaps) : '- None detected.'}\n\n## Launch-Critical Items (P0)\n${launchBlockers}\n\n## Competitor Baseline Used\n- BoldTrail / kvCORE\n- Follow Up Boss\n- BoomTown\n- Real Geeks\n- CINC\n- Lofty / Chime\n\n## Recommended Next Actions\n1. Close all P0 items above before broad rollout.\n2. Convert Partial items into Strong with instrumentation, tests, and UX hardening.\n3. Re-run this audit weekly and before each production release.\n`;
}

function main() {
  const appTsx = path.join(root, 'web', 'src', 'App.tsx');
  const featuresDir = path.join(root, 'web', 'src', 'features');
  const routesDir = path.join(root, 'server', 'src', 'routes');

  const webFiles = walk(path.join(root, 'web', 'src'), (f) => /\.(ts|tsx)$/.test(f));
  const serverFiles = walk(path.join(root, 'server', 'src'), (f) => /\.(ts|tsx)$/.test(f));
  const scanFiles = [...webFiles, ...serverFiles];

  const capabilitiesBlueprint = [
    {
      id: 'crm_pipeline',
      category: 'Core CRM',
      title: 'CRM + pipeline management',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'Deals, leads, tasks, calendar, and reporting should work as one workflow.',
      strongThreshold: 8,
      requiredPatterns: ['/api/deals', '/api/leads', '/api/tasks', '/api/calendar', '/api/reporting'],
      optionalPatterns: ['DashboardPage', 'TasksPage', 'LeadsDashboard'],
    },
    {
      id: 'contracts_esign',
      category: 'Transactions',
      title: 'Contracts + e-sign workflow',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'End-to-end contract send, sign, remind, and PDF retrieval.',
      strongThreshold: 8,
      requiredPatterns: ['/api/esign', '/api/esign-public', 'createESignToken', 'verifyESignToken', '/envelopes/:envelopeId/remind'],
      optionalPatterns: ['PublicSignPage', 'sendEnvelopeEmails', 'ContractsHub'],
    },
    {
      id: 'idx_mls_search',
      category: 'Property Discovery',
      title: 'IDX + MLS + property search',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'Search, listing import/cache, and MLS/IDX settings must be reliable.',
      strongThreshold: 7,
      requiredPatterns: ['/api/search', '/api/mls', '/api/settings/idx'],
      optionalPatterns: ['PropertySearch', 'mlsNumber', 'IdxSettingsPage', 'ListingsPage'],
    },
    {
      id: 'marketing_automation',
      category: 'Growth',
      title: 'Marketing + automations',
      expectedByMarket: true,
      priority: 'P1',
      notes: 'Campaigns, channel config, and automation orchestration.',
      strongThreshold: 8,
      requiredPatterns: ['/api/marketing', '/api/channels', '/api/automations'],
      optionalPatterns: ['MarketingPage', 'AutomationsPage', 'ChannelSettingsDrawer', 'BlastDetailPage', 'MarketingCampaignModal'],
    },
    {
      id: 'ai_assistant',
      category: 'AI',
      title: 'AI workflow assistance',
      expectedByMarket: true,
      priority: 'P1',
      notes: 'AI should assist in daily planning, contracts, tasks, and marketing.',
      strongThreshold: 8,
      requiredPatterns: ['/api/ai', 'ContractsAIAssistant', 'AIDailyPlan'],
      optionalPatterns: ['TasksAISuggest', 'RepcAIAssistant', 'ListingAIDescription', 'MarketingAICopy', 'OPENAI_API_KEY'],
    },
    {
      id: 'integration_ecosystem',
      category: 'Platform',
      title: 'Integrations ecosystem depth',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'Breadth and reliability of key integration connectors/webhooks.',
      strongThreshold: 7,
      requiredPatterns: ['/api/oauth', '/api/integrations', 'sendgridEventsWebhookHandler', 'STRIPE_WEBHOOK_SECRET'],
      optionalPatterns: ['leadIntegrations', 'IntegrationsSettingsPage', 'SENDGRID_WEBHOOK_PUBLIC_KEY'],
    },
    {
      id: 'lead_routing',
      category: 'Lead Ops',
      title: 'Lead routing + SLA response controls',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'Deterministic distribution, prioritization, and response accountability.',
      strongThreshold: 4,
      requiredPatterns: ['/api/priority-actions', '/api/leads'],
      optionalPatterns: ['lead routing', 'round robin', 'first to claim', 'Lead distribution', '/features/lead-routing'],
    },
    {
      id: 'mobile_execution',
      category: 'Experience',
      title: 'Mobile execution readiness',
      expectedByMarket: true,
      priority: 'P1',
      notes: 'Mobile-friendly workflows and practical on-the-go operations.',
      strongThreshold: 4,
      requiredPatterns: ['phoneToSmsHref', 'phoneToTelHref'],
      optionalPatterns: ['iOS', 'ANDROID', 'safe area', 'mobile', 'manifest', 'serviceWorker'],
    },
    {
      id: 'security_compliance',
      category: 'Trust',
      title: 'Security + compliance posture',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'Auth, webhooks, ownership checks, and auditability in production.',
      strongThreshold: 7,
      requiredPatterns: ['authMiddleware', 'requireOwner', 'verifySendGridEventWebhook', 'auditHash'],
      optionalPatterns: ['signature', 'JWT_SECRET'],
    },
    {
      id: 'observability_quality',
      category: 'Operations',
      title: 'Observability + release quality gates',
      expectedByMarket: true,
      priority: 'P0',
      notes: 'Telemetry, test coverage, and release confidence automation.',
      strongThreshold: 6,
      requiredPatterns: ['/api/telemetry', 'reportClientError', '/api/health'],
      optionalPatterns: ['run test', 'Playwright', 'smoke_test'],
    },
  ];

  const capabilities = capabilitiesBlueprint.map((c) => scoreCapability(c, scanFiles));
  const summary = summarize(capabilities);

  const routes = extractRoutes(appTsx);
  const featureFolders = getFeatureFolders(featuresDir);
  const routeFiles = getRouteFiles(routesDir);

  const report = {
    generatedAt: todayIso(),
    inventory: {
      frontendRouteCount: routes.length,
      backendRouteCount: routeFiles.length,
      featureCount: featureFolders.length,
      frontendRoutes: routes,
      featureModules: featureFolders,
      backendRoutes: routeFiles,
    },
    summary,
    capabilities,
  };

  ensureDir(outDir);

  const timestamp = compactDate(report.generatedAt);
  const jsonLatest = path.join(outDir, 'latest.json');
  const mdLatest = path.join(outDir, 'latest.md');
  const jsonTimestamped = path.join(outDir, `market-readiness-${timestamp}.json`);
  const mdTimestamped = path.join(outDir, `market-readiness-${timestamp}.md`);

  const markdown = buildMarkdown(report);

  fs.writeFileSync(jsonLatest, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdLatest, markdown);
  fs.writeFileSync(jsonTimestamped, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdTimestamped, markdown);

  const blockerCount = capabilities.filter((c) => c.priority === 'P0' && c.status !== 'Strong').length;
  console.log(`Market readiness audit complete.`);
  console.log(`Output: ${rel(mdLatest)} and ${rel(jsonLatest)}`);
  console.log(`Snapshot: ${rel(mdTimestamped)} and ${rel(jsonTimestamped)}`);
  console.log(`Scorecard => Strong: ${summary.Strong}, Partial: ${summary.Partial}, Gap: ${summary.Gap}`);
  console.log(`P0 blockers (non-strong): ${blockerCount}`);
}

main();
