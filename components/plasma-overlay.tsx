"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

/* ---- simplex noise GLSL (Ashima / Stefan Gustavson) ---- */
const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
         + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
               dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float u_time;
uniform float u_coverage;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 4.0;

  // Multi-octave plasma color
  float n1 = snoise(p + u_time * 0.3);
  float n2 = snoise(p * 2.0 - u_time * 0.2);
  float n3 = snoise(p * 0.5 + u_time * 0.1);
  float n4 = snoise(p * 3.0 + vec2(u_time * 0.15, -u_time * 0.25));

  vec3 color = vec3(
    0.5 + 0.5 * sin(n1 * 3.0 + u_time * 0.8),
    0.5 + 0.5 * sin(n2 * 3.0 + u_time * 1.3 + 2.0),
    0.5 + 0.5 * sin(n3 * 3.0 + u_time * 0.7 + 4.0)
  );

  // Shift toward purples / magentas / cyans / greens
  color = mix(color, vec3(
    0.5 + 0.5 * sin(n4 * 2.5 + u_time + 1.0),
    0.5 + 0.5 * sin(n1 * 2.0 + u_time * 0.6 + 3.5),
    0.5 + 0.5 * sin(n2 * 2.0 + u_time * 0.9 + 5.0)
  ), 0.5);

  // Boost saturation
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, 1.6);

  // Edge-inward radial mask with noisy boundary
  // dist: 0 at center, ~1.4 at corners
  float dist = length(vUv - 0.5) * 2.0;

  // Multiple noise scales for organic boundary
  float edgeNoise = snoise(vUv * 8.0 + u_time * 0.5) * 0.12
                  + snoise(vUv * 16.0 - u_time * 0.3) * 0.06
                  + snoise(vUv * 4.0 + u_time * 0.2) * 0.08;

  // Map coverage [0..1] so edges appear first, center fills last
  // threshold shrinks from ~1.5 (edges only) toward 0 (full cover)
  float threshold = mix(1.6, -0.2, u_coverage);
  float mask = smoothstep(threshold + 0.15, threshold - 0.15, dist + edgeNoise);

  // Add thin tendrils at the leading edge
  float tendrilNoise = snoise(vUv * 20.0 + u_time * 0.4) * 0.5 + 0.5;
  float tendrilMask = smoothstep(threshold + 0.4, threshold + 0.1, dist + edgeNoise)
                    * tendrilNoise * (1.0 - mask);
  mask = max(mask, tendrilMask * 0.7);

  gl_FragColor = vec4(color, mask);
}
`;

function PlasmaQuad({ coverage }: { coverage: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_coverage: { value: 0 },
    }),
    [],
  );

  useFrame((_state, delta) => {
    uniforms.u_time.value += delta;
    uniforms.u_coverage.value = coverage;
  });

  return (
    <mesh ref={meshRef}>
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

function noEvents() {
  return { enabled: false, priority: 0, compute: () => {} } as any;
}

export function PlasmaOverlay({ coverage }: { coverage: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <Canvas
        style={{ pointerEvents: "none" }}
        gl={{ alpha: true }}
        dpr={[1, 2]}
        events={noEvents}
        camera={{ position: [0, 0, 1] }}
      >
        <PlasmaQuad coverage={coverage} />
      </Canvas>
    </div>
  );
}
