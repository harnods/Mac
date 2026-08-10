import type { ReactNode } from "react";

/**
 * Shared detail-page building blocks, matching the HR crew detail layout
 * (src/app/(app)/hr/crew/[id]/page.tsx). Use these on every module detail
 * page so section headings and label/value rows stay consistent.
 */

/** A titled section: `text-base font-semibold` heading + a `<dl>` of DetailRows. */
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <dl>{children}</dl>
    </section>
  );
}

/** One label/value row: stacked on mobile, label(1)/value(2) grid on `sm`. */
export function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}
