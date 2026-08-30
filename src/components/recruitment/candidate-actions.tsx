"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { deleteCandidate, moveCandidatePosition } from "@/app/actions/recruitment";

export function CandidateActions({
  candidateId,
  openingId,
  name,
  currentPositionId,
  positions,
}: {
  candidateId: string;
  openingId: string;
  name: string;
  currentPositionId: string;
  positions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleDelete() {
    start(async () => {
      const res = await deleteCandidate(candidateId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Candidate deleted");
      router.push(`/hr/recruitment/${openingId}`);
    });
  }

  function moveTo(positionId: string, positionName: string) {
    start(async () => {
      const res = await moveCandidatePosition(candidateId, positionId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Moved to ${positionName} (Applied)`);
      router.push(`/hr/recruitment/${positionId}/c/${candidateId}`);
    });
  }

  const others = positions.filter((p) => p.id !== currentPositionId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={pending}>Actions <ChevronDown className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-fit">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="whitespace-nowrap">Move to position</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {others.length === 0 ? (
                <DropdownMenuLabel className="font-normal text-muted-foreground">No other positions</DropdownMenuLabel>
              ) : (
                others.map((p) => (
                  <DropdownMenuItem key={p.id} className="whitespace-nowrap" onSelect={() => moveTo(p.id, p.name)}>{p.name}</DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="whitespace-nowrap" onSelect={(e) => { e.preventDefault(); setTimeout(() => setConfirmOpen(true), 0); }}>Delete candidate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>This removes the candidate, their résumé, photo and comments. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={handleDelete}>{pending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
