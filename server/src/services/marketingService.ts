import { BlastPlaybook, MarketingBlast, BlastChannel, BlastChannelType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { aiDraftMarketingCopy } from './aiService';
import { prisma } from '../lib/prisma';

const DEFAULT_CHANNELS: BlastChannelType[] = [
  BlastChannelType.FACEBOOK,
  BlastChannelType.INSTAGRAM,
  BlastChannelType.LINKEDIN,
  BlastChannelType.X,
  BlastChannelType.EMAIL,
  BlastChannelType.SMS,
  BlastChannelType.WEBSITE,
];

function titleForPlaybook(playbook: BlastPlaybook, listing?: { headline?: string | null } | null): string {
  const fallback = listing?.headline ?? 'Marketing blast';
  const address = listing?.headline ?? fallback;
  switch (playbook) {
    case BlastPlaybook.NEW_LISTING:
      return `New listing – ${address}`;
    case BlastPlaybook.PRICE_REDUCTION:
      return `Price drop – ${address}`;
    case BlastPlaybook.OPEN_HOUSE:
      return `Open house invite – ${address}`;
    case BlastPlaybook.UNDER_CONTRACT:
      return `Under contract – ${address}`;
    case BlastPlaybook.JUST_SOLD:
      return `Just sold – ${address}`;
    default:
      return fallback;
  }
}

function listingTargetUrl(listingId?: string | null): string {
  const appBase = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
  return listingId ? `${appBase}/listings/${listingId}` : `${appBase}/dashboard`;
}

function createShortCode(length = 7): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export async function generateUniqueShortCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = createShortCode();
    const existing = await prisma.blastChannel.findUnique({ where: { shortCode: code } });
    if (!existing) return code;
    attempts += 1;
  }
  // Fallback to timestamp-based code if collisions continue
  return `${Date.now().toString(36).slice(-6)}`;
}

export async function createBlastFromListing(input: {
  agentId: string;
  listingId: string;
  playbook: BlastPlaybook;
  channels?: BlastChannelType[];
}): Promise<MarketingBlast & { channels: BlastChannel[] }> {
  const listing = await prisma.listing.findFirst({
    where: { id: input.listingId, agentId: input.agentId },
  });
  if (!listing) {
    throw new Error('Listing not found for this agent');
  }

  const selectedChannels = (input.channels && input.channels.length > 0 ? input.channels : DEFAULT_CHANNELS).filter(
    (c) => DEFAULT_CHANNELS.includes(c),
  );
  const selectedSet = new Set(selectedChannels);

  const created = await prisma.marketingBlast.create({
    data: {
      agentId: input.agentId,
      listingId: listing.id,
      title: titleForPlaybook(input.playbook, listing),
      playbook: input.playbook,
      channels: {
        create: DEFAULT_CHANNELS.map((channel) => ({ channel, enabled: selectedSet.has(channel) })),
      },
    },
    include: {
      channels: true,
      listing: true,
    },
  });

  // Increment the listing's totalBlasts counter
  await prisma.listing.update({
    where: { id: listing.id },
    data: { totalBlasts: { increment: 1 } },
  });

  return created;
}

export async function generateBlastContent(
  blastId: string,
): Promise<MarketingBlast & { channels: BlastChannel[] }> {
  const blast = await prisma.marketingBlast.findUnique({
    where: { id: blastId },
    include: { channels: true, listing: true },
  });
  if (!blast) {
    throw new Error('Blast not found');
  }

  const copy = await aiDraftMarketingCopy({
    listing: blast.listing,
    playbook: blast.playbook,
  });

  await prisma.$transaction(
    blast.channels.map((channel) => {
      let previewText = channel.previewText;
      let previewHtml = channel.previewHtml;

      switch (channel.channel) {
        case BlastChannelType.FACEBOOK:
        case BlastChannelType.INSTAGRAM:
        case BlastChannelType.X:
          previewText = copy.social;
          break;
        case BlastChannelType.LINKEDIN:
          previewText = copy.linkedin;
          break;
        case BlastChannelType.EMAIL:
          previewText = copy.emailSubject;
          previewHtml = copy.emailBodyHtml;
          break;
        case BlastChannelType.SMS:
          previewText = copy.sms;
          break;
        case BlastChannelType.WEBSITE:
          previewHtml = copy.websiteIntro;
          break;
      }

      return prisma.blastChannel.update({
        where: { id: channel.id },
        data: { previewText, previewHtml },
      });
    }),
  );

  const updated = await prisma.marketingBlast.findUnique({
    where: { id: blastId },
    include: { channels: true, listing: true },
  });

  if (!updated) throw new Error('Blast not found after update');
  return updated;
}

export async function registerBlastClick(
  shortCode: string,
  meta: { ip?: string; userAgent?: string },
): Promise<string | null> {
  if (!shortCode) return null;
  const channel = await prisma.blastChannel.findUnique({
    where: { shortCode },
    include: {
      blast: {
        include: { listing: true },
      },
    },
  });
  if (!channel || !channel.blast) return null;

  let isUnique = true;
  if (meta.ip || meta.userAgent) {
    const existing = await prisma.blastHit.findFirst({
      where: {
        channelId: channel.id,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
    if (existing) {
      isUnique = false;
    }
  }

  await prisma.blastHit.create({
    data: {
      channelId: channel.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  await prisma.blastChannel.update({
    where: { id: channel.id },
    data: {
      clicks: { increment: 1 },
      uniqueClicks: { increment: isUnique ? 1 : 0 },
    },
  });

  return listingTargetUrl(channel.blast.listingId);
}

export function computeShortLink(baseUrl: string, shortCode: string): string {
  return `${baseUrl.replace(/\/$/, '')}/go/${shortCode}`;
}

export function resolveBlastDestination(blast: MarketingBlast & { listing?: { headline?: string | null } | null }): string {
  return listingTargetUrl(blast.listingId);
}

export { DEFAULT_CHANNELS };
