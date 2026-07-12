import type { GeneratedImage } from "@/lib/ai/image-providers/gemini";

/**
 * Tongyi-MAI/Z-Image via Hugging Face's routed Inference Providers (fal-ai backend).
 * Verified live at implementation time: HF's old api-inference.huggingface.co host no longer
 * resolves — the current unified endpoint is router.huggingface.co, and Z-Image specifically
 * is only served through the fal-ai provider (confirmed via
 * GET https://huggingface.co/api/models/Tongyi-MAI/Z-Image?expand[]=inferenceProviderMapping),
 * not the generic hf-inference provider.
 */
const Z_IMAGE_ENDPOINT = "https://router.huggingface.co/fal-ai/fal-ai/z-image/base";

export async function generateImageWithHuggingFace(prompt: string): Promise<GeneratedImage> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("HuggingFace not configured (HUGGINGFACE_API_KEY missing)");

  const res = await fetch(Z_IMAGE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = "Z-Image generation failed";
    try {
      msg = JSON.parse(errText).error || msg;
    } catch {
      // use default
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { images?: { url: string; content_type?: string }[] };
  const image = data.images?.[0];
  if (!image?.url) throw new Error("Z-Image returned no image URL");

  const imageRes = await fetch(image.url);
  if (!imageRes.ok) throw new Error("Failed to download generated image from fal.media");

  const buffer = Buffer.from(await imageRes.arrayBuffer());
  return { buffer, mime: image.content_type || "image/png" };
}
