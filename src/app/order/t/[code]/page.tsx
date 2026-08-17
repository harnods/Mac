import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { MenuClient } from "@/app/order/menu/menu-client";
import { loadMenu } from "@/lib/order-menu";

export const dynamic = "force-dynamic";

export default async function TableOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceClient();

  const { data: tableData } = await supabase
    .from("tables")
    .select("id, name, code")
    .eq("code", code)
    .maybeSingle();

  if (!tableData) notFound();

  const { categories, addons } = await loadMenu();

  return (
    <MenuClient
      categories={categories}
      addons={addons}
      table={{ id: tableData.id as string, name: tableData.name as string, code: tableData.code as string }}
    />
  );
}
