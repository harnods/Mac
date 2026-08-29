import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getOpenings, getRecruitmentFormData } from "@/app/actions/recruitment";
import { hireBaseUrl } from "@/lib/recruitment";
import { OpeningsManager } from "@/components/recruitment/openings-manager";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const [openings, formData] = await Promise.all([getOpenings(), getRecruitmentFormData()]);

  return (
    <div className="space-y-4">
      <OpeningsManager openings={openings} formData={formData} hireBase={hireBaseUrl()} isAdmin={isAdmin} />
    </div>
  );
}
