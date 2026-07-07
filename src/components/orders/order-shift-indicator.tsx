"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { closeOrderShift, openOrderShift } from "@/app/actions/orders";

export type OrderShiftSummary = {
  id: string;
  opened_at: string;
  opened_by: { full_name: string | null; email: string } | null;
  closed_at: string | null;
  closed_by: { full_name: string | null; email: string } | null;
};

function personName(person: { full_name: string | null; email: string } | null) {
  if (!person) return "Unknown";
  return person.full_name || person.email.split("@")[0];
}

export function OrderShiftIndicator({ shift }: { shift: OrderShiftSummary | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isOpen = !!shift && !shift.closed_at;

  function run(action: "open" | "close") {
    startTransition(async () => {
      const res = action === "open" ? await openOrderShift() : await closeOrderShift();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(action === "open" ? "Shift opened" : "Shift closed");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={isOpen ? "success" : "secondary"}>
        {isOpen ? "Open" : "Closed"}
      </Badge>
      <div className="text-xs text-muted-foreground">
        {isOpen && shift ? (
          <>Opened by {personName(shift.opened_by)} · {formatDateTime(shift.opened_at)}</>
        ) : shift?.closed_at ? (
          <>
            Closed by {personName(shift.closed_by)} · {formatDateTime(shift.closed_at)}
            <span className="mx-1">·</span>
            Last opened by {personName(shift.opened_by)}
          </>
        ) : (
          <>No shift has been opened yet</>
        )}
      </div>
      {isOpen ? (
        <Button size="sm" variant="outline" onClick={() => run("close")} disabled={pending}>
          {pending ? "Closing..." : "Close shift"}
        </Button>
      ) : (
        <Button size="sm" onClick={() => run("open")} disabled={pending}>
          {pending ? "Opening..." : "Open shift"}
        </Button>
      )}
    </div>
  );
}
