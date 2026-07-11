"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { strings } from "@/lib/strings";

export function SignOutButton({
  children,
  showIcon = true,
  ...props
}: ButtonProps & { showIcon?: boolean }) {
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      disabled={pending}
      {...props}
    >
      {showIcon && <LogOut className="h-4 w-4" />}
      {children ?? strings.auth.signOut}
    </Button>
  );
}
