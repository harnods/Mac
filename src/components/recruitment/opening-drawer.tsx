"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MasterDataCombobox } from "@/components/employees/master-data-combobox";
import { createJobPosition, createDepartment, createJobLevel, createEmploymentStatus } from "@/app/actions/employees";
import { createOpening, updateOpening, type OpeningInput, type RecruitmentFormData } from "@/app/actions/recruitment";

export type OpeningPrefill = {
  id: string;
  title: string | null;
  job_position_id: string | null;
  department_id: string | null;
  job_level_id: string | null;
  employment_status_id: string | null;
  min_experience_years: number;
  headcount: number;
  description: string | null;
};

function Required() {
  return <span className="text-destructive">*</span>;
}

export function OpeningDrawer({
  open,
  onOpenChange,
  formData,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: RecruitmentFormData;
  prefill?: OpeningPrefill;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!prefill;

  const [positions, setPositions] = useState(formData.positions);
  const [title, setTitle] = useState("");
  const [positionId, setPositionId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [employmentTypeId, setEmploymentTypeId] = useState<string | null>(null);
  const [minExp, setMinExp] = useState("0");
  const [headcount, setHeadcount] = useState("1");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setPositions(formData.positions);
    setTitle(prefill?.title ?? "");
    setPositionId(prefill?.job_position_id ?? null);
    setDepartmentId(prefill?.department_id ?? null);
    setLevelId(prefill?.job_level_id ?? null);
    setEmploymentTypeId(prefill?.employment_status_id ?? null);
    setMinExp(prefill ? String(prefill.min_experience_years) : "0");
    setHeadcount(prefill ? String(prefill.headcount) : "1");
    setDescription(prefill?.description ?? "");
  }, [open, prefill, formData.positions]);

  // Picking a position auto-fills its department (same rule as the crew form).
  function pickPosition(id: string | null) {
    setPositionId(id);
    const pos = positions.find((p) => p.id === id);
    if (pos?.department_id) setDepartmentId(pos.department_id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!positionId) { toast.error("Pilih posisi yang dicari."); return; }
    const payload: OpeningInput = {
      title: title.trim() || null,
      job_position_id: positionId,
      department_id: departmentId,
      job_level_id: levelId,
      employment_status_id: employmentTypeId,
      min_experience_years: Number(minExp) || 0,
      headcount: Number(headcount) || 1,
      description: description.trim() || null,
    };
    start(async () => {
      const res = isEdit ? await updateOpening(prefill!.id, payload) : await createOpening(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Lowongan diperbarui" : "Lowongan dibuat");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit lowongan" : "Buka lowongan baru"}</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <Label>Posisi yang dicari <Required /></Label>
              <MasterDataCombobox
                options={positions}
                value={positionId}
                onChange={pickPosition}
                placeholder="Pilih posisi"
                entityLabel="Job position"
                onCreate={async (name) => {
                  const res = await createJobPosition({ name, department_id: departmentId });
                  if (res.ok && res.id) setPositions((p) => [...p, { id: res.id!, name, department_id: departmentId }]);
                  return res;
                }}
              />
              <p className="text-xs text-muted-foreground">Departemen otomatis mengikuti posisi.</p>
            </div>

            <div className="space-y-2">
              <Label>Departemen</Label>
              <MasterDataCombobox
                options={formData.departments}
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="Pilih departemen"
                entityLabel="Department"
                onCreate={(name) => createDepartment({ name })}
              />
            </div>

            <div className="space-y-2">
              <Label>Job level</Label>
              <MasterDataCombobox
                options={formData.levels}
                value={levelId}
                onChange={setLevelId}
                placeholder="Pilih level"
                entityLabel="Job level"
                onCreate={(name) => createJobLevel({ name })}
              />
            </div>

            <div className="space-y-2">
              <Label>Employment type</Label>
              <MasterDataCombobox
                options={formData.employmentTypes}
                value={employmentTypeId}
                onChange={setEmploymentTypeId}
                placeholder="Pilih tipe"
                entityLabel="Employment type"
                onCreate={(name) => createEmploymentStatus({ name })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-exp">Min. pengalaman (tahun)</Label>
                <Input id="min-exp" type="number" min="0" step="1" value={minExp} onChange={(e) => setMinExp(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount">Jumlah posisi</Label>
                <Input id="headcount" type="number" min="1" step="1" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-title">Judul lowongan (opsional)</Label>
              <Input id="opening-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kosongkan untuk pakai nama posisi" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-desc">Deskripsi / kualifikasi (opsional)</Label>
              <Textarea id="opening-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tugas, kualifikasi, benefit…" />
            </div>
          </SheetBody>
          <SheetFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : isEdit ? "Save changes" : "Save"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
