import "server-only";

/**
 * Minimal Moonshot (Kimi) client — OpenAI-compatible chat completions via
 * plain fetch, no SDK dependency (SPEC §0: no deps without asking; owner chose
 * Kimi as the AI provider — see CONTEXT.md decision log). SERVER ONLY: the key
 * never reaches the browser.
 */

const BASE_URL = process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1";
// Owner picked Kimi K2.6 in the Moonshot console; override with MOONSHOT_MODEL
// if the console shows a different exact model id.
const MODEL = process.env.MOONSHOT_MODEL ?? "kimi-k2.6";

export const AI_SETUP_MESSAGE =
  "AI isn't set up yet — add MOONSHOT_API_KEY in Vercel env vars and redeploy (see SETUP.md).";

export function isAIReady(): boolean {
  return Boolean(process.env.MOONSHOT_API_KEY);
}

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string | (TextPart | ImagePart)[];
};

export async function askAI({
  messages,
  json = false,
  maxTokens = 2000,
  temperature = 0.3,
}: {
  messages: AIMessage[];
  /** Force a JSON-object response (OpenAI-style response_format). */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error(AI_SETUP_MESSAGE);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    // Briefs read a month of data; give the model time.
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error?.message ?? JSON.stringify(body).slice(0, 200);
    } catch {
      // keep status-only detail
    }
    throw new Error(`AI request failed: ${detail}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI returned an empty response — try again.");
  }
  return content;
}

/** Best-effort JSON extraction (some models wrap JSON in code fences). */
export function parseAIJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
    : trimmed;
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // last resort: first {...} block
    const m = unfenced.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI response wasn't valid JSON — try again.");
  }
}
