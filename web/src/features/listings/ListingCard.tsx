import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { ListingSummary } from '../../types/listing';

type Props = {
  listing: ListingSummary;
  onEdit: () => void;
  onLaunchBlast: () => void;
};

const statusLabelMap: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ACTIVE_NO_SHOW: 'Active - No Show',
  PENDING: 'Pending',
  UNDER_CONTRACT: 'Under Contract',
  BACKUP: 'Backup',
  SOLD: 'Sold',
  WITHDRAWN: 'Withdrawn',
  CANCELED: 'Canceled',
  EXPIRED: 'Expired',
  OFF_MARKET: 'Off Market',
};

// Beautiful status badge styles - best in class UX
const statusStyles: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  DRAFT: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-300',
    border: 'border-slate-400/30',
    icon: '✏️',
  },
  ACTIVE: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-400/40',
    icon: '🟢',
  },
  ACTIVE_NO_SHOW: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-400/40',
    icon: '🚫',
  },
  PENDING: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-300',
    border: 'border-yellow-400/40',
    icon: '⏳',
  },
  UNDER_CONTRACT: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-300',
    border: 'border-blue-400/40',
    icon: '📝',
  },
  BACKUP: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-400/40',
    icon: '🔄',
  },
  SOLD: {
    bg: 'bg-rose-500/20',
    text: 'text-rose-300',
    border: 'border-rose-400/40',
    icon: '🎉',
  },
  WITHDRAWN: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-300',
    border: 'border-orange-400/40',
    icon: '⏸️',
  },
  CANCELED: {
    bg: 'bg-red-500/20',
    text: 'text-red-300',
    border: 'border-red-400/40',
    icon: '❌',
  },
  EXPIRED: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-400/40',
    icon: '⌛',
  },
  OFF_MARKET: {
    bg: 'bg-slate-600/20',
    text: 'text-slate-400',
    border: 'border-slate-500/40',
    icon: '🏠',
  },
};

export function ListingCard({ listing, onEdit, onLaunchBlast }: Props) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  
  const {
    addressLine1,
    city,
    state,
    zipCode,
    price,
    beds,
    baths,
    sqft,
    status,
    heroImageUrl,
    totalBlasts,
    totalClicks,
    isFeatured,
  } = listing;

  const fullAddress = [addressLine1, city, state, zipCode].filter(Boolean).join(', ');
  const mapUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : '';
  
  // Generate listing-specific URLs for QR codes
  const listingLandingUrl = `${window.location.origin}/listing/${listing.id}`;
  const listingLeadCaptureUrl = `${window.location.origin}/api/integrations/lead-capture?listingId=${listing.id}&label=${encodeURIComponent(addressLine1)}`;
  
  const handleCopyAddress = () => {
    if (!fullAddress) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullAddress);
      return;
    }
  };

  const copyUrl = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyNotice(`${label} copied!`);
      setTimeout(() => setCopyNotice(null), 2000);
    } catch {
      setCopyNotice('Copy failed');
      setTimeout(() => setCopyNotice(null), 2000);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/85 text-xs text-slate-200 shadow-[0_22px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      {/* Image */}
      <div className="relative h-36 w-full overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={addressLine1}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 text-[11px] text-slate-400">
            No photo yet
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {(() => {
            const style = statusStyles[status] || statusStyles.OFF_MARKET;
            return (
              <span 
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md shadow-lg ${style.bg} ${style.text} ${style.border}`}
              >
                <span className="text-[9px]">{style.icon}</span>
                {statusLabelMap[status] ?? status}
              </span>
            );
          })()}
          {isFeatured && (
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-1 text-[10px] font-bold text-slate-900 shadow-lg shadow-amber-400/30">
              ⭐ Featured
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-50">{addressLine1}</p>
          <p className="text-[11px] text-slate-400">
            {city}, {state} {zipCode}
          </p>
        </div>

        {fullAddress && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
            >
              🗺️ Map
            </a>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="rounded-full border border-slate-400/30 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
            >
              📋 Copy address
            </button>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="font-semibold text-slate-50">
            ${new Intl.NumberFormat('en-US').format(price)}
          </span>
          {beds != null && <span className="text-slate-400">{beds} bd</span>}
          {baths != null && <span className="text-slate-400">{baths} ba</span>}
          {sqft != null && (
            <span className="text-slate-400">
              {new Intl.NumberFormat('en-US').format(sqft)} sqft
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            Blasts: <span className="text-slate-200">{totalBlasts}</span>
          </span>
          <span>
            Clicks: <span className="text-slate-200">{totalClicks}</span>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[11px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-100 transition-colors hover:border-cyan-400 hover:text-cyan-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-slate-100 transition-colors hover:border-purple-400 hover:text-purple-100"
            title="Generate QR Code"
          >
            📱
          </button>
        </div>
        <button
          type="button"
          onClick={onLaunchBlast}
          className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-slate-50 shadow-lg shadow-blue-500/40 transition-colors hover:bg-blue-500"
        >
          Launch blast
        </button>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => setShowQrModal(false)}
        >
          <div 
            className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-6 text-slate-900 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ✕
            </button>
            
            {/* Header */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">📱 Listing QR Codes</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{addressLine1}</p>
            </div>

            {/* Copy notice */}
            {copyNotice && (
              <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-400/30 dark:text-emerald-200">
                {copyNotice}
              </div>
            )}

            {/* QR Code Options */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Landing Page QR */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/50">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Listing Page</div>
                <div className="flex justify-center mb-3">
                  <div className="rounded-lg bg-white p-2">
                    <QRCodeSVG
                      value={listingLandingUrl}
                      size={100}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-2 text-center">
                  Links to listing details page
                </p>
                <button
                  onClick={() => copyUrl(listingLandingUrl, 'Listing URL')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Copy URL
                </button>
              </div>

              {/* Lead Capture QR */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/50">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Lead Capture</div>
                <div className="flex justify-center mb-3">
                  <div className="rounded-lg bg-white p-2">
                    <QRCodeSVG
                      value={listingLeadCaptureUrl}
                      size={100}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-2 text-center">
                  Captures leads tagged with this listing
                </p>
                <button
                  onClick={() => copyUrl(listingLeadCaptureUrl, 'Lead capture URL')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Copy URL
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 text-[10px] text-slate-500 dark:border-white/10">
              💡 Print these QR codes on yard signs, flyers, open house materials, or share digitally to drive traffic.
            </div>
          </div>
        </div>
      )}    </article>
  );
}