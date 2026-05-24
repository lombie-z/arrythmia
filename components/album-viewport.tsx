"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
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
        <img
          src={layer.imageUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full select-none"
          style={{ objectFit: "fill", pointerEvents: "none" }}
        />
        {nested}
      </div>
    );
  }

  return nested;
}

export function AlbumViewport() {
  const { phase, selectionIndex, drawnSegments, dragProgress, goToSection } = useScrollHijack();
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

  const [loaded, setLoaded] = useState(false);
  const onLoadDone = useCallback(() => setLoaded(true), []);
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
      <div
        className="relative crt-bulge"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: `calc(100vh * ${ASPECT_RATIO})`,
          maxHeight: `calc(100vw / ${ASPECT_RATIO})`,
          aspectRatio: `${ASPECT_RATIO}`,
        }}
      >
        {maskApplied && <ImageLayer imageUrl={nextImage} zIndex={1} visible />}

        {maskApplied && activeLayer ? (
          <div
            className="absolute inset-0"
            style={{
              clipPath: toClipPath(activeLayer.selection.points),
              zIndex: 2,
            }}
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
        ) : (
          <>
            <ImageLayer imageUrl={currentImage} zIndex={2} visible />
            {isComplete ? (() => {
              const lastReal = [...completedLayers].reverse().find((l) => !l.collageItems);
              if (!lastReal) return null;
              return (
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
              );
            })() : nestedLayers}
          </>
        )}

        {/* Collage layer: pieces appear one at a time */}
        {activeLayer?.collageItems && !isDragging && drawnSegments > 0 && (() => {
          const items = activeLayer.collageItems!;

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

          let baseZIndex = 30;

          return (
            <>
              {items.map((item, i) => {
                const vis = itemVisibility[i];
                if (!vis.visible) {
                  // Still need to advance baseZIndex for consistency
                  baseZIndex += item.trail ? item.trail.count : 1;
                  return null;
                }

                if (item.trail) {
                  // Trail item: render N offset copies
                  const copies = vis.trailCopies;
                  const startZ = baseZIndex;
                  baseZIndex += item.trail.count;
                  return Array.from({ length: copies }).map((_, ci) => (
                    <div
                      key={`collage-${i}-trail-${ci}`}
                      className="absolute inset-0"
                      style={{
                        clipPath: toClipPath(item.points),
                        zIndex: startZ + ci,
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
                  ));
                }

                // Normal item
                const z = baseZIndex;
                baseZIndex += 1;
                return (
                  <div
                    key={`collage-${i}`}
                    className="absolute inset-0"
                    style={{
                      clipPath: toClipPath(item.points),
                      zIndex: z,
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

        {/* SVG selection outlines */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 50, pointerEvents: "none" }}
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
        {/* Scroll hint */}
        <ScrollHint visible={selectionIndex === 0 && drawnSegments === 0} />

        {/* Social links on final screen */}
        <SocialLinks visible={isComplete} />

        {/* Loading screen inside the content area */}
        {!loaded && <LoadingScreen onDone={onLoadDone} />}

        {/* Retro player — fixed on mobile (blue area), absolute on desktop (inside screen) */}
        <RetroPlayer
          selectionIndex={selectionIndex}
          totalSections={layers.length}
          onSkipForward={skipForward}
          onSkipBack={skipBack}
        />
      </div>

      {/* Nothing here — scroll hint moved inside screen */}

      <div
        className="fixed bottom-4 right-4 text-white/20 text-xs font-mono select-none"
        style={{ zIndex: 100, pointerEvents: "none" }}
      >
        {isComplete
          ? "complete"
          : `${selectionIndex + 1}/${layers.length} — ${drawnSegments}/${activeLayer?.selection.points.length ?? 0}`}
      </div>
    </div>
  );
}
