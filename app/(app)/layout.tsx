import { requireAppUser } from "@/lib/auth";
import { strings } from "@/lib/strings";
import { MemberProvider } from "@/components/shell/member-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Toaster } from "@/components/ui/toaster";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await requireAppUser();

  return (
    <MemberProvider member={member}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <span className="text-base font-semibold tracking-tight text-foreground">
            {strings.appName}
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SignOutButton size="icon" variant="ghost" showIcon>
              <span className="sr-only">{strings.auth.signOut}</span>
            </SignOutButton>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4">{children}</main>

        <BottomNav />
        <Toaster />
      </div>
    </MemberProvider>
  );
}
