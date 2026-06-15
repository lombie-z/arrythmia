"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useScrollHijack } from "@/lib/use-scroll-hijack";
import { ALBUM_DATA } from "@/lib/album-data";
import { ASPECT_RATIO } from "@/lib/constants";
import { ImageLayer } from "./image-layer";
import { SelectionPath } from "./selection-path";
import { RetroPlayer } from "./retro-player";
import type { AnchorPoint, Layer } from "@/lib/types";
import { ScrollHint } from "./scroll-hint";
import { LoadingScreen } from "./loading-screen";
import { SocialLinks } from "./social-links";
import { DragCursor } from "./drag-cursor";
import { BsodScreen } from "./bsod-screen";
import { VhsOverlay } from "./vhs-overlay";
import { StaticNoise } from "./static-noise";


const PWR_GRID = [
  [0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0],
  [0,1,0,1,1,0,1,0],
  [1,1,0,1,1,0,1,1],
  [1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1],
  [1,1,0,0,0,0,1,1],
  [0,1,1,0,0,1,1,0],
  [0,0,1,1,1,1,0,0],
];

const PIXEL_R = [
  [0,0,0,1,0,0],
  [0,0,1,1,1,0],
  [0,1,1,0,1,0],
  [0,1,1,0,0,0],
  [0,1,1,0,0,0],
  [0,1,1,0,0,0],
  [0,1,1,0,0,0],
  [1,1,1,1,0,0],
];

function PixelSvg({ grid, size, color, glow }: { grid: number[][]; size: number; color: string; glow?: string }) {
  const w = grid[0].length;
  const h = grid.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size * w / h * (h / w)}
      height={size}
      style={{ imageRendering: "pixelated", filter: glow ? `drop-shadow(0 0 8px ${glow})` : undefined }}
    >
      <g shapeRendering="crispEdges">
        {grid.flatMap((row, y) =>
          row.map((cell, x) => {
            if (cell === 0) return null;
            return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />;
          }),
        )}
      </g>
    </svg>
  );
}

function PowerOnScreen({ onPowerOn }: { onPowerOn: () => void }) {
  const [turning, setTurning] = useState(false);
  const [ms, setMs] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!turning) return;
    startRef.current = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      setMs(elapsed);
      if (elapsed > 1200) {
        onPowerOn();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [turning, onPowerOn]);

  const handleClick = useCallback(() => {
    if (turning) return;
    try {
      const ctx = new AudioContext();
      ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(30, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
    setTurning(true);
  }, [turning]);

  const dotT = turning && ms < 200 ? ms / 200 : -1;
  const expandT = turning && ms >= 200 && ms < 400 ? (ms - 200) / 200 : -1;
  const fadeT = turning && ms >= 400 ? Math.max(0, 1 - (ms - 400) / 800) : turning ? 1 : 0;

  let sx = 1;
  let sy = 1;
  let br = 0;
  if (dotT >= 0) {
    sy = 0.005;
    sx = 0.01 + dotT * 0.99;
    br = 1 - dotT * 0.2;
  } else if (expandT >= 0) {
    sy = 0.005 + expandT * 0.995;
    sx = 1;
    br = Math.max(0, 0.8 - expandT * 0.8);
  }
  const showLine = dotT >= 0 || expandT >= 0;

  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 9999,
        cursor: turning ? "default" : "pointer",
        pointerEvents: turning && ms >= 400 ? "none" : "auto",
      }}
      onClick={handleClick}
    >
      {/* Dark background — stays solid until fade phase */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgb(2, 8, 4)",
          opacity: turning && ms >= 400 ? Math.max(0, 1 - (ms - 400) / 800) : 1,
        }}
      />
      {!turning && (
        <>
          <div className="absolute inset-0" style={{ opacity: 0.25, pointerEvents: "none" }}>
            <StaticNoise />
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 1, animation: "ghost-float 2.8s ease-in-out infinite", pointerEvents: "none" }}
          >
            <div className="flex flex-col items-center gap-6">
              <div style={{ opacity: 0.7 }}>
                <PixelSvg grid={PWR_GRID} size={72} color="#8ba8d4" glow="rgba(80, 130, 255, 0.5)" />
              </div>
              <div style={{ opacity: 0.5 }}>
                <PixelSvg grid={PIXEL_R} size={48} color="#8ba8d4" glow="rgba(80, 130, 255, 0.3)" />
              </div>
            </div>
          </div>
        </>
      )}
      {turning && (
        <>
          {ms < 400 && (
            <div className="absolute inset-0" style={{ opacity: 0.25, pointerEvents: "none" }}>
              <StaticNoise />
            </div>
          )}
          {showLine && (
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: `${sx * 100}%`,
                height: `${Math.max(2, sy * 100)}%`,
                transform: "translate(-50%, -50%)",
                background: `rgb(${Math.round(200 + br * 55)}, ${Math.round(200 + br * 55)}, ${Math.round(210 + br * 45)})`,
                boxShadow: br > 0.3
                  ? `0 0 ${br * 40}px ${br * 15}px rgba(255,255,255,${br * 0.4})`
                  : "none",
                zIndex: 2,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/** CRT turn-on overlay after BSOD shutdown — purely visual, doesn't block scroll */
function ShutdownTransition({ onDone }: { onDone: () => void }) {
  const [ms, setMs] = useState(0);
  const startRef = useRef(performance.now());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(30, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}

    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      if (elapsed > 1200) {
        onDoneRef.current();
        return;
      }
      setMs(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dotT = ms < 200 ? ms / 200 : -1;
  const expandT = ms >= 200 && ms < 400 ? (ms - 200) / 200 : -1;
  const fadeT = ms >= 400 ? Math.max(0, 1 - (ms - 400) / 800) : 1;

  let sx = 1;
  let sy = 1;
  let br = 0;
  if (dotT >= 0) {
    sy = 0.005;
    sx = 0.01 + dotT * 0.99;
    br = 1 - dotT * 0.2;
  } else if (expandT >= 0) {
    sy = 0.005 + expandT * 0.995;
    sx = 1;
    br = Math.max(0, 0.8 - expandT * 0.8);
  }
  const showLine = dotT >= 0 || expandT >= 0;

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 100,
        background: "rgb(2, 8, 4)",
        opacity: fadeT,
        pointerEvents: "none",
      }}
    >
      {ms < 400 && (
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
            width: `${sx * 100}%`,
            height: `${Math.max(2, sy * 100)}%`,
            transform: "translate(-50%, -50%)",
            background: `rgb(${Math.round(200 + br * 55)}, ${Math.round(200 + br * 55)}, ${Math.round(210 + br * 45)})`,
            boxShadow:
              br > 0.3
                ? `0 0 ${br * 40}px ${br * 15}px rgba(255,255,255,${br * 0.4})`
                : "none",
          }}
        />
      )}
    </div>
  );
}

const EDGE_SNAP = 1;
const DRAG_LAYER_INDEX = 3;
const DRAG_TARGET = { dx: -35, dy: 35 };

function snapEdge(v: number): number {
  if (v <= EDGE_SNAP) return 0;
  if (v >= 100 - EDGE_SNAP) return 100;
  return v;
}

function toClipPath(points: AnchorPoint[]): string {
  return `polygon(${points.map((p) => `${snapEdge(p.x)}% ${snapEdge(p.y)}%`).join(", ")})`;
}

const GRADIENT_LAYERS = new Set([1]);

function buildNestedLayers(
  completed: Layer[],
  draggedIndex?: number,
): ReactNode {
  let nested: ReactNode = null;

  for (let i = 0; i < completed.length; i++) {
    const layer = completed[i];
    if (layer.collageItems) continue;
    const isDragged = i === draggedIndex;

    nested = (
      <div
        key={layer.selection.id}
        className="absolute inset-0"
        style={{
          clipPath: toClipPath(layer.selection.points),
          zIndex: 10,
          transform: isDragged
            ? `translate(${DRAG_TARGET.dx}%, ${DRAG_TARGET.dy}%)`
            : undefined,
        }}
      >
        {GRADIENT_LAYERS.has(i) ? (
          <div className="absolute inset-0">
            <div className="absolute inset-0" style={{ background: "linear-gradient(to left, #16222A, #3A6073)", backgroundImage: "url(/images/static.gif)", backgroundSize: "cover" }} />
            <div className="absolute inset-0" style={{ opacity: 0.3 }}><StaticNoise /></div>
          </div>
        ) : (
          <img
            src={layer.imageUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full select-none"
            style={{ objectFit: "fill", pointerEvents: "none" }}
          />
        )}
        {nested}
      </div>
    );
  }

  return nested;
}

// How long the grey-static channel-change holds between scenes (ms). Short and
// punchy so it reads as a channel-flick, not a dwell.
const STATIC_DURATION = 320;

// useLayoutEffect on the client (fires before paint, so the static covers the
// new scene's first frame), useEffect on the server (no-op, avoids the SSR warn).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AlbumViewport() {
  const { phase, selectionIndex, drawnSegments, dragProgress, bsodProgress, sectionProgress, isStamping, goToSection, restartFromBsod, bsodSeen } = useScrollHijack();
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [staticBurst, setStaticBurst] = useState(false);
  const prevSelRef = useRef(selectionIndex);
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grey-static "channel change" between scenes. It comes on the instant the
  // scene starts masking/dissolving to the *next* image (that's the window where
  // the next scene was peeking through the cross-dissolve — the leftover flash),
  // and stays up across the swap. The auto-hide timer is only armed once we've
  // actually landed on the new scene, so it never hides mid-transition; it's
  // self-resetting and torn down only on unmount, so it can't get "stuck". A
  // *layout* effect so the static is committed before the new scene can paint.
  // masking/dissolving only occur on real scene transitions, so this stays clear
  // of the drag, BSOD and links-page flows.
  const clearStatic = useCallback(() => {
    if (staticTimerRef.current) { clearTimeout(staticTimerRef.current); staticTimerRef.current = null; }
    setStaticBurst(false);
  }, []);
  useIsoLayoutEffect(() => {
    const prev = prevSelRef.current;
    const selChanged = selectionIndex !== prev;
    prevSelRef.current = selectionIndex;

    // Never during the BSOD flow or the final links page.
    if (phase === "bsod" || phase === "complete" || selectionIndex >= ALBUM_DATA.layers.length) {
      clearStatic();
      return;
    }
    // The pre-BSOD dissolve (scene 6 before it's been seen) has its own glitch.
    const preBsod = selectionIndex === 6 && !bsodSeen;

    // `preBsod` only suppresses covering scene 6's *exit* into the BSOD (which
    // has its own glitch) — it must NOT block the hide timer when arriving, or
    // static from the previous transition would never clear.
    if ((phase === "masking" || phase === "dissolving") && !preBsod) {
      // Transition under way — cover it, don't arm the hide timer yet.
      setStaticBurst(true);
      if (staticTimerRef.current) { clearTimeout(staticTimerRef.current); staticTimerRef.current = null; }
      return;
    }

    if (selChanged) {
      // Landed on the new scene — keep static up and arm the auto-hide.
      setStaticBurst(true);
      if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
      staticTimerRef.current = setTimeout(() => {
        setStaticBurst(false);
        staticTimerRef.current = null;
      }, STATIC_DURATION);
    }
  }, [selectionIndex, phase, bsodSeen, clearStatic]);

  useEffect(() => () => {
    if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
  }, []);
  const onPlayingChange = useCallback((playing: boolean) => setIsPlaying(playing), []);
  const { layers, finalImage } = ALBUM_DATA;

  const completedLayers = layers.slice(0, selectionIndex);
  const activeLayer =
    selectionIndex < layers.length ? layers[selectionIndex] : null;

  const currentImage = activeLayer?.imageUrl ?? finalImage;
  const maskApplied = phase === "masking" || phase === "dissolving";
  const nextImage =
    selectionIndex + 1 < layers.length
      ? layers[selectionIndex + 1].imageUrl
      : finalImage;
  const isComplete = phase === "complete";

  const [poweredOn, setPoweredOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const onLoadDone = useCallback(() => setLoaded(true), []);

  // CRT turn-on transition after BSOD unmounts
  const [showCrtOn, setShowCrtOn] = useState(false);
  const prevPhaseRef = useRef(phase);
  // Reverse fade when leaving complete
  const [showReverseFade, setShowReverseFade] = useState(false);
  useEffect(() => {
    if (prevPhaseRef.current === "bsod" && phase !== "bsod") {
      setShowCrtOn(true);
    }
    if (prevPhaseRef.current === "complete" && phase !== "complete") {
      setShowReverseFade(true);
      const timer = setTimeout(() => setShowReverseFade(false), 1500);
      prevPhaseRef.current = phase;
      return () => clearTimeout(timer);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  const isDragging = phase === "dragging";
  const dragDone = selectionIndex > DRAG_LAYER_INDEX;
  const nestedLayers = buildNestedLayers(
    completedLayers,
    dragDone ? DRAG_LAYER_INDEX : undefined,
  );

  const skipForward = useCallback(() => {
    goToSection(Math.min(selectionIndex + 1, layers.length));
  }, [goToSection, selectionIndex, layers.length]);

  const skipBack = useCallback(() => {
    goToSection(Math.max(selectionIndex - 1, 0));
  }, [goToSection, selectionIndex]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bsod-bars flex items-center justify-center">
      {/* CRT barrel-warp filter — displaces the screen; corners pull in to expose the blue behind */}
      <svg aria-hidden style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="crt-warp" colorInterpolationFilters="sRGB">
          <feImage href="/crt-dispmap.png" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="36" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div
        className="relative"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: `calc(100vh * ${ASPECT_RATIO})`,
          maxHeight: `calc(100vw / ${ASPECT_RATIO})`,
          aspectRatio: `${ASPECT_RATIO}`,
          overflow: "hidden", // clip the warped/overlay content to the screen (fixes Firefox edge bar)
        }}
      >
        <div ref={containerRef} className="crt-bulge absolute inset-0">
        {maskApplied && (
          GRADIENT_LAYERS.has(selectionIndex + 1)
            ? <div className="absolute inset-0" style={{ zIndex: 1, background: "linear-gradient(to left, #16222A, #3A6073)", backgroundImage: "url(/images/static.gif)", backgroundSize: "cover" }} />
            : <ImageLayer imageUrl={nextImage} zIndex={1} visible />
        )}

        {maskApplied && activeLayer ? (
          <div
            className="absolute inset-0"
            style={{
              clipPath: toClipPath(activeLayer.selection.points),
              zIndex: 2,
            }}
          >
            {GRADIENT_LAYERS.has(selectionIndex) ? (
              <div className="absolute inset-0">
            <div className="absolute inset-0" style={{ background: "linear-gradient(to left, #16222A, #3A6073)", backgroundImage: "url(/images/static.gif)", backgroundSize: "cover" }} />
            <div className="absolute inset-0" style={{ opacity: 0.3 }}><StaticNoise /></div>
          </div>
            ) : (
              <img
                src={currentImage}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full select-none"
                style={{ objectFit: "fill", pointerEvents: "none" }}
              />
            )}
            {nestedLayers}
          </div>
        ) : (
          <>
            {isComplete ? (() => {
              const lastReal = [...completedLayers].reverse().find((l) => !l.collageItems);
              const prevImage = lastReal?.imageUrl ?? currentImage;
              return (
                <>
                  {/* Previous section's image stays as base — no change from drawing */}
                  <ImageLayer imageUrl={prevImage} zIndex={2} visible />
                  {/* Final image fades in on top, behind the selection */}
                  <img
                    src={finalImage}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full select-none complete-bg-fadein"
                    style={{ objectFit: "fill", zIndex: 5, pointerEvents: "none" }}
                  />
                  {/* Clipped selection — full opacity always, no fade */}
                  {lastReal && (
                    <div
                      className="absolute inset-0"
                      style={{ clipPath: toClipPath(lastReal.selection.points), zIndex: 10 }}
                    >
                      <img
                        src={lastReal.imageUrl}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full select-none"
                        style={{ objectFit: "fill", pointerEvents: "none" }}
                      />
                    </div>
                  )}
                </>
              );
            })() : (
              <>
                {GRADIENT_LAYERS.has(selectionIndex)
                  ? <div className="absolute inset-0" style={{ zIndex: 2, background: "linear-gradient(to left, #16222A, #3A6073)", backgroundImage: "url(/images/static.gif)", backgroundSize: "cover" }} />
                  : <ImageLayer imageUrl={currentImage} zIndex={2} visible />
                }
                {nestedLayers}
              </>
            )}
          </>
        )}

        {/* Vitriol text — massive, behind the image-1 cutout (z10) but over the bg (z2) */}
        {selectionIndex >= 1 && selectionIndex <= 1 && !isComplete && (
          <img
            src="/images/vitriol-text.webp"
            alt=""
            draggable={false}
            className="absolute inset-0 select-none"
            style={{
              width: "100%",
              height: "100%",
              zIndex: 5,
              pointerEvents: "none",
              objectFit: "contain",
              imageRendering: "pixelated",
            }}
          />
        )}

        {/* Collage layer: pieces appear one at a time */}
        {activeLayer?.collageItems && !isDragging && drawnSegments > 0 && (() => {
          const allItems = activeLayer.collageItems!;
          const items = bsodSeen ? allItems.filter((item) => !item.trail) : allItems;

          // Map drawnSegments to per-item visibility.
          // Normal items cost 1 tick. Consecutive trail items are interleaved.
          let ticksRemaining = drawnSegments;
          const itemVisibility: { visible: boolean; trailCopies: number }[] = items.map(() => ({ visible: false, trailCopies: 0 }));

          let i = 0;
          while (i < items.length && ticksRemaining > 0) {
            const item = items[i];
            if (!item.trail) {
              itemVisibility[i] = { visible: true, trailCopies: 0 };
              ticksRemaining -= 1;
              i++;
            } else {
              // Gather consecutive trail items for interleaving
              const trailGroup: number[] = [];
              let j = i;
              while (j < items.length && items[j].trail) {
                trailGroup.push(j);
                itemVisibility[j] = { visible: true, trailCopies: 0 };
                j++;
              }
              // Distribute ticks round-robin across the group
              const maxCount = Math.max(...trailGroup.map((idx) => items[idx].trail!.count));
              let tick = 0;
              while (ticksRemaining > 0 && tick < maxCount * trailGroup.length) {
                const groupIdx = tick % trailGroup.length;
                const itemIdx = trailGroup[groupIdx];
                const copyNum = Math.floor(tick / trailGroup.length);
                if (copyNum < items[itemIdx].trail!.count) {
                  itemVisibility[itemIdx].trailCopies = copyNum + 1;
                  ticksRemaining -= 1;
                }
                tick++;
              }
              i = j;
            }
          }

          // Find the last visible item for the selection outline
          let lastVisibleIndex = -1;
          let lastVisibleTrailCopies = 0;
          for (let i = items.length - 1; i >= 0; i--) {
            if (itemVisibility[i].visible) {
              lastVisibleIndex = i;
              lastVisibleTrailCopies = itemVisibility[i].trailCopies;
              break;
            }
          }

          // Build a flat render list ordered by stamp sequence for correct z-ordering
          const renderList: { itemIndex: number; copyIndex: number }[] = [];
          for (let idx = 0; idx < items.length; idx++) {
            const vis = itemVisibility[idx];
            if (!vis.visible) continue;
            if (items[idx].trail) {
              for (let ci = 0; ci < vis.trailCopies; ci++) {
                renderList.push({ itemIndex: idx, copyIndex: ci });
              }
            } else {
              renderList.push({ itemIndex: idx, copyIndex: -1 });
            }
          }
          // Sort by stamp order: interleaved trails should alternate
          // The visibility mapping already handles ordering via round-robin,
          // so we just sort by copyIndex then itemIndex for interleaved z-order
          renderList.sort((a, b) => {
            if (a.copyIndex === -1 && b.copyIndex === -1) return a.itemIndex - b.itemIndex;
            if (a.copyIndex === -1) return -1;
            if (b.copyIndex === -1) return -1;
            if (a.copyIndex !== b.copyIndex) return a.copyIndex - b.copyIndex;
            return a.itemIndex - b.itemIndex;
          });

          return (
            <>
              {renderList.map(({ itemIndex: idx, copyIndex: ci }, renderIdx) => {
                const item = items[idx];

                if (ci === -1) {
                  // Normal item
                  return (
                    <div
                      key={`collage-${idx}`}
                      className="absolute inset-0"
                      style={{
                        clipPath: toClipPath(item.points),
                        zIndex: 30 + renderIdx,
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full select-none"
                        style={{ objectFit: "fill", pointerEvents: "none" }}
                      />
                    </div>
                  );
                }

                // Trail copy with progressive distortion
                const progress = ci / (item.trail!.count - 1);
                const blur = progress * 2.5;
                const hueShift = progress * 40;
                const contrast = 1 + progress * 0.6;
                return (
                    <div
                      key={`collage-${idx}-trail-${ci}`}
                      className="absolute inset-0"
                      style={{
                        clipPath: toClipPath(item.points),
                        zIndex: 30 + renderIdx,
                        filter: ci > 0 ? `blur(${blur}px) hue-rotate(${hueShift}deg) contrast(${contrast})` : undefined,
                        transform: `translate(${ci * item.trail!.dx}%, ${ci * item.trail!.dy}%)`,
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full select-none"
                        style={{ objectFit: "fill", pointerEvents: "none" }}
                      />
                    </div>
                );
              })}
              {/* Selection outline only on the latest stamp */}
              {lastVisibleIndex >= 0 && (() => {
                const item = items[lastVisibleIndex];
                const trail = item.trail;
                // For trail items, translate the outline to match the last visible copy
                const trailOffset = trail && lastVisibleTrailCopies > 0
                  ? { x: (lastVisibleTrailCopies - 1) * trail.dx, y: (lastVisibleTrailCopies - 1) * trail.dy }
                  : null;
                return (
                  <svg
                    className="absolute inset-0 w-full h-full"
                    style={{
                      zIndex: 100,
                      pointerEvents: "none",
                      transform: trailOffset
                        ? `translate(${trailOffset.x}%, ${trailOffset.y}%)`
                        : undefined,
                    }}
                  >
                    <SelectionPath
                      points={item.points}
                      drawnSegments={item.points.length}
                      dissolving={false}
                      playing={false}
                    />
                  </svg>
                );
              })()}
            </>
          );
        })()}

        {/* Drag interlude: move piece + cursor exits */}
        {isDragging && activeLayer && (() => {
          const pts = activeLayer.selection.points;
          const p = dragProgress;

          /*
           * Timeline:
           * 0.00-0.06  Cursor holds at last SVG point
           * 0.06-0.20  Cursor moves into selection
           * 0.20-0.28  Cursor hovers (grab)
           * 0.28-0.70  Cursor drags piece (grabbing)
           * 0.70-0.76  Cursor releases (grab)
           * 0.76-0.90  Cursor exits right
           * 0.90-1.00  Hold, then transition
           */

          const dragT = Math.max(0, Math.min(1, (p - 0.28) / 0.42));
          const dx = DRAG_TARGET.dx * dragT;
          const dy = DRAG_TARGET.dy * dragT;

          const showHoleCheckerboard = p > 0.28;

          const lastPt = pts[pts.length - 1];
          const startX = lastPt.x;
          const startY = lastPt.y;
          const grabX = startX + 15;
          const grabY = startY - 5;
          const dropX = grabX + DRAG_TARGET.dx;
          const dropY = grabY + DRAG_TARGET.dy;
          let cursorX: number, cursorY: number;
          let cursorStyle: "default" | "grab" | "grabbing";

          if (p < 0.06) {
            cursorX = startX;
            cursorY = startY;
            cursorStyle = "default";
          } else if (p < 0.20) {
            const t = (p - 0.06) / 0.14;
            cursorX = startX + (grabX - startX) * t;
            cursorY = startY + (grabY - startY) * t;
            cursorStyle = "default";
          } else if (p < 0.28) {
            cursorX = grabX;
            cursorY = grabY;
            cursorStyle = "grab";
          } else if (p < 0.70) {
            cursorX = grabX + dx;
            cursorY = grabY + dy;
            cursorStyle = "grabbing";
          } else if (p < 0.76) {
            cursorX = dropX;
            cursorY = dropY;
            cursorStyle = "grab";
          } else {
            const t = Math.min(1, (p - 0.76) / 0.10);
            const ease = t * t * (3 - 2 * t);
            cursorX = dropX + (-10) * ease;
            cursorY = dropY;
            cursorStyle = "default";
          }

          return (
            <>
              {/* Checkerboard in the hole */}
              {showHoleCheckerboard && (
                <div
                  className="absolute inset-0 checkerboard"
                  style={{ clipPath: toClipPath(pts), zIndex: 15 }}
                />
              )}
              {/* The selected piece moving */}
              <div
                className="absolute inset-0"
                style={{ zIndex: 20, transform: `translate(${dx}%, ${dy}%)` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ clipPath: toClipPath(pts) }}
                >
                  <img
                    src={currentImage}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full select-none"
                    style={{ objectFit: "fill", pointerEvents: "none" }}
                  />
                  {nestedLayers}
                </div>
              </div>
              {/* SVG outline on the moving piece */}
              {p < 0.76 && (
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ zIndex: 55, pointerEvents: "none", transform: `translate(${dx}%, ${dy}%)` }}
                >
                  <SelectionPath
                    points={pts}
                    drawnSegments={pts.length}
                    dissolving={false}
                    playing={false}
                  />
                </svg>
              )}
              {/* Cursor */}
              {p < 0.92 && (
                <DragCursor x={cursorX} y={cursorY} style={cursorStyle} />
              )}
            </>
          );
        })()}

        {/* Pre-BSOD glitch storm */}
        {phase === "dissolving" && selectionIndex === 6 && !bsodSeen && (
          <div className="absolute inset-0 bsod-preglitch" style={{ zIndex: 55, pointerEvents: "none" }}>
            <div className="absolute inset-0 bsod-preglitch-flash" />
            <div className="absolute inset-0 bsod-preglitch-bars" />
            <div className="absolute inset-0 bsod-preglitch-white" />
          </div>
        )}

        {/* CRT turn-on after BSOD — scroll works underneath */}
        {showCrtOn && (
          <ShutdownTransition onDone={() => setShowCrtOn(false)} />
        )}

        {/* SVG selection outlines — lower z during complete so fade covers them */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: isComplete ? 8 : 50, pointerEvents: "none" }}
        >
          {isComplete && completedLayers.length > 0 && (() => {
            const nonCollage = completedLayers.filter((l) => !l.collageItems);
            const last = nonCollage[nonCollage.length - 1];
            if (!last) return null;
            return (
              <SelectionPath
                key={`done-${last.selection.id}`}
                points={last.selection.points}
                drawnSegments={last.selection.points.length}
                dissolving={false}
                playing={false}
              />
            );
          })()}

          {activeLayer && drawnSegments > 0 && !isDragging && !activeLayer.collageItems && (
            <SelectionPath
              points={activeLayer.selection.points}
              drawnSegments={drawnSegments}
              dissolving={phase === "dissolving" && selectionIndex < layers.length - 1}
              playing={false}
            />
          )}
        </svg>
        {/* Scroll hint — snakes around the top-left corner and down over the landing scroll */}
        <ScrollHint visible={selectionIndex === 0} progress={selectionIndex === 0 ? sectionProgress : 1} />

        <VhsOverlay active={isPlaying && phase !== "bsod"} containerRef={containerRef} />

        {/* Section progress bar */}
        {(() => {
          const barW = 10;
          const barZ = 60;
          const showGlitch = phase === "bsod" || isStamping;
          const quantized = Math.floor(sectionProgress * 15) / 15;
          if (!loaded || isComplete) return null;
          if (showGlitch) return (
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{ width: barW, zIndex: barZ, pointerEvents: "none" }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "#ff0000",
                  animation: "progress-bar-glitch 0.3s steps(1) infinite",
                }}
              />
            </div>
          );
          return (
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{ width: barW, zIndex: barZ, pointerEvents: "none" }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${quantized * 100}%`,
                  background: "rgba(255, 255, 255, 0.3)",
                  transition: phase === "idle" && sectionProgress === 0 ? "height 0.15s ease-out" : "none",
                }}
              />
            </div>
          );
        })()}

        {/* Grey-static "channel change" — inside the warp so it reads as the TV
            screen flipping channels (non-interactive, so the filter is fine).
            The dark, clipped container stays put while the inner noise layer
            rolls/squashes (vertical-hold-slip), exposing a rolling black bar —
            re-keyed per channel so the flick replays on every flip. */}
        {staticBurst && (
          <div className="absolute inset-0" style={{ zIndex: 700, pointerEvents: "none", background: "#0a0a0a", overflow: "hidden" }}>
            <div className="channel-flick absolute inset-0">
              <div className="absolute inset-0" style={{ backgroundImage: "url(/images/static.gif)", backgroundSize: "cover", filter: "grayscale(1) contrast(1.1)" }} />
              <div className="absolute inset-0" style={{ opacity: 0.5 }}><StaticNoise /></div>
            </div>
            <div className="absolute inset-0" style={{ background: "rgba(20, 20, 20, 0.2)" }} />
            <div className="channel-flash absolute inset-0" style={{ background: "#fff" }} />
          </div>
        )}

      </div>{/* end .crt-bulge (filtered scene) */}

        {/* Screen-positioned controls — NOT filtered (CSS filters break click
            hit-testing), sized to the same 4:3 screen so they keep their spots. */}
        <div className="absolute inset-0" style={{ zIndex: 400 }}>
          <SocialLinks visible={isComplete} />
          {phase !== "bsod" && <RetroPlayer
            selectionIndex={selectionIndex}
            totalSections={layers.length}
            onSkipForward={skipForward}
            onSkipBack={skipBack}
            isStamping={isStamping}
            onPlayingChange={onPlayingChange}
            muted={staticBurst}
            autoplay={(selectionIndex === 0 && loaded && poweredOn) || (selectionIndex === layers.length - 1 && showCrtOn)}
          />}
        </div>
      </div>{/* end 4:3 screen wrapper */}

      {/* Full-screen overlays — kept OUTSIDE the warp wrapper so the filter can't
          affect their rendering (they were vanishing inside it across engines). */}
      {!loaded && <LoadingScreen onDone={onLoadDone} paused={!poweredOn} />}
      {!poweredOn && <PowerOnScreen onPowerOn={() => setPoweredOn(true)} />}
      {phase === "bsod" && <BsodScreen progress={bsodProgress} onRestart={restartFromBsod} />}
    </div>
  );
}
