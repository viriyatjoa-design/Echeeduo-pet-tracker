"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { addMember } from "@/lib/actions/members";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const t = {
  email: "Email",
  emailPlaceholder: "them@example.com",
  name: "Display name",
  namePlaceholder: "e.g. Sari",
  add: "Add member",
  adding: "Adding…",
  added: "Member added",
  hint: "They can sign in with this email — no redeploy needed.",
} as const;

export function MemberAddForm() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await addMember({ email, display_name: name });
      toast({ title: t.added, variant: "success" });
      setEmail("");
      setName("");
    } catch (err) {
      toast({
        title: strings.auth.genericError,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="member-name">{t.name}</Label>
        <Input
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="member-email">{t.email}</Label>
        <Input
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      <Button type="submit" disabled={pending} className="w-full">
        <UserPlus className="h-4 w-4" />
        {pending ? t.adding : t.add}
      </Button>
    </form>
  );
}
