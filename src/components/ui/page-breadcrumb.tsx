import Link from "next/link";

export type Crumb = { label: string; href: string };

/** Ancestor breadcrumb shown above a detail-page title (e.g. Inventory / Products). */
export function PageBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          <Link href={c.href} className="hover:text-foreground transition-colors">
            {c.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
