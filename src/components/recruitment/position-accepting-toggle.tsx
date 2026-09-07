"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setPositionAcceptingApplications } from "@/app/actions/recruitment";

/** In-table on/off switch: when off, candidates can't pick this position on the
 *  public apply form. Persists immediately and refreshes the row. */
export function PositionAcceptingToggle({ id, name, accepting }: { id: string; name: string; accepting: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleToggle(checked: boolean) {
    start(async () => {
      const res = await setPositionAcceptingApplications(id, checked);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(checked ? `${name} is now open for applications` : `${name} is closed for applications`);
      router.refresh();
    });
  }

  return (
    <Switch
      checked={accepting}
      onCheckedChange={handleToggle}
      disabled={pending}
      aria-label={accepting ? `${name} is open for applications` : `${name} is closed for applications`}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
