"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { addCandidateComment, type CandidateComment } from "@/app/actions/recruitment";

export function CandidateComments({ candidateId, comments }: { candidateId: string; comments: CandidateComment[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!body.trim()) return;
    start(async () => {
      const res = await addCandidateComment(candidateId, body);
      if (!res.ok) { toast.error(res.error); return; }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Comments</h2>
      <div className="space-y-2">
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note about this candidate…" />
        <div className="flex justify-end">
          <Button onClick={add} disabled={pending || !body.trim()}>{pending ? "Adding..." : "Add comment"}</Button>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border p-3">
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.author ?? "—"}</span>
                <span>{formatDateTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
