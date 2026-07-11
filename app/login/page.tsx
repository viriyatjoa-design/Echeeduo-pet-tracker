"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Cat } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const t = {
  linkError: "That sign-in link didn't work or expired — request a new one.",
} as const;

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const hadError = searchParams.get("error");

  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const nextParam = next
        ? `?next=${encodeURIComponent(next)}`
        : "";
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${nextParam}`,
        },
      });
      if (otpError) throw otpError;
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      // Surface the real reason — Supabase messages like "email rate limit
      // exceeded" are actionable; a generic error just makes people retry
      // and burn more of the hourly limit.
      const msg = err instanceof Error && err.message ? err.message : null;
      if (msg && /rate limit/i.test(msg)) {
        setError(
          "Email limit reached — the free email sender allows only ~2 per hour. Wait an hour, then try once. (Permanent fix: custom SMTP, see SETUP.md.)",
        );
      } else if (msg && /security purposes|once every/i.test(msg)) {
        setError("Please wait a minute before requesting another link.");
      } else if (msg && /signups? not allowed/i.test(msg)) {
        setError(
          "New sign-ups are disabled in Supabase — enable 'Allow new users to sign up' under Authentication settings.",
        );
      } else {
        setError(msg ?? strings.auth.genericError);
      }
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Cat className="h-7 w-7" />
        </div>
        <CardTitle className="text-xl">
          {status === "sent" ? strings.auth.linkSent : strings.auth.signInTitle}
        </CardTitle>
        <CardDescription>
          {status === "sent"
            ? strings.auth.linkSentBody(email.trim())
            : strings.auth.signInSubtitle}
        </CardDescription>
      </CardHeader>

      {status !== "sent" && (
        <CardContent>
          {hadError && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-warning/50 bg-warning/15 px-3 py-2.5 text-sm text-foreground"
            >
              {t.linkError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{strings.auth.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                placeholder={strings.auth.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={status === "sending"}
            >
              {status === "sending"
                ? strings.auth.sending
                : strings.auth.sendLink}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {strings.appName}
        </h1>
        <p className="text-sm text-muted-foreground">{strings.tagline}</p>
      </div>
      <React.Suspense fallback={null}>
        <LoginForm />
      </React.Suspense>
    </main>
  );
}
