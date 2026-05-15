export function normalizeOwnerEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseList(value?: string | null) {
  if (!value) return [] as string[];
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addEmail(target: Set<string>, email?: string | null) {
  if (!email) return;
  const normalized = normalizeOwnerEmail(email);
  if (normalized.includes('@')) target.add(normalized);
}

export function getOwnerConfig() {
  const ownerEmails = new Set<string>();
  const ownerIds = new Set<string>();

  const masterOwnerEmail = process.env.AGENTEASE_MASTER_OWNER_EMAIL
    ? normalizeOwnerEmail(process.env.AGENTEASE_MASTER_OWNER_EMAIL)
    : null;

  addEmail(ownerEmails, masterOwnerEmail);
  addEmail(ownerEmails, process.env.AGENTEASE_OWNER_EMAIL);
  parseList(process.env.AGENTEASE_OWNER_EMAILS).forEach((email) => addEmail(ownerEmails, email));
  parseList(process.env.AGENTEASE_OWNER_ADMIN_EMAILS).forEach((email) => addEmail(ownerEmails, email));

  parseList(process.env.AGENTEASE_OWNER_ID).forEach((id) => ownerIds.add(id));
  parseList(process.env.AGENTEASE_OWNER_IDS).forEach((id) => ownerIds.add(id));

  return {
    masterOwnerEmail,
    ownerEmail: process.env.AGENTEASE_OWNER_EMAIL ? normalizeOwnerEmail(process.env.AGENTEASE_OWNER_EMAIL) : masterOwnerEmail,
    ownerEmails,
    ownerIds,
    ownerId: process.env.AGENTEASE_OWNER_ID?.trim() || null,
    configured: ownerEmails.size > 0 || ownerIds.size > 0,
  };
}

export function isMasterOwnerEmail(email?: string | null) {
  if (!email) return false;
  const config = getOwnerConfig();
  return Boolean(config.masterOwnerEmail && normalizeOwnerEmail(email) === config.masterOwnerEmail);
}
