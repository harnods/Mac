export function AccessDenied({ label }: { label?: string }) {
  return (
    <div className="space-y-4">
      {label && <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>}
      <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
        Access denied. You don&apos;t have permission to view this page.
      </div>
    </div>
  );
}
