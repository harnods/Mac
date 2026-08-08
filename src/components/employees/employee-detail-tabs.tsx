"use client";

import { useState } from "react";

type Tab = "profile" | "attendance" | "overtime" | "time-off" | "payroll";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Crew profile" },
  { key: "attendance", label: "Attendance" },
  { key: "overtime", label: "Overtime" },
  { key: "time-off", label: "Time off" },
  { key: "payroll", label: "Payroll" },
];

export function EmployeeDetailTabs({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("profile");
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-8">
      <div className="border-b">
        <div className="flex items-center gap-4">
          {TABS.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabButton>
          ))}
        </div>
      </div>

      {tab === "profile" ? (
        children
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No {active.label.toLowerCase()} records yet.
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-0 py-2 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
