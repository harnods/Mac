"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { P, type PermissionKey } from "@/lib/permissions";
import { OrderShiftSidebar } from "@/components/orders/order-shift-sidebar";
import {
  ChevronRight,
  Calculator,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarX,
  ChartColumn,
} from "lucide-react";
import {
  OrdersIcon,
  OfficeIcon,
  InventoryIcon,
  ProductsIcon,
  RecipesIcon,
  PrepOrdersIcon,
  PurchasingIcon,
  SettingsIcon,
  HrIcon,
  CrewIcon,
  AttendanceIcon,
  OvertimeIcon,
  PayrollIcon,
} from "@/components/icons/nav-icons";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type Leaf = { label: string; href: string; perm?: PermissionKey };
type Heading = { heading: string };
type Child = Leaf | "divider" | Heading;
type MenuNode =
  | { label: string; icon: NavIcon; href: string; perm?: PermissionKey; children?: undefined }
  | { label: string; icon: NavIcon; href?: undefined; children: Child[] };

const MENU: MenuNode[] = [
  { label: "Products", icon: ProductsIcon, href: "/inventory/products", perm: P.PRODUCTS_READ },
  { label: "Recipes", icon: RecipesIcon, href: "/recipes" },
  {
    label: "Inventory",
    icon: InventoryIcon,
    children: [
      { label: "Ingredients", href: "/inventory/ingredients", perm: P.INGREDIENTS_READ },
      { label: "Assets", href: "/inventory/supplies", perm: P.ASSETS_READ },
      { label: "Prep items", href: "/inventory/prep-items", perm: P.PREP_ITEMS_READ },
      "divider",
      { label: "Stock adjustments", href: "/stock/adjustments", perm: P.STOCK_ADJUSTMENTS_READ },
      { label: "Stock count", href: "/stock/counts", perm: P.STOCK_COUNTS_READ },
      { label: "Daily stock count", href: "/stock/daily-counts", perm: P.DAILY_STOCK_COUNTS_READ },
    ],
  },
  { label: "Prep orders", icon: PrepOrdersIcon, href: "/prep-orders" },
  {
    label: "Purchasing",
    icon: PurchasingIcon,
    children: [
      { label: "Purchase requests", href: "/purchasing/requests" },
      { label: "Purchases", href: "/purchasing/purchases" },
      { label: "Suppliers", href: "/purchasing/suppliers" },
    ],
  },
  { label: "Sales", icon: Calculator, href: "/sales" },
  {
    label: "Reports",
    icon: ChartColumn,
    children: [
      { label: "Sales", href: "/reports/sales", perm: P.SALES_READ },
      { label: "Service charge", href: "/reports/service-charge", perm: P.SALES_READ },
    ],
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    children: [
      { label: "Roles & permissions", href: "/settings/roles" },
      { label: "Payment methods", href: "/settings/payment-methods", perm: P.SALES_READ },
      { label: "Tables & QR", href: "/settings/tables" },
      { label: "Loyalty points", href: "/settings/loyalty" },
      "divider",
      { label: "Ingredients categories", href: "/settings/categories/ingredients", perm: P.CATEGORIES_READ },
      { label: "Asset categories", href: "/settings/categories/supplies", perm: P.CATEGORIES_READ },
      { label: "Product categories", href: "/settings/categories/products", perm: P.CATEGORIES_READ },
      { label: "Units", href: "/settings/units", perm: P.UNITS_READ },
      { label: "Locations", href: "/settings/locations", perm: P.LOCATIONS_READ },
    ],
  },
];

const HR_MENU: MenuNode[] = [
  { label: "Crew", icon: CrewIcon, href: "/hr/crew" },
  { label: "Attendance", icon: AttendanceIcon, href: "/hr/attendance" },
  { label: "Overtime", icon: OvertimeIcon, href: "/hr/overtime" },
  { label: "Time off", icon: CalendarX, href: "/hr/time-off" },
  { label: "Payroll", icon: PayrollIcon, href: "/hr/payroll" },
  {
    label: "Reports",
    icon: ChartColumn,
    children: [
      { label: "Turnover", href: "/hr/reports/turnover" },
      { label: "Attendance", href: "/hr/reports/attendance" },
    ],
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    children: [
      { label: "Job positions", href: "/hr/job-positions" },
      { label: "Job levels", href: "/hr/job-levels" },
      { label: "Employment type", href: "/hr/employment-statuses" },
      { label: "Departments", href: "/hr/departments" },
      "divider",
      { label: "Shifts", href: "/hr/shifts" },
      { label: "Attendance", href: "/hr/attendance-settings" },
      { label: "Overtime", href: "/hr/overtime-settings" },
      "divider",
      { label: "Payroll", href: "/hr/payroll-settings" },
      { label: "Payroll components", href: "/hr/allowances" },
    ],
  },
];

const ORDERS_MENU: MenuNode[] = [
  { label: "POS", icon: OrdersIcon, href: "/orders" },
  {
    label: "Pipeline",
    icon: OrdersIcon,
    children: [
      { label: "Bar", href: "/orders/bar" },
      { label: "Kitchen", href: "/orders/kitchen" },
    ],
  },
  { label: "Settings", icon: SettingsIcon, href: "/orders/settings" },
];

const RAIL = [
  { label: "Orders", icon: OrdersIcon, href: "/orders", match: (p: string) => p.startsWith("/orders") },
  { label: "Office", icon: OfficeIcon, href: "/inventory/ingredients", match: (p: string) => !p.startsWith("/orders") && !p.startsWith("/hr") },
  { label: "HR", icon: HrIcon, href: "/hr/crew", match: (p: string) => p.startsWith("/hr") },
];

function isLeafActive(pathname: string, href: string) {
  if (href === "/orders") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function isNodeActive(pathname: string, node: MenuNode) {
  if (node.children) return node.children.some((c) => c !== "divider" && !("heading" in c) && isLeafActive(pathname, c.href));
  return isLeafActive(pathname, node.href);
}

function allowedLeaf(perm: string | undefined, permissions: string[]) {
  return !perm || permissions.includes(perm);
}

/** Drop leading/trailing dividers and collapse consecutive ones. */
function cleanChildren(children: Child[]): Child[] {
  const out: Child[] = [];
  for (const c of children) {
    if (c === "divider" && (out.length === 0 || out[out.length - 1] === "divider")) continue;
    out.push(c);
  }
  while (out.length && out[out.length - 1] === "divider") out.pop();
  return out;
}

/** Hide leaves the role can't read; drop groups left with no visible leaf. */
export function filterMenu(menu: MenuNode[], permissions: string[]): MenuNode[] {
  const result: MenuNode[] = [];
  for (const node of menu) {
    if (node.children) {
      const kids = node.children.filter((c) =>
        c === "divider" || "heading" in c ? true : allowedLeaf(c.perm, permissions),
      );
      const cleaned = cleanChildren(kids);
      if (cleaned.some((c) => c !== "divider" && !("heading" in c))) {
        result.push({ ...node, children: cleaned });
      }
    } else if (allowedLeaf(node.perm, permissions)) {
      result.push(node);
    }
  }
  return result;
}

export function AppSidebar({ canHr = true, permissions = [] }: { canHr?: boolean; permissions?: string[] }) {
  const pathname = usePathname();
  const rail = RAIL.filter((r) => r.label !== "HR" || canHr);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const isOrders = pathname.startsWith("/orders");
  const isHr = pathname.startsWith("/hr");
  const rawMenu = isOrders ? ORDERS_MENU : isHr ? HR_MENU : MENU;
  const menu = filterMenu(rawMenu, permissions);
  const title = "Mac";
  const homeHref = isOrders ? "/orders" : isHr ? "/hr/crew" : "/inventory/ingredients";

  return (
    <div className="hidden md:flex shrink-0">
      {/* App rail */}
      <nav className="w-[68px] bg-[#E9EEF6] flex flex-col items-center">
        <div className="h-[72px] flex items-center justify-center">
          <button
            type="button"
            aria-label={sidebarVisible ? "Hide sidebar menu" : "Show sidebar menu"}
            title={sidebarVisible ? "Hide sidebar menu" : "Show sidebar menu"}
            onClick={() => setSidebarVisible((visible) => !visible)}
            className="size-10 flex items-center justify-center rounded-[8px] text-[#0a0a0a] transition-colors hover:bg-[#d3e4fe]"
          >
            {sidebarVisible ? (
              <PanelLeftClose className="size-5" strokeWidth={1.75} />
            ) : (
              <PanelLeftOpen className="size-5" strokeWidth={1.75} />
            )}
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
          {rail.map((app) => {
            const active = app.match(pathname);
            const Icon = app.icon;
            return (
              <Link
                key={app.label}
                href={app.href}
                prefetch={false}
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
        </div>
      </nav>

      <aside
        className={cn(
          "bg-[#f8fafe] flex flex-col overflow-hidden transition-[width,opacity,transform] duration-300 ease-out",
          sidebarVisible ? "w-64 translate-x-0 opacity-100" : "w-0 -translate-x-2 opacity-0",
        )}
        aria-hidden={!sidebarVisible}
      >
        <div className="w-64 flex min-h-0 flex-1 flex-col">
          <Link
            href={homeHref}
            prefetch={false}
            className="h-[72px] shrink-0 flex items-center px-4 text-2xl font-bold tracking-tight text-[#0a0a0a]"
          >
            {title}
          </Link>
          <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {menu.map((node) => (
              <MenuItem key={node.label} node={node} pathname={pathname} />
            ))}
          </nav>
          {isOrders && <OrderShiftSidebar />}
        </div>
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
      <Link href={node.href} prefetch={false} className={rowClass(active)}>
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
          {node.children.map((child, i) => {
            if (child === "divider") {
              return <div key={`d${i}`} className="my-1 border-b border-[#e8ecf5]" />;
            }
            if ("heading" in child) {
              return (
                <div key={`h${i}`} className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#0a0a0a]/45">
                  {child.heading}
                </div>
              );
            }
            return (
              <Link
                key={child.href}
                href={child.href}
                prefetch={false}
                className={cn(
                  "flex h-10 items-center pl-9 pr-2 rounded-[6px] text-sm text-[#0a0a0a] transition-colors",
                  isLeafActive(pathname, child.href)
                    ? "bg-[#eef5ff] font-medium"
                    : "hover:bg-[#eef5ff]",
                )}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
