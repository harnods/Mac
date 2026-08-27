"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU, HR_MENU, ORDERS_MENU, filterMenu, type MenuNode } from "@/components/app-sidebar";

// The mobile menu shows every section at once (Orders + Store + HR), driven by
// the SAME nav arrays as the desktop sidebar so the two never drift apart.
function Section({ menu, pendingOvertime }: { menu: MenuNode[]; pendingOvertime: number }) {
  return (
    <>
      {menu.map((node) =>
        !node.children ? (
          <DropdownMenuItem key={node.href} asChild>
            <Link prefetch={false} href={node.href} className="cursor-pointer">
              {node.label}
              {node.href === "/hr/overtime" && pendingOvertime > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
                  {pendingOvertime}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
        ) : (
          <Fragment key={node.label}>
            <DropdownMenuLabel>{node.label}</DropdownMenuLabel>
            {node.children.map((child, i) =>
              child === "divider" || "heading" in child ? null : (
                <DropdownMenuItem key={child.href} asChild>
                  <Link prefetch={false} href={child.href} className="cursor-pointer">
                    {child.label}
                  </Link>
                </DropdownMenuItem>
              ),
            )}
          </Fragment>
        ),
      )}
    </>
  );
}

export function MainNavMobile({ canHr = true, permissions = [], pendingOvertime = 0 }: { canHr?: boolean; permissions?: string[]; pendingOvertime?: number }) {
  const orders = filterMenu(ORDERS_MENU, permissions);
  const store = filterMenu(MENU, permissions);
  const hr = filterMenu(HR_MENU, permissions);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open navigation menu"
        className="p-2 rounded-md hover:bg-accent flex items-center outline-none data-[state=open]:bg-accent"
      >
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[80vh] w-56 overflow-y-auto">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Orders</DropdownMenuLabel>
        <Section menu={orders} pendingOvertime={pendingOvertime} />

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Store</DropdownMenuLabel>
        <Section menu={store} pendingOvertime={pendingOvertime} />

        {canHr && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">HR</DropdownMenuLabel>
            <Section menu={hr} pendingOvertime={pendingOvertime} />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
