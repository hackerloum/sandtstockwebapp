import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const iconSvg = await readFile(path.join(publicDir, 'icon.svg'));

const sizes = [
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
];

await mkdir(publicDir, { recursive: true });

for (const { name, size, maskable } of sizes) {
  const padding = maskable ? Math.round(size * 0.1) : 0;
  const innerSize = size - padding * 2;

  let image = sharp(iconSvg).resize(innerSize, innerSize, {
    fit: 'contain',
    background: { r: 37, g: 99, b: 235, alpha: 1 },
  });

  if (padding > 0) {
    image = sharp(await image.toBuffer()).extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 37, g: 99, b: 235, alpha: 1 },
    });
  }

  await image.png().toFile(path.join(publicDir, name));
  console.log(`Generated ${name}`);
}
