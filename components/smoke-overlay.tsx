"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  seed: number;
  alpha: number;
}

function createSmokeTexture(
  size: number,
  r: number,
  g: number,
  b: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.6)`);
  grad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, 0.15)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function SmokeOverlay({ intensity }: { intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const stateRef = useRef({
    particles: [] as Particle[],
    textures: null as HTMLCanvasElement[] | null,
    lastTime: 0,
    emitAccum: 0,
    raf: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const s = stateRef.current;
    s.textures = [
      createSmokeTexture(128, 235, 225, 210),
      createSmokeTexture(128, 215, 185, 140),
      createSmokeTexture(128, 185, 140, 90),
      createSmokeTexture(128, 145, 100, 55),
    ];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    s.lastTime = performance.now();

    const emit = (): Particle => ({
      x: 0.05 + Math.random() * 0.9,
      y: 1.0 + Math.random() * 0.03,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -(0.1 + Math.random() * 0.15),
      size: 0.06 + Math.random() * 0.1,
      life: 0,
      maxLife: 3 + Math.random() * 3,
      seed: Math.random() * 1000,
      alpha: 0.06 + Math.random() * 0.12,
    });

    const animate = (now: number) => {
      const dt = Math.min((now - s.lastTime) / 1000, 0.05);
      s.lastTime = now;
      const ci = intensityRef.current;
      const w = canvas.width;
      const h = canvas.height;

      s.emitAccum += dt * ci * 35;
      while (s.emitAccum >= 1) {
        s.particles.push(emit());
        s.emitAccum -= 1;
      }

      ctx.clearRect(0, 0, w, h);

      const textures = s.textures!;
      const minDim = Math.min(w, h);

      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          s.particles.splice(i, 1);
          continue;
        }

        const t = p.life / p.maxLife;

        const nx =
          Math.sin(p.life * 1.2 + p.seed * 7.13) * 0.012 +
          Math.sin(p.life * 2.8 + p.seed * 13.37) * 0.006 +
          Math.sin(p.life * 5.5 + p.seed * 31.17) * 0.002;
        const ny =
          Math.cos(p.life * 0.9 + p.seed * 11.3) * 0.005 +
          Math.cos(p.life * 2.1 + p.seed * 23.7) * 0.002;

        p.vx += nx * dt;
        p.vy += ny * dt;
        p.vy += 0.015 * dt;

        p.vx *= 1 - 2.0 * dt;
        p.vy *= 1 - 0.4 * dt;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const currentSize = p.size * (1 + t * 1.5) * minDim;
        const fadeIn = Math.min(1, p.life / 0.5);
        const fadeOut = 1 - t * t;
        const alpha = p.alpha * fadeIn * fadeOut * ci;
        if (alpha < 0.003) continue;

        const texIdx = Math.min(3, Math.floor(t * 4));
        const px = p.x * w;
        const py = p.y * h;

        ctx.globalAlpha = alpha;
        ctx.drawImage(
          textures[texIdx],
          px - currentSize,
          py - currentSize,
          currentSize * 2,
          currentSize * 2,
        );
      }

      ctx.globalAlpha = 1;

      if (s.particles.length > 250) {
        s.particles.splice(0, s.particles.length - 250);
      }

      s.raf = requestAnimationFrame(animate);
    };

    s.raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener("resize", resize);
      s.particles.length = 0;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 6 }}
    />
  );
}
