-- Migration: cascade_deletes_token_hashing_relations
-- Adds onDelete: Cascade to all Agent/Deal/Blast/Lead child relations,
-- adds missing @relation for Sequence, OAuthState, WebhookDeliveryLog,
-- adds unique constraint on Lead(agentId, email).
-- NOTE: Existing resetToken / emailVerifyToken values in DB will no longer
-- match because the application now stores SHA-256 hashes. Any in-flight
-- reset links or verification codes will be invalidated (acceptable since
-- tokens have short TTLs of 1h / 15min).

-- =====================================================================
-- 1. CASCADE DELETES — Agent children
-- =====================================================================

-- SupportRequest
ALTER TABLE "SupportRequest" DROP CONSTRAINT IF EXISTS "SupportRequest_agentId_fkey";
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentProfileSettings
ALTER TABLE "AgentProfileSettings" DROP CONSTRAINT IF EXISTS "AgentProfileSettings_agentId_fkey";
ALTER TABLE "AgentProfileSettings" ADD CONSTRAINT "AgentProfileSettings_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentNotificationPrefs
ALTER TABLE "AgentNotificationPrefs" DROP CONSTRAINT IF EXISTS "AgentNotificationPrefs_agentId_fkey";
ALTER TABLE "AgentNotificationPrefs" ADD CONSTRAINT "AgentNotificationPrefs_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentAiSettings
ALTER TABLE "AgentAiSettings" DROP CONSTRAINT IF EXISTS "AgentAiSettings_agentId_fkey";
ALTER TABLE "AgentAiSettings" ADD CONSTRAINT "AgentAiSettings_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Property
ALTER TABLE "Property" DROP CONSTRAINT IF EXISTS "Property_agentId_fkey";
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deal → Agent
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS "Deal_agentId_fkey";
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deal → Property
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS "Deal_propertyId_fkey";
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Listing
ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_agentId_fkey";
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MarketingBlast
ALTER TABLE "MarketingBlast" DROP CONSTRAINT IF EXISTS "MarketingBlast_agentId_fkey";
ALTER TABLE "MarketingBlast" ADD CONSTRAINT "MarketingBlast_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MarketingDeliveryLog → Agent
ALTER TABLE "MarketingDeliveryLog" DROP CONSTRAINT IF EXISTS "MarketingDeliveryLog_agentId_fkey";
ALTER TABLE "MarketingDeliveryLog" ADD CONSTRAINT "MarketingDeliveryLog_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MarketingDeliveryLog → Blast
ALTER TABLE "MarketingDeliveryLog" DROP CONSTRAINT IF EXISTS "MarketingDeliveryLog_blastId_fkey";
ALTER TABLE "MarketingDeliveryLog" ADD CONSTRAINT "MarketingDeliveryLog_blastId_fkey"
  FOREIGN KEY ("blastId") REFERENCES "MarketingBlast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MarketingEmailEvent → Agent (nullable — SetNull)
ALTER TABLE "MarketingEmailEvent" DROP CONSTRAINT IF EXISTS "MarketingEmailEvent_agentId_fkey";
ALTER TABLE "MarketingEmailEvent" ADD CONSTRAINT "MarketingEmailEvent_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MarketingEmailEvent → Blast (nullable — SetNull)
ALTER TABLE "MarketingEmailEvent" DROP CONSTRAINT IF EXISTS "MarketingEmailEvent_blastId_fkey";
ALTER TABLE "MarketingEmailEvent" ADD CONSTRAINT "MarketingEmailEvent_blastId_fkey"
  FOREIGN KEY ("blastId") REFERENCES "MarketingBlast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BlastChannel → MarketingBlast
ALTER TABLE "BlastChannel" DROP CONSTRAINT IF EXISTS "BlastChannel_blastId_fkey";
ALTER TABLE "BlastChannel" ADD CONSTRAINT "BlastChannel_blastId_fkey"
  FOREIGN KEY ("blastId") REFERENCES "MarketingBlast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BlastHit → BlastChannel
ALTER TABLE "BlastHit" DROP CONSTRAINT IF EXISTS "BlastHit_channelId_fkey";
ALTER TABLE "BlastHit" ADD CONSTRAINT "BlastHit_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "BlastChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealEvent → Agent
ALTER TABLE "DealEvent" DROP CONSTRAINT IF EXISTS "DealEvent_agentId_fkey";
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealEvent → Deal
ALTER TABLE "DealEvent" DROP CONSTRAINT IF EXISTS "DealEvent_dealId_fkey";
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task → Agent
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_agentId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task → Deal (nullable — SetNull)
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_dealId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task → Client (nullable — SetNull)
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_clientId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task → Listing (nullable — SetNull)
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_listingId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task → MarketingBlast (nullable — SetNull)
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_marketingBlastId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_marketingBlastId_fkey"
  FOREIGN KEY ("marketingBlastId") REFERENCES "MarketingBlast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MlsListing
ALTER TABLE "MlsListing" DROP CONSTRAINT IF EXISTS "MlsListing_agentId_fkey";
ALTER TABLE "MlsListing" ADD CONSTRAINT "MlsListing_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AutomationRule
ALTER TABLE "AutomationRule" DROP CONSTRAINT IF EXISTS "AutomationRule_agentId_fkey";
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentChannelConnection
ALTER TABLE "AgentChannelConnection" DROP CONSTRAINT IF EXISTS "AgentChannelConnection_agentId_fkey";
ALTER TABLE "AgentChannelConnection" ADD CONSTRAINT "AgentChannelConnection_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DailyActivity
ALTER TABLE "DailyActivity" DROP CONSTRAINT IF EXISTS "DailyActivity_agentId_fkey";
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GoogleCalendarConnection
ALTER TABLE "GoogleCalendarConnection" DROP CONSTRAINT IF EXISTS "GoogleCalendarConnection_agentId_fkey";
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IdxConnection
ALTER TABLE "IdxConnection" DROP CONSTRAINT IF EXISTS "IdxConnection_agentId_fkey";
ALTER TABLE "IdxConnection" ADD CONSTRAINT "IdxConnection_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LandingPage
ALTER TABLE "LandingPage" DROP CONSTRAINT IF EXISTS "LandingPage_agentId_fkey";
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Client
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_agentId_fkey";
ALTER TABLE "Client" ADD CONSTRAINT "Client_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lead → Agent
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_agentId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LeadActivity → Lead
ALTER TABLE "LeadActivity" DROP CONSTRAINT IF EXISTS "LeadActivity_leadId_fkey";
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InternalEvent → Agent (nullable — SetNull)
ALTER TABLE "InternalEvent" DROP CONSTRAINT IF EXISTS "InternalEvent_agentId_fkey";
ALTER TABLE "InternalEvent" ADD CONSTRAINT "InternalEvent_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InternalError → Agent (nullable — SetNull)
ALTER TABLE "InternalError" DROP CONSTRAINT IF EXISTS "InternalError_agentId_fkey";
ALTER TABLE "InternalError" ADD CONSTRAINT "InternalError_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TeamMember → Agent
ALTER TABLE "TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_agentId_fkey";
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SequenceEnrollment → Agent
ALTER TABLE "SequenceEnrollment" DROP CONSTRAINT IF EXISTS "SequenceEnrollment_agentId_fkey";
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- 2. CASCADE DELETES — Deal children
-- =====================================================================

-- Repc → Deal
ALTER TABLE "Repc" DROP CONSTRAINT IF EXISTS "Repc_dealId_fkey";
ALTER TABLE "Repc" ADD CONSTRAINT "Repc_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Addendum → Deal
ALTER TABLE "Addendum" DROP CONSTRAINT IF EXISTS "Addendum_dealId_fkey";
ALTER TABLE "Addendum" ADD CONSTRAINT "Addendum_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SignatureEnvelope → Deal
ALTER TABLE "SignatureEnvelope" DROP CONSTRAINT IF EXISTS "SignatureEnvelope_dealId_fkey";
ALTER TABLE "SignatureEnvelope" ADD CONSTRAINT "SignatureEnvelope_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Signer → SignatureEnvelope
ALTER TABLE "Signer" DROP CONSTRAINT IF EXISTS "Signer_envelopeId_fkey";
ALTER TABLE "Signer" ADD CONSTRAINT "Signer_envelopeId_fkey"
  FOREIGN KEY ("envelopeId") REFERENCES "SignatureEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FormInstance → Deal
ALTER TABLE "FormInstance" DROP CONSTRAINT IF EXISTS "FormInstance_dealId_fkey";
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- 3. MISSING RELATIONS (new FKs)
-- =====================================================================

-- Sequence.agentId → Agent
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OAuthState.agentId → Agent
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WebhookDeliveryLog.webhookId → OutboundWebhook
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_webhookId_fkey"
  FOREIGN KEY ("webhookId") REFERENCES "OutboundWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- 4. UNIQUE CONSTRAINT on Lead(agentId, email)
-- =====================================================================

-- First, remove duplicate leads keeping the NEWEST one per (agentId, email) pair.
-- This DELETE is safe: it only removes older duplicates and preserves the most-recent lead.
DELETE FROM "Lead" a
  USING "Lead" b
  WHERE a."agentId" = b."agentId"
    AND LOWER(a."email") = LOWER(b."email")
    AND a."createdAt" < b."createdAt";

-- Also handle exact ties (same createdAt) by keeping the one with the "greater" id.
DELETE FROM "Lead" a
  USING "Lead" b
  WHERE a."agentId" = b."agentId"
    AND LOWER(a."email") = LOWER(b."email")
    AND a."createdAt" = b."createdAt"
    AND a."id" < b."id";

-- Now safe to add the unique constraint.
CREATE UNIQUE INDEX "Lead_agentId_email_key" ON "Lead"("agentId", "email");
