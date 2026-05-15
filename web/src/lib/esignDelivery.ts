export type EnvelopeLink = {
  signerId: string;
  url: string;
  name?: string | null;
  role?: string | null;
  email?: string | null;
  deliveryMethod?: 'EMAIL' | 'LINK_ONLY';
};

export type EnvelopeEmailStatus = {
  sent?: number;
  failed?: number;
  skipped?: number;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const formatRoleLabel = (role?: string | null) => {
  switch ((role || '').toUpperCase()) {
    case 'BUYER':
      return 'Buyer';
    case 'SELLER':
      return 'Seller';
    case 'AGENT':
      return 'Agent';
    case 'OTHER':
      return 'Other';
    default:
      return 'Signer';
  }
};

const isLinkOnly = (link: EnvelopeLink) =>
  link.deliveryMethod === 'LINK_ONLY' || !String(link.email || '').trim();

export const getEnvelopeLinkCounts = (links: EnvelopeLink[]) => ({
  emailed: links.filter((link) => !isLinkOnly(link)).length,
  linkOnly: links.filter((link) => isLinkOnly(link)).length,
});

export const getEnvelopeLinkSubtitle = (links: EnvelopeLink[]) => {
  const counts = getEnvelopeLinkCounts(links);

  if (counts.emailed > 0 && counts.linkOnly > 0) {
    return `${pluralize(counts.emailed, 'recipient')} received email delivery, and ${pluralize(counts.linkOnly, 'signing link')} ${counts.linkOnly === 1 ? 'is' : 'are'} ready to share manually.`;
  }

  if (counts.linkOnly > 0) {
    return `${pluralize(counts.linkOnly, 'signing link')} ${counts.linkOnly === 1 ? 'is' : 'are'} ready to share by text, chat, or in person.`;
  }

  if (counts.emailed > 0) {
    return 'Emails were sent automatically. Use these links for backup sharing if needed.';
  }

  return 'Secure signing links are ready to share.';
};

export const getEnvelopeLinkPrimaryLabel = (link: EnvelopeLink, index: number) => {
  const name = String(link.name || '').trim();
  const roleLabel = formatRoleLabel(link.role);

  if (name && roleLabel !== 'Signer') {
    return `${name} (${roleLabel})`;
  }

  return name || roleLabel || `Signer ${index + 1}`;
};

export const getEnvelopeLinkDeliveryLabel = (link: EnvelopeLink) => {
  if (isLinkOnly(link)) {
    return 'Share manually';
  }

  return `Email: ${String(link.email || '').trim()}`;
};

export const buildEnvelopeSendToast = (
  status?: EnvelopeEmailStatus | null,
  options: { quick?: boolean } = {},
) => {
  const sent = Number(status?.sent || 0);
  const failed = Number(status?.failed || 0);
  const skipped = Number(status?.skipped || 0);

  if (sent > 0 && failed === 0 && skipped === 0) {
    return {
      type: 'success' as const,
      message: `${options.quick ? 'Quick send complete.' : 'Envelope ready.'} ${pluralize(sent, 'email')} delivered.`,
    };
  }

  if (sent > 0 && failed === 0 && skipped > 0) {
    return {
      type: 'success' as const,
      message: `${options.quick ? 'Quick send complete.' : 'Envelope ready.'} ${pluralize(sent, 'email')} sent and ${pluralize(skipped, 'signing link')} ready to share.`,
    };
  }

  if (sent === 0 && failed === 0 && skipped > 0) {
    return {
      type: 'success' as const,
      message: `${options.quick ? 'Quick send prepared' : 'Envelope created.'} ${pluralize(skipped, 'signing link')} ready to share manually.`,
    };
  }

  if (sent > 0 && failed > 0) {
    return {
      type: 'warning' as const,
      message: `${options.quick ? 'Quick send created the envelope.' : 'Envelope created.'} ${pluralize(sent, 'email')} sent, ${pluralize(failed, 'email')} failed${skipped > 0 ? `, and ${pluralize(skipped, 'signing link')} ready to share` : ''}.`,
    };
  }

  if (failed > 0) {
    return {
      type: 'warning' as const,
      message: `${options.quick ? 'Quick send created the envelope,' : 'Envelope created,'} but ${pluralize(failed, 'email')} failed${skipped > 0 ? `. ${pluralize(skipped, 'signing link')} ready to share manually.` : '.'}`,
    };
  }

  return {
    type: 'success' as const,
    message: options.quick ? 'Quick send launched.' : 'Envelope sent for signature!',
  };
};