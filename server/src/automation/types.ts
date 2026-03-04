// Automation event types and payloads

export type AutomationEventType =
  | 'LISTING_CREATED'
  | 'DEAL_CREATED'
  | 'REPC_CREATED'
  | 'MARKETING_BLAST_SENT'
  | 'CLIENT_STAGE_CHANGED';

export type AutomationEventPayload =
  | { type: 'LISTING_CREATED'; listingId: string; agentId: string }
  | { type: 'DEAL_CREATED' | 'REPC_CREATED'; dealId: string; agentId: string }
  | { type: 'MARKETING_BLAST_SENT'; blastId: string; agentId: string }
  | {
      type: 'CLIENT_STAGE_CHANGED';
      clientId: string;
      agentId: string;
      fromStage?: string;
      toStage: string;
    };

// Action configuration types
export type AutomationActionConfig =
  | { action: 'CREATE_TASKS'; template: string; useAI?: boolean; enabled?: boolean }
  | { action: 'CREATE_TASKS_FROM_AI'; promptTemplate: string; enabled?: boolean }
  | { action: 'SCHEDULE_DEAL_TASKS'; useKeyDates: boolean; useAI?: boolean; enabled?: boolean }
  | { action: 'CREATE_REFERRAL_TOUCH_SEQUENCE'; sequenceType: string; enabled?: boolean }
  | { action: 'INCREMENT_METRICS'; kind: string; enabled?: boolean };

export interface AutomationRuleConfig {
  actions: AutomationActionConfig[];
  conditions?: Record<string, any>;
}
