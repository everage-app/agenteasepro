-- CreateTable
CREATE TABLE "InternalEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "kind" TEXT NOT NULL,
    "path" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalError" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'client',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalEvent_createdAt_idx" ON "InternalEvent"("createdAt");

-- CreateIndex
CREATE INDEX "InternalEvent_agentId_createdAt_idx" ON "InternalEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalEvent_kind_createdAt_idx" ON "InternalEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "InternalError_createdAt_idx" ON "InternalError"("createdAt");

-- CreateIndex
CREATE INDEX "InternalError_agentId_createdAt_idx" ON "InternalError"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalError_source_createdAt_idx" ON "InternalError"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "InternalEvent" ADD CONSTRAINT "InternalEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalError" ADD CONSTRAINT "InternalError_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
