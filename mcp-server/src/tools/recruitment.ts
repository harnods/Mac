import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerRecruitmentTools(server: McpServer) {
  server.tool(
    "list_candidates",
    "List recruitment candidates with filters.",
    {
      stage: z.string().optional().describe("Pipeline stage name"),
      job_position_id: z.string().uuid().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ stage, job_position_id, search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("candidates")
        .select("id, name, email, phone, stage, source, applied_at, job_position_id, job_positions(id,name), created_at")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (stage) q = q.eq("stage", stage);
      if (job_position_id) q = q.eq("job_position_id", job_position_id);
      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_candidate",
    "Get full details of a candidate.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data, error } = await getDb()
        .from("candidates")
        .select("*, job_positions(id,name), candidate_comments(id, body, created_by, created_at), candidate_events(id, type, detail, created_at)")
        .eq("id", id)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_candidate_stage",
    "Move a candidate to a new pipeline stage.",
    {
      id: z.string().uuid(),
      stage: z.string().describe("New stage name"),
    },
    async ({ id, stage }) => {
      const { data, error } = await getDb()
        .from("candidates")
        .update({ stage })
        .eq("id", id)
        .select("id, name, stage")
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Moved to "${stage}":\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "add_candidate_comment",
    "Add a comment/note to a candidate.",
    {
      candidate_id: z.string().uuid(),
      body: z.string(),
    },
    async ({ candidate_id, body }) => {
      const { data, error } = await getDb()
        .from("candidate_comments")
        .insert({ candidate_id, body })
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
