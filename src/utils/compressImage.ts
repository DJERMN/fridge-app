/**
 * Compresses an image file using Canvas.
 * Resizes to max 1024px on the longest side, JPEG quality 0.75.
 * Returns { base64, mimeType, originalKB, compressedKB }
 */
export async function compressImage(file: File): Promise<{
  base64: string;
  mimeType: string;
  originalKB: number;
  compressedKB: number;
}> {
  const MAX_SIZE = 1024;
  const QUALITY = 0.75;
  const originalKB = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      const base64 = dataUrl.split(',')[1];
      const compressedKB = Math.round((base64.length * 3) / 4 / 1024);

      resolve({ base64, mimeType: 'image/jpeg', originalKB, compressedKB });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}