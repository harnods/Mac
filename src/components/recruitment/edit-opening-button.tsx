"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OpeningDrawer, type OpeningPrefill } from "@/components/recruitment/opening-drawer";
import type { RecruitmentFormData } from "@/app/actions/recruitment";

export function EditOpeningButton({ formData, prefill }: { formData: RecruitmentFormData; prefill: OpeningPrefill }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      <OpeningDrawer open={open} onOpenChange={setOpen} formData={formData} prefill={prefill} />
    </>
  );
}
