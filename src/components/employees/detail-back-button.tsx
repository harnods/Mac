"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Back button that returns to the previous page via history when possible, so
 * list filters/search/pagination are preserved. Falls back to `href` (the parent
 * index) when there's no in-app history — e.g. the detail page was opened
 * directly via a deep link.
 */
export function DetailBackButton({ href }: { href: string }) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleBack} className="-ml-2" aria-label="Back">
      <ArrowLeft className="size-4" />
    </Button>
  );
}
