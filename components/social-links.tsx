"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

function FlowerModel({ hovered }: { hovered: boolean }) {
  const { nodes, materials } = useGLTF("/DesertLily.glb") as any;
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef(0);

  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
    glowRef.current += ((hovered ? 1 : 0) - glowRef.current) * 0.08;
    if (matRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 1.5) * 0.5 + 0.5;
      matRef.current.emissiveIntensity = glowRef.current * (0.4 + pulse * 0.8);
    }
  });

  return (
    <mesh
      ref={ref}
      geometry={nodes.DeserLily_Mesh.geometry}
      scale={0.35}
      position={[0, -0.9, 0]}
      rotation={[0.3, 0, 0.1]}
    >
      <meshStandardMaterial
        ref={matRef}
        {...materials.DeserLily_Mat}
        emissive={new THREE.Color("#EC407A")}
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

function RedCube() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="arr-ct" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7f1d1d" />
          <stop offset="100%" stopColor="#5b1414" />
        </linearGradient>
        <linearGradient id="arr-cl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#450a0a" />
          <stop offset="100%" stopColor="#1a0404" />
        </linearGradient>
        <linearGradient id="arr-cr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b1414" />
          <stop offset="100%" stopColor="#2a0606" />
        </linearGradient>
      </defs>
      <polygon points="16,4 28,10 16,16 4,10" fill="url(#arr-ct)" />
      <polygon points="4,10 16,16 16,28 4,22" fill="url(#arr-cl)" />
      <polygon points="16,16 28,10 28,22 16,28" fill="url(#arr-cr)" />
    </svg>
  );
}

function noEvents() {
  return { enabled: false, priority: 0, compute: () => {} } as any;
}

export function SocialLinks({ visible }: { visible: boolean }) {
  const [flowerHovered, setFlowerHovered] = useState(false);

  return (
    <div
      className="absolute inset-0 flex items-center"
      style={{
        zIndex: 40,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        justifyContent: "center",
        paddingLeft: "36%",
      }}
    >
      <div className="flex gap-14 sm:gap-20 items-end">
        {/* Main site — red cube */}
        <a
          href="https://isaacrozsa.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-3"
          style={{
            filter: "drop-shadow(0 0 0px transparent)",
            transition: "filter 300ms ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter =
              "drop-shadow(0 0 14px rgba(180, 40, 40, 0.5))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter =
              "drop-shadow(0 0 0px transparent)";
          }}
        >
          <RedCube />
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 group-hover:text-white/60 transition-colors"
          >
            isaacrozsa.com
          </span>
        </a>

        {/* Good Talk — 3D rotating flower */}
        <a
          href="https://goodtalk.isaacrozsa.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-3"
          onMouseEnter={() => setFlowerHovered(true)}
          onMouseLeave={() => setFlowerHovered(false)}
        >
          <span className="block" style={{ width: 48, height: 48 }}>
            <Canvas
              camera={{ position: [0, 0, 3], fov: 40 }}
              style={{ width: "100%", height: "100%", pointerEvents: "none" }}
              gl={{ alpha: true }}
              events={noEvents}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[3, 4, 2]} intensity={1} />
              <FlowerModel hovered={flowerHovered} />
            </Canvas>
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 group-hover:text-white/60 transition-colors"
          >
            good talk
          </span>
        </a>
      </div>
    </div>
  );
}
