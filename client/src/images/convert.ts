// Re-encodes an arbitrary image (PNG/JPEG/GIF/etc.) to WebP so every
// stored image ends up the same format — see server/src/features/images
// (IMAGE_CONTENT_TYPE is hardcoded to "image/webp" there). Note: the
// Canvas API's toBlob only exposes WebP's *lossy* quality knob (1 = best
// lossy quality) — there is no browser API for libwebp's true lossless
// mode, so this is "highest-quality lossy", not bit-for-bit lossless.
export async function convertToWebp(source: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("WebP encoding failed"))),
        "image/webp",
        1,
      );
    });
  } finally {
    bitmap.close();
  }
}
