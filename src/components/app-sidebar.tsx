"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import {
  OrdersIcon,
  OfficeIcon,
  InventoryIcon,
  ProductsIcon,
  RecipesIcon,
  PrepOrdersIcon,
  PurchasingIcon,
  SettingsIcon,
} from "@/components/icons/nav-icons";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type Leaf = { label: string; href: string };
type MenuNode =
  | { label: string; icon: NavIcon; href: string; children?: undefined }
  | { label: string; icon: NavIcon; href?: undefined; children: (Leaf | "divider")[] };

const MENU: MenuNode[] = [
  { label: "Products", icon: ProductsIcon, href: "/inventory/products" },
  {
    label: "Inventory",
    icon: InventoryIcon,
    children: [
      { label: "Ingredients", href: "/inventory/ingredients" },
      { label: "Supplies", href: "/inventory/supplies" },
      { label: "Prep items", href: "/inventory/prep-items" },
      "divider",
      { label: "Stock adjustments", href: "/stock/adjustments" },
      { label: "Stock count", href: "/stock/counts" },
      "divider",
      { label: "Ingredients categories", href: "/inventory/categories/ingredients" },
      { label: "Supplies categories", href: "/inventory/categories/supplies" },
      { label: "Product categories", href: "/inventory/categories/products" },
      { label: "Units", href: "/inventory/units" },
    ],
  },
  { label: "Recipes", icon: RecipesIcon, href: "/recipes" },
  { label: "Prep orders", icon: PrepOrdersIcon, href: "/prep-orders" },
  {
    label: "Purchasing",
    icon: PurchasingIcon,
    children: [
      { label: "Purchase requests", href: "/purchasing/requests" },
      { label: "Purchases", href: "/purchasing/purchases" },
    ],
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    children: [
      { label: "Roles & permissions", href: "/settings/roles" },
      { label: "Tables & QR", href: "/settings/tables" },
      { label: "Loyalty points", href: "/settings/loyalty" },
      "divider",
      { label: "Employees", href: "/employees" },
      { label: "Departments", href: "/employees/departments" },
      { label: "Job positions", href: "/employees/job-positions" },
      { label: "Job levels", href: "/employees/job-levels" },
      { label: "Employment status", href: "/employees/employment-statuses" },
    ],
  },
];

const RAIL = [
  { label: "Orders", icon: OrdersIcon, href: "/orders", match: (p: string) => p.startsWith("/orders") },
  { label: "Office", icon: OfficeIcon, href: "/inventory/ingredients", match: (p: string) => !p.startsWith("/orders") },
];

function isLeafActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isNodeActive(pathname: string, node: MenuNode) {
  if (node.children) return node.children.some((c) => c !== "divider" && isLeafActive(pathname, c.href));
  return isLeafActive(pathname, node.href);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex shrink-0">
      {/* App rail */}
      <nav className="w-[68px] bg-[#e9eef6] flex flex-col items-center pt-[72px] gap-2">
        {RAIL.map((app) => {
          const active = app.match(pathname);
          const Icon = app.icon;
          return (
            <Link
              key={app.label}
              href={app.href}
              className={cn(
                "w-[60px] h-[48px] flex flex-col items-center justify-center gap-1 rounded-[8px] text-[#0a0a0a] transition-colors",
                active ? "bg-[#d3e4fe]" : "hover:bg-[#d3e4fe]",
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              <span className="text-[11px] leading-none">{app.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar menu */}
      <aside className="w-64 bg-[#f8fafe] flex flex-col">
        <Link
          href="/inventory/ingredients"
          className="h-[72px] shrink-0 flex items-center px-4 text-2xl font-bold tracking-tight text-[#0a0a0a]"
        >
          Mac
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {MENU.map((node) => (
            <MenuItem key={node.label} node={node} pathname={pathname} />
          ))}
        </nav>
      </aside>
    </div>
  );
}

function MenuItem({ node, pathname }: { node: MenuNode; pathname: string }) {
  const active = isNodeActive(pathname, node);
  const Icon = node.icon;
  const [open, setOpen] = useState(active);

  const rowClass = (isActive: boolean) =>
    cn(
      "w-full h-10 flex items-center gap-3 pl-2 pr-2 rounded-[6px] text-sm text-[#0a0a0a] transition-colors",
      isActive ? "bg-[#d3e4fe] font-medium" : "hover:bg-[#d3e4fe]",
    );

  if (!node.children) {
    return (
      <Link href={node.href} className={rowClass(active)}>
        <Icon className="size-5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{node.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className={rowClass(active)}>
        <Icon className="size-5 shrink-0" strokeWidth={1.75} />
        <span className="truncate flex-1 text-left">{node.label}</span>
        <ChevronRight className={cn("size-4 opacity-60 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-0.5">
          {node.children.map((child, i) =>
            child === "divider" ? (
              <div key={`d${i}`} className="my-1 border-b border-[#e8ecf5]" />
            ) : (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex h-10 items-center pl-9 pr-2 rounded-[6px] text-sm text-[#0a0a0a] transition-colors",
                  isLeafActive(pathname, child.href)
                    ? "bg-[#eef5ff] font-medium"
                    : "hover:bg-[#eef5ff]",
                )}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
