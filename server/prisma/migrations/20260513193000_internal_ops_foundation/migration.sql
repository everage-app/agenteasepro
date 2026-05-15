CREATE TYPE "InternalStaffRole" AS ENUM ('OWNER', 'ADMIN', 'SUPPORT', 'BILLING', 'SALES', 'PRODUCT', 'ENGINEERING', 'READ_ONLY');

ALTER TABLE "SupportRequest"
  ADD COLUMN "assignedToAgentId" TEXT,
  ADD COLUMN "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN "dueAt" TIMESTAMP(3);

CREATE TABLE "InternalStaff" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "role" "InternalStaffRole" NOT NULL DEFAULT 'READ_ONLY',
  "title" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "lastAccessAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalStaff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalAuditLog" (
  "id" TEXT NOT NULL,
  "actorAgentId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "summary" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "requestId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalStaff_agentId_key" ON "InternalStaff"("agentId");
CREATE INDEX "InternalStaff_role_active_idx" ON "InternalStaff"("role", "active");
CREATE INDEX "InternalAuditLog_createdAt_idx" ON "InternalAuditLog"("createdAt");
CREATE INDEX "InternalAuditLog_actorAgentId_createdAt_idx" ON "InternalAuditLog"("actorAgentId", "createdAt");
CREATE INDEX "InternalAuditLog_targetType_targetId_idx" ON "InternalAuditLog"("targetType", "targetId");
CREATE INDEX "InternalAuditLog_action_createdAt_idx" ON "InternalAuditLog"("action", "createdAt");
CREATE INDEX "SupportRequest_assignedToAgentId_status_idx" ON "SupportRequest"("assignedToAgentId", "status");
CREATE INDEX "SupportRequest_status_priority_createdAt_idx" ON "SupportRequest"("status", "priority", "createdAt");
CREATE INDEX "SupportRequest_dueAt_idx" ON "SupportRequest"("dueAt");

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedToAgentId_fkey" FOREIGN KEY ("assignedToAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternalStaff" ADD CONSTRAINT "InternalStaff_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalAuditLog" ADD CONSTRAINT "InternalAuditLog_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;