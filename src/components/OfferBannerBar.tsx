"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY_PREFIX = "offer-banner-dismissed-";

type OfferBanner = {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  image_url: string | null;
};

/** Slim, dismissible promotional strip — distinct from the sitewide site_settings.announcement_bar.
 * Reads the highest-priority currently-active row from offer_banners (admin-managed at
 * /admin/offers/banners), which previously had no public renderer at all. */
export function OfferBannerBar() {
  const [banner, setBanner] = useState<OfferBanner | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    fetch("/api/offer-banners/active")
      .then((r) => (r.ok ? r.json() : { banner: null }))
      .then((d) => {
        const b = d?.banner as OfferBanner | null;
        if (!b) return;
        const dismissedUntil = typeof window !== "undefined" ? localStorage.getItem(`${DISMISS_KEY_PREFIX}${b.id}`) : null;
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;
        setBanner(b);
        setDismissed(false);
      })
      .catch(() => {});
  }, []);

  function handleDismiss() {
    if (!banner) return;
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${banner.id}`, String(until));
    setDismissed(true);
  }

  if (!banner || dismissed) return null;

  const content = (
    <span className="text-sm font-semibold">
      {banner.title ? <strong className="font-bold">{banner.title}: </strong> : null}
      {banner.message}
    </span>
  );

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-[#1A1A1A] text-white text-center">
      {banner.link_url ? (
        <Link href={banner.link_url} className="hover:underline text-white">
          {content}
        </Link>
      ) : (
        content
      )}
      <button
        type="button"
        onClick={handleDismiss}
        className="text-white/60 hover:text-white transition-opacity text-base leading-none"
        aria-label="Dismiss offer"
      >
        ×
      </button>
    </div>
  );
}
