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
  const { phase, selectionIndex, drawnSegments, dragProgress, dragInProgress, goToSection } = useScrollHijack();
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
  const isDraggingIn = phase === "dragging-in";
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
        {!isDraggingIn && maskApplied && <ImageLayer imageUrl={nextImage} zIndex={1} visible />}

        {!isDraggingIn && maskApplied && activeLayer ? (
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
        ) : !isDraggingIn ? (
          <>
            <ImageLayer imageUrl={currentImage} zIndex={2} visible />
            {!isComplete && nestedLayers}
          </>
        ) : null}

        {/* Collage layer: pieces appear one at a time */}
        {activeLayer?.collageItems && !isDragging && !isDraggingIn && drawnSegments > 0 && (() => {
          const items = activeLayer.collageItems!;
          const visibleCount = Math.min(drawnSegments, items.length);
          return (
            <>
              {items.slice(0, visibleCount).map((item, i) => (
                <div
                  key={`collage-${i}`}
                  className="absolute inset-0"
                  style={{
                    clipPath: toClipPath(item.points),
                    zIndex: 30 + i,
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
              ))}
              {/* Selection outline only on the last dropped piece */}
              {visibleCount > 0 && visibleCount <= items.length && (
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ zIndex: 50, pointerEvents: "none" }}
                >
                  <SelectionPath
                    points={items[visibleCount - 1].points}
                    drawnSegments={items[visibleCount - 1].points.length}
                    dissolving={false}
                    playing={false}
                  />
                </svg>
              )}
            </>
          );
        })()}

        {/* Drag interlude: checkerboard hole + moving selection piece + cursor */}
        {isDragging && activeLayer && (() => {
          const pts = activeLayer.selection.points;
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          const p = dragProgress;

          /*
           * Timeline:
           * 0.00-0.12  Cursor approaches from top-right
           * 0.12-0.16  Cursor hovers selection (grab)
           * 0.16-0.52  Cursor drags piece to bottom-left (grabbing)
           * 0.52-0.55  Cursor releases (grab)
           * 0.55-0.60  Cursor moves to center of remaining area (default)
           * 0.60-0.65  "Select inverse" — marching ants appear on rest of image
           * 0.65-0.75  Marching ants hold
           * 0.75-0.82  "Delete" — rest of image becomes checkerboard
           * 0.82-0.90  Cursor exits left
           * 0.90-1.00  Hold, then transition
           */

          const dragT = Math.max(0, Math.min(1, (p - 0.20) / 0.30));
          const dx = DRAG_TARGET.dx * dragT;
          const dy = DRAG_TARGET.dy * dragT;

          const showHoleCheckerboard = p > 0.20;
          const showMarchingAnts = p >= 0.66 && p < 0.82;
          const showFullCheckerboard = p >= 0.82;
          const deleteProgress = p >= 0.82 ? 1 : 0;

          // Cursor starts from last SVG anchor, moves right into selection to grab
          const lastPt = pts[pts.length - 1];
          const startX = lastPt.x;
          const startY = lastPt.y;
          const grabX = startX + 15;
          const grabY = startY - 5;
          const dropX = grabX + DRAG_TARGET.dx;
          const dropY = grabY + DRAG_TARGET.dy;
          const restX = dropX + 22;
          const restY = dropY - 8;
          let cursorX: number, cursorY: number;
          let cursorStyle: "default" | "grab" | "grabbing";

          if (p < 0.04) {
            // Hold still at start
            cursorX = startX;
            cursorY = startY;
            cursorStyle = "default";
          } else if (p < 0.14) {
            // Move into selection
            const t = (p - 0.04) / 0.10;
            cursorX = startX + (grabX - startX) * t;
            cursorY = startY + (grabY - startY) * t;
            cursorStyle = "default";
          } else if (p < 0.20) {
            // Hold with grab cursor
            cursorX = grabX;
            cursorY = grabY;
            cursorStyle = "grab";
          } else if (p < 0.50) {
            // Drag
            cursorX = grabX + dx;
            cursorY = grabY + dy;
            cursorStyle = "grabbing";
          } else if (p < 0.56) {
            // Hold after release
            cursorX = dropX;
            cursorY = dropY;
            cursorStyle = "grab";
          } else if (p < 0.62) {
            // Move outward
            const t = (p - 0.56) / 0.06;
            cursorX = dropX + (restX - dropX) * t;
            cursorY = dropY + (restY - dropY) * t;
            cursorStyle = "default";
          } else if (p < 0.82) {
            // Hold at rest (during ants + highlight)
            cursorX = restX;
            cursorY = restY;
            cursorStyle = "default";
          } else {
            // Exit to the right and up, eased
            const t = Math.min(1, (p - 0.82) / 0.18);
            const ease = t * t * (3 - 2 * t);
            cursorX = restX + (110 - restX) * ease;
            cursorY = restY + (50 - restY) * ease + Math.sin(t * Math.PI) * -8;
            cursorStyle = "default";
          }

          // Dragged piece points offset for marching ants inversion
          const draggedPts = pts.map((pt) => ({
            x: pt.x + DRAG_TARGET.dx * dragT,
            y: pt.y + DRAG_TARGET.dy * dragT,
          }));

          return (
            <>
              {/* Single checkerboard — starts clipped to hole, expands to full screen on delete */}
              <div
                className="absolute inset-0 checkerboard"
                style={{
                  zIndex: 15,
                  clipPath: showFullCheckerboard ? undefined : (showHoleCheckerboard ? toClipPath(pts) : "polygon(0 0, 0 0, 0 0)"),
                }}
              />
              {/* The selected piece — moves during drag phase */}
              <div
                className="absolute inset-0"
                style={{
                  zIndex: 20,
                  transform: `translate(${dx}%, ${dy}%)`,
                }}
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
              {/* Blue highlight + marching ants on edges and hole */}
              {showMarchingAnts && (
                <>
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{ zIndex: 16, pointerEvents: "none" }}
                  >
                    <path
                      fillRule="evenodd"
                      d={`M0,0 L100,0 L100,100 L0,100 Z M${snapEdge(pts[0].x)},${snapEdge(pts[0].y)} ${pts.slice(1).map((pt) => `L${snapEdge(pt.x)},${snapEdge(pt.y)}`).join(" ")} Z`}
                      fill="rgba(80, 130, 255, 0.2)"
                    />
                  </svg>
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{ zIndex: 17, pointerEvents: "none" }}
                  >
                    {/* Ants around viewport edge */}
                    <rect
                      x="0.2" y="0.2" width="99.6" height="99.6"
                      fill="none" stroke="#6ca6ff" strokeWidth="0.3"
                      className="marching-ants"
                    />
                    {/* Ants around the original selection hole — use snapped coords */}
                    <polygon
                      points={pts.map((pt) => `${snapEdge(pt.x)},${snapEdge(pt.y)}`).join(" ")}
                      fill="none" stroke="#6ca6ff" strokeWidth="0.3"
                      className="marching-ants"
                    />
                  </svg>
                </>
              )}
              {/* SVG outline on the moving piece — hide once select inverse starts */}
              {p < 0.60 && (
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{
                    zIndex: 55,
                    pointerEvents: "none",
                    transform: `translate(${dx}%, ${dy}%)`,
                  }}
                >
                  <SelectionPath
                    points={pts}
                    drawnSegments={pts.length}
                    dissolving={false}
                    playing={false}
                  />
                </svg>
              )}
              {/* Cursor — stays until next scene */}
              <DragCursor x={cursorX} y={cursorY} style={cursorStyle} />
            </>
          );
        })()}

        {/* Drag-in: new image slides in from right onto checkerboard */}
        {isDraggingIn && (() => {
          const p = dragInProgress;
          const slideX = 100 * (1 - p);
          const cursorX = slideX + 5;
          const cursorY = 50;

          return (
            <>
              {/* Checkerboard base */}
              <div
                className="absolute inset-0 checkerboard"
                style={{ zIndex: 3 }}
              />
              {/* New image sliding in from right — under the Fantasia piece */}
              <div
                className="absolute inset-0"
                style={{
                  zIndex: 5,
                  transform: `translateX(${slideX}%)`,
                }}
              >
                <img
                  src={currentImage}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full select-none"
                  style={{ objectFit: "fill", pointerEvents: "none" }}
                />
              </div>
              {/* Previous dragged piece on top */}
              {nestedLayers}
              {/* Cursor on top of everything */}
              <DragCursor x={cursorX} y={cursorY} style="grabbing" />
            </>
          );
        })()}

        {/* SVG selection outlines */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 50, pointerEvents: "none" }}
        >
          {isComplete && completedLayers.length > 0 && (() => {
            const last = completedLayers[completedLayers.length - 1];
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
              dissolving={phase === "dissolving"}
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
