"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Upload, ImagePlus, Plus, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compressImage } from "@/lib/compress-image";
import { submitApplication, type OpenPosition } from "@/app/actions/apply";

const JOIN_OPTIONS = ["Minggu ini", "2 minggu ke depan", "1 bulan ke depan", "2 bulan ke depan"];

function Required() {
  return <span className="text-destructive">*</span>;
}
function group(raw: string) {
  const d = raw.replace(/[^0-9]/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

type Exp = { period: string; place: string; position: string; jobdesk: string };
const emptyExp: Exp = { period: "", place: "", position: "", jobdesk: "" };

export function ApplyForm({ openings }: { openings: OpenPosition[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [openingId, setOpeningId] = useState("");
  const [name, setName] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [domicile, setDomicile] = useState("");
  const [height, setHeight] = useState("");
  const [fresh, setFresh] = useState(false);
  const [exps, setExps] = useState<Exp[]>([{ ...emptyExp }]);
  const [salary, setSalary] = useState("");
  const [empStatus, setEmpStatus] = useState<"working" | "not_working" | "">("");
  const [notice, setNotice] = useState("");
  const [earliest, setEarliest] = useState("");
  const [contribution, setContribution] = useState("");
  const [agreeTerms, setAgreeTerms] = useState<"" | "yes" | "no">("");
  const [agreeInterview, setAgreeInterview] = useState<"" | "yes" | "no">("");

  function setExp(i: number, patch: Partial<Exp>) {
    setExps((s) => s.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const resume = resumeRef.current?.files?.[0] ?? null;
    const photo = photoRef.current?.files?.[0] ?? null;
    if (!openingId) { toast.error("Pilih posisi yang dilamar."); return; }
    if (!name.trim()) { toast.error("Nama wajib diisi."); return; }
    if (!whatsapp.trim()) { toast.error("Nomor WhatsApp wajib diisi."); return; }
    if (!(Number(height) > 0)) { toast.error("Tinggi badan wajib diisi."); return; }
    if (agreeTerms !== "yes") { toast.error("Kamu harus bersedia dengan sistem & ketentuan kerja."); return; }
    if (!resume) { toast.error("Lampirkan resume (PDF)."); return; }
    if (resume.type !== "application/pdf") { toast.error("Resume harus PDF."); return; }
    if (resume.size > 5 * 1024 * 1024) { toast.error("Resume maksimal 5MB."); return; }
    if (!photo) { toast.error("Lampirkan foto."); return; }
    if (!photo.type.startsWith("image/")) { toast.error("Foto harus gambar."); return; }

    start(async () => {
      let photoFile: Blob = photo;
      try { photoFile = await compressImage(photo); } catch { photoFile = photo; }

      const fd = new FormData();
      fd.set("opening_id", openingId);
      fd.set("name", name.trim());
      fd.set("whatsapp", whatsapp.trim());
      fd.set("birth_place", birthPlace.trim());
      fd.set("birth_date", birthDate);
      fd.set("domicile", domicile.trim());
      fd.set("height_cm", height.trim());
      fd.set("fresh_graduate", fresh ? "1" : "0");
      fd.set("work_experiences", JSON.stringify(fresh ? [] : exps));
      fd.set("expected_salary", salary.replace(/[^0-9]/g, ""));
      fd.set("employment_status", empStatus);
      fd.set("notice_period", notice.trim());
      fd.set("earliest_join", earliest);
      fd.set("contribution", contribution.trim());
      fd.set("agree_terms", agreeTerms === "yes" ? "1" : "0");
      fd.set("agree_interview", agreeInterview === "yes" ? "1" : "0");
      fd.set("resume", resume);
      fd.set("photo", photoFile, "photo.jpg");

      const res = await submitApplication(fd);
      if (!res.ok) { toast.error(res.error); return; }
      setDone(true);
      window.scrollTo({ top: 0 });
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" />
        <h2 className="mt-3 text-lg font-semibold">Lamaran terkirim!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Terima kasih sudah melamar. Tim kami akan menghubungi kamu lewat WhatsApp bila lolos screening.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Lokasi penempatan */}
      <section className="space-y-2">
        <SectionTitle>Lokasi Penempatan</SectionTitle>
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Machimoto</div>
          <div className="text-muted-foreground">Ruko Delrey Biz Town, BSD</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Mohon pastikan lokasi kerja sesuai dan masih terjangkau dari domisili kamu sebelum mengisi formulir.
        </p>
      </section>

      {/* Posisi */}
      <section className="space-y-2">
        <SectionTitle>Posisi yang Dilamar <Required /></SectionTitle>
        {openings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada posisi yang dibuka saat ini.</p>
        ) : (
          <div className="space-y-2">
            {openings.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${openingId === o.id ? "border-primary bg-primary/5" : ""}`}>
                <input type="radio" name="opening" className="accent-primary" checked={openingId === o.id} onChange={() => setOpeningId(o.id)} />
                <span className="font-medium">{o.title}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Data diri */}
      <section className="space-y-4">
        <SectionTitle>Data Diri</SectionTitle>
        <Field label={<>Nama lengkap <Required /></>}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label="Tempat lahir"><Input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} /></Field>
        <Field label="Tanggal lahir (DD/MM/YYYY)"><DateField value={birthDate} onChange={setBirthDate} /></Field>
        <Field label={<>No. WhatsApp <Required /></>}><Input inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></Field>
        <Field label="Domisili saat ini"><Input value={domicile} onChange={(e) => setDomicile(e.target.value)} /></Field>
        <Field label={<>Tinggi badan (cm) <Required /></>}><Input type="number" min="0" step="1" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
      </section>

      {/* Pengalaman kerja */}
      <section className="space-y-3">
        <SectionTitle>Pengalaman Kerja</SectionTitle>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
          Belum pernah bekerja / Fresh Graduate
        </label>
        {!fresh && (
          <div className="space-y-3">
            {exps.map((ex, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pengalaman {i + 1}</span>
                  {exps.length > 1 && (
                    <button type="button" onClick={() => setExps((s) => s.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <Field label="Tahun / Periode"><Input value={ex.period} onChange={(e) => setExp(i, { period: e.target.value })} /></Field>
                <Field label="Nama Resto / Café / Tempat Kerja"><Input value={ex.place} onChange={(e) => setExp(i, { place: e.target.value })} /></Field>
                <Field label="Posisi"><Input value={ex.position} onChange={(e) => setExp(i, { position: e.target.value })} /></Field>
                <Field label="Job Desk"><Textarea rows={2} value={ex.jobdesk} onChange={(e) => setExp(i, { jobdesk: e.target.value })} /></Field>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={() => setExps((s) => [...s, { ...emptyExp }])}>
              <Plus className="size-4" /> Tambah pengalaman
            </Button>
          </div>
        )}
      </section>

      {/* Salary & availability */}
      <section className="space-y-4">
        <SectionTitle>Salary &amp; Availability</SectionTitle>
        <div className="space-y-1.5">
          <Label>Ekspektasi salary (per bulan)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input inputMode="numeric" className="pl-9" value={salary} onChange={(e) => setSalary(group(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="leading-5">Status saat ini</Label>
          <div className="space-y-2">
            <Radio checked={empStatus === "working"} onChange={() => setEmpStatus("working")} label="Sedang bekerja" />
            <Radio checked={empStatus === "not_working"} onChange={() => setEmpStatus("not_working")} label="Tidak sedang bekerja" />
          </div>
        </div>
        {empStatus === "working" && (
          <Field label="Jika masih bekerja, apakah ada masa notice?"><Input value={notice} onChange={(e) => setNotice(e.target.value)} /></Field>
        )}
        <Field label="Jika diterima, kapan paling cepat bisa join?">
          <Select value={earliest} onValueChange={setEarliest}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Pilih waktu" /></SelectTrigger>
            <SelectContent>
              {JOIN_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </section>

      {/* Tentang kamu */}
      <section className="space-y-2">
        <SectionTitle>Tentang Kamu</SectionTitle>
        <Label className="leading-5">Apa yang bisa kamu kontribusikan untuk Machimoto sesuai posisi yang dilamar?</Label>
        <Textarea rows={4} value={contribution} onChange={(e) => setContribution(e.target.value)} />
      </section>

      {/* Informasi kerja */}
      <section className="space-y-3">
        <SectionTitle>Informasi Kerja</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Sistem kerja shift, durasi kerja normal ±9 jam termasuk break.</li>
          <li>Lembur berlaku jika bekerja melebihi jam shift.</li>
          <li>Service Charge (SC) tersedia sesuai ketentuan.</li>
          <li>Mess tersedia sesuai ketersediaan.</li>
          <li>Bersedia mengikuti training 5 hari × 6 jam per hari.</li>
          <li>Selama masa training mendapat makan 1x per hari.</li>
          <li>Tidak diperbolehkan merokok selama jam operasional, termasuk saat istirahat.</li>
        </ul>
        <div className="space-y-1.5">
          <Label className="leading-5">Apakah bersedia dengan sistem &amp; ketentuan kerja di atas? <Required /></Label>
          <div className="space-y-2">
            <Radio checked={agreeTerms === "yes"} onChange={() => setAgreeTerms("yes")} label="Ya" />
            <Radio checked={agreeTerms === "no"} onChange={() => setAgreeTerms("no")} label="Tidak" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="leading-5">Apakah bersedia mengikuti on-site interview di Machimoto BSD?</Label>
          <div className="space-y-2">
            <Radio checked={agreeInterview === "yes"} onChange={() => setAgreeInterview("yes")} label="Ya" />
            <Radio checked={agreeInterview === "no"} onChange={() => setAgreeInterview("no")} label="Tidak" />
          </div>
          <p className="text-xs leading-4 text-muted-foreground">Hari / tanggal interview akan diinformasikan saat lulus tahap screening CV.</p>
        </div>
      </section>

      {/* Lampiran */}
      <section className="space-y-4">
        <SectionTitle>Lampiran</SectionTitle>
        <div className="space-y-1.5">
          <Label>Foto <Required /></Label>
          <button type="button" onClick={() => photoRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-left text-sm hover:bg-muted">
            <ImagePlus className="size-4 shrink-0 text-muted-foreground" />
            <span className={photoName ? "" : "text-muted-foreground"}>{photoName ?? "Unggah foto"}</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)} />
        </div>
        <div className="space-y-1.5">
          <Label>Resume / CV (PDF) <Required /></Label>
          <button type="button" onClick={() => resumeRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-left text-sm hover:bg-muted">
            <Upload className="size-4 shrink-0 text-muted-foreground" />
            <span className={resumeName ? "" : "text-muted-foreground"}>{resumeName ?? "Unggah resume PDF"}</span>
          </button>
          <input ref={resumeRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setResumeName(e.target.files?.[0]?.name ?? null)} />
        </div>
      </section>

      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim lamaran"}
      </Button>
    </form>
  );
}

/** Text date input (free typing) + a calendar icon that opens the native picker. */
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Input value={value} inputMode="numeric" className="pr-10" onChange={(e) => onChange(e.target.value)} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2">
        <CalendarDays className="pointer-events-none size-4 text-muted-foreground" />
        <input
          type="date"
          aria-label="Pilih tanggal lahir"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const iso = e.target.value;
            if (iso) { const [y, m, d] = iso.split("-"); onChange(`${d}/${m}/${y}`); }
          }}
        />
      </span>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="leading-5">{label}</Label>
      {children}
    </div>
  );
}

function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${checked ? "border-primary bg-primary/5" : ""}`}>
      <input type="radio" className="accent-primary" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
