import type { Metadata } from "next";
import Image from "next/image";
import { getOpenPositions } from "@/app/actions/apply";
import { ApplyForm } from "@/components/apply/apply-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Machimoto — Job Application",
  description: "Lamar posisi di Machimoto. Isi formulir dan kirim CV kamu.",
  openGraph: { title: "Machimoto — Job Application", description: "Lamar posisi di Machimoto.", type: "website", siteName: "Machimoto" },
  twitter: { card: "summary_large_image", title: "Machimoto — Job Application", description: "Lamar posisi di Machimoto." },
};

export default async function ApplyPage() {
  const openings = await getOpenPositions();
  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6 flex justify-center">
        <Image src="/machimoto-logotype.svg" alt="Machimoto" width={150} height={32} priority />
      </div>
      <h1 className="mb-6 text-center text-xl font-semibold tracking-tight">Machimoto Job Application</h1>
      <ApplyForm openings={openings} />
    </div>
  );
}
