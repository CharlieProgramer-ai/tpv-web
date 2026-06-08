// Optimiza las capturas PNG a WebP ligeras para la web.
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, '..', 'public', 'screenshots');

// Anchos objetivo por tipo
const desktopMax = 1600; // capturas de escritorio
const mobileMax = 480;   // carta movil

const files = readdirSync(SHOTS).filter(f => f.endsWith('.png'));
for (const f of files) {
  const src = join(SHOTS, f);
  const out = join(SHOTS, basename(f, extname(f)) + '.webp');
  const isMobile = f.includes('carta');
  const w = isMobile ? mobileMax : desktopMax;
  const meta = await sharp(src).metadata();
  await sharp(src)
    .resize({ width: Math.min(w, meta.width), withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out);
  const outMeta = await sharp(out).metadata();
  console.log(`${f} (${meta.width}x${meta.height}) -> ${basename(out)} (${outMeta.width}x${outMeta.height})`);
}
console.log('OPTIMIZE OK');
