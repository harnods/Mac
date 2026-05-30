import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/format";
import { EmployeeDeleteButton } from "@/components/employees/employee-actions";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
};

const MARITAL_LABEL: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 border-b last:border-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">{value || "—"}</dd>
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
  const isAdmin = profile?.role === "admin";

  const { data, error } = await supabase
    .from("employees")
    .select(
      "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name), updater:profiles!updated_by(full_name,email)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) notFound();
  const emp = data as EmployeeWithRelations;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
            <Link href="/employees"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{emp.name}</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/employees/${id}/edit`}>Edit</Link>
            </Button>
            <EmployeeDeleteButton id={id} name={emp.name} />
          </div>
        )}
      </div>

      <div className="border rounded-lg px-4">
        <h2 className="text-sm font-semibold py-3 border-b">Personal information</h2>
        <dl>
          <DetailRow label="Email" value={emp.email} />
          <DetailRow label="Phone" value={emp.phone} />
          <DetailRow label="Birthdate" value={emp.birthdate ? formatDate(emp.birthdate) : null} />
          <DetailRow label="NIK" value={emp.nik} />
          <DetailRow label="Gender" value={emp.gender ? GENDER_LABEL[emp.gender] : null} />
          <DetailRow label="Marital status" value={emp.marital_status ? MARITAL_LABEL[emp.marital_status] : null} />
          <DetailRow label="Address" value={<span className="whitespace-pre-wrap">{emp.address}</span>} />
        </dl>
      </div>

      <div className="border rounded-lg px-4">
        <h2 className="text-sm font-semibold py-3 border-b">Employment information</h2>
        <dl>
          <DetailRow label="Department" value={emp.departments?.name} />
          <DetailRow label="Job position" value={emp.job_positions?.name} />
          <DetailRow label="Job level" value={emp.job_levels?.name} />
          <DetailRow label="Employment status" value={emp.employment_statuses?.name} />
        </dl>
      </div>

      <div className="border rounded-lg px-4">
        <h2 className="text-sm font-semibold py-3 border-b">Record info</h2>
        <dl>
          <DetailRow label="Created" value={formatDate(emp.created_at)} />
          <DetailRow label="Last updated" value={formatDate(emp.updated_at)} />
        </dl>
      </div>
    </div>
  );
}
