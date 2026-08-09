"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Check, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runPayroll, confirmPayrollRun, sendPayslips } from "@/app/actions/payroll-run";

export function PayrollRunBar({
  ym,
  monthOptions,
  anchorYear,
  anchorMonth,
  runId,
  status,
  sentAt,
  isAdmin,
}: {
  ym: string;
  monthOptions: { key: string; label: string }[];
  anchorYear: number;
  anchorMonth: number;
  runId: string | null;
  status: "draft" | "finalized" | null;
  sentAt: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function onMonthChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("ym", next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Something went wrong"); return; }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={ym} onValueChange={onMonthChange}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => (
            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isAdmin && status !== "finalized" && (
        <Button variant={status === "draft" ? "outline" : "default"} onClick={() => run(() => runPayroll(anchorYear, anchorMonth), "Preview generated")} disabled={pending}>
          {status === "draft" ? <RefreshCw className="size-4" /> : <Play className="size-4" />}
          {pending ? "Running..." : status === "draft" ? "Re-run preview" : "Run payroll"}
        </Button>
      )}

      {isAdmin && status === "draft" && runId && (
        <Button onClick={() => run(() => confirmPayrollRun(runId), "Payroll confirmed")} disabled={pending}>
          <Check className="size-4" /> Confirm payroll
        </Button>
      )}

      {isAdmin && status === "finalized" && runId && (
        sentAt ? (
          <Button variant="secondary" disabled><Check className="size-4" /> Payslips sent</Button>
        ) : (
          <Button onClick={() => run(() => sendPayslips(runId), "Payslips sent to crew")} disabled={pending}>
            <Send className="size-4" /> Send payslips
          </Button>
        )
      )}
    </div>
  );
}
