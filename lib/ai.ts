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

/**
 * Optional faster model for single-photo jobs (litter analysis, label scan).
 * K2.6 is a thinking model — fine for briefs, slow for "look at one photo".
 * Set MOONSHOT_VISION_MODEL in Vercel (e.g. "kimi-latest") to speed those up;
 * unset, everything uses the main model.
 */
export const VISION_MODEL = process.env.MOONSHOT_VISION_MODEL ?? MODEL;

export const AI_SETUP_MESSAGE =
  "AI isn't set up yet — add MOONSHOT_API_KEY in Vercel env vars and redeploy (see SETUP.md).";

export function isAIReady(): boolean {
  return Boolean(process.env.MOONSHOT_API_KEY);
}

/**
 * How long a single AI call may run before we abort with a friendly message.
 * Kept UNDER the Vercel function ceiling (Hobby caps functions at 60s) so the
 * user sees our "took too long" message instead of a raw platform 504. Bump
 * `AI_TIMEOUT_MS` in Vercel if you move to Pro (functions up to 300s).
 */
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 50_000);

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string | (TextPart | ImagePart)[];
};

export async function askAI({
  messages,
  json = false,
  maxTokens = 8000,
  model = MODEL,
}: {
  messages: AIMessage[];
  /** Force a JSON-object response (OpenAI-style response_format). */
  json?: boolean;
  maxTokens?: number;
  /** Per-call model override (e.g. VISION_MODEL for photo jobs). */
  model?: string;
}): Promise<string> {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error(AI_SETUP_MESSAGE);

  const baseBody: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    // No temperature: Kimi K2.6 only accepts its fixed default (sending a
    // custom value is rejected with "invalid temperature").
    ...(json ? { response_format: { type: "json_object" } } : {}),
  };

  async function post(body: Record<string, unknown>) {
    return fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      // Bounded so we return our own message before the platform kills the
      // function (see AI_TIMEOUT_MS).
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    }).catch((err: unknown) => {
      // AbortSignal.timeout throws a TimeoutError; turn network/timeout
      // failures into a clear, retryable message.
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new Error(
          "The AI took too long to answer and timed out. Tap to try again — it's usually quicker the second time. (The free hosting plan limits each request to 60 seconds.)",
        );
      }
      throw err;
    });
  }

  // Kimi K2.6 is a REASONING model: on an analytical prompt its hidden thinking
  // trace can run for tens of seconds and blow the function timeout, even though
  // the same model answers a trivial prompt in ~1s. Disable thinking for these
  // short, policy-guided family outputs — the system prompt already carries the
  // rules, so a direct answer is fine and dramatically faster. If a model/plan
  // rejects the field (400), fall back to a plain request so we're never worse.
  let res = await post({ ...baseBody, thinking: { type: "disabled" } });
  if (res.status === 400) {
    res = await post(baseBody);
  }

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
  const msg = data?.choices?.[0]?.message;
  const finish = data?.choices?.[0]?.finish_reason;

  // K2.6 is a thinking model: the answer is in `content`; internal reasoning
  // may arrive separately (and can eat the whole token budget). `content` can
  // also be an array of parts on some models — join the text parts.
  let content: string = "";
  if (typeof msg?.content === "string") {
    content = msg.content;
  } else if (Array.isArray(msg?.content)) {
    content = msg.content
      .map((part: { type?: string; text?: string }) =>
        typeof part?.text === "string" ? part.text : "",
      )
      .join("");
  }

  if (!content.trim()) {
    if (finish === "length") {
      throw new Error(
        "The AI ran out of room while thinking before it could answer — try again, or simplify the request if it keeps happening.",
      );
    }
    throw new Error(
      `AI returned an empty response (finish_reason: ${finish ?? "unknown"}) — try again.`,
    );
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
    // last resort: first {...} block. The regex only guarantees balanced outer
    // braces, not valid JSON, so this parse can itself throw — swallow it and
    // fall through to the friendly error rather than leaking a raw SyntaxError.
    const m = unfenced.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("AI response wasn't valid JSON — try again.");
  }
}
