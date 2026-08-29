import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { getPositionDetail, getHireComponents } from "@/app/actions/recruitment";
import { HiringPipeline } from "@/components/recruitment/hiring-pipeline";

export const dynamic = "force-dynamic";

export default async function RecruitmentPositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const [data, hireComponents] = await Promise.all([getPositionDetail(id), getHireComponents()]);
  if (!data) notFound();
  const { position, candidates } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DetailBackButton href="/hr/recruitment" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{position.name}</h1>
          <p className="text-sm text-muted-foreground">
            {position.department ?? "—"} · {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <HiringPipeline candidates={candidates} isAdmin={isAdmin} openingId={position.id} hireComponents={hireComponents} />
    </div>
  );
}
