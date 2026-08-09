import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** Parse a raw `size` query param into an allowed page size. */
export function parsePageSize(raw?: string): number {
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

type Props = {
  page: number; // current page, 1-based
  totalPages: number;
  pageSize: number;
  buildHref: (page: number) => string;
  /** Build a URL that switches to `size` rows per page (resets to page 1). */
  buildSizeHref: (size: number) => string;
};

export function PaginationBar({ page, totalPages, pageSize, buildHref, buildSizeHref }: Props) {
  const shownTotal = Math.max(totalPages, 1);

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline">Rows per page</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="tabular-nums">
              {pageSize} <ChevronsUpDown className="size-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[4rem]">
            {PAGE_SIZE_OPTIONS.map((s) => (
              <DropdownMenuItem key={s} asChild>
                <Link href={buildSizeHref(s)} className="tabular-nums cursor-pointer">
                  {s}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {page} of {shownTotal}
        </span>
        {totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
}
