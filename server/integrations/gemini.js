import { request } from "./http.js";

// يرجّع نص JSON خام من جمناي
export async function generate(cfg, { system, user }) {
  const model = encodeURIComponent(cfg.model || "gemini-2.5-flash");
  const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": cfg.apiKey },
    json: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 8192 },
    },
    timeout: 60_000,
  });
  return (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

export async function test(cfg) {
  const text = await generate(cfg, { system: 'Reply only with JSON: {"ok":true}', user: "ping" });
  if (!/ok/i.test(text)) throw new Error("رد غير متوقع من جمناي");
  return "جمناي يرد بنجاح";
}
