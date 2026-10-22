import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';

/** Small seeded PRNG so every visit renders the same stone. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Multi-octave value noise painted onto a canvas (greyscale). */
export function noiseCanvas(size: number, seed: number, octaves = 5, contrast = 1, base = 0.5): HTMLCanvasElement {
  const out = document.createElement('canvas'); out.width = out.height = size;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = `rgb(${base * 255},${base * 255},${base * 255})`; ctx.fillRect(0, 0, size, size);
  const rand = rng(seed);
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o; const layer = document.createElement('canvas'); layer.width = layer.height = cells;
    const lc = layer.getContext('2d')!; const img = lc.createImageData(cells, cells);
    for (let i = 0; i < cells * cells; i++) { const v = rand() * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    lc.putImageData(img, 0, 0);
    ctx.globalAlpha = (0.55 / (1 + o * 0.35)) * contrast; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(layer, 0, 0, size, size);
  }
  ctx.globalAlpha = 1;
  return out;
}

function toTexture(canvas: HTMLCanvasElement, repeat: number, srgb: boolean) {
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat, repeat);
  t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.anisotropy = 8;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Greyscale noise map usable as bump / roughness. */
export function noiseTexture(size: number, seed: number, repeat = 1, octaves = 5, contrast = 1) {
  return toTexture(noiseCanvas(size, seed, octaves, contrast), repeat, false);
}

/** Warm travertine: cream base, pores and faint strata. */
export function travertineTextures(seed = 11, repeat = 1) {
  const size = 1024; const c = noiseCanvas(size, seed, 6, 1.1, 0.5);
  const ctx = c.getContext('2d')!; const rand = rng(seed + 7);
  // strata
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 38; i++) { ctx.fillStyle = rand() > 0.5 ? '#8a6c4b' : '#ffffff'; ctx.fillRect(0, rand() * size, size, 1 + rand() * 5); }
  // pores
  for (let i = 0; i < 1400; i++) { ctx.globalAlpha = 0.18 + rand() * 0.25; ctx.fillStyle = '#4b3a2b'; const r = 0.6 + rand() * 2.2; ctx.beginPath(); ctx.ellipse(rand() * size, rand() * size, r * 1.8, r, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const bump = toTexture(c, repeat, false);
  const colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = size;
  const cc = colorCanvas.getContext('2d')!; cc.fillStyle = '#f2e6d8'; cc.fillRect(0, 0, size, size);
  cc.globalCompositeOperation = 'multiply'; cc.globalAlpha = 0.3; cc.drawImage(c, 0, 0);
  cc.globalCompositeOperation = 'source-over'; cc.globalAlpha = 1;
  return { map: toTexture(colorCanvas, repeat, true), bump };
}

/**
 * Cream marble / travertine with fine crackle veins, like the stone of the courtyard in the reference:
 * warm base, soft pink-beige clouds, a network of branching hairline cracks and tiny pits. Returns colour and bump.
 */
const marbleCache = new Map<string, { map: CanvasTexture; bump: CanvasTexture; rough: CanvasTexture }>();
export function marbleTextures(seed = 5, repeat = 1, strength = 1) {
  const key = `${seed}/${repeat}/${strength}`; const hit = marbleCache.get(key); if (hit) return hit;
  const size = 1024; const rand = rng(seed);
  const cloud = noiseCanvas(size, seed, 6, 0.9, 0.5);
  const col = document.createElement('canvas'); col.width = col.height = size; const c = col.getContext('2d')!;
  c.fillStyle = '#f1e6d6'; c.fillRect(0, 0, size, size);
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.26; c.drawImage(cloud, 0, 0);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  // faint pink / ochre clouds
  for (let i = 0; i < 26; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 60 + rand() * 140); const warm = rand() > 0.5; g.addColorStop(0, warm ? 'rgba(214,150,112,0.16)' : 'rgba(255,248,236,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.save(); c.translate(rand() * size, rand() * size); c.fillStyle = g; c.fillRect(-220, -220, 440, 440); c.restore(); }
  // branching hairline cracks
  const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    if (depth > 4 || len < 8) return;
    c.beginPath(); c.moveTo(x, y); let px = x, py = y;
    for (let s = 0; s < len; s += 6) { a += (rand() - 0.5) * 0.7; px += Math.cos(a) * 6; py += Math.sin(a) * 6; c.lineTo(px, py); if (rand() < 0.04) crack(px, py, a + (rand() > 0.5 ? 1 : -1) * (0.5 + rand() * 0.7), len * (0.35 + rand() * 0.3) - s * 0.4, w * 0.7, depth + 1); }
    c.strokeStyle = `rgba(150,96,68,${Math.min(0.9, (0.08 + rand() * 0.1) * strength)})`; c.lineWidth = w; c.stroke();
  };
  for (let i = 0; i < 34; i++) crack(rand() * size, rand() * size, rand() * Math.PI * 2, 120 + rand() * 260, 1 + rand() * 0.8, 0);
  // long flowing veins: a wide soft halo, a mid tone and a thin dark core, drawn wrapped so the tile repeats without a seam
  const veins: { pts: [number, number][]; w: number }[] = [];
  for (let v = 0; v < 11; v++) {
    let x = rand() * size, y = rand() * size, a = rand() * Math.PI * 2; const pts: [number, number][] = [[x, y]]; const len = 420 + rand() * 700;
    for (let s = 0; s < len; s += 8) { a += (rand() - 0.5) * 0.34 + Math.sin(s / 90 + v) * 0.05; x += Math.cos(a) * 8; y += Math.sin(a) * 8; pts.push([x, y]); }
    veins.push({ pts, w: 0.7 + rand() * 1.5 });
  }
  const strokeVeins = (ctx: CanvasRenderingContext2D, style: (w: number) => [string, number]) => {
    for (const { pts, w } of veins) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + ox * size, py + oy * size) : ctx.moveTo(px + ox * size, py + oy * size)));
      const [col, lw] = style(w); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
    }
  };
  strokeVeins(c, w => [`rgba(190,140,110,${Math.min(0.5, 0.08 * strength)})`, 18 * w]);
  strokeVeins(c, w => [`rgba(160,110,86,${Math.min(0.7, 0.14 * strength)})`, 6 * w]);
  strokeVeins(c, w => [`rgba(130,84,62,${Math.min(0.95, 0.36 * strength)})`, 1.6 * w]);
  // pits: travertine is pocked rather than veined, the pocks are the main surface character
  for (let i = 0; i < 3800; i++) { c.globalAlpha = 0.1 + rand() * 0.34; c.fillStyle = '#7b6350'; const r = 0.6 + Math.pow(rand(), 2) * 2.6; c.beginPath(); c.ellipse(rand() * size, rand() * size, r * 1.5, r, rand() * 3, 0, Math.PI * 2); c.fill(); }
  // a few larger shells / fossil pockets
  for (let i = 0; i < 26; i++) {
    const x = rand() * size, y = rand() * size, r = 2.2 + rand() * 3.6, rot = rand() * 3;
    c.globalAlpha = 0.22 + rand() * 0.2; c.fillStyle = '#6a5442'; c.beginPath(); c.ellipse(x, y, r * 1.6, r, rot, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.45; c.fillStyle = '#fff6e6'; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.3, r * 1.1, r * 0.45, rot, 0, Math.PI * 2); c.fill(); // lit lip of the pocket
  }
  c.globalAlpha = 1;
  const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = bumpCanvas.height = size; const b = bumpCanvas.getContext('2d')!;
  b.drawImage(cloud, 0, 0); b.globalCompositeOperation = 'multiply'; b.globalAlpha = 0.5; b.drawImage(col, 0, 0);
  b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
  strokeVeins(b, w => ['rgba(30,30,30,0.55)', 1.6 * w]); // veins sit slightly sunk
  // roughness: polished body (dark = smoother), porous pits and veins matt
  const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = size; const rc = roughCanvas.getContext('2d')!;
  rc.fillStyle = '#8a8a8a'; rc.fillRect(0, 0, size, size);
  rc.globalCompositeOperation = 'multiply'; rc.globalAlpha = 0.55; rc.drawImage(cloud, 0, 0); rc.globalCompositeOperation = 'lighter'; rc.globalAlpha = 1;
  strokeVeins(rc, w => ['rgba(70,70,70,0.7)', 2.4 * w]);
  rc.fillStyle = 'rgba(120,120,120,0.9)';
  for (let i = 0; i < 1400; i++) { const r = 0.6 + rand() * 1.6; rc.beginPath(); rc.ellipse(rand() * size, rand() * size, r * 1.5, r, rand() * 3, 0, Math.PI * 2); rc.fill(); }
  const out = { map: toTexture(col, repeat, true), bump: toTexture(bumpCanvas, repeat, false), rough: toTexture(roughCanvas, repeat, false) };
  marbleCache.set(key, out); return out;
}

/** Big polished floor tiles (2 × 2 per texture, each flipped differently) with fine joints, built from the marble above. */
const tileCache = new Map<number, { map: CanvasTexture; bump: CanvasTexture }>();
export function marbleTileTextures(seed = 21, repeat = 6) {
  const hit = tileCache.get(seed); if (hit) return hit;
  const src = (marbleTextures(seed, 1).map.image as HTMLCanvasElement); const size = 1024; const half = size / 2;
  const col = document.createElement('canvas'); col.width = col.height = size; const c = col.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * half, y = Math.floor(i / 2) * half; c.save(); c.translate(x + half / 2, y + half / 2); c.scale(i % 2 ? -1 : 1, i > 1 ? -1 : 1); c.rotate((i * Math.PI) / 2);
    c.beginPath(); c.rect(-half / 2, -half / 2, half, half); c.clip(); c.drawImage(src, -half / 2 - (i * 97) % 300, -half / 2 - (i * 151) % 300, size, size); c.restore();
    c.fillStyle = `rgba(${i % 2 ? 255 : 244},${i > 1 ? 246 : 238},228,0.10)`; c.fillRect(x, y, half, half); // slight tone difference tile to tile
  }
  c.strokeStyle = 'rgba(96,74,56,0.22)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(half, 0); c.lineTo(half, size); c.moveTo(0, half); c.lineTo(size, half); c.stroke();
  c.strokeStyle = 'rgba(255,250,240,0.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(half + 3, 0); c.lineTo(half + 3, size); c.moveTo(0, half + 3); c.lineTo(size, half + 3); c.stroke();
  const bump = document.createElement('canvas'); bump.width = bump.height = size; const b = bump.getContext('2d')!; b.fillStyle = '#9a9a9a'; b.fillRect(0, 0, size, size);
  b.strokeStyle = '#303030'; b.lineWidth = 5; b.beginPath(); b.moveTo(half, 0); b.lineTo(half, size); b.moveTo(0, half); b.lineTo(size, half); b.stroke();
  const out = { map: toTexture(col, repeat, true), bump: toTexture(bump, repeat, false) };
  tileCache.set(seed, out); return out;
}

const darkCache = new Map<string, { map: CanvasTexture; bump: CanvasTexture }>();
/** Worn black coated stone-metal: dark base, fine speckle, dusty scratches. Cached: one set per seed/repeat. */
export function darkStoneTextures(seed = 3, repeat = 1) {
  const key = `${seed}/${repeat}`;
  let hit = darkCache.get(key);
  if (!hit) { hit = buildDarkStone(seed, repeat); darkCache.set(key, hit); }
  return hit;
}

function buildDarkStone(seed: number, repeat: number) {
  const size = 1024; const noise = noiseCanvas(size, seed, 6, 1, 0.5); const rand = rng(seed + 1);
  const color = document.createElement('canvas'); color.width = color.height = size; const cc = color.getContext('2d')!;
  cc.fillStyle = '#2b2a29'; cc.fillRect(0, 0, size, size);
  cc.globalCompositeOperation = 'lighten'; cc.globalAlpha = 0.5; cc.drawImage(noise, 0, 0); cc.globalCompositeOperation = 'multiply'; cc.globalAlpha = 0.85; cc.fillStyle = '#858585'; cc.fillRect(0, 0, size, size);
  cc.globalCompositeOperation = 'source-over';
  // speckle
  for (let i = 0; i < 2600; i++) { cc.globalAlpha = 0.10 + rand() * 0.35; cc.fillStyle = rand() > 0.35 ? '#8c8a86' : '#0b0b0b'; cc.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2); }
  // dusty hairline scratches
  cc.strokeStyle = '#9a948a'; cc.lineWidth = 1;
  for (let i = 0; i < 140; i++) { cc.globalAlpha = 0.12 + rand() * 0.3; const x = rand() * size, y = rand() * size, a = rand() * Math.PI, l = 8 + rand() * 60; cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cc.stroke(); }
  cc.globalAlpha = 1;
  return { map: toTexture(color, repeat, true), bump: toTexture(noise, repeat, false) };
}
