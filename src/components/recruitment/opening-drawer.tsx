"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  require_physical: boolean;
  min_height_cm: number | null;
  min_weight_kg: number | null;
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
  const [requirePhysical, setRequirePhysical] = useState(false);
  const [minHeight, setMinHeight] = useState("");
  const [minWeight, setMinWeight] = useState("");
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
    setRequirePhysical(prefill?.require_physical ?? false);
    setMinHeight(prefill?.min_height_cm != null ? String(prefill.min_height_cm) : "");
    setMinWeight(prefill?.min_weight_kg != null ? String(prefill.min_weight_kg) : "");
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
    if (!positionId) { toast.error("Select a position."); return; }
    const payload: OpeningInput = {
      title: title.trim() || null,
      job_position_id: positionId,
      department_id: departmentId,
      job_level_id: levelId,
      employment_status_id: employmentTypeId,
      min_experience_years: Number(minExp) || 0,
      headcount: Number(headcount) || 1,
      require_physical: requirePhysical,
      min_height_cm: requirePhysical && minHeight ? Number(minHeight) : null,
      min_weight_kg: requirePhysical && minWeight ? Number(minWeight) : null,
      description: description.trim() || null,
    };
    start(async () => {
      const res = isEdit ? await updateOpening(prefill!.id, payload) : await createOpening(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Opening updated" : "Opening created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit opening" : "New opening"}</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <Label>Position <Required /></Label>
              <MasterDataCombobox
                options={positions}
                value={positionId}
                onChange={pickPosition}
                placeholder="Select position"
                entityLabel="Job position"
                onCreate={async (name) => {
                  const res = await createJobPosition({ name, department_id: departmentId });
                  if (res.ok && res.id) setPositions((p) => [...p, { id: res.id!, name, department_id: departmentId }]);
                  return res;
                }}
              />
              <p className="text-xs text-muted-foreground">Department follows the selected position.</p>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <MasterDataCombobox
                options={formData.departments}
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="Select department"
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
                placeholder="Select level"
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
                placeholder="Select type"
                entityLabel="Employment type"
                onCreate={(name) => createEmploymentStatus({ name })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-exp">Min. experience (years)</Label>
                <Input id="min-exp" type="number" min="0" step="1" value={minExp} onChange={(e) => setMinExp(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount">Headcount</Label>
                <Input id="headcount" type="number" min="1" step="1" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="require-physical">Physical requirements</Label>
                  <p className="text-xs text-muted-foreground">Ask candidates for height &amp; weight.</p>
                </div>
                <Switch id="require-physical" checked={requirePhysical} onCheckedChange={setRequirePhysical} />
              </div>
              {requirePhysical && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-height">Min. height (cm)</Label>
                    <Input id="min-height" type="number" min="0" step="1" value={minHeight} onChange={(e) => setMinHeight(e.target.value)} placeholder="e.g. 160" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-weight">Min. weight (kg)</Label>
                    <Input id="min-weight" type="number" min="0" step="1" value={minWeight} onChange={(e) => setMinWeight(e.target.value)} placeholder="e.g. 50" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-title">Title (optional)</Label>
              <Input id="opening-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank to use the position name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-desc">Description / qualifications (optional)</Label>
              <Textarea id="opening-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Responsibilities, qualifications, benefits…" />
            </div>
          </SheetBody>
          <SheetFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : isEdit ? "Save changes" : "Save"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
