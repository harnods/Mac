"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitDraftRequest } from "@/app/actions/purchasing";

export function SubmitDraftButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function handleSubmit() {
    start(async () => {
      const res = await submitDraftRequest(id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Request submitted");
    });
  }

  return (
    <Button disabled={pending} onClick={handleSubmit}>
      {pending ? "Submitting..." : "Submit request"}
    </Button>
  );
}
