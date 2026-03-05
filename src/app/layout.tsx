import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { OrganizationSchema } from "@/components/JsonLd";
import { ThirdPartyScripts } from "@/components/ThirdPartyScripts";
import { sql } from "@/lib/db";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Japanese with Avnish | Learn Japanese JLPT N5-N1",
  description: "Premium Japanese learning resources. JLPT bundles, placement quiz, and lessons.",
  icons: { icon: "/favicon.ico" },
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const MONETAG_TAG = process.env.NEXT_PUBLIC_MONETAG_TAG;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let monetagInpageZone = "";
  let monetagVignetteZone = "";

  if (sql) {
    const rows = (await sql`
      SELECT key, value
      FROM site_settings
      WHERE key = ANY(ARRAY['monetag_inpage_zone_id', 'monetag_vignette_zone_id'])
    `) as { key: string; value: unknown }[];

    rows.forEach((row) => {
      const v = typeof row.value === "string" ? row.value : "";
      if (row.key === "monetag_inpage_zone_id") monetagInpageZone = v;
      if (row.key === "monetag_vignette_zone_id") monetagVignetteZone = v;
    });
  }

  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
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
