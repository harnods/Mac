"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitApplication } from "@/app/actions/apply";

function Required() {
  return <span className="text-destructive">*</span>;
}

export function ApplyForm({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [experience, setExperience] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [coverNote, setCoverNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0] ?? null;
    if (!name.trim()) { toast.error("Nama wajib diisi."); return; }
    if (!whatsapp.trim()) { toast.error("Nomor WhatsApp wajib diisi."); return; }
    if (!email.trim()) { toast.error("Email wajib diisi."); return; }
    if (!file) { toast.error("Lampirkan resume (PDF)."); return; }
    if (file.type !== "application/pdf") { toast.error("Resume harus berformat PDF."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran resume maksimal 5MB."); return; }

    const fd = new FormData();
    fd.set("code", code);
    fd.set("name", name.trim());
    fd.set("whatsapp", whatsapp.trim());
    fd.set("email", email.trim());
    fd.set("experience_years", experience.trim());
    fd.set("expected_salary", expectedSalary.trim());
    fd.set("cover_note", coverNote.trim());
    fd.set("resume", file);

    start(async () => {
      const res = await submitApplication(fd);
      if (!res.ok) { toast.error(res.error); return; }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" />
        <h2 className="mt-3 text-lg font-semibold">Lamaran terkirim!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Terima kasih sudah melamar. Tim kami akan menghubungi kamu lewat WhatsApp bila cocok.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ap-name">Nama lengkap <Required /></Label>
        <Input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-wa">Nomor WhatsApp <Required /></Label>
        <Input id="ap-wa" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="08xxxxxxxxxx" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-email">Email <Required /></Label>
        <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-exp">Lama pengalaman (tahun)</Label>
        <Input id="ap-exp" type="number" min="0" step="1" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="mis. 2" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-salary">Ekspektasi gaji (Rp)</Label>
        <Input id="ap-salary" inputMode="numeric" value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="mis. 5000000" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-note">Kenapa kamu cocok? (opsional)</Label>
        <Textarea id="ap-note" rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="Ceritakan singkat pengalaman relevan kamu…" />
      </div>

      <div className="space-y-1.5">
        <Label>Resume (PDF) <Required /></Label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-left text-sm hover:bg-muted"
        >
          <Upload className="size-4 shrink-0 text-muted-foreground" />
          <span className={resumeName ? "" : "text-muted-foreground"}>{resumeName ?? "Unggah resume PDF (maks 5MB)"}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setResumeName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim lamaran"}
      </Button>
    </form>
  );
}
