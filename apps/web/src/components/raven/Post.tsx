import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { HalfFloatType, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/** Final colour grade, applied in display space after tone mapping: split toning, a touch of contrast, vignette and fine film grain. */
const GRADE = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new Vector2(1, 1) }, contrast: { value: 1.07 }, saturation: { value: 1.0 }, vignette: { value: 0.3 }, grain: { value: 0.022 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float contrast; uniform float saturation; uniform float vignette; uniform float grain;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c += vec3(0.035, 0.022, 0.018) * smoothstep(0.5, 0.0, l);                 // lifted, warm-pink shadows like the reference
      c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.95), smoothstep(0.45, 1.0, l));    // warm sunlit highlights
      c = (c - 0.5) * contrast + 0.5;
      c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, saturation);
      float d = distance(vUv, vec2(0.5, 0.52));
      c *= 1.0 - vignette * smoothstep(0.32, 0.95, d);
      c += (hash(vUv * res) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/**
 * The film look: scene → ambient occlusion → bloom → tone mapping → grade (no depth-of-field blur: everything stays sharp).
 * Rendered through a multisampled half-float target, so highlights keep headroom for the bloom and edges stay clean.
 */
export function Post() {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();
  const chain = useMemo(() => {
    const target = new WebGLRenderTarget(size.width * dpr, size.height * dpr, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.blendIntensity = 1;
    ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
    composer.addPass(ao);
    // the normal / depth prepass draws every object with an override material, which turns soft sprites (dust) into solid quads:
    // hide anything named 'dust' while it runs (it is already in the colour image)
    const render = (ao as Pass).render.bind(ao);
    ao.render = (...args: Parameters<Pass['render']>) => { const d = scene.getObjectByName('dust'); const v = d?.visible; if (d) d.visible = false; render(...args); if (d && v !== undefined) d.visible = v; };
    composer.addPass(new UnrealBloomPass(new Vector2(size.width, size.height), 0.36, 0.75, 0.95));
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(new ShaderMaterial(GRADE));
    composer.addPass(grade);
    return { composer, ao, grade };
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    chain.composer.setPixelRatio(dpr); chain.composer.setSize(size.width, size.height);
    (chain.grade.uniforms.res.value as Vector2).set(size.width * dpr, size.height * dpr);
  }, [chain, size, dpr]);
  useEffect(() => () => { chain.composer.dispose(); }, [chain]);
  useFrame(({ clock }, dt) => {
    chain.grade.uniforms.time.value = clock.elapsedTime % 100;
    chain.composer.render(dt);
  }, 1); // priority > 0: takes over rendering from the default loop
  return null;
}
