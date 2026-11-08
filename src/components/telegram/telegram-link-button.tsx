"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTelegramLink, unlinkMyTelegram } from "@/app/actions/telegram";

/**
 * Connect the signed-in user's Telegram account to the purchasing bot. Opens a
 * one-time t.me deep link; the bot completes the link on /start <code>.
 */
export function TelegramLinkButton({
  linkedAs,
  className,
}: {
  /** "@username" / name when already linked, else null. */
  linkedAs: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [opened, setOpened] = useState(false);

  function connect() {
    start(async () => {
      const res = await createTelegramLink();
      if (!res.ok) { toast.error(res.error); return; }
      window.open(res.url, "_blank", "noopener,noreferrer");
      setOpened(true);
    });
  }

  function unlink() {
    start(async () => {
      const res = await unlinkMyTelegram();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Telegram terputus");
      router.refresh();
    });
  }

  if (linkedAs) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">
            Terhubung sebagai <span className="font-medium">{linkedAs}</span>
          </span>
          <Button variant="outline" size="sm" onClick={unlink} disabled={pending}>
            Putuskan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button variant="outline" onClick={connect} disabled={pending}>
        <Send className="size-4" /> {pending ? "Membuka…" : "Hubungkan Telegram"}
      </Button>
      {opened && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tekan <b>Start</b> di Telegram, lalu{" "}
          <button type="button" onClick={() => router.refresh()} className="underline underline-offset-2">
            muat ulang
          </button>{" "}
          halaman ini. Link berlaku 15 menit.
        </p>
      )}
    </div>
  );
}
