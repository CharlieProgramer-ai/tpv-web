// Captura de pantallas y video del TPV (instancia demo :3001) para la web de marketing.
import { chromium } from 'playwright';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const PUB = join(__dirname, '..', 'public');
const SHOTS = join(PUB, 'screenshots');
const VIDEO = join(PUB, 'video');
const TMP = join(__dirname, '.tmpvideo');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDEO, { recursive: true });
mkdirSync(TMP, { recursive: true });

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function login() {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_usuario: 'admin', 'contraseña': '1234' }),
  });
  const b = await res.json();
  if (!b.token) throw new Error('login fallo: ' + JSON.stringify(b));
  return { token: b.token, rol: b.rol };
}

async function shoot(page, route, file, { waitFor, extra = 1500, before } = {}) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    // fallback: login por UI
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"], button:has-text("Iniciar")');
    await wait(1500);
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  }
  if (waitFor) { try { await page.waitForSelector(waitFor, { timeout: 8000 }); } catch (e) { console.log('  (waitFor no encontrado:', waitFor, ')'); } }
  await wait(extra);
  if (before) { try { await before(page); } catch (e) { console.log('  (before fallo:', e.message, ')'); } }
  const path = join(SHOTS, file);
  await page.screenshot({ path });
  console.log('  capturado:', file, '->', page.url());
}

async function main() {
  const { token, rol } = await login();
  console.log('Login OK rol', rol);

  const browser = await chromium.launch();

  // ---- DESKTOP screenshots (alta resolucion) ----
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([t, r]) => {
    try { localStorage.setItem('token', t); localStorage.setItem('rol', r); } catch (e) {}
  }, [token, rol]);
  const page = await ctx.newPage();

  await shoot(page, '/barra', 'plano-sala.png', { waitFor: '.mesa-card', extra: 2500 });

  // Comanda con notas: click en mesa ocupada (mesa 2 tiene notas)
  await shoot(page, '/barra', 'comanda-notas.png', {
    waitFor: '.mesa-card', extra: 2000,
    before: async (p) => {
      // click en la tarjeta de la mesa numero 2
      const cards = p.locator('.mesa-card');
      const n = await cards.count();
      for (let i = 0; i < n; i++) {
        const numTxt = (await cards.nth(i).locator('.mesa-card__num').textContent().catch(() => '')) || '';
        if (numTxt.trim() === '2') { await cards.nth(i).click(); break; }
      }
      await wait(1800);
    },
  });

  await shoot(page, '/cocina', 'cocina-kds.png', { extra: 2500 });
  await shoot(page, '/caja', 'caja.png', { extra: 2500 });
  await shoot(page, '/admin', 'admin.png', { extra: 2500 });
  await ctx.close();

  // ---- MOBILE screenshot: Carta QR ----
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE + '/carta/?mesa=2', { waitUntil: 'domcontentloaded' });
  await wait(3000);
  await mpage.screenshot({ path: join(SHOTS, 'carta-qr.png') });
  console.log('  capturado: carta-qr.png ->', mpage.url());
  await mctx.close();

  // ---- VIDEO: tour del flujo ----
  const vctx = await browser.newContext({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
  });
  await vctx.addInitScript(([t, r]) => {
    try { localStorage.setItem('token', t); localStorage.setItem('rol', r); } catch (e) {}
  }, [token, rol]);
  const vpage = await vctx.newPage();
  await vpage.goto(BASE + '/barra', { waitUntil: 'domcontentloaded' });
  await vpage.waitForSelector('.mesa-card', { timeout: 8000 }).catch(() => {});
  await wait(3000);
  // abrir detalle de una mesa
  try {
    const cards = vpage.locator('.mesa-card');
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const numTxt = (await cards.nth(i).locator('.mesa-card__num').textContent().catch(() => '')) || '';
      if (numTxt.trim() === '2') { await cards.nth(i).click(); break; }
    }
  } catch (e) {}
  await wait(3000);
  await vpage.goto(BASE + '/cocina', { waitUntil: 'domcontentloaded' });
  await wait(3000);
  await vpage.goto(BASE + '/caja', { waitUntil: 'domcontentloaded' });
  await wait(3000);
  await vctx.close(); // guarda el webm
  await browser.close();

  // localizar el webm
  const webm = readdirSync(TMP).find(f => f.endsWith('.webm'));
  if (webm) {
    const webmPath = join(TMP, webm);
    const mp4Path = join(VIDEO, 'demo-tpv.mp4');
    const r = spawnSync(ffmpeg.path, [
      '-y', '-i', webmPath,
      '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Path,
    ], { encoding: 'utf8' });
    if (r.status === 0) console.log('  video mp4:', mp4Path);
    else console.log('  ffmpeg fallo:', (r.stderr || '').slice(-300));
  } else {
    console.log('  no se encontro webm en', TMP);
  }
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}

  console.log('CAPTURA OK');
}

main().catch(e => { console.error('ERROR', e); process.exit(1); });
