"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@/components/admin/lookups-util";
import { createLookup } from "@/lib/actions/lookups";

const t = {
  labelLabel: "Label",
  labelPlaceholder: "e.g. Nail trim",
  codeLabel: "Code",
  codeOptional: "optional",
  add: "Add entry",
  addFailed: "Couldn't add entry",
  derivedHint: (code: string) => `Will be saved as "${code}"`,
} as const;

export function AddRowForm({ category }: { category: string }) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [label, setLabel] = React.useState("");
  const [code, setCode] = React.useState("");

  const derivedCode = slugify(code.trim() || label);

  function submit() {
    const nextLabel = label.trim();
    if (!nextLabel) {
      toast({
        variant: "destructive",
        title: t.addFailed,
        description: `${t.labelLabel} is required.`,
      });
      return;
    }
    startTransition(async () => {
      try {
        await createLookup({ category, code: code.trim(), label: nextLabel });
        setLabel("");
        setCode("");
      } catch (err) {
        toast({
          variant: "destructive",
          title: t.addFailed,
          description: (err as Error).message,
        });
      }
    });
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-label">{t.labelLabel}</Label>
        <Input
          id="new-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.labelPlaceholder}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-code">
          {t.codeLabel}{" "}
          <span className="font-normal text-muted-foreground">
            ({t.codeOptional})
          </span>
        </Label>
        <Input
          id="new-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={(e) => setCode(slugify(e.target.value))}
          placeholder={derivedCode || "nail_trim"}
          className="font-mono"
        />
        {derivedCode && (
          <p className="text-xs text-muted-foreground">
            {t.derivedHint(derivedCode)}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" disabled={pending || !label.trim()}>
        <Plus /> {t.add}
      </Button>
    </form>
  );
}
