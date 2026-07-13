import { requireAppUser } from "@/lib/auth";

// TEMPORARY diagnostic — remove once the AI timeout issue is resolved.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Probe =
  | { ms: number; status: number; ok: boolean; body: string }
  | { ms: number; error: string };

type ProbeOpts = {
  messages?: { role: string; content: string }[];
  disableThinking?: boolean;
  timeoutMs?: number;
};

/** One raw call to Moonshot, mirroring lib/ai.ts config, with timing. */
async function probe(
  model: string,
  maxTokens: number,
  opts: ProbeOpts = {},
): Promise<Probe> {
  const key = process.env.MOONSHOT_API_KEY;
  const base = process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1";
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages ?? [{ role: "user", content: "Reply with exactly: ok" }],
        max_tokens: maxTokens,
        ...(opts.disableThinking ? { thinking: { type: "disabled" } } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
    });
    const ms = Date.now() - t0;
    const body = await res.text();
    return { ms, status: res.status, ok: res.ok, body: body.slice(0, 600) };
  } catch (e) {
    const ms = Date.now() - t0;
    return { ms, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

// A realistic, analytical prompt roughly the size/shape of a real health brief,
// to compare thinking-on (slow) vs thinking-disabled (fast).
const REAL_MESSAGES = [
  {
    role: "system",
    content:
      "You write short, warm cat health summaries for a family. Give a soft read plus 1-3 low-risk suggestions; escalate red flags to a vet. Under 200 words.",
  },
  {
    role: "user",
    content:
      'Write a health analysis of Tudou. Sections: "How\'s Tudou doing", "Eating", "Weight", "Watch for". DATA: ' +
      JSON.stringify({
        cat: { name: "Tudou", breed: "British Shorthair", neutered: true, daily_kcal_target: 340 },
        weights_kg: [{ date: "2026-06-01", kg: "4.60", bcs: 5 }, { date: "2026-05-01", kg: "4.50", bcs: 5 }],
        daily_kcal_last_30d: Array.from({ length: 30 }, (_, i) => ({ date: `2026-06-${(i % 28) + 1}`, kcal: 300 + (i % 5) * 15, meals: 3 })),
        water_ml_last_14d: 210,
        litter_recent: [{ date: "2026-06-30", urine: true, stool: true, consistency: "firm" }],
      }),
  },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

export default async function AiSelfTestPage() {
  await requireAppUser();

  const hasKey = Boolean(process.env.MOONSHOT_API_KEY);
  const keyLen = process.env.MOONSHOT_API_KEY?.length ?? 0;
  const base = process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1";
  const model = process.env.MOONSHOT_MODEL ?? "kimi-k2.6";
  const visionModel = process.env.MOONSHOT_VISION_MODEL ?? model;

  // Small budget first (fast if the model/key/endpoint are healthy). Only run a
  // second, larger probe if the first succeeded quickly, to see how time scales.
  const small = hasKey ? await probe(model, 200) : null;
  const big =
    hasKey && small && "ok" in small && small.ok
      ? await probe(model, 2000)
      : null;

  // The real test: a realistic health-brief prompt with thinking DISABLED —
  // this mirrors the actual fix and should return in a few seconds.
  const real =
    hasKey && small && "ok" in small && small.ok
      ? await probe(model, 1200, {
          messages: REAL_MESSAGES,
          disableThinking: true,
          timeoutMs: 50_000,
        })
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">AI self-test</h1>
      <p className="text-sm text-muted-foreground">
        Diagnostic for the AI timeouts. Share these numbers back. This page is
        temporary.
      </p>

      <section className="rounded-2xl border border-border bg-card p-4">
        <Row label="Key present" value={hasKey ? `yes (length ${keyLen})` : "NO — MOONSHOT_API_KEY missing in Vercel"} />
        <Row label="Base URL" value={base} />
        <Row label="Model" value={model} />
        <Row label="Vision model" value={visionModel} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold text-foreground">
          Probe 1 — tiny request (200 tokens)
        </h2>
        {!small ? (
          <p className="text-sm text-muted-foreground">Skipped — no key.</p>
        ) : "ok" in small ? (
          <>
            <Row label="Result" value={small.ok ? `HTTP ${small.status} OK` : `HTTP ${small.status} (error)`} />
            <Row label="Time" value={`${small.ms} ms`} />
            <Row label="Response body (first 600 chars)" value={small.body} />
          </>
        ) : (
          <>
            <Row label="Failed" value={small.error} />
            <Row label="Time before failure" value={`${small.ms} ms`} />
          </>
        )}
      </section>

      {big && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">
            Probe 2 — larger budget (2000 tokens)
          </h2>
          {"ok" in big ? (
            <>
              <Row label="Result" value={big.ok ? `HTTP ${big.status} OK` : `HTTP ${big.status} (error)`} />
              <Row label="Time" value={`${big.ms} ms`} />
              <Row label="Response body (first 600 chars)" value={big.body} />
            </>
          ) : (
            <>
              <Row label="Failed" value={big.error} />
              <Row label="Time before failure" value={`${big.ms} ms`} />
            </>
          )}
        </section>
      )}

      {real && (
        <section className="rounded-2xl border-2 border-primary bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">
            Probe 3 — REAL health brief, thinking disabled (the fix)
          </h2>
          {"ok" in real ? (
            <>
              <Row label="Result" value={real.ok ? `HTTP ${real.status} OK` : `HTTP ${real.status} (error)`} />
              <Row label="Time" value={`${real.ms} ms`} />
              <Row label="Response body (first 600 chars)" value={real.body} />
            </>
          ) : (
            <>
              <Row label="Failed" value={real.error} />
              <Row label="Time before failure" value={`${real.ms} ms`} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
