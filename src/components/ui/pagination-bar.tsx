import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;        // current page, 1-based
  totalPages: number;
  buildHref: (page: number) => string;
};

export function PaginationBar({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page - 1)}>
              <ChevronLeft className="size-4 mr-1" /> Prev
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="size-4 mr-1" /> Prev
          </Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page + 1)}>
              Next <ChevronRight className="size-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
