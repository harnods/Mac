import Image from "next/image";
import { getOpeningByCode } from "@/app/actions/apply";
import { ApplyForm } from "@/components/apply/apply-form";

export const dynamic = "force-dynamic";

export default async function ApplyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const opening = await getOpeningByCode(code);

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6 flex justify-center">
        <Image src="/machimoto-logotype.svg" alt="Machimoto" width={150} height={32} priority />
      </div>

      {!opening ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-lg font-semibold">Lowongan tidak ditemukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Link mungkin salah atau sudah tidak berlaku.</p>
        </div>
      ) : opening.status !== "open" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-lg font-semibold">{opening.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lowongan ini sudah ditutup. Terima kasih atas minat kamu.</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{opening.title}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {opening.department && <span>{opening.department}</span>}
              {opening.level && <span>· {opening.level}</span>}
              {opening.employment_type && <span>· {opening.employment_type}</span>}
            </div>
            {opening.min_experience_years > 0 && (
              <p className="text-sm text-muted-foreground">Min. pengalaman {opening.min_experience_years} tahun</p>
            )}
          </div>

          {opening.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{opening.description}</p>
          )}

          <div className="mt-6">
            <ApplyForm code={opening.code} />
          </div>
        </>
      )}
    </div>
  );
}
