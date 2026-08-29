"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Upload, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/compress-image";
import { submitApplication } from "@/app/actions/apply";

function Required() {
  return <span className="text-destructive">*</span>;
}

/** Format a raw number string with thousand separators (dots): 5000000 → 5.000.000 */
function groupThousands(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

export function ApplyForm({ code, requirePhysical = false }: { code: string; requirePhysical?: boolean }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [experience, setExperience] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [coverNote, setCoverNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const resume = resumeRef.current?.files?.[0] ?? null;
    const photo = photoRef.current?.files?.[0] ?? null;
    if (!name.trim()) { toast.error("Nama wajib diisi."); return; }
    if (!whatsapp.trim()) { toast.error("Nomor WhatsApp wajib diisi."); return; }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error("Email tidak valid."); return; }
    if (requirePhysical && !(Number(height) > 0)) { toast.error("Tinggi badan wajib diisi."); return; }
    if (requirePhysical && !(Number(weight) > 0)) { toast.error("Berat badan wajib diisi."); return; }
    if (!resume) { toast.error("Lampirkan resume (PDF)."); return; }
    if (resume.type !== "application/pdf") { toast.error("Resume harus berformat PDF."); return; }
    if (resume.size > 5 * 1024 * 1024) { toast.error("Ukuran resume maksimal 5MB."); return; }
    if (!photo) { toast.error("Lampirkan foto."); return; }
    if (!photo.type.startsWith("image/")) { toast.error("Foto harus berupa gambar."); return; }

    start(async () => {
      let photoFile: Blob = photo;
      try { photoFile = await compressImage(photo); } catch { photoFile = photo; }

      const fd = new FormData();
      fd.set("code", code);
      fd.set("name", name.trim());
      fd.set("whatsapp", whatsapp.trim());
      fd.set("email", email.trim());
      fd.set("experience_years", experience.trim());
      fd.set("expected_salary", expectedSalary.replace(/[^0-9]/g, ""));
      fd.set("height_cm", height.trim());
      fd.set("weight_kg", weight.trim());
      fd.set("cover_note", coverNote.trim());
      fd.set("resume", resume);
      fd.set("photo", photoFile, "photo.jpg");

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
        <Input id="ap-wa" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-email">Email</Label>
        <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-exp">Lama pengalaman (tahun)</Label>
        <Input id="ap-exp" type="number" min="0" step="1" value={experience} onChange={(e) => setExperience(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-salary">Ekspektasi gaji (Rp)</Label>
        <Input id="ap-salary" inputMode="numeric" value={expectedSalary} onChange={(e) => setExpectedSalary(groupThousands(e.target.value))} />
      </div>
      {requirePhysical && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ap-height">Tinggi badan (cm) <Required /></Label>
            <Input id="ap-height" type="number" min="0" step="1" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-weight">Berat badan (kg) <Required /></Label>
            <Input id="ap-weight" type="number" min="0" step="1" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ap-note">Kenapa kamu cocok? (opsional)</Label>
        <Textarea id="ap-note" rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Foto <Required /></Label>
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-left text-sm hover:bg-muted"
        >
          <ImagePlus className="size-4 shrink-0 text-muted-foreground" />
          <span className={photoName ? "" : "text-muted-foreground"}>{photoName ?? "Unggah foto"}</span>
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Resume (PDF) <Required /></Label>
        <button
          type="button"
          onClick={() => resumeRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-left text-sm hover:bg-muted"
        >
          <Upload className="size-4 shrink-0 text-muted-foreground" />
          <span className={resumeName ? "" : "text-muted-foreground"}>{resumeName ?? "Unggah resume PDF"}</span>
        </button>
        <input
          ref={resumeRef}
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
