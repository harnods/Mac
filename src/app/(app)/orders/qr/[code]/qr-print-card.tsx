"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { tableOrderUrl } from "@/lib/order-url";

export function QrPrintCard({ name, code }: { name: string; code: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const printed = useRef(false);

  useEffect(() => {
    const target = tableOrderUrl(code);
    QRCode.toDataURL(target, { width: 720, margin: 1, errorCorrectionLevel: "M" }).then((d) => {
      setUrl(target);
      setDataUrl(d);
    });
  }, [code]);

  // Auto-open the print dialog once the QR has rendered (one-tap from POS).
  useEffect(() => {
    if (dataUrl && !printed.current) {
      printed.current = true;
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [dataUrl]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Print rules: when printing, show only the tent card. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .qr-tent, .qr-tent * { visibility: visible !important; }
          .qr-tent { position: absolute; inset: 0; margin: auto; border: none !important; box-shadow: none !important; }
          .qr-noprint { display: none !important; }
        }
      `}</style>

      <div className="qr-noprint flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/orders"><ArrowLeft className="size-4" /> Back to POS</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()} disabled={!dataUrl}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      <div className="qr-tent mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border bg-white px-8 py-10 text-center text-black">
        <div className="space-y-1">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Machimoto Cafe</div>
          <div className="text-4xl font-extrabold tracking-tight">{name}</div>
        </div>

        <div className="rounded-xl border p-3">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`QR ${name}`} width={280} height={280} className="size-[280px]" />
          ) : (
            <div className="size-[280px] animate-pulse rounded-lg bg-neutral-100" />
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xl font-bold">Scan untuk pesan</div>
          <div className="text-sm text-neutral-600">Arahkan kamera HP ke QR untuk lihat menu &amp; pesan langsung dari meja.</div>
          <div className="pt-1 text-[11px] font-mono text-neutral-400 break-all">{url}</div>
        </div>
      </div>
    </div>
  );
}
