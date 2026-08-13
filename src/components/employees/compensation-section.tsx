"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-list";

const DOTS = <span className="tracking-widest text-muted-foreground">••••••</span>;

/**
 * Compensation block for the crew detail page. Only rendered for viewers who
 * are allowed to see salary — but values are still masked by default and
 * revealed with the eye toggle, so pay isn't shown over-the-shoulder.
 */
export function CompensationSection({
  basicSalary,
  dailyAllowance,
  allowances,
}: {
  basicSalary: string | null;
  dailyAllowance: string | null;
  allowances: { name: string; amount: string }[];
}) {
  const [shown, setShown] = useState(false);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Compensation</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide compensation" : "Show compensation"}
          title={shown ? "Hide compensation" : "Show compensation"}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      <dl>
        <DetailRow label="Basic salary" value={shown ? basicSalary : DOTS} />
        <DetailRow label="Daily allowance" value={shown ? dailyAllowance : DOTS} />
        <DetailRow
          label="Allowances"
          value={
            shown ? (
              allowances.length > 0 ? (
                <div className="space-y-1">
                  {allowances.map((a, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <span>{a.name}</span>
                      <span className="tabular-nums">{a.amount}</span>
                    </div>
                  ))}
                </div>
              ) : null
            ) : (
              DOTS
            )
          }
        />
      </dl>
    </section>
  );
}
