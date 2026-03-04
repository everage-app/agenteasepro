import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

export const router = Router();

// Environment variable helpers
function getEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Encryption helpers (same as googleCalendarService)
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (key) return key;
  const env = (process.env.NODE_ENV || '').toLowerCase();
  if (env === 'development' || env === 'test') {
    return 'dev-only-32-character-secret!!';
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
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = parts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text;
  }
}

// Store OAuth state in memory (in production, use Redis or DB)
const oauthStates = new Map<string, { agentId: string; provider: string; createdAt: Date }>();

// Clean up old states every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [state, data] of oauthStates.entries()) {
    if (now.getTime() - data.createdAt.getTime() > 10 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

// Get base URL for callbacks
function getBaseUrl(): string {
  return getEnv('PUBLIC_APP_URL') || getEnv('APP_BASE_URL') || 'http://localhost:3001';
}

// ============== GOOGLE OAUTH ==============

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

router.get('/google/connect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const agentId = req.agentId;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const clientId = requireEnv('GOOGLE_CLIENT_ID');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/google/callback`;

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, { agentId, provider: 'google', createdAt: new Date() });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Google OAuth connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate Google OAuth' });
  }
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  if (error) {
    return res.redirect('/settings/integrations?error=' + encodeURIComponent(error));
  }

  if (!code || !state) {
    return res.redirect('/settings/integrations?error=missing_params');
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.provider !== 'google') {
    return res.redirect('/settings/integrations?error=invalid_state');
  }

  oauthStates.delete(state);
  const { agentId } = stateData;

  try {
    const clientId = requireEnv('GOOGLE_CLIENT_ID');
    const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token exchange failed:', errText);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = userRes.ok ? await userRes.json() as { email?: string; name?: string } : {};

    // Save to GoogleCalendarConnection
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.googleCalendarConnection.upsert({
      where: { agentId },
      create: {
        agentId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token || ''),
        tokenExpiry: expiresAt,
        calendarId: 'primary',
        syncEnabled: true,
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        tokenExpiry: expiresAt,
        syncEnabled: true,
      },
    });

    // Also update channel connection for display
    await prisma.agentChannelConnection.upsert({
      where: { agentId_type: { agentId, type: 'EMAIL' } },
      create: {
        agentId,
        type: 'EMAIL',
        config: { provider: 'google', email: userInfo.email, name: userInfo.name },
      },
      update: {
        config: { provider: 'google', email: userInfo.email, name: userInfo.name },
      },
    });

    res.redirect('/settings/integrations?connected=google');
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    res.redirect('/settings/integrations?error=' + encodeURIComponent(error.message || 'callback_failed'));
  }
});

// ============== FACEBOOK OAUTH ==============

const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'public_profile',
  'email',
].join(',');

router.get('/facebook/connect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const agentId = req.agentId;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const clientId = requireEnv('FACEBOOK_APP_ID');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/facebook/callback`;

    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, { agentId, provider: 'facebook', createdAt: new Date() });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: FACEBOOK_SCOPES,
      response_type: 'code',
      state,
    });

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Facebook OAuth connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate Facebook OAuth' });
  }
});

router.get('/facebook/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    return res.redirect('/settings/integrations?error=' + encodeURIComponent(error_description || error));
  }

  if (!code || !state) {
    return res.redirect('/settings/integrations?error=missing_params');
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.provider !== 'facebook') {
    return res.redirect('/settings/integrations?error=invalid_state');
  }

  oauthStates.delete(state);
  const { agentId } = stateData;

  try {
    const clientId = requireEnv('FACEBOOK_APP_ID');
    const clientSecret = requireEnv('FACEBOOK_APP_SECRET');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })}`);

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Facebook token exchange failed:', errText);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const tokens = await tokenRes.json() as { access_token: string; expires_in?: number };

    // Get user info and pages
    const [userRes, pagesRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${tokens.access_token}`),
      fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${tokens.access_token}`),
    ]);

    const userInfo = userRes.ok ? await userRes.json() as { id: string; name?: string; email?: string } : { id: '' };
    const pagesData = pagesRes.ok ? await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string }> } : { data: [] };

    // Use the first page if available, or user profile
    const page = pagesData.data?.[0];

    await prisma.agentChannelConnection.upsert({
      where: { agentId_type: { agentId, type: 'FACEBOOK' } },
      create: {
        agentId,
        type: 'FACEBOOK',
        config: {
          accessToken: encrypt(page?.access_token || tokens.access_token),
          userId: userInfo.id,
          userName: userInfo.name,
          userEmail: userInfo.email,
          pageId: page?.id,
          pageName: page?.name || userInfo.name,
          pages: pagesData.data?.map(p => ({ id: p.id, name: p.name })) || [],
        },
      },
      update: {
        config: {
          accessToken: encrypt(page?.access_token || tokens.access_token),
          userId: userInfo.id,
          userName: userInfo.name,
          userEmail: userInfo.email,
          pageId: page?.id,
          pageName: page?.name || userInfo.name,
          pages: pagesData.data?.map(p => ({ id: p.id, name: p.name })) || [],
        },
      },
    });

    res.redirect('/settings/integrations?connected=facebook');
  } catch (error: any) {
    console.error('Facebook OAuth callback error:', error);
    res.redirect('/settings/integrations?error=' + encodeURIComponent(error.message || 'callback_failed'));
  }
});

// ============== INSTAGRAM OAUTH (via Facebook) ==============

const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
].join(',');

router.get('/instagram/connect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const agentId = req.agentId;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const clientId = requireEnv('FACEBOOK_APP_ID');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/instagram/callback`;

    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, { agentId, provider: 'instagram', createdAt: new Date() });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: INSTAGRAM_SCOPES,
      response_type: 'code',
      state,
    });

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Instagram OAuth connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate Instagram OAuth' });
  }
});

router.get('/instagram/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    return res.redirect('/settings/integrations?error=' + encodeURIComponent(error_description || error));
  }

  if (!code || !state) {
    return res.redirect('/settings/integrations?error=missing_params');
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.provider !== 'instagram') {
    return res.redirect('/settings/integrations?error=invalid_state');
  }

  oauthStates.delete(state);
  const { agentId } = stateData;

  try {
    const clientId = requireEnv('FACEBOOK_APP_ID');
    const clientSecret = requireEnv('FACEBOOK_APP_SECRET');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/instagram/callback`;

    // Exchange code for access token
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })}`);

    if (!tokenRes.ok) {
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const tokens = await tokenRes.json() as { access_token: string };

    // Get pages and their Instagram Business accounts
    const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account&access_token=${tokens.access_token}`);
    const pagesData = pagesRes.ok ? await pagesRes.json() as { data?: Array<{ id: string; name: string; instagram_business_account?: { id: string }; access_token?: string }> } : { data: [] };

    // Find first page with Instagram business account
    const pageWithInstagram = pagesData.data?.find(p => p.instagram_business_account);

    if (!pageWithInstagram?.instagram_business_account) {
      return res.redirect('/settings/integrations?error=no_instagram_business_account');
    }

    // Get Instagram account info
    const igRes = await fetch(`https://graph.facebook.com/v18.0/${pageWithInstagram.instagram_business_account.id}?fields=id,username,name,profile_picture_url&access_token=${tokens.access_token}`);
    const igInfo = igRes.ok ? await igRes.json() as { id: string; username?: string; name?: string; profile_picture_url?: string } : { id: pageWithInstagram.instagram_business_account.id };

    await prisma.agentChannelConnection.upsert({
      where: { agentId_type: { agentId, type: 'INSTAGRAM' } },
      create: {
        agentId,
        type: 'INSTAGRAM',
        config: {
          accessToken: encrypt(tokens.access_token),
          instagramId: igInfo.id,
          username: igInfo.username,
          pageName: igInfo.name || igInfo.username,
          profilePicture: igInfo.profile_picture_url,
          facebookPageId: pageWithInstagram.id,
        },
      },
      update: {
        config: {
          accessToken: encrypt(tokens.access_token),
          instagramId: igInfo.id,
          username: igInfo.username,
          pageName: igInfo.name || igInfo.username,
          profilePicture: igInfo.profile_picture_url,
          facebookPageId: pageWithInstagram.id,
        },
      },
    });

    res.redirect('/settings/integrations?connected=instagram');
  } catch (error: any) {
    console.error('Instagram OAuth callback error:', error);
    res.redirect('/settings/integrations?error=' + encodeURIComponent(error.message || 'callback_failed'));
  }
});

// ============== LINKEDIN OAUTH ==============

const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
].join(' ');

router.get('/linkedin/connect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const agentId = req.agentId;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const clientId = requireEnv('LINKEDIN_CLIENT_ID');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/linkedin/callback`;

    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, { agentId, provider: 'linkedin', createdAt: new Date() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: LINKEDIN_SCOPES,
      state,
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('LinkedIn OAuth connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate LinkedIn OAuth' });
  }
});

router.get('/linkedin/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    return res.redirect('/settings/integrations?error=' + encodeURIComponent(error_description || error));
  }

  if (!code || !state) {
    return res.redirect('/settings/integrations?error=missing_params');
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.provider !== 'linkedin') {
    return res.redirect('/settings/integrations?error=invalid_state');
  }

  oauthStates.delete(state);
  const { agentId } = stateData;

  try {
    const clientId = requireEnv('LINKEDIN_CLIENT_ID');
    const clientSecret = requireEnv('LINKEDIN_CLIENT_SECRET');
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/oauth/linkedin/callback`;

    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('LinkedIn token exchange failed:', errText);
      return res.redirect('/settings/integrations?error=token_exchange_failed');
    }

    const tokens = await tokenRes.json() as { access_token: string; expires_in: number };

    // Get user profile
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = profileRes.ok ? await profileRes.json() as { 
      sub: string;
      name?: string;
      email?: string;
      picture?: string;
    } : { sub: '' };

    await prisma.agentChannelConnection.upsert({
      where: { agentId_type: { agentId, type: 'LINKEDIN' } },
      create: {
        agentId,
        type: 'LINKEDIN',
        config: {
          accessToken: encrypt(tokens.access_token),
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          userId: profile.sub,
          displayName: profile.name,
          email: profile.email,
          profilePicture: profile.picture,
        },
      },
      update: {
        config: {
          accessToken: encrypt(tokens.access_token),
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          userId: profile.sub,
          displayName: profile.name,
          email: profile.email,
          profilePicture: profile.picture,
        },
      },
    });

    res.redirect('/settings/integrations?connected=linkedin');
  } catch (error: any) {
    console.error('LinkedIn OAuth callback error:', error);
    res.redirect('/settings/integrations?error=' + encodeURIComponent(error.message || 'callback_failed'));
  }
});

// ============== DISCONNECT ==============

router.delete('/:provider/disconnect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const agentId = req.agentId;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  const { provider } = req.params;

  try {
    if (provider === 'google') {
      await prisma.googleCalendarConnection.delete({
        where: { agentId },
      }).catch(() => {}); // Ignore if doesn't exist

      // Also remove email channel if it was Google
      const emailChannel = await prisma.agentChannelConnection.findUnique({
        where: { agentId_type: { agentId, type: 'EMAIL' } },
      });
      if ((emailChannel?.config as any)?.provider === 'google') {
        await prisma.agentChannelConnection.delete({
          where: { agentId_type: { agentId, type: 'EMAIL' } },
        });
      }
    } else {
      const typeMap: Record<string, string> = {
        facebook: 'FACEBOOK',
        instagram: 'INSTAGRAM',
        linkedin: 'LINKEDIN',
      };

      const type = typeMap[provider];
      if (type) {
        await prisma.agentChannelConnection.delete({
          where: { agentId_type: { agentId, type: type as any } },
        }).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(`${provider} disconnect error:`, error);
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
});

// ============== STATUS CHECK ==============

router.get('/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const agentId = req.agentId;
  if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [googleConnection, channels] = await Promise.all([
      prisma.googleCalendarConnection.findUnique({ where: { agentId } }),
      prisma.agentChannelConnection.findMany({ where: { agentId } }),
    ]);

    const status: Record<string, { connected: boolean; displayName?: string }> = {
      google: { 
        connected: !!googleConnection,
        displayName: googleConnection ? 'Connected' : undefined,
      },
    };

    for (const channel of channels) {
      const config = channel.config as any;
      if (channel.type === 'FACEBOOK') {
        status.facebook = { connected: true, displayName: config?.pageName };
      } else if (channel.type === 'INSTAGRAM') {
        status.instagram = { connected: true, displayName: config?.username || config?.pageName };
      } else if (channel.type === 'LINKEDIN') {
        status.linkedin = { connected: true, displayName: config?.displayName };
      }
    }

    res.json(status);
  } catch (error: any) {
    console.error('OAuth status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get status' });
  }
});
