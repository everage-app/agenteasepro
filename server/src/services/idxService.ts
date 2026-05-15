import { prisma } from '../lib/prisma';
import crypto from 'crypto';

type IdxProviderType = 'UTAH_RESO_WEBAPI' | 'GENERIC_API';


// Get encryption key - fallback only allowed in development/test mode
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (key) return key;
  const env = (process.env.NODE_ENV || '').toLowerCase();
  if (env === 'development' || env === 'test') {
    return 'dev-only-32-character-secret!!'; // 32 chars for aes-256
  }
  throw new Error('ENCRYPTION_KEY environment variable is required in production');
}
const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  if (!text) return '';
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function maskSecret(value: string | null): string {
  if (!value) return '';
  return '••••••••••••' + value.slice(-4);
}

interface IdxConnectionInput {
  providerType: IdxProviderType;
  vendorName?: string;
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  serverToken?: string;
  browserToken?: string;
  apiKey?: string;
  mlsAgentIds?: string;
}

export async function getIdxConnectionForAgent(agentId: string) {
  const connection = await prisma.idxConnection.findUnique({
    where: { agentId },
  });

  if (!connection) {
    return null;
  }

  // Return with masked secrets for security
  return {
    id: connection.id,
    providerType: connection.providerType,
    vendorName: connection.vendorName,
    baseUrl: connection.baseUrl,
    clientId: connection.clientId ? maskSecret(connection.clientId) : '',
    clientSecret: connection.clientSecret ? maskSecret(connection.clientSecret) : '',
    serverToken: connection.serverToken ? maskSecret(connection.serverToken) : '',
    browserToken: connection.browserToken ? maskSecret(connection.browserToken) : '',
    apiKey: connection.apiKey ? maskSecret(connection.apiKey) : '',
    mlsAgentIds: connection.mlsAgentIds || '',
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export async function upsertIdxConnection(agentId: string, input: IdxConnectionInput) {
  // Encrypt sensitive fields
  const data: any = {
    providerType: input.providerType,
    vendorName: input.vendorName || null,
    baseUrl: input.baseUrl,
    mlsAgentIds: input.mlsAgentIds || null,
  };

  // Only update secrets if they're not masked (i.e., user provided new values)
  if (input.clientId && !input.clientId.startsWith('••••')) {
    data.clientId = encrypt(input.clientId);
  }
  if (input.clientSecret && !input.clientSecret.startsWith('••••')) {
    data.clientSecret = encrypt(input.clientSecret);
  }
  if (input.serverToken && !input.serverToken.startsWith('••••')) {
    data.serverToken = encrypt(input.serverToken);
  }
  if (input.browserToken && !input.browserToken.startsWith('••••')) {
    data.browserToken = encrypt(input.browserToken);
  }
  if (input.apiKey && !input.apiKey.startsWith('••••')) {
    data.apiKey = encrypt(input.apiKey);
  }

  const connection = await prisma.idxConnection.upsert({
    where: { agentId },
    create: {
      agentId,
      ...data,
    },
    update: data,
  });

  return connection;
}

export async function testIdxConnection(agentId: string): Promise<{ ok: boolean; sampleListingCount?: number; error?: string }> {
  const connection = await prisma.idxConnection.findUnique({
    where: { agentId },
  });

  if (!connection) {
    return { ok: false, error: 'No IDX connection found. Please save your credentials first.' };
  }

  try {
    // TODO: Implement actual API calls based on provider type
    // For now, this is a stub that validates the connection exists
    
    if (connection.providerType === 'UTAH_RESO_WEBAPI') {
      // TODO: Implement RESO Web API test
      // 1. Decrypt credentials
      // 2. Make OAuth token request if needed
      // 3. Call a lightweight endpoint like /Metadata or /Property?$top=1
      // 4. Verify response
      
      // Stub response for now
      console.log('Testing Utah RESO Web API connection for agent:', agentId);
      console.log('Base URL:', connection.baseUrl);
      // NEVER log secrets!
      
      // Simulate success
      return { ok: true, sampleListingCount: 1 };
    } else if (connection.providerType === 'GENERIC_API') {
      // TODO: Implement generic API test
      // 1. Decrypt API key
      // 2. Make GET request to baseUrl/listings?limit=1 or similar
      // 3. Verify response
      
      // Stub response for now
      console.log('Testing generic IDX API connection for agent:', agentId);
      console.log('Base URL:', connection.baseUrl);
      // NEVER log secrets!
      
      // Simulate success
      return { ok: true, sampleListingCount: 1 };
    }

    return { ok: false, error: 'Unknown provider type' };
  } catch (error: any) {
    console.error('IDX connection test failed:', error.message);
    // NEVER expose internal error details that might leak credentials
    return { ok: false, error: 'Connection test failed. Please check your credentials.' };
  }
}

// Helper to decrypt credentials for internal use only (e.g., actual API calls)
export async function getDecryptedCredentials(agentId: string) {
  const connection = await prisma.idxConnection.findUnique({
    where: { agentId },
  });

  if (!connection) {
    return null;
  }

  return {
    providerType: connection.providerType,
    vendorName: connection.vendorName,
    baseUrl: connection.baseUrl,
    clientId: connection.clientId ? decrypt(connection.clientId) : null,
    clientSecret: connection.clientSecret ? decrypt(connection.clientSecret) : null,
    serverToken: connection.serverToken ? decrypt(connection.serverToken) : null,
    browserToken: connection.browserToken ? decrypt(connection.browserToken) : null,
    apiKey: connection.apiKey ? decrypt(connection.apiKey) : null,
    mlsAgentIds: connection.mlsAgentIds,
  };
}
