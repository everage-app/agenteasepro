-- CreateEnum
CREATE TYPE "ChannelConnectionType" AS ENUM ('EMAIL', 'SMS', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'WEBSITE');

-- CreateTable
CREATE TABLE "AgentChannelConnection" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" "ChannelConnectionType" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentChannelConnection_agentId_type_key" ON "AgentChannelConnection"("agentId", "type");

-- AddForeignKey
ALTER TABLE "AgentChannelConnection" ADD CONSTRAINT "AgentChannelConnection_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
