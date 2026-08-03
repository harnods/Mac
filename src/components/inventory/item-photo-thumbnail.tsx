"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ItemPhotoThumbnail({
  imageUrl,
  name,
  className,
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!imageUrl) {
    return (
      <div className={cn("rounded-md border bg-muted overflow-hidden shrink-0", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/no-photo.svg" alt={name} className="size-full object-cover" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(true); }}
        className={cn("rounded-md border bg-muted overflow-hidden shrink-0 cursor-zoom-in", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} className="size-full object-cover" />
      </button>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="p-0 gap-0 bg-transparent ring-0 sm:max-w-2xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={name} className="w-full h-auto object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
