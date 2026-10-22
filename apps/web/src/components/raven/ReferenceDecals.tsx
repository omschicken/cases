import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, PlaneGeometry } from 'three';
import { CHEST } from './ChestModel';
import { RAVEN_POLY, displaceFromReference, heroCamera, useReferenceMaps } from './referenceMaps';
import type { RefMaps } from './referenceMaps';
import { CAMERA } from './sceneConfig';

/**
 * The raven relief on the front-left of the case: real displaced geometry in front of the body, one single piece.
 * Albedo / normal / height come from the reference render through UVs baked from the hero camera,
 * so the relief lines up exactly with the surface detail of the body from the hero view.
 * The silhouette is the polygon in referenceMaps (reference pixels), applied as an alpha cut-out.
 * The whole raven stays on the body when the lid opens (nothing of it rides on the lid), and the baked copy of the raven is removed from
 * the case texture underneath, so the head and the beak can never separate from the bird.
 */
function silhouette(img: HTMLImageElement, blur: number) {
  const W = img.naturalWidth, H = img.naturalHeight, k = W / 1254;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.filter = `blur(${blur}px)`; ctx.fillStyle = '#fff'; ctx.beginPath();
  RAVEN_POLY.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k))); ctx.closePath(); ctx.fill();
  return c;
}

const HERO = heroCamera(CAMERA.position, CAMERA.target, CAMERA.fov);

function Relief({ maps }: { maps: RefMaps }) {
  const { d } = CHEST; const hz = d / 2;
  // wide enough to carry the whole raven, head and beak included (the plane used to end short of the beak, which was left as baked texture on the case)
  const w = 5.6, h = 3.0, pos: [number, number, number] = [-0.7, 1.25, hz + 0.04];
  const geometry = useMemo(() => {
    const feather = silhouette(maps.image, 16); const fd = feather.getContext('2d')!.getImageData(0, 0, feather.width, feather.height).data;
    const full = displaceFromReference(new PlaneGeometry(w, h, 420, 230), pos, HERO, maps, 0.13, fd);
    // keep the relief on the case: nothing past the left corner of the body and nothing below its base
    const index = full.getIndex()!; const position = full.getAttribute('position'); const keep: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3 + pos[0], y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3 + pos[1];
      if (x > -CHEST.w / 2 + 0.03 && y > 0.04) keep.push(a, b, c);
    }
    full.setIndex(keep); return full;
  }, [maps]); // eslint-disable-line react-hooks/exhaustive-deps
  const alpha = useMemo(() => new CanvasTexture(silhouette(maps.image, 3)), [maps]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __ravenReady?: boolean }).__ravenReady = true; }, []); // dev harness: scene fully built
  return <mesh position={pos} geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial map={maps.color} color="#7f7c77" emissiveMap={maps.color} emissive="#ffffff" emissiveIntensity={0.07} normalMap={maps.normal} normalScale={[2.1, 2.1] as unknown as never}
      alphaMap={alpha} alphaTest={0.5} roughness={0.6} metalness={0.2} side={DoubleSide} />
  </mesh>;
}

export function ReferenceDecals() {
  const maps = useReferenceMaps();
  return maps ? <Relief maps={maps} /> : null;
}
