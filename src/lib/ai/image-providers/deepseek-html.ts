import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { html } from "satori-html";
import type { GeneratedImage } from "@/lib/ai/image-providers/gemini";

/**
 * Third-tier image fallback: DeepSeek writes a self-contained HTML/CSS card, rendered to a
 * real PNG via Next.js's built-in ImageResponse (next/og — Satori under the hood). Deliberately
 * not a Playwright/headless-browser screenshot: ImageResponse works in any Next.js serverless/
 * edge runtime with no native-binary infra, safe on the current Netlify deployment. satori-html
 * bridges DeepSeek's HTML string output into the element tree Satori/ImageResponse expects.
 *
 * Satori only supports a CSS subset (flexbox layout, inline styles, no CSS grid) — the system
 * prompt below constrains DeepSeek's output to that subset.
 */
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const HTML_CARD_SYSTEM = `You generate a single self-contained HTML snippet for a branded 1200x630 card image, to be rendered by Satori (a strict HTML/CSS-subset renderer).

Hard constraints:
- Only these tags are allowed: div, span, p, h1, h2, h3.
- Every element must have an inline "style" attribute — no <style> blocks, no CSS classes, no external stylesheets.
- Layout must use flexbox only (display:flex, flexDirection, alignItems, justifyContent, gap, padding). Never use CSS Grid, floats, or position:absolute.
- No <script>, no external images, no external fonts, no JavaScript of any kind.
- The root element must be sized to the full canvas: style="display:flex; width:1200px; height:630px; ...".
- Use this site's palette: background #FAF8F5, primary accent #D0021B, gold #C8A35F, dark text #1A1A1A. Flat vector / minimal educational aesthetic — no photorealistic imagery (none is possible anyway, this is pure HTML/CSS shapes and text).
- Output ONLY the raw HTML snippet — no markdown code fences, no explanation, no <html>/<head>/<body> wrapper. Start directly with the root <div>.`;

export async function generateImageWithDeepSeekHtml(prompt: string): Promise<GeneratedImage> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DeepSeek not configured (DEEPSEEK_API_KEY missing)");

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: HTML_CARD_SYSTEM },
        { role: "user", content: `Design a card image for: ${prompt}` },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek HTML card generation failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  if (!cleaned) throw new Error("DeepSeek returned no HTML content");

  const vnode = html(cleaned);
  const imageResponse = new ImageResponse(vnode as unknown as ReactElement, { width: 1200, height: 630 });
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return { buffer, mime: "image/png" };
}
