/**
 * Prépare un logo importé : lit l'image (PNG, JPG, WebP ou SVG), la redimensionne
 * (600 px max) et la convertit en PNG — format accepté par les PDF — sous forme de
 * data URL stockée dans les paramètres du centre.
 */
const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export const LOGO_ACCEPT = ACCEPTED.join(',');

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible.'));
    };
    image.src = url;
  });
}

function render(image: HTMLImageElement, maxSide: number): string {
  const naturalW = image.naturalWidth || image.width || maxSide;
  const naturalH = image.naturalHeight || image.height || maxSide;
  const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
  // Un SVG sans dimensions fixes est agrandi pour rester net.
  const factor = naturalW < 200 && naturalH < 200 ? maxSide / Math.max(naturalW, naturalH) : scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalW * factor));
  canvas.height = Math.max(1, Math.round(naturalH * factor));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Conversion impossible.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Format non pris en charge. Utilisez PNG, JPG, WebP ou SVG.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image trop lourde (4 Mo maximum).');
  }
  const image = await load(file);
  let output = render(image, 600);
  // Garde la base légère : on réduit si le PNG dépasse ~500 Ko.
  if (output.length > 700_000) output = render(image, 360);
  return output;
}
