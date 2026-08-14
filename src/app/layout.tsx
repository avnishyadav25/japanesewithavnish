import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { unstable_cache } from "next/cache";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { OrganizationSchema } from "@/components/JsonLd";
import { ThirdPartyScripts } from "@/components/ThirdPartyScripts";
import { sql } from "@/lib/db";

// Monetag zone IDs change rarely; querying them on every single request blocked
// TTFB site-wide (flagged by the perf audit). Cache for 5 minutes instead.
const getMonetagZones = unstable_cache(
  async () => {
    if (!sql) return { inpage: "", vignette: "" };
    const rows = (await sql`
      SELECT key, value
      FROM site_settings
      WHERE key = ANY(ARRAY['monetag_inpage_zone_id', 'monetag_vignette_zone_id'])
    `) as { key: string; value: unknown }[];
    let inpage = "";
    let vignette = "";
    rows.forEach((row) => {
      const v = typeof row.value === "string" ? row.value : "";
      if (row.key === "monetag_inpage_zone_id") inpage = v;
      if (row.key === "monetag_vignette_zone_id") vignette = v;
    });
    return { inpage, vignette };
  },
  ["monetag-zones"],
  { revalidate: 300 }
);

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Japanese with Avnish | Structured Japanese Learning from N5 to N1",
  description: "Structured Japanese learning from N5 to N1. Premium JLPT curriculum, placement quiz, and daily lessons.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    siteName: "Japanese with Avnish",
    title: "Japanese with Avnish | Structured Japanese Learning from N5 to N1",
    description: "Structured Japanese learning from N5 to N1. Premium JLPT curriculum, placement quiz, and daily lessons.",
    url: "/",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Japanese with Avnish | Structured Japanese Learning from N5 to N1",
    description: "Structured Japanese learning from N5 to N1. Premium JLPT curriculum, placement quiz, and daily lessons.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const MONETAG_TAG = process.env.NEXT_PUBLIC_MONETAG_TAG;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { inpage: monetagInpageZone, vignette: monetagVignetteZone } = await getMonetagZones();

  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <head>
        {ADSENSE_CLIENT ? (
          <meta
            name="google-adsense-account"
            content={ADSENSE_CLIENT}
          />
        ) : null}
        {MONETAG_TAG ? <meta name="monetag" content={MONETAG_TAG} /> : null}
      </head>
      <body className="font-sans antialiased">
        <OrganizationSchema />
        {children}
        <ThirdPartyScripts />
        {monetagInpageZone && (
          <Script id="monetag-inpage" strategy="afterInteractive">
            {`(function(s){s.dataset.zone='${monetagInpageZone}',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));`}
          </Script>
        )}
        {monetagVignetteZone && (
          <Script id="monetag-vignette" strategy="afterInteractive">
            {`(function(s){s.dataset.zone='${monetagVignetteZone}',s.src='https://gizokraijaw.net/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));`}
          </Script>
        )}
      </body>
    </html>
  );
}
