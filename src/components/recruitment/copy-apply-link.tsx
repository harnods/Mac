"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ExternalLink } from "lucide-react";

export function CopyApplyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const shown = url.replace(/^https?:\/\//, "");
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="tabular-nums">{shown}</span>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); toast.success("Link disalin"); setTimeout(() => setCopied(false), 1500); })}
        className="rounded p-1 hover:bg-muted"
        title="Salin link"
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </button>
      <a href={url} target="_blank" rel="noopener" className="rounded p-1 hover:bg-muted" title="Buka halaman apply">
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}
