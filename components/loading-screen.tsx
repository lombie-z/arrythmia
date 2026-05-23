"use client";

import { useEffect, useRef, useState } from "react";
import { ALBUM_DATA } from "@/lib/album-data";

const R_PATH =
  "M47.99 108.26L47.86 41.95Q47.86 37.58 50.04 36.35L59.89 30.6Q63.03 28.69 69.46 37.3Q70.83 39.08 72.88 38.06Q74.93 37.03 72.88 34.57Q58.52 18.57 50.86 3.12Q48.54 -0.02 45.81 3.12Q38.15 12.01 31.52 16.66Q24.89 21.31 12.04 24.32Q9.58 25 9.58 26.5Q9.58 28.01 11.35 28.69Q20.51 30.19 20.38 44.41L20.38 102.25Q20.38 116.19 15.18 119.34Q9.17 123.3 5.34 116.46Q3.83 113.59 1.92 115.1Q0.01 116.6 2.06 119.88Q6.02 126.17 9.64 132.73Q13.27 139.3 17.1 145.86Q19.42 149.96 23.25 147.36Q43.35 137.66 47.31 122.75Q47.72 121.39 48.95 121.04Q50.18 120.7 51.14 121.93L72.19 146.13Q73.01 146.95 74.11 146.88Q75.2 146.82 75.88 145.72L90.24 118.24Q90.79 117.01 89.97 115.92L73.56 96.23Q72.6 95.27 71.44 95.41Q70.28 95.55 69.87 96.64L58.79 117.15Q58.25 117.97 57.09 118.17Q55.92 118.38 54.97 117.42L48.54 109.63Q47.99 109.08 47.99 108.26";

const GLYPH_W = 91;
const GLYPH_H = 150;
const MIN_DISPLAY_MS = 3500;

type Phase = "filling" | "fading-r" | "revealing";

export function LoadingScreen({
  onDone,
}: {
  onDone: () => void;
}) {
  const [fillPercent, setFillPercent] = useState(0);
  const [phase, setPhase] = useState<Phase>("filling");
  const startRef = useRef(Date.now());
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    const urls = [
      ...ALBUM_DATA.layers.map((l) => l.imageUrl),
      ALBUM_DATA.finalImage,
    ];
    let loaded = 0;
    for (const url of urls) {
      const img = new Image();
      img.src = url;
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= urls.length) setImagesReady(true);
      };
    }
  }, []);

  useEffect(() => {
    const animate = () => {
      if (doneRef.current) return;

      const elapsed = Date.now() - startRef.current;
      const canFinish = elapsed >= MIN_DISPLAY_MS && imagesReady;
      const speed = canFinish ? 0.06 : 0.012;

      setFillPercent((prev) => {
        const next = prev + speed * 16;
        if (next >= 110 && canFinish && !doneRef.current) {
          doneRef.current = true;
          setPhase("fading-r");
          setTimeout(() => {
            setPhase("revealing");
            setTimeout(onDone, 1200);
          }, 700);
          return 110;
        }
        return Math.min(next, canFinish ? 110 : 95);
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onDone]);

  const fillY = Math.max(0, GLYPH_H - (fillPercent / 100) * GLYPH_H);
  const textOpacity = Math.min(1, fillPercent / 40);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9999,
        background: "#030308",
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.015) 0px,
            rgba(255, 255, 255, 0.015) 1px,
            transparent 1px,
            transparent 4px
          )
        `,
        backgroundSize: "100% 4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase === "revealing" ? 0 : 1,
        transition: "opacity 1.2s ease-in-out",
        pointerEvents: phase === "revealing" ? "none" : "auto",
      }}
    >
      {/* Animated scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            rgba(80, 80, 255, 0.04) 0px,
            rgba(80, 80, 255, 0.04) 1px,
            transparent 1px,
            transparent 4px
          )`,
          backgroundSize: "100% 4px",
          animation: "scanlines 3s linear infinite",
          pointerEvents: "none",
        }}
      />
      {/* Noise grain */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.12, mixBlendMode: "screen" }}>
        <filter id="loading-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#loading-noise)" />
      </svg>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* R glyph */}
        <div
          style={{
            opacity: phase === "filling" ? 1 : 0,
            transition: "opacity 0.8s ease-out",
            position: "relative",
          }}
        >
          <svg
            viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`}
            style={{
              width: "min(14vw, 16vh)",
              height: `calc(min(14vw, 16vh) * ${GLYPH_H} / ${GLYPH_W})`,
              overflow: "visible",
            }}
          >
            <defs>
              <clipPath id="r-clip">
                <path
                  d={R_PATH}
                  transform={`scale(1,-1) translate(0,${-GLYPH_H})`}
                />
              </clipPath>
              <filter id="r-distort">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.04"
                  numOctaves="4"
                  seed="2"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="3"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>

            {/* Depth outline */}
            <path
              d={R_PATH}
              transform={`scale(1,-1) translate(-6,${-GLYPH_H - 8})`}
              fill="none"
              stroke="rgba(40, 40, 180, 0.25)"
              strokeWidth={1.5}
            />

            {/* Fill clipped to R shape */}
            <g clipPath="url(#r-clip)" filter="url(#r-distort)">
              {/* Main fill */}
              <rect
                x={0}
                y={fillY}
                width={GLYPH_W}
                height={GLYPH_H + 10}
                fill="rgba(30, 30, 180, 0.85)"
              />
              {/* Scanlines baked into the R fill */}
              {Array.from({ length: Math.ceil(GLYPH_H / 3) }).map((_, i) => (
                <rect
                  key={i}
                  x={0}
                  y={fillY + i * 3}
                  width={GLYPH_W}
                  height={1}
                  fill="rgba(100, 100, 255, 0.3)"
                />
              ))}
              {/* Highlight edge — hide when fill reaches top */}
              {fillY > 2 && (
                <>
                  <rect
                    x={0}
                    y={fillY}
                    width={GLYPH_W}
                    height={4}
                    fill="rgba(100, 100, 255, 0.6)"
                  />
                  <rect
                    x={0}
                    y={fillY + 4}
                    width={GLYPH_W}
                    height={2}
                    fill="rgba(20, 20, 120, 0.4)"
                  />
                </>
              )}
            </g>

            {/* R outline */}
            <path
              d={R_PATH}
              transform={`scale(1,-1) translate(0,${-GLYPH_H})`}
              fill="none"
              stroke="rgba(80, 80, 255, 0.2)"
              strokeWidth={0.8}
            />
          </svg>

          {/* Ambient glow */}
          <div
            style={{
              position: "absolute",
              inset: "-60%",
              background: `radial-gradient(ellipse at center, rgba(40, 40, 220, ${0.15 * Math.min(1, fillPercent / 60)}) 0%, transparent 70%)`,
              pointerEvents: "none",
              transform: `scale(${0.6 + (fillPercent / 100) * 0.6})`,
            }}
          />
        </div>

        {/* "arrhythmia" text — vertical character stack */}
        <div
          style={{
            opacity: textOpacity,
            transition: "opacity 0.6s ease-out",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontFamily: "'Courier New', 'Lucida Console', monospace",
            fontSize: "clamp(0.7rem, 1.4vw, 1rem)",
            letterSpacing: "0.15em",
            color: "rgba(130, 150, 255, 0.8)",
            textTransform: "uppercase",
            lineHeight: 1.6,
            width: "1.2em",
            wordBreak: "break-all",
            textAlign: "center",
          }}
        >
          {"arrhythmia".split("").map((ch, i) => (
            <span key={i} style={{ display: "block" }}>
              {ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
