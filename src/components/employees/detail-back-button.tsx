import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Back button that always returns to the parent page (not browser history). */
export function DetailBackButton({ href }: { href: string }) {
  return (
    <Button variant="ghost" size="icon" asChild className="-ml-2" aria-label="Back">
      <Link href={href}>
        <ArrowLeft className="size-4" />
      </Link>
    </Button>
  );
}
