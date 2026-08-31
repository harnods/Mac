import type { Metadata } from "next";
import { getMenu } from "@/app/actions/online-order";
import { MenuBoard } from "@/components/menu/menu-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Machimoto Cafe - Ruko Delrey Biztown C2 No. 8",
  description: "The Machimoto menu — Japanese comfort food, coffee, matcha & more. Order ahead with Grab & Go.",
};

export default async function LandingPage() {
  const menu = await getMenu();
  const categories = menu.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((it) => ({ id: it.id, name: it.name, description: it.description, imageUrl: it.imageUrl })),
  }));
  return <MenuBoard categories={categories} />;
}
