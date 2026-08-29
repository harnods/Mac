import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { getCandidate, getResumeSignedUrl, getCandidateComments, getCandidateEvents, type CandidateEvent } from "@/app/actions/recruitment";
import { CandidateActions } from "@/components/recruitment/candidate-actions";
import { CandidateComments } from "@/components/recruitment/candidate-comments";
import { HIRING_STAGE_LABEL } from "@/lib/recruitment";
import { formatRp, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function waLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { id, candidateId } = await params;
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_READ)) notFound();

  const canWrite = can(profile, P.EMPLOYEES_WRITE);
  const data = await getCandidate(candidateId);
  if (!data || data.openingId !== id) notFound();
  const c = data.candidate;

  const [resume, comments, events] = await Promise.all([
    c.resume_path ? getResumeSignedUrl(candidateId) : Promise.resolve(null),
    getCandidateComments(candidateId),
    getCandidateEvents(candidateId),
  ]);
  const resumeUrl = resume && resume.ok ? resume.data!.url : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DetailBackButton href={`/hr/recruitment/${id}`} />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {c.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photo_url} alt={c.name} className="size-11 rounded-full object-cover" />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-base font-medium text-muted-foreground">
              {c.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <p className="text-sm text-muted-foreground">{data.openingTitle}</p>
          </div>
        </div>
        <Badge variant={c.stage === "hired" ? "success" : "secondary"} className="ml-1">
          {HIRING_STAGE_LABEL[c.stage]}
        </Badge>
        {canWrite && (
          <div className="ml-auto">
            <CandidateActions candidateId={c.id} openingId={id} name={c.name} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left: what the candidate filled in + comments */}
        <div className="space-y-6">
        <dl className="space-y-1">
          <Row label="WhatsApp" value={<a href={waLink(c.whatsapp)} target="_blank" rel="noopener" className="text-primary hover:underline">{c.whatsapp}</a>} />
          <Row label="Email" value={c.email || "—"} />
          <Row label="Experience" value={c.experience_years != null ? `${c.experience_years} years` : "—"} />
          <Row label="Expected salary" value={c.expected_salary != null ? formatRp(c.expected_salary) : "—"} />
          {c.height_cm != null && <Row label="Height" value={`${c.height_cm} cm`} />}
          {c.weight_kg != null && <Row label="Weight" value={`${c.weight_kg} kg`} />}
          <Row label="Applied" value={formatDateTime(c.created_at)} />
          {c.cover_note && (
            <div className="pt-2">
              <dt className="text-sm text-muted-foreground">Why they fit</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">{c.cover_note}</dd>
            </div>
          )}
          {c.stage === "rejected" && c.reject_reason && (
            <div className="pt-2">
              <dt className="text-sm text-muted-foreground">Rejection reason</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">{c.reject_reason}</dd>
            </div>
          )}
        </dl>

        <ActivityLog events={events} />

        <CandidateComments candidateId={c.id} comments={comments} />
        </div>

        {/* Right: résumé preview — fills to the bottom, no thumbnail panel */}
        <div className="lg:sticky lg:top-4">
          {resumeUrl ? (
            <div className="h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 p-6">
              <iframe src={`${resumeUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-full w-full rounded bg-white" title="Résumé" />
            </div>
          ) : (
            <div className="flex h-[calc(100vh-7rem)] items-center justify-center rounded-lg border text-sm text-muted-foreground">
              No résumé attached.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function eventText(e: CandidateEvent): string {
  if (e.type === "applied") return "Applied";
  const to = e.to_stage ? HIRING_STAGE_LABEL[e.to_stage as keyof typeof HIRING_STAGE_LABEL] ?? e.to_stage : "?";
  if (e.type === "hired") return `Hired${e.actor ? ` by ${e.actor}` : ""}`;
  return `Moved to ${to}${e.actor ? ` by ${e.actor}` : ""}`;
}

function ActivityLog({ events }: { events: CandidateEvent[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Activity log</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative ml-1 border-l border-border">
          {events.map((e) => (
            <li key={e.id} className="relative pb-5 pl-6 last:pb-0">
              <span
                className={`absolute -left-[6.5px] top-1 size-3 rounded-full border-2 border-background ${
                  e.type === "hired" ? "bg-emerald-500" : e.type === "applied" ? "bg-primary" : "bg-muted-foreground"
                }`}
              />
              <div className="text-sm">{eventText(e)}</div>
              <div className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}
