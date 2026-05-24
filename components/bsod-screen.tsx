"use client";

import { useMemo } from "react";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DeadPixel {
  x: number;
  y: number;
  size: number;
  color: string;
}

const DEAD_PIXEL_COLORS = [
  "#000", "#000", "#fff", "#ff0000", "#00ff00", "#0000ff", "#ff0000", "#00ff00",
];

function generateDeadPixels(count: number): DeadPixel[] {
  const rng = mulberry32(42);
  const pixels: DeadPixel[] = [];
  for (let i = 0; i < count; i++) {
    pixels.push({
      x: rng() * 100,
      y: rng() * 100,
      size: 2 + Math.floor(rng() * 3),
      color: DEAD_PIXEL_COLORS[Math.floor(rng() * DEAD_PIXEL_COLORS.length)],
    });
  }
  return pixels;
}

export function BsodScreen({ progress }: { progress: number }) {
  const eased = Math.pow(progress, 3.5);
  const pct = Math.min(100, Math.round(eased * 102));
  const deadPixels = useMemo(() => generateDeadPixels(40), []);

  const fringeStyle = {
    textShadow: "1.5px 0 0 rgba(255,0,0,0.35), -1.5px 0 0 rgba(0,255,255,0.35)",
  };

  return (
    <div className="absolute inset-0" style={{ zIndex: 100 }}>
      <div
        className="absolute inset-0 flex flex-col justify-center px-[10%]"
        style={{
          background: "#0000aa",
          fontFamily: "'Courier New', 'Lucida Console', monospace",
          perspective: "800px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div style={{ transform: "translateZ(12px)", transformStyle: "preserve-3d" }}>
          <div className="text-white" style={{ fontSize: "clamp(80px, 15vw, 160px)", fontWeight: 100, lineHeight: 1, fontFamily: "system-ui, -apple-system, sans-serif", ...fringeStyle }}>
            ;)
          </div>
          <div className="text-white mt-6" style={{ fontSize: "clamp(12px, 1.8vw, 20px)", fontWeight: 400, ...fringeStyle }}>
            Your PC ran into a problem and needs to restart. We&apos;re just collecting some error info, and then we&apos;ll restart for you.
          </div>
          <div className="text-white mt-4" style={{ fontSize: "clamp(12px, 1.8vw, 20px)", fontWeight: 400, ...fringeStyle }}>
            {pct}% complete
          </div>
          <div className="text-white/60 mt-12" style={{ fontSize: "clamp(8px, 1vw, 11px)", ...fringeStyle }}>
            If you&apos;d like to know more, you can search online later for this error: ARRHYTHMIA_TRACK_OVERFLOW
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 4px)", zIndex: 1 }} aria-hidden="true" />

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }} aria-hidden="true">
        {deadPixels.map((px, i) => (
          <div key={i} style={{ position: "absolute", left: `${px.x}%`, top: `${px.y}%`, width: px.size, height: px.size, background: px.color }} />
        ))}
      </div>

      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)", zIndex: 3 }} aria-hidden="true" />

      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 3px 0 8px rgba(255,0,0,0.12), inset -3px 0 8px rgba(0,255,255,0.12), inset 0 3px 8px rgba(255,0,255,0.08), inset 0 -3px 8px rgba(0,255,0,0.08)", zIndex: 4 }} aria-hidden="true" />

      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: "8px", boxShadow: "inset 0 0 60px 10px rgba(0,0,0,0.4)", zIndex: 5 }} aria-hidden="true" />
    </div>
  );
}
