import { requireAppUser } from "@/lib/auth";
import { strings } from "@/lib/strings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function TodayPage() {
  const member = await requireAppUser();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Hi, {member.display_name}
        </h1>
        <p className="text-sm text-muted-foreground">{strings.today.title}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard coming soon</CardTitle>
          <CardDescription>
            The Today view will show feeds, calorie targets, water, and
            what&apos;s due. It&apos;s next on the build list.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {strings.today.noFeedsYet}
        </CardContent>
      </Card>
    </div>
  );
}
