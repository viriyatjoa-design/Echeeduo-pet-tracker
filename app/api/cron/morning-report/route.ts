import { NextResponse } from "next/server";
import { generateMorningReport } from "@/lib/briefs";

/**
 * Nightly cron (vercel.json: 21:30 UTC = 04:30 Jakarta): write the household
 * morning report so it's ready when the family wakes up. Vercel calls this
 * with "Authorization: Bearer $CRON_SECRET" — until the owner sets CRON_SECRET
 * in Vercel env vars, every call is rejected (secure default; the dashboard's
 * manual Refresh button still works, it's a Server Action, not this route).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateMorningReport(null);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
