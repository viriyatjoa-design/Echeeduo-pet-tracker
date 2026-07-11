import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listAttachments } from "@/lib/storage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CatProfileHeader } from "@/components/cats/cat-profile-header";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";
import { FeedingHistory } from "@/components/feed/feeding-history";
import { WeightSection } from "@/components/weight/weight-section";
import { HealthSection } from "@/components/observation/health-section";
import { CatCareTimeline } from "@/components/care/cat-care-timeline";
import type { Cat } from "@/lib/types";

const t = {
  back: "Today",
  updatePhoto: "Update photo",
  feeding: "Feeding",
  weight: "Weight",
  health: "Health",
  care: "Care",
} as const;

export default async function CatProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppUser();
  const { id } = await params;

  const { data: catRow } = await db()
    .from("cats")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!catRow) notFound();
  const cat = catRow as Cat;

  const attachments = await listAttachments("cat", id);
  const photoUrl = attachments[0]?.url ?? undefined;

  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <CatProfileHeader cat={cat} photoUrl={photoUrl} />

      <AttachmentUploader
        entityType="cat"
        entityId={id}
        label={t.updatePhoto}
        revalidate={`/cats/${id}`}
      />

      <Tabs defaultValue="feeding" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="feeding">{t.feeding}</TabsTrigger>
          <TabsTrigger value="weight">{t.weight}</TabsTrigger>
          <TabsTrigger value="health">{t.health}</TabsTrigger>
          <TabsTrigger value="care">{t.care}</TabsTrigger>
        </TabsList>

        <TabsContent value="feeding">
          <FeedingHistory catId={id} />
        </TabsContent>
        <TabsContent value="weight">
          <WeightSection cat={cat} />
        </TabsContent>
        <TabsContent value="health">
          <HealthSection cat={cat} />
        </TabsContent>
        <TabsContent value="care">
          <CatCareTimeline catId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
