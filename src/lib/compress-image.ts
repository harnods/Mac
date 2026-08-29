// Client-side image compression. Resizes to a max dimension and re-encodes as
// JPEG so profile photos stay small and don't burden storage/bandwidth.
export async function compressImage(
  file: File,
  maxDim = 512,
  quality = 0.82,
): Promise<Blob> {
  // Read the intrinsic size first, then decode straight to the target size:
  // passing resizeWidth/resizeHeight lets the decoder downscale instead of
  // materialising a full-resolution bitmap. A 12MP phone photo is ~48MB of RGBA
  // that way, which is enough to get the tab killed on a mid-range Android
  // ("This page couldn't load") before the form is ever submitted.
  const { width: srcWidth, height: srcHeight } = await readImageSize(file);
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const bitmap = await createImageBitmap(file, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "high",
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("Canvas is not supported");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  // Free the backing store right away instead of waiting for GC.
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("Could not compress the image");
  return blob;
}

/** Intrinsic dimensions, without keeping a decoded copy of the image around. */
function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error("Could not read the image"));
      else resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image"));
    };
    img.src = url;
  });
}
