import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly on navigation to any (app) route while the server renders.
// Turns a frozen "click and wait" into an immediate skeleton response.
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="ml-auto h-9 w-9" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="rounded-lg border divide-y">
        <div className="h-9 bg-muted/40" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3.5">
            <Skeleton className="h-4 w-[220px]" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
