"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keeps an unexpected client error on the apply page inside the page itself —
 *  applicants get a retry instead of a dead tab. */
export default function ApplyError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="size-10 text-amber-600" />
      <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
      <p className="text-sm text-muted-foreground">
        Formulir gagal dimuat. Coba lagi, atau muat ulang halaman ini.
      </p>
      <Button className="mt-2" onClick={() => unstable_retry()}>Coba lagi</Button>
    </div>
  );
}
