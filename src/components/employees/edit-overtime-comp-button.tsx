"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OvertimeCompDrawer, type OvertimePrefill } from "@/components/employees/overtime-comp-drawer";

export function EditOvertimeCompButton({
  prefill,
  jobLevels,
  today,
}: {
  prefill: OvertimePrefill;
  jobLevels: { id: string; name: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Edit</Button>
      <OvertimeCompDrawer open={open} onOpenChange={setOpen} jobLevels={jobLevels} prefill={prefill} today={today} />
    </>
  );
}
