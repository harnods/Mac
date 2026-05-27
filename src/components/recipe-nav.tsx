"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RecipeNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/recipes");

  return (
    <Link
      href="/recipes"
      className={cn(
        "px-3 py-1.5 rounded-md hover:bg-accent text-sm",
        active && "bg-accent/60",
      )}
    >
      Recipes
    </Link>
  );
}
