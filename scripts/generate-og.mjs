import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="12" fill="#1e40af"/>
  <g transform="translate(80, 90)">
    <rect width="64" height="64" rx="14" fill="#1e40af"/>
    <text x="32" y="44" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle">T</text>
    <text x="84" y="42" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#1e40af">TPV Restaurante</text>
  </g>
  <text x="80" y="280" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#0f172a">Todo tu restaurante</text>
  <text x="80" y="360" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#0f172a">en un solo TPV</text>
  <text x="80" y="450" font-family="Arial, sans-serif" font-size="34" fill="#64748b">Carta QR · Reservas · KDS · Verifactu incluidos</text>
  <g transform="translate(80, 500)">
    <rect width="320" height="64" rx="12" fill="#1e40af"/>
    <text x="160" y="42" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">Desde 35 €/mes</text>
  </g>
  <text x="80" y="600" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8">Sin permanencia · Soporte directo</text>
</svg>`;

mkdirSync('public', { recursive: true });
await sharp(Buffer.from(svg)).png().toFile('public/og-default.png');
console.log('OG image generated: public/og-default.png');
