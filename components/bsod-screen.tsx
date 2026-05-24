"use client";

import { useMemo } from "react";

/* ---------- seeded PRNG for deterministic dead-pixel positions ---------- */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DeadPixel {
  x: number; // % from left
  y: number; // % from top
  size: number; // px
  color: string;
}

const DEAD_PIXEL_COLORS = [
  "#000",
  "#000",
  "#fff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ff0000",
  "#00ff00",
];

function generateDeadPixels(count: number): DeadPixel[] {
  const rng = mulberry32(42);
  const pixels: DeadPixel[] = [];
  for (let i = 0; i < count; i++) {
    pixels.push({
      x: rng() * 100,
      y: rng() * 100,
      size: 2 + Math.floor(rng() * 3), // 2-4px
      color: DEAD_PIXEL_COLORS[Math.floor(rng() * DEAD_PIXEL_COLORS.length)],
    });
  }
  return pixels;
}

/* ---------- SVG barrel-distortion filter (inline, component-scoped) ----- */
const BARREL_FILTER_ID = "bsod-barrel";
const BarrelSvgFilter = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ position: "absolute", width: 0, height: 0 }}
    aria-hidden="true"
  >
    <defs>
      <filter id={BARREL_FILTER_ID} x="-5%" y="-5%" width="110%" height="110%">
        {/* turbulence gives us a subtle displacement source */}
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="blur" />
        {/* merge original + very slightly blurred to simulate lens softening at edges */}
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

/* ---------- component --------------------------------------------------- */

export function BsodScreen({ progress }: { progress: number }) {
  const eased = progress * progress;
  const pct = Math.min(100, Math.round(eased * 105));
  const fadingOut = progress > 0.92;
  const deadPixels = useMemo(() => generateDeadPixels(40), []);

  /* color-fringe offset applied via text-shadow on every text block */
  const fringeStyle = {
    textShadow: "1.5px 0 0 rgba(255,0,0,0.35), -1.5px 0 0 rgba(0,255,255,0.35)",
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 100,
        opacity: fadingOut ? Math.max(0, 1 - (progress - 0.9) * 10) : 1,
        transition: fadingOut ? "opacity 100ms" : undefined,
      }}
    >
      {/* inline SVG filter definition */}
      <BarrelSvgFilter />

      {/* ---- main BSOD content layer ---- */}
      <div
        className="absolute inset-0 flex flex-col justify-center px-[10%]"
        style={{
          background: "#0000aa",
          fontFamily: "'Courier New', 'Lucida Console', monospace",
          /* barrel distortion via perspective warp */
          perspective: "800px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        {/* inner wrapper that slightly curves toward viewer */}
        <div
          style={{
            transform: "translateZ(12px)",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className="text-white"
            style={{
              fontSize: "clamp(80px, 15vw, 160px)",
              fontWeight: 100,
              lineHeight: 1,
              fontFamily: "system-ui, -apple-system, sans-serif",
              ...fringeStyle,
            }}
          >
            ;)
          </div>
          <div
            className="text-white mt-6"
            style={{
              fontSize: "clamp(12px, 1.8vw, 20px)",
              fontWeight: 400,
              ...fringeStyle,
            }}
          >
            Your PC ran into a problem and needs to restart.
            We&apos;re just collecting some error info, and then we&apos;ll
            restart for you.
          </div>
          <div
            className="text-white mt-4"
            style={{
              fontSize: "clamp(12px, 1.8vw, 20px)",
              fontWeight: 400,
              ...fringeStyle,
            }}
          >
            {pct}% complete
          </div>
          <div
            className="text-white/60 mt-12"
            style={{
              fontSize: "clamp(8px, 1vw, 11px)",
              ...fringeStyle,
            }}
          >
            If you&apos;d like to know more, you can search online later for
            this error: ARRHYTHMIA_TRACK_OVERFLOW
          </div>
        </div>
      </div>

      {/* ---- scanlines overlay ---- */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 4px)",
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* ---- dead pixels ---- */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }} aria-hidden="true">
        {deadPixels.map((px, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${px.x}%`,
              top: `${px.y}%`,
              width: px.size,
              height: px.size,
              background: px.color,
            }}
          />
        ))}
      </div>

      {/* ---- CRT vignette (edge darkening) ---- */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)",
          zIndex: 3,
        }}
        aria-hidden="true"
      />

      {/* ---- chromatic-aberration edge overlay ---- */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            "inset 3px 0 8px rgba(255,0,0,0.12), inset -3px 0 8px rgba(0,255,255,0.12), inset 0 3px 8px rgba(255,0,255,0.08), inset 0 -3px 8px rgba(0,255,0,0.08)",
          zIndex: 4,
        }}
        aria-hidden="true"
      />

      {/* ---- screen edge curvature (inner shadow for CRT bezel feel) ---- */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "8px",
          boxShadow: "inset 0 0 60px 10px rgba(0,0,0,0.4)",
          zIndex: 5,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
