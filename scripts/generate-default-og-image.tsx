/**
 * One-time generation of a branded default 1200x630 OG/social-share image, saved to
 * public/og-default.png. Uses next/og's ImageResponse (Satori under the hood) — the same
 * rendering engine already used for AI-generated content cards
 * (src/lib/ai/image-providers/deepseek-html.ts) — run here as a build-time script rather than
 * a live route, since the design is static and shouldn't cost a render on every request.
 *
 * Brand palette from src/app/globals.css: base #FAF8F5, primary #D0021B, charcoal #1A1A1A,
 * gold accent #C8A35F (matches the palette already codified for AI-generated cards).
 *
 * Run: npx tsx scripts/generate-default-og-image.tsx
 */
import React from "react";
import { ImageResponse } from "next/og";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

async function main() {
  const logoPath = join(process.cwd(), "public/logo.png");
  const logoBase64 = readFileSync(logoPath).toString("base64");
  const logoDataUri = `data:image/png;base64,${logoBase64}`;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF8F5",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "14px", backgroundColor: "#D0021B", display: "flex" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "14px", backgroundColor: "#C8A35F", display: "flex" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} alt="" width={160} height={160} style={{ borderRadius: "9999px", marginBottom: "36px" }} />
        <div style={{ fontSize: 64, fontWeight: 700, color: "#1A1A1A", display: "flex", marginBottom: "16px" }}>
          Japanese with Avnish
        </div>
        <div style={{ fontSize: 32, color: "#D0021B", fontWeight: 600, display: "flex" }}>
          Structured Japanese Learning · N5 to N1
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );

  const buffer = Buffer.from(await image.arrayBuffer());
  const outPath = join(process.cwd(), "public/og-default.png");
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
