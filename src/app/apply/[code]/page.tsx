import type { Metadata } from "next";
import Image from "next/image";
import { getOpeningByCode } from "@/app/actions/apply";
import { ApplyForm } from "@/components/apply/apply-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const opening = await getOpeningByCode(code);
  const title = opening ? `Machimoto — Apply position: ${opening.title}` : "Machimoto — Lowongan Kerja";
  const description = opening?.description?.trim()
    ? opening.description.trim().slice(0, 200)
    : "Lamar posisi di Machimoto. Isi form dan kirim CV kamu.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Machimoto" },
    twitter: { card: "summary_large_image", title, description },
  };
}

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
          <h1 className="text-xl font-semibold tracking-tight">{opening.title}</h1>

          {opening.description && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{opening.description}</p>
          )}

          <div className="mt-6">
            <ApplyForm code={opening.code} requirePhysical={opening.require_physical} />
          </div>
        </>
      )}
    </div>
  );
}
