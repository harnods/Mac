import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";
import { InventoryNav } from "@/components/inventory-nav";
import { RecipeNav } from "@/components/recipe-nav";
import { StockNav } from "@/components/stock-nav";
import { PurchasingNav } from "@/components/purchasing-nav";
import { PrepOrdersNav } from "@/components/prep-orders-nav";
import { SalesNav } from "@/components/sales-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/inventory" className="font-semibold tracking-tight">
              Machitori
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <InventoryNav />
              <RecipeNav />
              <PrepOrdersNav />
              <SalesNav />
              <StockNav />
              <PurchasingNav />
            </nav>
          </div>
          <UserMenu profile={profile} />
        </div>
      </header>
      <main className="flex-1 w-full px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
