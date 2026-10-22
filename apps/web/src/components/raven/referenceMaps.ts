import { useEffect, useState } from 'react';
import { Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter, MirroredRepeatWrapping, PerspectiveCamera, SRGBColorSpace, Texture, Vector3 } from 'three';
import { BufferGeometry } from 'three';

/**
 * The approved reference render, turned into surface textures (albedo + normal) for real geometry.
 * UVs are baked once from the hero camera, so the texture is glued to the model:
 * it matches the reference from the hero view and keeps sticking to the surface when the camera or parts move.
 */
const BASE = '/scene-ref/';
// Baked once from reference.png by the offline step in scene-ref/README: chest albedo (80% desaturated), full colour, normal, height.
const FILES = { chest: 'reference-chest.jpg', full: 'reference-full.jpg', normal: 'reference-normal.jpg', height: 'reference-height.jpg', pedestal: 'reference-pedestal.jpg', stone: 'reference-stone.jpg' } as const;
/** The raven's silhouette in reference pixels (1254 px square). */
export const RAVEN_POLY: [number, number][] = [[670, 455], [640, 520], [560, 545], [548, 600], [545, 700], [520, 770], [505, 788], [480, 774], [455, 796], [425, 778], [395, 800], [365, 780], [335, 798], [305, 774], [275, 794], [245, 770], [215, 786], [185, 760], [155, 778], [125, 752], [100, 760], [92, 740], [75, 700], [65, 600], [70, 500], [90, 430], [100, 395], [190, 380], [300, 345], [330, 342], [480, 340], [600, 345], [640, 420]];

/**
 * The case's own surface texture without the raven: the raven is real relief geometry on top, so the baked copy underneath
 * (which cannot follow the lid or the camera) is painted over with plain dark panel.
 */
function bodyTexture(chest: HTMLImageElement): Texture {
  const W = chest.naturalWidth, H = chest.naturalHeight, k = W / 1254;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.drawImage(chest, 0, 0);
  // The patch is grown from the pixels around the raven by diffusion (every missing cell becomes the average of its neighbours), on a coarse grid,
  // so it carries the exact tone and the light gradient of the panel at its border and never reads as a separate shape.
  const cell = 8, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const small = document.createElement('canvas'); small.width = gw; small.height = gh; const sg = small.getContext('2d', { willReadFrequently: true })!;
  sg.drawImage(chest, 0, 0, gw, gh);
  const maskSmall = document.createElement('canvas'); maskSmall.width = gw; maskSmall.height = gh; const ms = maskSmall.getContext('2d', { willReadFrequently: true })!;
  ms.fillStyle = ms.strokeStyle = '#fff'; ms.lineWidth = 2; ms.lineJoin = 'round'; ms.beginPath();
  RAVEN_POLY.forEach(([x, y], i) => (i ? ms.lineTo((x * k) / cell, (y * k) / cell) : ms.moveTo((x * k) / cell, (y * k) / cell))); ms.closePath(); ms.fill(); ms.stroke();
  const mdata = ms.getImageData(0, 0, gw, gh).data; const sdata = sg.getImageData(0, 0, gw, gh); const px = sdata.data;
  const inside = new Uint8Array(gw * gh); let bx = 0, by = 0, bz = 0, bn = 0;
  for (let i = 0; i < gw * gh; i++) inside[i] = mdata[i * 4] > 40 ? 1 : 0;
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; if (!inside[i] && (inside[i - 1] || inside[i + 1] || inside[i - gw] || inside[i + gw])) { bx += px[i * 4]; by += px[i * 4 + 1]; bz += px[i * 4 + 2]; bn++; } }
  for (let i = 0; i < gw * gh; i++) if (inside[i]) { px[i * 4] = bx / bn; px[i * 4 + 1] = by / bn; px[i * 4 + 2] = bz / bn; }
  for (let it = 0; it < 500; it++) for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
    const i = y * gw + x; if (!inside[i]) continue;
    for (let c = 0; c < 3; c++) px[i * 4 + c] = (px[(i - 1) * 4 + c] + px[(i + 1) * 4 + c] + px[(i - gw) * 4 + c] + px[(i + gw) * 4 + c]) / 4;
  }
  sg.putImageData(sdata, 0, 0);
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H; const lg = layer.getContext('2d')!;
  lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = 'high'; lg.drawImage(small, 0, 0, W, H);
  for (let i = 0; i < 6000; i++) { // fine speckle so the patch matches the worn panel around it
    const x = (50 + Math.random() * 660) * k, y = (320 + Math.random() * 490) * k; lg.globalAlpha = 0.04 + Math.random() * 0.12; lg.fillStyle = Math.random() > 0.5 ? '#4a4743' : '#151413'; lg.fillRect(x, y, 1.3 * k, 1.3 * k);
  }
  lg.globalAlpha = 1;
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H; const mg = mask.getContext('2d')!;
  mg.filter = `blur(${5 * k}px)`; mg.fillStyle = '#fff'; mg.beginPath();
  RAVEN_POLY.forEach(([x, y], i) => (i ? mg.lineTo(x * k, y * k) : mg.moveTo(x * k, y * k))); mg.closePath(); mg.fill();
  lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mask, 0, 0);
  g.drawImage(layer, 0, 0);
  const t = new Texture(c); t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.anisotropy = 8; t.colorSpace = SRGBColorSpace; t.needsUpdate = true;
  return t;
}

export type RefMaps = { color: Texture; body: Texture; colorFull: Texture; pedestal: Texture; stone: Texture; normal: Texture; height: Texture; image: HTMLImageElement; heightData: Uint8ClampedArray; size: [number, number] };

let cached: RefMaps | null = null;
let pending: Promise<RefMaps> | null = null;

function loadImage(name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = BASE + name; });
}

function texture(img: HTMLImageElement, srgb: boolean): Texture {
  const t = new Texture(img); t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.anisotropy = 8;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function build(chest: HTMLImageElement, full: HTMLImageElement, normal: HTMLImageElement, height: HTMLImageElement, pedestalImg: HTMLImageElement, stoneImg: HTMLImageElement): RefMaps {
  const W = full.naturalWidth, H = full.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(height, 0, 0);
  const heightData = ctx.getImageData(0, 0, W, H).data;
  const colorFull = texture(full, true); colorFull.wrapS = colorFull.wrapT = MirroredRepeatWrapping;
  const stone = texture(stoneImg, true); stone.wrapS = stone.wrapT = MirroredRepeatWrapping; stone.repeat.set(1.8, 4.8); // same stone density as the pedestal's front face
  const pedestal = texture(pedestalImg, true); pedestal.wrapS = pedestal.wrapT = MirroredRepeatWrapping; // the block is wider than the reference frame
  return { color: texture(chest, true), body: bodyTexture(chest), colorFull, pedestal, stone, normal: texture(normal, false), height: texture(height, false), image: full, heightData, size: [W, H] };
}

export function loadReferenceMaps(): Promise<RefMaps> {
  if (cached) return Promise.resolve(cached);
  pending ??= Promise.all([loadImage(FILES.chest), loadImage(FILES.full), loadImage(FILES.normal), loadImage(FILES.height), loadImage(FILES.pedestal), loadImage(FILES.stone)])
    .then(([chest, full, normal, height, pedestal, stone]) => {
      const t0 = performance.now(); cached = build(chest, full, normal, height, pedestal, stone);
      if (import.meta.env.DEV) console.info(`[raven] reference maps: images ready at ${Math.round(t0)} ms, built in ${Math.round(performance.now() - t0)} ms`);
      return cached;
    });
  return pending;
}

export function useReferenceMaps(): RefMaps | null {
  const [maps, set] = useState<RefMaps | null>(cached);
  useEffect(() => { let alive = true; if (!cached) loadReferenceMaps().then(m => { if (alive) set(m); }).catch(() => undefined); return () => { alive = false; }; }, []);
  return maps;
}

/** The hero camera, mirrored for UV baking (square frame, same vertical fov as the live camera). */
export function heroCamera(position: readonly [number, number, number], target: readonly [number, number, number], fov: number) {
  const cam = new PerspectiveCamera(fov, 1, 0.1, 100);
  cam.position.set(...position); cam.lookAt(new Vector3(...target)); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  return cam;
}

/**
 * Displaces a +z facing plane by the reference height field and bakes UVs from the *displaced* vertices,
 * so geometry and texture stay registered from the hero view (no parallax drift).
 */
export function displaceFromReference(source: BufferGeometry, origin: readonly [number, number, number], cam: PerspectiveCamera, maps: RefMaps, scale: number, fade?: Uint8ClampedArray): BufferGeometry {
  const g = source.clone(); const pos = g.getAttribute('position'); const uv = new Float32Array(pos.count * 2); const v = new Vector3();
  const [W, H] = maps.size;
  const sample = (u: number, vv: number, data: Uint8ClampedArray) => {
    const x = Math.min(W - 1, Math.max(0, Math.round(u * (W - 1)))), y = Math.min(H - 1, Math.max(0, Math.round((1 - vv) * (H - 1))));
    return data[(y * W + x) * 4] / 255;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i); let z = pos.getZ(i);
    const z0 = z; let u = 0, w = 0;
    for (let pass = 0; pass < 3; pass++) {
      v.set(x + origin[0], y + origin[1], z + origin[2]).project(cam); u = (v.x + 1) / 2; w = (v.y + 1) / 2;
      const m = fade ? sample(u, w, fade) : 1;
      z = z0 + sample(u, w, maps.heightData) * scale * m;
    }
    pos.setZ(i, z); uv[i * 2] = u; uv[i * 2 + 1] = w;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); pos.needsUpdate = true; g.computeVertexNormals();
  return g;
}

/**
 * Splits triangles until every edge is at most `maxEdge` long. Screen-space UVs are a projective (non-linear) function of
 * position, so big triangles would interpolate them wrongly and the texture would drift against the geometry.
 */
export function subdivide(source: BufferGeometry, maxEdge: number): BufferGeometry {
  const g = source.index ? source.toNonIndexed() : source.clone();
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const outP: number[] = [], outN: number[] = [];
  const tri = (a: number[], b: number[], c: number[], na: number[], nb: number[], nc: number[]) => {
    const d = (u: number[], v: number[]) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    const ab = d(a, b), bc = d(b, c), ca = d(c, a), m = Math.max(ab, bc, ca);
    if (m <= maxEdge) { outP.push(...a, ...b, ...c); outN.push(...na, ...nb, ...nc); return; }
    const mid = (u: number[], v: number[]) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2];
    if (m === ab) { const q = mid(a, b), nq = mid(na, nb); tri(a, q, c, na, nq, nc); tri(q, b, c, nq, nb, nc); }
    else if (m === bc) { const q = mid(b, c), nq = mid(nb, nc); tri(a, b, q, na, nb, nq); tri(a, q, c, na, nq, nc); }
    else { const q = mid(c, a), nq = mid(nc, na); tri(a, b, q, na, nb, nq); tri(q, b, c, nq, nb, nc); }
  };
  const v = (attr: typeof p, i: number) => [attr.getX(i), attr.getY(i), attr.getZ(i)];
  for (let i = 0; i < p.count; i += 3) tri(v(p, i), v(p, i + 1), v(p, i + 2), n ? v(n, i) : [0, 0, 1], n ? v(n, i + 1) : [0, 0, 1], n ? v(n, i + 2) : [0, 0, 1]);
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(outP, 3)); out.setAttribute('normal', new Float32BufferAttribute(outN, 3));
  return out;
}

/** Writes uv = hero-camera screen position of every vertex (geometry space offset by `origin`). Returns a clone. */
export function bakeProjectedUV(source: BufferGeometry, origin: readonly [number, number, number], cam: PerspectiveCamera): BufferGeometry {
  const g = source.clone(); const pos = g.getAttribute('position'); const uv = new Float32Array(pos.count * 2); const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i) + origin[0], pos.getY(i) + origin[1], pos.getZ(i) + origin[2]).project(cam);
    uv[i * 2] = (v.x + 1) / 2; uv[i * 2 + 1] = (v.y + 1) / 2;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}
