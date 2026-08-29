"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

export function CopyApplyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const shown = url.replace(/^https?:\/\//, "");
  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={url} target="_blank" rel="noopener" className="tabular-nums text-primary hover:underline">{shown}</a>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); })}
        className="rounded p-0.5 hover:bg-muted"
        title="Copy link"
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </button>
    </span>
  );
}
