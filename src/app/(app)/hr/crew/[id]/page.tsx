import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, updaterName, yearsSince, durationSince } from "@/lib/format";
import { EmployeeDetailActions } from "@/components/employees/employee-detail-actions";
import { EmployeeDetailTabs } from "@/components/employees/employee-detail-tabs";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const { data, error } = await supabase
    .from("employees")
    .select(
      "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name), updater:profiles!updated_by(full_name,email), mac_user:profiles!user_id(id,email,role,is_owner)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) notFound();
  const emp = data as EmployeeWithRelations;
  const isResigned = !!emp.termination_date;
  const initials = emp.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-8">
      {/* Title — full width (12 columns, to the far right) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/hr/crew"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{emp.name}</h1>
          {isResigned && <Badge variant="secondary">Resigned</Badge>}
        </div>
        {isAdmin && (
          <EmployeeDetailActions
            id={id}
            name={emp.name}
            canDelete={!emp.mac_user?.is_owner}
            terminationDate={emp.termination_date}
            lastDay={emp.last_day}
          />
        )}
      </div>

      {/* Tabs — Crew profile holds the detail content; other modules TBD */}
      <EmployeeDetailTabs>
      {/* Body — 12 columns: info on the left (6), profile pic after it */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
      {/* Employee info */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Employee info</h2>
        <dl>
          <DetailRow label="Name" value={emp.name} />
          <DetailRow label="Email" value={emp.email} />
          <DetailRow
            label="WhatsApp no"
            value={emp.phone ? (
              <a
                href={`https://wa.me/${emp.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {emp.phone}
              </a>
            ) : null}
          />
          <DetailRow
            label="Birthdate"
            value={emp.birthdate ? (
              <span className="inline-flex items-center gap-2">
                {formatDate(emp.birthdate)}
                <Badge variant="secondary">{yearsSince(emp.birthdate)} years old</Badge>
              </span>
            ) : null}
          />
          <DetailRow label="NIK" value={emp.nik} />
          <DetailRow label="Gender" value={emp.gender ? GENDER_LABEL[emp.gender] : null} />
          <DetailRow label="Address" value={<span className="whitespace-pre-wrap">{emp.address}</span>} />
        </dl>
      </section>

      {/* Employment info */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Employment info</h2>
        <dl>
          <DetailRow
            label="Join date"
            value={emp.join_date ? (
              <span className="inline-flex items-center gap-2">
                {formatDate(emp.join_date)}
                <Badge variant="secondary">{durationSince(emp.join_date)}</Badge>
              </span>
            ) : null}
          />
          <DetailRow label="Department" value={emp.departments?.name} />
          <DetailRow label="Job position" value={emp.job_positions?.name} />
          <DetailRow label="Job level" value={emp.job_levels?.name} />
          <DetailRow label="Employment status" value={emp.employment_statuses?.name} />
          {isResigned && (
            <>
              <DetailRow label="Termination date" value={emp.termination_date ? formatDate(emp.termination_date) : null} />
              <DetailRow label="Last day" value={emp.last_day ? formatDate(emp.last_day) : null} />
            </>
          )}
        </dl>
      </section>

          <p className="text-xs text-muted-foreground">
            Last updated by {updaterName(emp.updater)} at {formatDateTime(emp.updated_at)}
          </p>
        </div>

        {/* Profile pic — right after the 6-column info (starts at column 7) */}
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <div className="flex size-[120px] items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {emp.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emp.photo_url} alt={emp.name} className="size-full object-cover" />
            ) : (
              <span className="text-3xl font-medium text-muted-foreground">{initials || "?"}</span>
            )}
          </div>
        </div>
      </div>
      </EmployeeDetailTabs>
    </div>
  );
}
