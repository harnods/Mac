"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GroupPicker, type TelegramGroup } from "@/components/telegram/group-picker";
import { TelegramLinkButton } from "@/components/telegram/telegram-link-button";
import { registerWebhook, setPurchaseRequestGroup, setSupplierGroup, type WebhookStatus } from "@/app/actions/telegram";
import { formatDate } from "@/lib/format";

export type SupplierGroupRow = { id: string; name: string; chatId: number | null };
export type LinkedAccountRow = { profileId: string; name: string; telegram: string; linkedAt: string };

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TelegramSettings({
  status,
  groups,
  prChatId,
  suppliers,
  accounts,
  myTelegram,
}: {
  status: WebhookStatus;
  groups: TelegramGroup[];
  prChatId: number | null;
  suppliers: SupplierGroupRow[];
  accounts: LinkedAccountRow[];
  myTelegram: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const webhookOk = !!status.webhookUrl && status.webhookUrl === status.expectedUrl;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Telegram</h1>

      <Section title="Bot">
        {!status.configured ? (
          <p className="text-sm text-muted-foreground">
            Bot belum dikonfigurasi. Isi <code>TELEGRAM_BOT_TOKEN</code> dan <code>TELEGRAM_WEBHOOK_SECRET</code> di environment.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <div>
              Bot:{" "}
              {status.username ? (
                <a href={`https://t.me/${status.username}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  @{status.username}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div>
              Webhook:{" "}
              {webhookOk ? (
                <span className="text-emerald-600">aktif</span>
              ) : status.webhookUrl ? (
                <span className="text-amber-600">mengarah ke {status.webhookUrl}</span>
              ) : (
                <span className="text-muted-foreground">belum dipasang</span>
              )}
              {status.pending > 0 && <span className="text-muted-foreground"> · {status.pending} update menunggu</span>}
            </div>
            {status.lastError && <div className="text-amber-600">Error terakhir: {status.lastError}</div>}
            {!webhookOk && status.expectedUrl?.startsWith("https://") && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(registerWebhook, "Webhook dipasang")}>
                Pasang webhook ke {status.expectedUrl}
              </Button>
            )}
            {!status.expectedUrl?.startsWith("https://") && (
              <p className="text-xs text-muted-foreground">
                Webhook butuh URL publik (<code>APP_BASE_URL</code> https). Untuk local, jalankan <code>node scripts/telegram-poll.mjs</code>.
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Tambahkan bot ke grup Telegram (grup Purchase Requests dan satu grup per supplier). Grup akan otomatis muncul di pilihan di bawah.
        </p>
      </Section>

      <Section title="Grup Purchase Requests">
        <div className="max-w-sm">
          <GroupPicker
            groups={groups}
            value={prChatId}
            disabled={pending}
            onChange={(id) => run(() => setPurchaseRequestGroup(id), "Grup Purchase Requests disimpan")}
          />
        </div>
      </Section>

      <Section
        title="Grup per supplier"
        action={
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers" className="w-64" />
        }
      >
        {suppliers.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
            Belum ada supplier. <Link href="/purchasing/suppliers" className="underline">Tambah supplier</Link>.
          </div>
        ) : (
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Supplier</TableHead>
                  <TableHead className="w-72">Grup Telegram</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/purchasing/suppliers/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    </TableCell>
                    <TableCell>
                      <GroupPicker
                        groups={groups}
                        value={s.chatId}
                        disabled={pending}
                        onChange={(id) => run(() => setSupplierGroup(s.id, id), `Grup ${s.name} disimpan`)}
                      />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Akun terhubung">
        <TelegramLinkButton linkedAs={myTelegram} />
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada karyawan yang terhubung. Karyawan menghubungkan akunnya dari halaman Profile (aplikasi crew) atau dari sini.
          </p>
        ) : (
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Nama</TableHead>
                  <TableHead className="w-56">Telegram</TableHead>
                  <TableHead className="w-44">Terhubung</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.profileId}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-sm">{a.telegram}</TableCell>
                    <TableCell className="text-sm">{formatDate(a.linkedAt)}</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
