"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PayrollComponentDrawer, type ComponentPrefill } from "@/components/employees/payroll-component-drawer";

/** "Edit" action for the Payroll component detail title bar. */
export function EditPayrollComponentButton({ prefill, today }: { prefill: ComponentPrefill; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Edit</Button>
      <PayrollComponentDrawer open={open} onOpenChange={setOpen} prefill={prefill} today={today} />
    </>
  );
}
