-- Scale readiness indexes for Heroku Postgres production traffic.
-- Additive only; these support high-volume signup, landing-page, marketing,
-- e-sign, reporting, and scheduled-job paths without changing data shape.

CREATE INDEX IF NOT EXISTS "Agent_createdAt_idx" ON "Agent"("createdAt");
CREATE INDEX IF NOT EXISTS "Agent_status_createdAt_idx" ON "Agent"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Agent_subscriptionStatus_createdAt_idx" ON "Agent"("subscriptionStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Agent_teamId_idx" ON "Agent"("teamId");
CREATE INDEX IF NOT EXISTS "Agent_brokerageId_idx" ON "Agent"("brokerageId");

CREATE INDEX IF NOT EXISTS "Deal_agentId_status_createdAt_idx" ON "Deal"("agentId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Deal_agentId_lastActivityAt_idx" ON "Deal"("agentId", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "Deal_teamId_idx" ON "Deal"("teamId");
CREATE INDEX IF NOT EXISTS "Deal_brokerageId_idx" ON "Deal"("brokerageId");

CREATE INDEX IF NOT EXISTS "Listing_agentId_status_createdAt_idx" ON "Listing"("agentId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Listing_agentId_isFeatured_status_idx" ON "Listing"("agentId", "isFeatured", "status");

CREATE INDEX IF NOT EXISTS "MarketingDeliveryLog_agentId_status_createdAt_idx" ON "MarketingDeliveryLog"("agentId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingDeliveryLog_agentId_blastId_createdAt_idx" ON "MarketingDeliveryLog"("agentId", "blastId", "createdAt");

CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_agentId_eventType_occurredAt_idx" ON "MarketingEmailEvent"("agentId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_agentId_blastId_occurredAt_idx" ON "MarketingEmailEvent"("agentId", "blastId", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_agentId_email_occurredAt_idx" ON "MarketingEmailEvent"("agentId", "email", "occurredAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_messageId_eventType_idx" ON "MarketingEmailEvent"("messageId", "eventType");

CREATE INDEX IF NOT EXISTS "SignatureEnvelope_agentId_createdAt_idx" ON "SignatureEnvelope"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "SignatureEnvelope_agentId_completedAt_idx" ON "SignatureEnvelope"("agentId", "completedAt");
CREATE INDEX IF NOT EXISTS "SignatureEnvelope_dealId_createdAt_idx" ON "SignatureEnvelope"("dealId", "createdAt");
CREATE INDEX IF NOT EXISTS "SignatureEnvelope_type_createdAt_idx" ON "SignatureEnvelope"("type", "createdAt");

CREATE INDEX IF NOT EXISTS "Signer_envelopeId_role_idx" ON "Signer"("envelopeId", "role");
CREATE INDEX IF NOT EXISTS "Signer_envelopeId_signedAt_idx" ON "Signer"("envelopeId", "signedAt");
CREATE INDEX IF NOT EXISTS "Signer_email_idx" ON "Signer"("email");

CREATE INDEX IF NOT EXISTS "LandingPage_agentId_isActive_idx" ON "LandingPage"("agentId", "isActive");
CREATE INDEX IF NOT EXISTS "LandingPage_agentId_createdAt_idx" ON "LandingPage"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "LandingPage_customDomain_idx" ON "LandingPage"("customDomain");

CREATE INDEX IF NOT EXISTS "PageView_landingPageId_visitorId_idx" ON "PageView"("landingPageId", "visitorId");
CREATE INDEX IF NOT EXISTS "PageView_landingPageId_createdAt_idx" ON "PageView"("landingPageId", "createdAt");
CREATE INDEX IF NOT EXISTS "PageView_listingId_createdAt_idx" ON "PageView"("listingId", "createdAt");

CREATE INDEX IF NOT EXISTS "Lead_agentId_createdAt_idx" ON "Lead"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_agentId_source_createdAt_idx" ON "Lead"("agentId", "source", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_agentId_priority_createdAt_idx" ON "Lead"("agentId", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_agentId_converted_createdAt_idx" ON "Lead"("agentId", "converted", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_agentId_landingPageId_createdAt_idx" ON "Lead"("agentId", "landingPageId", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_teamId_createdAt_idx" ON "Lead"("teamId", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_brokerageId_createdAt_idx" ON "Lead"("brokerageId", "createdAt");

CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_listingId_createdAt_idx" ON "LeadActivity"("listingId", "createdAt");

CREATE INDEX IF NOT EXISTS "Client_agentId_email_idx" ON "Client"("agentId", "email");
CREATE INDEX IF NOT EXISTS "Client_agentId_lastMarketingAt_idx" ON "Client"("agentId", "lastMarketingAt");

CREATE INDEX IF NOT EXISTS "LoginAttemptRecord_email_lockedUntil_idx" ON "LoginAttemptRecord"("email", "lockedUntil");
CREATE INDEX IF NOT EXISTS "LoginAttemptRecord_ipAddress_createdAt_idx" ON "LoginAttemptRecord"("ipAddress", "createdAt");

CREATE INDEX IF NOT EXISTS "DistributedLock_expiresAt_idx" ON "DistributedLock"("expiresAt");
CREATE INDEX IF NOT EXISTS "SequenceEnrollment_agentId_status_idx" ON "SequenceEnrollment"("agentId", "status");
