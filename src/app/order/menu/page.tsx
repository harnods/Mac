import { loadMenu } from "@/lib/order-menu";
import { MenuClient } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { categories, addons } = await loadMenu();
  return <MenuClient categories={categories} addons={addons} />;
}
