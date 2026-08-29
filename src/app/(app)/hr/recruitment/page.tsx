import { getPositions } from "@/app/actions/recruitment";
import { hireBaseUrl } from "@/lib/recruitment";
import { PositionsList } from "@/components/recruitment/positions-list";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const positions = await getPositions();
  return (
    <div className="space-y-4">
      <PositionsList positions={positions} hireBase={hireBaseUrl()} />
    </div>
  );
}
