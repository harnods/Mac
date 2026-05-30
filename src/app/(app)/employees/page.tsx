import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";

  let query = supabase
    .from("employees")
    .select(
      "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name), updater:profiles!updated_by(full_name,email)"
    )
    .is("deleted_at", null)
    .order("name");

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data } = await query;
  const list = (data ?? []) as EmployeeWithRelations[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/employees/new">
              <Plus className="size-4" /> Add employee
            </Link>
          </Button>
        )}
      </div>

      <form method="get" className="flex gap-2 max-w-xs">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="h-9"
        />
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Search
        </Button>
      </form>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q.trim() ? "No employees match your search." : "No employees yet."}
          {!q.trim() && isAdmin && (
            <>
              {" "}
              <Link href="/employees/new" className="underline">
                Add the first employee
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="border table-outer rounded-lg overflow-x-auto hidden md:block">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Name</TableHead>
                  <TableHead className="w-40">Department</TableHead>
                  <TableHead className="w-40">Job position</TableHead>
                  <TableHead className="w-32">Job level</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={undefined}
                  >
                    <TableCell className="font-medium truncate">
                      <Link
                        href={`/employees/${emp.id}`}
                        className="block w-full hover:underline"
                      >
                        {emp.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">
                      {emp.departments?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">
                      {emp.job_positions?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">
                      {emp.job_levels?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">
                      {emp.employment_statuses?.name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {list.map((emp) => (
              <Link
                key={emp.id}
                href={`/employees/${emp.id}`}
                className="border rounded-lg p-4 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{emp.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {[emp.departments?.name, emp.employment_statuses?.name]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
