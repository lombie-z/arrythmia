"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { SmokeOverlay } from "./smoke-overlay";
import { StaticNoise } from "./static-noise";

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

interface TextStage {
  face: string;
  message: string;
  errorCode: string;
}

const STAGES: { threshold: number; content: TextStage }[] = [
  {
    threshold: 0,
    content: {
      face: ";)",
      message:
        "Your PC ran into a problem and needs to restart. We’re just collecting some error info, and then we’ll restart for you.",
      errorCode: "ARRHYTHMIA_TRACK_OVERFLOW",
    },
  },
  {
    threshold: 25,
    content: {
      face: ":/",
      message:
        "Something doesn’t feel right. Running additional diagnostics...",
      errorCode: "RHYTHM_DESYNC_DETECTED",
    },
  },
  {
    threshold: 50,
    content: {
      face: ":(",
      message:
        "Warning: Abnormal patterns detected. System integrity compromised.",
      errorCode: "CARDIAC_FAULT_0xDEAD",
    },
  },
  {
    threshold: 70,
    content: {
      face: ">:(",
      message:
        "CRITICAL: Core temperature rising. Thermal threshold exceeded.",
      errorCode: "OVERHEAT_THRESHOLD_EXCEEDED",
    },
  },
  {
    threshold: 80,
    content: {
      face: ":|",
      message: "it’s getting hot in here...",
      errorCode: "MELTDOWN_IN_PROGRESS",
    },
  },
];

function getStageIndex(pct: number): number {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (pct >= STAGES[i].threshold) return i;
  }
  return 0;
}

function GlitchText({
  children,
  active,
}: {
  children: ReactNode;
  active: boolean;
}) {
  if (!active) return <>{children}</>;
  return (
    <>
      {children}
      <div className="bsod-ghost bsod-ghost-1" aria-hidden="true">
        {children}
      </div>
      <div className="bsod-ghost bsod-ghost-2" aria-hidden="true">
        {children}
      </div>
    </>
  );
}

export function BsodScreen({ progress }: { progress: number }) {
  const eased = Math.pow(progress, 3.5);
  const pct = Math.min(100, Math.round(eased * 102));
  const deadPixels = useMemo(() => generateDeadPixels(40), []);

  const stageIdx = getStageIndex(pct);
  const stage = STAGES[stageIdx].content;

  const prevStageRef = useRef(stageIdx);
  const [showBurst, setShowBurst] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (stageIdx !== prevStageRef.current) {
      prevStageRef.current = stageIdx;
      setBurstKey((k) => k + 1);
      setShowBurst(true);
      const timer = setTimeout(() => setShowBurst(false), 300);
      return () => clearTimeout(timer);
    }
  }, [stageIdx]);

  const [randomGlitch, setRandomGlitch] = useState(false);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      if (Math.random() < 0.12) {
        setRandomGlitch(true);
        const dur = 80 + Math.random() * 170;
        timeout = setTimeout(() => setRandomGlitch(false), dur);
      }
    }, 800);
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  // Shutdown sequence at 100%
  const isShutdown = pct >= 100;
  const shutdownStart = useRef(0);
  const [shutdownMs, setShutdownMs] = useState(0);

  useEffect(() => {
    if (!isShutdown) {
      shutdownStart.current = 0;
      setShutdownMs(0);
      return;
    }
    if (!shutdownStart.current) shutdownStart.current = performance.now();
    let raf: number;
    const tick = () => {
      setShutdownMs(performance.now() - shutdownStart.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isShutdown]);

  // Scroll resistance glitch — effort derived from progress change rate
  const prevProg = useRef(progress);
  const effortRef = useRef(0);
  const [scrollEffort, setScrollEffort] = useState(0);

  const delta = Math.abs(progress - prevProg.current);
  prevProg.current = progress;
  const zone = progress > 0.95 ? 800 : progress > 0.85 ? 150 : progress > 0.7 ? 30 : progress > 0.5 ? 8 : 1;
  effortRef.current = Math.max(effortRef.current * 0.92, Math.min(1, delta * zone));

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setScrollEffort((prev) => {
        const target = effortRef.current;
        effortRef.current *= 0.95;
        const next = target > prev ? target : prev * 0.88;
        return next < 0.01 ? 0 : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isGlitching = !isShutdown && (showBurst || randomGlitch || scrollEffort > 0.05);
  const smokeIntensity = pct >= 80 ? (pct - 80) / 20 : 0;

  const effortJitterX = scrollEffort > 0.08
    ? ((Math.floor(Date.now() / 50) * 13337) % 100 - 50) / 50 * scrollEffort * 5
    : 0;

  const fringeStyle = {
    textShadow:
      "1.5px 0 0 rgba(255,0,0,0.35), -1.5px 0 0 rgba(0,255,255,0.35)",
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 100 }}>
      <div
        className="absolute inset-0 flex flex-col justify-center px-[10%]"
        style={{
          background: "#0000aa",
          fontFamily: "'Courier New', 'Lucida Console', monospace",
          perspective: "800px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            transform: "translateZ(12px)",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            key={burstKey}
            className={showBurst ? "bsod-burst" : undefined}
            style={effortJitterX ? { transform: `translateX(${effortJitterX}px)` } : undefined}
          >
            <div
              className="relative text-white"
              style={{
                fontSize: "clamp(80px, 15vw, 160px)",
                fontWeight: 100,
                lineHeight: 1,
                fontFamily: "system-ui, -apple-system, sans-serif",
                ...fringeStyle,
              }}
            >
              <GlitchText active={isGlitching}>{stage.face}</GlitchText>
            </div>

            <div
              className="relative text-white mt-6"
              style={{
                fontSize: "clamp(12px, 1.8vw, 20px)",
                fontWeight: 400,
                ...fringeStyle,
              }}
            >
              <GlitchText active={isGlitching}>{stage.message}</GlitchText>
            </div>

            <div
              className="relative text-white mt-4"
              style={{
                fontSize: "clamp(12px, 1.8vw, 20px)",
                fontWeight: 400,
                ...fringeStyle,
              }}
            >
              {pct}% complete
            </div>

            <div
              className="relative text-white/60 mt-12"
              style={{
                fontSize: "clamp(8px, 1vw, 11px)",
                ...fringeStyle,
              }}
            >
              <GlitchText active={isGlitching}>
                If you&apos;d like to know more, you can search online later for
                this error: {stage.errorCode}
              </GlitchText>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 4px)",
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
        aria-hidden="true"
      >
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

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)",
          zIndex: 3,
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            "inset 3px 0 8px rgba(255,0,0,0.12), inset -3px 0 8px rgba(0,255,255,0.12), inset 0 3px 8px rgba(255,0,255,0.08), inset 0 -3px 8px rgba(0,255,0,0.08)",
          zIndex: 4,
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "8px",
          boxShadow: "inset 0 0 60px 10px rgba(0,0,0,0.4)",
          zIndex: 5,
        }}
        aria-hidden="true"
      />

      {smokeIntensity > 0 && <SmokeOverlay intensity={smokeIntensity} />}

      {isShutdown && shutdownMs > 0 && (() => {
        /*
         *    0-1800ms   Hold at 100%
         * 1800-2000ms   CRT off: squeeze to line
         * 2000-2200ms   Line to dot
         * 2200-3800ms   Dark with static (1600ms)
         * 3800ms        BSOD unmounts → CRT on handled by ShutdownTransition
         */

        const ms = shutdownMs - 1800;
        if (ms < 0) return null;

        const offCollapse = ms < 200 ? ms / 200 : -1;
        const offDot = ms >= 200 && ms < 400 ? (ms - 200) / 200 : -1;

        let scaleX = 1;
        let scaleY = 1;
        let brightness = 0;

        if (offCollapse >= 0) {
          scaleY = 1 - offCollapse * 0.995;
          brightness = offCollapse * 0.8;
        } else if (offDot >= 0) {
          scaleY = 0.005;
          scaleX = 1 - offDot * 0.99;
          brightness = 0.8 + offDot * 0.2;
        }

        const showLine = offCollapse >= 0 || offDot >= 0;
        const isDark = ms >= 400;

        return (
          <div
            className="absolute inset-0"
            style={{ zIndex: 10, background: "rgb(2, 8, 4)" }}
          >
            {isDark && (
              <div className="absolute inset-0" style={{ opacity: 0.25 }}>
                <StaticNoise />
              </div>
            )}
            {showLine && (
              <div
                className="absolute"
                style={{
                  left: "50%",
                  top: "50%",
                  width: `${scaleX * 100}%`,
                  height: `${Math.max(2, scaleY * 100)}%`,
                  transform: "translate(-50%, -50%)",
                  background: `rgb(${Math.round(200 + brightness * 55)}, ${Math.round(200 + brightness * 55)}, ${Math.round(210 + brightness * 45)})`,
                  boxShadow: brightness > 0.3
                    ? `0 0 ${brightness * 40}px ${brightness * 15}px rgba(255,255,255,${brightness * 0.4})`
                    : "none",
                }}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
