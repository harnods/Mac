"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { roleLabel } from "@/lib/permissions";
import { setViewAsRole } from "@/app/actions/view-as";

export function ViewAsBanner({ role }: { role: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function exit() {
    startTransition(async () => {
      await setViewAsRole(null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-1.5 text-sm text-amber-900">
      <Eye className="size-4 shrink-0" />
      <span>
        Previewing as <strong>{roleLabel(role)}</strong> — this shows what that role can access.
      </span>
      <button onClick={exit} disabled={pending} className="font-medium underline underline-offset-2 hover:opacity-80">
        {pending ? "Exiting…" : "Exit preview"}
      </button>
    </div>
  );
}
