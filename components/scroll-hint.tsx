"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const MESSAGE = "SCROLL TO BEGIN · ";
const RADIUS = 1.0;
const ROTATION_SPEED = 0.35;
const CHAR_SCALE = 0.28;

function makeCharTexture(char: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "white";
  ctx.font = "bold 44px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function CylinderText() {
  const groupRef = useRef<THREE.Group>(null);

  const chars = useMemo(() => {
    const arr = MESSAGE.split("");
    const step = (Math.PI * 2) / arr.length;
    return arr.map((ch, i) => {
      const angle = i * step;
      return {
        texture: makeCharTexture(ch),
        position: new THREE.Vector3(
          Math.sin(angle) * RADIUS,
          0,
          Math.cos(angle) * RADIUS,
        ),
        rotationY: angle,
      };
    });
  }, []);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * ROTATION_SPEED;
    }
  });

  return (
    <group ref={groupRef}>
      {chars.map((c, i) => (
        <mesh
          key={i}
          position={c.position}
          rotation={[0, c.rotationY, 0]}
          scale={[CHAR_SCALE, CHAR_SCALE, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={c.texture}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function noEvents() {
  return { enabled: false, priority: 0, compute: () => {} } as any;
}

export function ScrollHint({ visible }: { visible: boolean }) {
  return (
    <div
      className="absolute select-none"
      style={{
        zIndex: 100,
        pointerEvents: "none",
        opacity: visible ? 0.55 : 0,
        transition: "opacity 600ms ease-out",
        top: 6,
        left: 16,
        width: 150,
        height: 150,
      }}
    >
      <Canvas
        camera={{ position: [0, 0.3, 4], fov: 30 }}
        style={{ background: "transparent", pointerEvents: "none" }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        events={noEvents}
      >
        <CylinderText />
      </Canvas>
    </div>
  );
}
