export type LeadMailingAddress = {
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
};

type LeadMailingAddressSource = LeadMailingAddress & {
  notes?: string | null;
};

const trimValue = (value?: string | null) => String(value || '').trim();

export function normalizeLeadMailingAddress(address?: LeadMailingAddress | null): LeadMailingAddress {
  return {
    mailingAddress: trimValue(address?.mailingAddress) || null,
    mailingCity: trimValue(address?.mailingCity) || null,
    mailingState: trimValue(address?.mailingState) || null,
    mailingZip: trimValue(address?.mailingZip) || null,
  };
}

export function hasLeadMailingAddress(address?: LeadMailingAddress | null) {
  if (!address) return false;
  return Boolean(
    trimValue(address.mailingAddress) ||
      trimValue(address.mailingCity) ||
      trimValue(address.mailingState) ||
      trimValue(address.mailingZip),
  );
}

export function hasCompleteLeadMailingAddress(address?: LeadMailingAddress | null) {
  if (!address) return false;
  return Boolean(
    trimValue(address.mailingAddress) &&
      trimValue(address.mailingCity) &&
      trimValue(address.mailingState) &&
      trimValue(address.mailingZip),
  );
}

export function stripImportedMailingAddressBlock(notes?: string | null) {
  return String(notes || '')
    .replace(/(?:\n{0,2})Imported mailing address:\nStreet:\s*.*\nCity:\s*.*\nState:\s*.*\nZIP:\s*.*(?=\n|$)/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function appendImportedMailingAddressToNotes(notes: string | undefined, address: LeadMailingAddress) {
  const baseNotes = stripImportedMailingAddressBlock(notes);
  if (!hasLeadMailingAddress(address)) {
    return baseNotes || undefined;
  }

  const block = [
    'Imported mailing address:',
    `Street: ${trimValue(address.mailingAddress)}`,
    `City: ${trimValue(address.mailingCity)}`,
    `State: ${trimValue(address.mailingState)}`,
    `ZIP: ${trimValue(address.mailingZip)}`,
  ].join('\n');

  return baseNotes ? `${baseNotes}\n\n${block}` : block;
}

export function extractLeadMailingAddressFromNotes(notes?: string | null): LeadMailingAddress {
  const source = String(notes || '');
  const blockMatch = source.match(/(?:^|\n)Imported mailing address:\nStreet:\s*(.*)\nCity:\s*(.*)\nState:\s*(.*)\nZIP:\s*(.*)(?:\n|$)/i);
  if (!blockMatch) {
    return normalizeLeadMailingAddress();
  }

  return normalizeLeadMailingAddress({
    mailingAddress: trimValue(blockMatch[1]) || null,
    mailingCity: trimValue(blockMatch[2]) || null,
    mailingState: trimValue(blockMatch[3]) || null,
    mailingZip: trimValue(blockMatch[4]) || null,
  });
}

export function resolveLeadMailingAddress(source?: LeadMailingAddressSource | null): LeadMailingAddress {
  const direct = normalizeLeadMailingAddress(source);
  if (hasLeadMailingAddress(direct)) {
    return direct;
  }

  return extractLeadMailingAddressFromNotes(source?.notes);
}