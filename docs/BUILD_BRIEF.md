# Build brief for feature-slice agents

You are building ONE feature slice of **Purrfect Log v2**, a Next.js 15 (App Router, TS)
family cat-care PWA. Repo root: `/home/user/Echeeduo-pet-tracker`. The foundation is DONE and
the build is green. Read `SPEC.md` (source of truth) and `CONTEXT.md` (the auth deviation)
before coding. Your task prompt names your slice + exact files you own.

## HARD RULES (breaking these breaks everyone)
1. **Only create/edit files inside the paths your task assigns.** Never touch: `lib/db.ts`,
   `lib/auth.ts`, `lib/supabase/*`, `middleware.ts`, `lib/types.ts`, `lib/{kcal,care,weight,
   time,lookups,strings,utils}.ts`, `supabase/*`, `app/globals.css`, `app/layout.tsx`,
   `app/(app)/layout.tsx`, `components/ui/*`, `components/shell/*`, any config file, or
   another slice's directory. If you need a change there, note it in your final report.
2. **Do NOT run `npm run build`, `npm run dev`, `next build`, or `tsc`.** Other agents build
   in this same directory concurrently — a build would corrupt `.next`. The lead runs one
   build per wave and fixes integration. Your job is to write correct code against the
   contracts below. Read your own files back to sanity-check imports/types.
3. **Do NOT add dependencies.** Only what's in package.json (radix dialog/dropdown/label/
   select/slot/switch/tabs, cva, clsx, tailwind-merge, tailwindcss-animate, lucide-react,
   recharts, @supabase/ssr, @supabase/supabase-js). No date libs (use `lib/time.ts`), no
   toast lib (use the toaster below), no form lib, no zod.

## Data access + mutations (the pattern — follow it exactly)
- **Reads (in Server Components):** `import { db } from "@/lib/db"` then
  `const { data } = await db().from("table").select(...)`. `db()` is the service-role client
  (bypasses deny-all RLS). Server-only — never import into a "use client" file.
- **Mutations = Server Actions** in `lib/actions/<yourslice>.ts` starting with `"use server"`.
  Pattern:
  ```ts
  "use server";
  import { db } from "@/lib/db";
  import { getCurrentAppUser } from "@/lib/auth";
  import { revalidatePath } from "next/cache";
  export async function createX(input: {...}) {
    const me = await getCurrentAppUser();
    if (!me) throw new Error("Unauthorized");
    const { error } = await db().from("table").insert({ ...input, created_by: me.id });
    if (error) throw new Error(error.message);
    revalidatePath("/relevant-path");
  }
  ```
- **`created_by`** on every user-generated row = `me.id` from `getCurrentAppUser()`.
- **Soft delete:** set `is_active = false`; never hard-delete. Filter `.eq("is_active", true)`
  on reads.
- **Time:** store UTC (DB defaults handle `now()`); DISPLAY via `lib/time.ts`
  (`formatDateTime`, `formatTime`, `formatDate`, `relativeDay`, `todayInTz`, `daysBetween`,
  `addDaysToDate`). Never format dates by hand.

## Foundation you build ON (import paths + APIs)
- **Types:** `@/lib/types` — `Cat, Food, FeedingLog, WeightLog, CareEvent, Attachment,
  MealTemplate, MealTemplateItem, LitterLog, WaterLog, SymptomLog, Lookup, AppUser, UUID`.
- **Lookups:** `@/lib/lookups` — `getAllLookups()`, `getLookupsByCategory(cat)`,
  `getLookupMap()` (id→Lookup), `getLookupCategories()`. Categories: `care_event_type`,
  `food_type`, `food_unit`, `stool_consistency`, `symptom_type`.
- **Calories:** `@/lib/kcal` — `kcalFromGrams(g, per100)`, `gramsFromPortion(qty, unitG)`,
  `dailyTarget(cat, latestWeightGrams|null)`, `exceedsTreatLimit(snackKcal, target)`,
  `portionLabel(qty, unitLabel, grams)` → "½ can · 42.5 g", `round1(n)`.
- **Care:** `@/lib/care` — `isOpen/isOverdue/isDueToday(e)`, `bucketCareEvents(events)` →
  `{overdue, today, upcoming}`, `nextDueDate(doneDate, intervalDays)`,
  `expandMedCourse(startDate, durationDays, times[])`.
- **Weight:** `@/lib/weight` — `weightTrend(logs)` → `{direction,pct,latestGrams,fromGrams,
  overDays}|null`, `gramsToKg(g)`.
- **Strings:** `@/lib/strings` — `strings.*`. USE existing keys where they fit. **Do NOT edit
  `lib/strings.ts`** (concurrent agents would corrupt it). For slice-specific copy that isn't
  already a key, define a local `const t = { ... } as const` at the top of your file. (Phase C
  may consolidate later.)
- **UI primitives** (`@/components/ui/<name>`): `Button` (variants default/destructive/outline/
  secondary/ghost/link; sizes default/sm/lg/icon/pill), `Input`, `Label`, `Textarea`,
  `Card,CardHeader,CardTitle,CardDescription,CardContent,CardFooter`, `Badge` (default/
  secondary/outline/destructive/warning/success), `Tabs,TabsList,TabsTrigger,TabsContent`,
  `Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,
  DialogClose`, `Select,SelectTrigger,SelectValue,SelectContent,SelectItem`, `Switch`,
  `Separator`, `Skeleton`.
- **Toasts:** `import { useToast } from "@/hooks/use-toast"` → `const { toast } = useToast();
  toast({ title, description, variant })` variant ∈ default|warning|destructive|success.
  `<Toaster/>` is already mounted. Use for the treat-limit warning.
- **Current member (client, display only):** `import { useMember } from
  "@/components/shell/member-provider"` → `useMember()` = `{id,email,display_name}`.
- **`cn`** from `@/lib/utils`.

## Design (SPEC §7)
Warm/domestic, not clinical. Mobile-first, single `max-w-md` column (the shell provides it),
large tap targets, `rounded-xl` controls / `rounded-2xl` cards, generous whitespace. Theme
tokens only (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`,
`bg-primary`, `border-border`, `bg-warning`, `bg-success`, `bg-destructive`) so light + dark
both work. Per-cat accent: a cat has `accent_index` (1–5) → CSS var `--cat-{n}`; to tint an
element for a cat use inline style `{{ ["--cat-accent" as any]: `var(--cat-${cat.accent_index})` }}` (raw TRIPLET — the `cat` utility wraps it in hsl() itself; passing a full hsl() color double-wraps and silently renders nothing)
and the `text-cat`/`bg-cat`/`border-cat` utilities (defined in tailwind config as
`hsl(var(--cat-accent))`).

## Client vs Server
Pages/lists = Server Components (fetch with `db()`), reading data directly. Interactive forms
= small `"use client"` components that call your Server Actions. Keep client bundles lean.
Every user-facing string comes from `@/lib/strings` (add keys as needed).

## When done
Report: files created, any assumption you made, anything you need from another slice or the
lead (e.g. "the cat profile page should mount `<WeightSection catId=.../>` from
components/weight/weight-section.tsx"), and any foundation change you couldn't make yourself.
