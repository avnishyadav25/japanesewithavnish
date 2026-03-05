import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { OrganizationSchema } from "@/components/JsonLd";
import { ThirdPartyScripts } from "@/components/ThirdPartyScripts";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <head>
        {ADSENSE_CLIENT ? (
          <meta
            name="google-adsense-account"
            content={ADSENSE_CLIENT}
          />
        ) : null}
      </head>
      <body className="font-sans antialiased">
        <OrganizationSchema />
        {children}
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
