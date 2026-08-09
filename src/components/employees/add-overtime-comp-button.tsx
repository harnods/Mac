"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OvertimeCompDrawer } from "@/components/employees/overtime-comp-drawer";

export function AddOvertimeCompButton({ jobLevels, today }: { jobLevels: { id: string; name: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add overtime
      </Button>
      <OvertimeCompDrawer open={open} onOpenChange={setOpen} jobLevels={jobLevels} today={today} />
    </>
  );
}
