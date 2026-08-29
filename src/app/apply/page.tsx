import Image from "next/image";

export const dynamic = "force-dynamic";

export default function ApplyRootPage() {
  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6 flex justify-center">
        <Image src="/machimoto-logotype.svg" alt="Machimoto" width={150} height={32} priority />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold">Karier di Machimoto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buka link lowongan lengkap yang dibagikan tim kami untuk mulai melamar.
        </p>
      </div>
    </div>
  );
}
