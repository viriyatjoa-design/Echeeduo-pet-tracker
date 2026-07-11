import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Cat } from "@/lib/types";
import { strings } from "@/lib/strings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { CatForm } from "@/components/cats/cat-form";
import { MemberAddForm } from "@/components/settings/member-add-form";
import { ActiveToggle } from "@/components/settings/active-toggle";

export const dynamic = "force-dynamic";

const t = {
  title: "Settings",
  catsTitle: "Cats",
  catsDesc: "Add, edit, or archive the cats in your household.",
  noCats: "No cats yet — add your first.",
  inactive: "Inactive",
  membersTitle: "Members",
  membersDesc: "Anyone with an active email here can sign in.",
  signedIn: "Signed in",
  invited: "Invited",
  addMember: "Add a member",
  you: "You",
} as const;

type MemberRow = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  auth_sub: string | null;
};

export default async function SettingsPage() {
  const me = await requireAppUser();

  const [{ data: cats }, { data: members }] = await Promise.all([
    db()
      .from("cats")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    db()
      .from("app_users")
      .select("id, email, display_name, is_active, auth_sub")
      .order("is_active", { ascending: false })
      .order("display_name", { ascending: true }),
  ]);

  const catList = (cats ?? []) as Cat[];
  const memberList = (members ?? []) as MemberRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t.title}
      </h1>

      {/* ── Cats ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>{t.catsTitle}</CardTitle>
            <CardDescription>{t.catsDesc}</CardDescription>
          </div>
          <CatForm />
        </CardHeader>
        <CardContent className="space-y-1">
          {catList.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t.noCats}</p>
          ) : (
            catList.map((cat, i) => (
              <div key={cat.id}>
                {i > 0 && <Separator className="my-1" />}
                <div className="flex items-center gap-3 py-2">
                  <CatAvatar cat={cat} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {cat.name}
                      </span>
                      {!cat.is_active && (
                        <Badge variant="outline">{t.inactive}</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {cat.breed}
                    </p>
                  </div>
                  <CatForm cat={cat} />
                  <ActiveToggle
                    kind="cat"
                    id={cat.id}
                    active={cat.is_active}
                    label={cat.name}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Members ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t.membersTitle}</CardTitle>
          <CardDescription>{t.membersDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            {memberList.map((m, i) => (
              <div key={m.id}>
                {i > 0 && <Separator className="my-1" />}
                <div className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {m.display_name}
                      </span>
                      {m.id === me.id && (
                        <Badge variant="secondary">{t.you}</Badge>
                      )}
                      {!m.is_active && (
                        <Badge variant="outline">{t.inactive}</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  </div>
                  <Badge variant={m.auth_sub ? "success" : "outline"}>
                    {m.auth_sub ? t.signedIn : t.invited}
                  </Badge>
                  {m.id !== me.id && (
                    <ActiveToggle
                      kind="member"
                      id={m.id}
                      active={m.is_active}
                      label={m.display_name}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t.addMember}
            </h3>
            <MemberAddForm />
          </div>
        </CardContent>
      </Card>

      {/* ── Session ──────────────────────────────────────── */}
      <div className="pt-2">
        <SignOutButton className="w-full">{strings.auth.signOut}</SignOutButton>
      </div>
    </div>
  );
}
