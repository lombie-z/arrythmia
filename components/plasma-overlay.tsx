"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Simplex noise (Ashima / Stefan Gustavson)                         */
/* ------------------------------------------------------------------ */
const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/* ------------------------------------------------------------------ */
/*  Fractal Brownian Motion                                           */
/* ------------------------------------------------------------------ */
const FBM_GLSL = /* glsl */ `
float fbm(vec2 p, float time) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p * frequency + time * (0.1 + float(i) * 0.05));
    p = rot * p;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
`;

/* ------------------------------------------------------------------ */
/*  Vertex shader                                                     */
/* ------------------------------------------------------------------ */
const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  Fragment shader — palette-driven plasma + edge-inward mask        */
/* ------------------------------------------------------------------ */
const FRAGMENT_SHADER = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
${FBM_GLSL}

uniform float u_time;
uniform float u_coverage;
uniform vec2  u_resolution;
varying vec2  vUv;

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 uv = vUv * aspect;

  // ---- PLASMA COLOR ----
  // Palette anchors: indigo, purple, magenta, cyan, deep blue
  vec3 c0 = vec3(0.05, 0.02, 0.25);
  vec3 c1 = vec3(0.45, 0.05, 0.55);
  vec3 c2 = vec3(0.85, 0.10, 0.60);
  vec3 c3 = vec3(0.10, 0.70, 0.75);
  vec3 c4 = vec3(0.15, 0.20, 0.70);

  // Multi-scale noise
  float n1 = fbm(uv * 1.5, u_time * 0.4);
  float n2 = fbm(uv * 2.5 + vec2(5.2, 1.3), u_time * -0.3);
  float n3 = snoise(uv * 0.8 + u_time * 0.15);

  // Domain warping for organic swirls
  float warp = fbm(uv * 2.0 + vec2(n1, n2) * 0.8, u_time * 0.25);

  // Palette lookup via warped noise
  float t = fract((warp * 2.5 + n1 * 1.5 + u_time * 0.2) * 0.5) * 5.0;
  vec3 color;
  if (t < 1.0)      color = mix(c0, c1, t);
  else if (t < 2.0) color = mix(c1, c2, t - 1.0);
  else if (t < 3.0) color = mix(c2, c3, t - 2.0);
  else if (t < 4.0) color = mix(c3, c4, t - 3.0);
  else              color = mix(c4, c0, t - 4.0);

  // Secondary shimmer layer
  float shimmer = 0.5 + 0.5 * sin(n2 * 4.0 + u_time * 0.5 + 3.0);
  float t2 = fract(n3 * 0.5 + u_time * 0.1 + 0.3) * 5.0;
  vec3 sc;
  if (t2 < 1.0)      sc = mix(c2, c3, t2);
  else if (t2 < 2.0) sc = mix(c3, c0, t2 - 1.0);
  else if (t2 < 3.0) sc = mix(c0, c1, t2 - 2.0);
  else if (t2 < 4.0) sc = mix(c1, c4, t2 - 3.0);
  else               sc = mix(c4, c2, t2 - 4.0);
  color = mix(color, sc, shimmer * 0.4);

  // Boost saturation and brightness
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, 1.5);
  color = pow(max(color, 0.0), vec3(0.8));
  color = clamp(color, 0.0, 1.0);

  // ---- COVERAGE MASK ----
  // edgeDist: 0 at edges, 0.5 at center
  float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));

  // Noisy boundary for organic edge
  float boundaryNoise = snoise(vUv * 6.0  + u_time * 0.3)  * 0.10
                       + snoise(vUv * 14.0 - u_time * 0.4)  * 0.05
                       + snoise(vUv * 3.0  + u_time * 0.15) * 0.07;

  float threshold = u_coverage * 0.6;
  float alpha = smoothstep(threshold, threshold - 0.08, edgeDist + boundaryNoise);

  // Wispy tendrils at leading edge
  float tendrilNoise = snoise(vUv * 18.0 + u_time * 0.5) * 0.5 + 0.5;
  float tendrilZone = smoothstep(threshold + 0.12, threshold, edgeDist + boundaryNoise);
  alpha = max(alpha, tendrilZone * tendrilNoise * (1.0 - alpha) * 0.5);

  // Fine wisps extending further
  float wispNoise = snoise(vUv * 30.0 + u_time * 0.6) * 0.5 + 0.5;
  float wispZone = smoothstep(threshold + 0.2, threshold + 0.06, edgeDist + boundaryNoise);
  alpha = max(alpha, wispZone * wispNoise * (1.0 - alpha) * 0.25);

  // Zero alpha when coverage is zero
  alpha *= smoothstep(0.0, 0.02, u_coverage);

  gl_FragColor = vec4(color, alpha);
}
`;

/* ------------------------------------------------------------------ */
/*  PlasmaQuad — fullscreen mesh updated each frame                   */
/* ------------------------------------------------------------------ */
function PlasmaQuad({ coverage }: { coverage: number }) {
  const sizeVec = useRef(new THREE.Vector2());

  // biome-ignore lint/correctness/useExhaustiveDependencies: coverage is captured at mount only; useFrame lerps toward the live prop
  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_coverage: { value: coverage },
      u_resolution: {
        value: new THREE.Vector2(
          typeof window !== "undefined" ? window.innerWidth : 1,
          typeof window !== "undefined" ? window.innerHeight : 1,
        ),
      },
    }),
    [],
  );

  useFrame((state, delta) => {
    uniforms.u_time.value += delta;

    // Smooth lerp toward target coverage (frame-rate independent)
    const lerpSpeed = 1.0 - 0.001 ** delta;
    uniforms.u_coverage.value +=
      (coverage - uniforms.u_coverage.value) * lerpSpeed;

    // Keep resolution in sync
    const size = state.gl.getDrawingBufferSize(sizeVec.current);
    uniforms.u_resolution.value.set(size.x, size.y);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported overlay component                                        */
/* ------------------------------------------------------------------ */
export function PlasmaOverlay({ coverage }: { coverage: number }) {
  if (coverage <= 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <Canvas
        style={{ pointerEvents: "none" }}
        gl={{ alpha: true, antialias: false, premultipliedAlpha: false }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 1] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <PlasmaQuad coverage={coverage} />
      </Canvas>
    </div>
  );
}
