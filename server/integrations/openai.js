import { request } from "./http.js";

// يرجّع نص JSON خام من OpenAI
export async function generate(cfg, { system, user }) {
  const data = await request("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    json: {
      model: cfg.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    timeout: 60_000,
  });
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function test(cfg) {
  const text = await generate(cfg, { system: 'Reply only with JSON: {"ok":true}', user: "ping" });
  if (!/ok/i.test(text)) throw new Error("رد غير متوقع من OpenAI");
  return "OpenAI يرد بنجاح";
}
