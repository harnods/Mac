"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTelegramLink, unlinkMyTelegram } from "@/app/actions/telegram";

type Pending = { url: string; username: string; command: string };

/**
 * Connect the signed-in user's Telegram account to the purchasing bot.
 * Opens a one-time t.me deep link; because that link only works when the
 * Telegram app can be launched, the "/start <code>" command is also shown to
 * paste into the bot chat manually (phone, desktop or web.telegram.org).
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
  const [link, setLink] = useState<Pending | null>(null);

  function connect() {
    start(async () => {
      const res = await createTelegramLink();
      if (!res.ok) { toast.error(res.error); return; }
      setLink({ url: res.url, username: res.username, command: res.command });
      window.open(res.url, "_blank", "noopener,noreferrer");
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

  async function copyCommand() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.command);
      toast.success("Perintah disalin");
    } catch {
      toast.error("Tidak bisa menyalin — salin manual");
    }
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
      {link && (
        <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
          <p>
            Di Telegram, buka chat{" "}
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              @{link.username}
            </a>{" "}
            dan tekan <b>Start</b>.
          </p>
          <p className="text-muted-foreground">
            Kalau Telegram tidak terbuka, kirim pesan ini ke @{link.username} (dari HP, Telegram Desktop, atau web.telegram.org):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">{link.command}</code>
            <Button type="button" variant="outline" size="sm" onClick={copyCommand}>
              <Copy className="size-3.5" /> Salin
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Berlaku 15 menit, sekali pakai. Setelah bot membalas &ldquo;Akun terhubung&rdquo;,{" "}
            <button type="button" onClick={() => router.refresh()} className="underline underline-offset-2">
              muat ulang
            </button>{" "}
            halaman ini.
          </p>
        </div>
      )}
    </div>
  );
}
