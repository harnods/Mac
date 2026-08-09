"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayrollComponentDrawer } from "@/components/employees/payroll-component-drawer";

/** "Add component" action for the Payroll components page title bar. */
export function AddPayrollComponentButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add component
      </Button>
      <PayrollComponentDrawer open={open} onOpenChange={setOpen} today={today} />
    </>
  );
}
