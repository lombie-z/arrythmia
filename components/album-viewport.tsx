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

const EDGE_SNAP = 2;
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
            {nestedLayers}
          </>
        )}

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

          const dragT = Math.max(0, Math.min(1, (p - 0.16) / 0.36));
          const dx = DRAG_TARGET.dx * dragT;
          const dy = DRAG_TARGET.dy * dragT;

          const showHoleCheckerboard = p > 0.16;
          const showMarchingAnts = p >= 0.60 && p < 0.82;
          const showFullCheckerboard = p >= 0.75;
          const deleteProgress = p >= 0.75 ? 1 : 0;

          // Cursor
          const startX = 105;
          const startY = -5;
          const restX = 75;
          const restY = 30;
          let cursorX: number, cursorY: number;
          let cursorStyle: "default" | "grab" | "grabbing";

          if (p < 0.12) {
            const t = p / 0.12;
            cursorX = startX + (cx - startX) * t;
            cursorY = startY + (cy - startY) * t;
            cursorStyle = "default";
          } else if (p < 0.16) {
            cursorX = cx;
            cursorY = cy;
            cursorStyle = "grab";
          } else if (p < 0.52) {
            cursorX = cx + dx;
            cursorY = cy + dy;
            cursorStyle = "grabbing";
          } else if (p < 0.55) {
            cursorX = cx + DRAG_TARGET.dx;
            cursorY = cy + DRAG_TARGET.dy;
            cursorStyle = "grab";
          } else if (p < 0.60) {
            const t = (p - 0.55) / 0.05;
            cursorX = (cx + DRAG_TARGET.dx) + (restX - (cx + DRAG_TARGET.dx)) * t;
            cursorY = (cy + DRAG_TARGET.dy) + (restY - (cy + DRAG_TARGET.dy)) * t;
            cursorStyle = "default";
          } else {
            cursorX = restX;
            cursorY = restY;
            cursorStyle = "default";
          }

          // Dragged piece points offset for marching ants inversion
          const draggedPts = pts.map((pt) => ({
            x: pt.x + DRAG_TARGET.dx * dragT,
            y: pt.y + DRAG_TARGET.dy * dragT,
          }));

          return (
            <>
              {/* Full-screen checkerboard "delete" — fades in behind everything */}
              {showFullCheckerboard && (
                <div
                  className="absolute inset-0 checkerboard"
                  style={{
                    zIndex: 3,
                    opacity: deleteProgress,
                  }}
                />
              )}
              {/* Checkerboard in the original selection hole */}
              {showHoleCheckerboard && (
                <div
                  className="absolute inset-0 checkerboard"
                  style={{
                    clipPath: toClipPath(pts),
                    zIndex: 15,
                  }}
                />
              )}
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
              {/* Blue highlight tint — SVG with evenodd cutout for the hole */}
              {showMarchingAnts && (
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ zIndex: 16, pointerEvents: "none" }}
                >
                  <path
                    fillRule="evenodd"
                    d={`M0,0 L100,0 L100,100 L0,100 Z M${pts[0].x},${pts[0].y} ${pts.slice(1).map((pt) => `L${pt.x},${pt.y}`).join(" ")} Z`}
                    fill="rgba(80, 130, 255, 0.2)"
                  />
                </svg>
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
              {/* Cursor — vanishes when delete happens */}
              {p < 0.75 && (
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

          {activeLayer && drawnSegments > 0 && !isDragging && (
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
