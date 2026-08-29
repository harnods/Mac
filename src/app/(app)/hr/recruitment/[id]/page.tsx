import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { getOpeningDetail, getRecruitmentFormData } from "@/app/actions/recruitment";
import { hireBaseUrl } from "@/lib/recruitment";
import { EditOpeningButton } from "@/components/recruitment/edit-opening-button";
import { CopyApplyLink } from "@/components/recruitment/copy-apply-link";
import { HiringPipeline } from "@/components/recruitment/hiring-pipeline";

export const dynamic = "force-dynamic";

export default async function RecruitmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const [data, formData] = await Promise.all([getOpeningDetail(id), getRecruitmentFormData()]);
  if (!data) notFound();
  const { opening, candidates } = data;
  const applyUrl = `${hireBaseUrl().replace(/\/$/, "")}/${opening.code}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/hr/recruitment" />
          <h1 className="text-2xl font-semibold tracking-tight">{opening.title || opening.position || "Opening"}</h1>
          {opening.status === "open"
            ? <Badge variant="success">Open</Badge>
            : <Badge variant="secondary">Closed</Badge>}
        </div>
        {isAdmin && (
          <EditOpeningButton
            formData={formData}
            prefill={{
              id: opening.id, title: opening.title,
              job_position_id: opening.job_position_id, department_id: opening.department_id,
              job_level_id: opening.job_level_id, employment_status_id: opening.employment_status_id,
              min_experience_years: opening.min_experience_years, headcount: opening.headcount,
              require_physical: opening.require_physical,
              min_height_cm: opening.min_height_cm, min_weight_kg: opening.min_weight_kg,
              description: opening.description,
            }}
          />
        )}
      </div>

      <dl className="grid max-w-3xl grid-cols-1 gap-x-16 gap-y-1 sm:grid-cols-2">
        <Field label="Position" value={opening.position} />
        <Field label="Department" value={opening.department} />
        <Field label="Job level" value={opening.level} />
        <Field label="Employment type" value={opening.employment_type} />
        <Field label="Min. experience" value={opening.min_experience_years > 0 ? `${opening.min_experience_years} years` : "—"} />
        <Field label="Headcount" value={String(opening.headcount)} />
        {opening.require_physical && (
          <>
            <Field label="Min. height" value={opening.min_height_cm != null ? `${opening.min_height_cm} cm` : "—"} />
            <Field label="Min. weight" value={opening.min_weight_kg != null ? `${opening.min_weight_kg} kg` : "—"} />
          </>
        )}
        <Field label="Apply link" value={<CopyApplyLink url={applyUrl} />} />
      </dl>

      {opening.description && (
        <div className="max-w-2xl space-y-1">
          <div className="text-sm text-muted-foreground">Description</div>
          <p className="whitespace-pre-wrap text-sm">{opening.description}</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Hiring pipeline</h2>
        <HiringPipeline candidates={candidates} isAdmin={isAdmin} openingId={opening.id} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 sm:border-0 sm:py-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{value ?? "—"}</dd>
    </div>
  );
}
