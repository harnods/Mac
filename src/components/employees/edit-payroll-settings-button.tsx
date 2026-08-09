"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PayrollSettingsDrawer, type SettingsPrefill } from "@/components/employees/payroll-settings-drawer";

export function EditPayrollSettingsButton({ prefill, today }: { prefill: SettingsPrefill; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Edit</Button>
      <PayrollSettingsDrawer open={open} onOpenChange={setOpen} prefill={prefill} today={today} />
    </>
  );
}
