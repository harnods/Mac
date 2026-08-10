import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMyProfile } from "@/app/actions/crew-self";
import { formatDate } from "@/lib/format";
import { CrewLogoutButton } from "@/components/crew/crew-logout-button";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function cap(s: string | null) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

export default async function MeProfilePage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const p = await getMyProfile();
  if (!p) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This account isn&rsquo;t linked to a crew profile.
      </div>
    );
  }

  const waDigits = p.phone?.replace(/\D/g, "");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight">Profile</h1>

      <Section title="Employee info">
        <Row label="Name" value={p.name} />
        <Row label="Email" value={p.email} />
        <Row
          label="WhatsApp"
          value={
            p.phone ? (
              <a href={`https://wa.me/${waDigits}`} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
                {p.phone}
              </a>
            ) : null
          }
        />
        <Row label="Birthdate" value={p.birthdate ? formatDate(p.birthdate) : null} />
        <Row label="NIK" value={p.nik} />
        <Row label="Gender" value={cap(p.gender)} />
        <Row label="Address" value={p.address} />
      </Section>

      <Section title="Employment info">
        <Row label="Department" value={p.department} />
        <Row label="Job position" value={p.job_position} />
        <Row label="Job level" value={p.job_level} />
        <Row label="Employment type" value={p.employment_status} />
        <Row label="Join date" value={p.join_date ? formatDate(p.join_date) : null} />
        {p.termination_date && <Row label="Termination date" value={formatDate(p.termination_date)} />}
        {p.last_day && <Row label="Last day" value={formatDate(p.last_day)} />}
      </Section>

      <Section title="Bank info">
        <Row label="Bank name" value={p.bank_name} />
        <Row label="Account number" value={p.bank_account_no} />
        <Row label="Account holder" value={p.account_holder_name} />
      </Section>

      <CrewLogoutButton />
    </div>
  );
}
