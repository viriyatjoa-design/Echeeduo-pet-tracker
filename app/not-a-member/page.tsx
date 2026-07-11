import { Cat } from "lucide-react";
import { strings } from "@/lib/strings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/shell/sign-out-button";

export default function NotAMemberPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Cat className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">
            {strings.auth.notMemberTitle}
          </CardTitle>
          <CardDescription>{strings.auth.notMemberBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignOutButton className="w-full">
            {strings.auth.backToSignIn}
          </SignOutButton>
        </CardContent>
      </Card>
    </main>
  );
}
