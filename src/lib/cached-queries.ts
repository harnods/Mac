import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Department, JobPosition, JobLevel, EmploymentStatus } from "@/lib/supabase/types";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const getDepartments = unstable_cache(
  async (): Promise<Department[]> => {
    const { data } = await getServiceClient()
      .from("departments")
      .select("id,name,updated_at")
      .order("name");
    return (data ?? []) as Department[];
  },
  ["departments-list"],
  { tags: ["departments"] }
);

export const getJobPositions = unstable_cache(
  async (): Promise<JobPosition[]> => {
    const { data } = await getServiceClient()
      .from("job_positions")
      .select("id,name,updated_at")
      .order("name");
    return (data ?? []) as JobPosition[];
  },
  ["job-positions-list"],
  { tags: ["job_positions"] }
);

export const getEmploymentStatuses = unstable_cache(
  async (): Promise<EmploymentStatus[]> => {
    const { data } = await getServiceClient()
      .from("employment_statuses")
      .select("id,name,updated_at")
      .order("name");
    return (data ?? []) as EmploymentStatus[];
  },
  ["employment-statuses-list"],
  { tags: ["employment_statuses"] }
);

export const getJobLevels = unstable_cache(
  async (): Promise<JobLevel[]> => {
    const { data } = await getServiceClient()
      .from("job_levels")
      .select("id,name,updated_at")
      .order("name");
    return (data ?? []) as JobLevel[];
  },
  ["job-levels-list"],
  { tags: ["job_levels"] }
);
