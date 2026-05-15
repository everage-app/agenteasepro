type AgentLike = {
  id?: string;
  email?: string;
  teamId?: string | null;
};

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function hasLocalForceOverride(): boolean {
  try {
    return window.localStorage.getItem('aep_command_center_force') === '1';
  } catch {
    return false;
  }
}

export function canAccessCommandCenter(agent?: AgentLike | null): boolean {
  if (hasLocalForceOverride()) return true;
  if (!agent?.id) return false;

  const allowedEmails = parseCsv((import.meta as any)?.env?.VITE_COMMAND_CENTER_ALLOWED_EMAILS);
  const allowedTeamIds = parseCsv((import.meta as any)?.env?.VITE_COMMAND_CENTER_ALLOWED_TEAM_IDS);

  const hasExplicitAllowlist = allowedEmails.length > 0 || allowedTeamIds.length > 0;
  const normalizedEmail = (agent.email || '').trim().toLowerCase();
  const normalizedTeamId = (agent.teamId || '').trim().toLowerCase();

  if (allowedEmails.includes(normalizedEmail)) return true;
  if (allowedTeamIds.includes(normalizedTeamId)) return true;

  if (hasExplicitAllowlist) return false;

  // Default open access when no phased rollout list is configured.
  return true;
}
