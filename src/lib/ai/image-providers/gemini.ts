export interface GeneratedImage {
  buffer: Buffer;
  mime: string;
  textResponse?: string;
}

/** Extracted from the original inline Gemini call so the route can chain multiple providers. */
export async function generateImageWithGemini(prompt: string): Promise<GeneratedImage> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";
  if (!key) throw new Error("Gemini not configured (GEMINI_API_KEY missing)");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 2048, responseModalities: ["TEXT", "IMAGE"] },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    let msg = "Gemini image generation failed";
    try {
      msg = JSON.parse(errText).error?.message || msg;
    } catch {
      // use default
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const textResponse = parts.find((p: { text?: string }) => p.text)?.text ?? undefined;
  const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini returned no image (model may not support image generation)");
  }

  const mime = imagePart.inlineData.mimeType || "image/png";
  return { buffer: Buffer.from(imagePart.inlineData.data, "base64"), mime, textResponse };
}
