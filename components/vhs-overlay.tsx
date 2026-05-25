"use client";

import { useEffect, useRef, type RefObject } from "react";

interface GlitchBar {
  y: number;
  height: number;
  offsetX: number;
  color: string;
}

const BAR_COLORS = [
  (a: number) => `rgba(255, 60, 60, ${a})`,
  (a: number) => `rgba(60, 255, 255, ${a})`,
  (a: number) => `rgba(255, 255, 255, ${a})`,
  (a: number) => `rgba(180, 60, 255, ${a})`,
];

export function VhsOverlay({
  active,
  containerRef,
}: {
  active: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let nextGlitchTime = performance.now() + 200 + Math.random() * 800;
    let glitchEndTime = 0;
    let glitching = false;
    let bars: GlitchBar[] = [];

    const animate = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const dpr = w / (canvas.offsetWidth || 1);

      if (!glitching && now >= nextGlitchTime) {
        glitching = true;
        const intense = Math.random() < 0.15;
        glitchEndTime =
          now + (intense ? 100 + Math.random() * 300 : 40 + Math.random() * 160);

        const barCount = intense
          ? 3 + Math.floor(Math.random() * 5)
          : 1 + Math.floor(Math.random() * 3);
        bars = Array.from({ length: barCount }, () => {
          const fn = BAR_COLORS[Math.floor(Math.random() * BAR_COLORS.length)];
          return {
            y: Math.random() * 100,
            height: 0.3 + Math.random() * (intense ? 5 : 3),
            offsetX: (Math.random() - 0.5) * (intense ? 40 : 20),
            color: fn(0.04 + Math.random() * (intense ? 0.14 : 0.08)),
          };
        });

        const jitter = (Math.random() - 0.5) * (intense ? 14 : 6);
        if (canvas) canvas.style.transform = `translateX(${jitter}px)`;
      }
      if (glitching && now >= glitchEndTime) {
        glitching = false;
        nextGlitchTime = now + 400 + Math.random() * 2500;
        bars = [];
        if (canvas) canvas.style.transform = "";
      }

      ctx.clearRect(0, 0, w, h);

      // Tracking line — subtle bright band scrolling down
      const lineY = ((now * 0.04) % (h + 60)) - 30;
      const lg = ctx.createLinearGradient(0, lineY - 20, 0, lineY + 20);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(0.35, "rgba(255,255,255,0.02)");
      lg.addColorStop(0.5, "rgba(255,255,255,0.04)");
      lg.addColorStop(0.65, "rgba(255,255,255,0.02)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, lineY - 20, w, 40);

      if (glitching) {
        for (const bar of bars) {
          ctx.fillStyle = bar.color;
          const by = (bar.y / 100) * h;
          const bh = Math.max(2, (bar.height / 100) * h);
          const ox = bar.offsetX * dpr;
          ctx.fillRect(ox, by, w + Math.abs(ox), bh);
        }

        const noiseCount = 30 + Math.floor(Math.random() * 50);
        for (let i = 0; i < noiseCount; i++) {
          const b = 200 + Math.floor(Math.random() * 55);
          ctx.fillStyle = `rgba(${b},${b},${b},${0.04 + Math.random() * 0.08})`;
          ctx.fillRect(
            Math.random() * w,
            Math.random() * h,
            1 + Math.random() * 3,
            1,
          );
        }
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (canvas) canvas.style.transform = "";
    };
  }, [active, containerRef]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 60, mixBlendMode: "screen" }}
    />
  );
}
