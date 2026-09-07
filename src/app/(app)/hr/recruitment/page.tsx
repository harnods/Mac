import { getPositions } from "@/app/actions/recruitment";
import { hireBaseUrl } from "@/lib/recruitment";
import { RecruitmentBrowser } from "@/components/recruitment/recruitment-browser";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const positions = await getPositions();
  return <RecruitmentBrowser positions={positions} hireBase={hireBaseUrl()} />;
}
