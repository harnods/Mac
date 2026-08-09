"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MasterDataCombobox } from "@/components/employees/master-data-combobox";
import type { ActionResult } from "@/app/actions/employees";

type Props = {
  title: string;
  showSortOrder?: boolean;
  departmentOptions?: { id: string; name: string }[];
  onCreateDepartment?: (input: unknown) => Promise<ActionResult>;
  onCreate: (input: unknown) => Promise<ActionResult>;
};

export function AddMasterDataButton({ title, showSortOrder = false, departmentOptions, onCreateDepartment, onCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const showDepartment = !!departmentOptions;

  function reset() {
    setName("");
    setSortOrder("0");
    setDepartmentId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (showDepartment && !departmentId) { toast.error("Department is required"); return; }
    start(async () => {
      const input: Record<string, unknown> = { name: name.trim() };
      if (showSortOrder) input.sort_order = Number(sortOrder);
      if (showDepartment) input.department_id = departmentId;
      const res = await onCreate(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${title} created`);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add {title.toLowerCase()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add {title.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mdata-name">Name</Label>
            <Input
              id="mdata-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {showSortOrder && (
            <div className="space-y-2">
              <Label htmlFor="mdata-sort">Sort order</Label>
              <Input
                id="mdata-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          )}
          {showDepartment && (
            <div className="space-y-2">
              <Label>Department <span className="text-destructive">*</span></Label>
              <MasterDataCombobox
                options={departmentOptions!}
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="Select department"
                entityLabel="Department"
                onCreate={(depName) => onCreateDepartment ? onCreateDepartment({ name: depName }) : Promise.resolve({ ok: false, error: "Cannot create department here" })}
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !name.trim() || (showDepartment && !departmentId)}>
              {pending ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
