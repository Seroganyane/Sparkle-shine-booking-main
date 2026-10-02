export type PlateCrop = {
  blob: Blob;
  previewUrl: string;
  label: string;
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare plate image.")), "image/jpeg", 0.92));

const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not open the vehicle photo.")); };
  image.src = url;
});

/**
 * Produces OCR-friendly candidate regions from a vehicle photo.
 * Staff are asked to frame the plate in the centre guide, so the primary crop
 * is a wide central band. A second, wider crop makes the scan resilient when
 * the plate is slightly off-centre. Contrast + grayscale reduces reflections,
 * paint colour and background detail before Tesseract sees the image.
 */
export async function preparePlateCrops(file: File): Promise<PlateCrop[]> {
  const image = await loadImage(file);
  const candidates = [
    { label: "plate region", x: 0.12, y: 0.30, w: 0.76, h: 0.40 },
    { label: "wide plate region", x: 0.03, y: 0.20, w: 0.94, h: 0.60 },
  ];

  return Promise.all(candidates.map(async (candidate) => {
    const sx = Math.round(image.naturalWidth * candidate.x);
    const sy = Math.round(image.naturalHeight * candidate.y);
    const sw = Math.round(image.naturalWidth * candidate.w);
    const sh = Math.round(image.naturalHeight * candidate.h);
    const scale = Math.min(2.5, Math.max(1, 1600 / sw));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Image processing is not available in this browser.");
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));
      d[i] = d[i + 1] = d[i + 2] = contrasted;
    }
    ctx.putImageData(pixels, 0, 0);
    const blob = await canvasToBlob(canvas);
    return { blob, previewUrl: URL.createObjectURL(blob), label: candidate.label };
  }));
}
