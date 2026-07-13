import { requireAppUser } from "@/lib/auth";

// TEMPORARY diagnostic — remove once the AI timeout issue is resolved.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Probe =
  | { ms: number; status: number; ok: boolean; body: string }
  | { ms: number; error: string };

/** One raw call to Moonshot, mirroring lib/ai.ts config, with timing. */
async function probe(model: string, maxTokens: number): Promise<Probe> {
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
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const ms = Date.now() - t0;
    const body = await res.text();
    return { ms, status: res.status, ok: res.ok, body: body.slice(0, 600) };
  } catch (e) {
    const ms = Date.now() - t0;
    return { ms, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

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
    </div>
  );
}
