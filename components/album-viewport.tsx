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
const DRAG_TARGET = { dx: -30, dy: 30 };

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

          // Cursor phases: approach (0-0.08), grab (0.08-0.12), drag (0.12-0.88), release (0.88-0.92), exit (0.92-1)
          const approach = Math.min(1, dragProgress / 0.08);
          const isDragPhase = dragProgress > 0.12 && dragProgress < 0.88;
          const isExiting = dragProgress >= 0.92;
          const dragT = Math.max(0, Math.min(1, (dragProgress - 0.12) / 0.76));

          const dx = DRAG_TARGET.dx * dragT;
          const dy = DRAG_TARGET.dy * dragT;

          // Cursor position: enters from top-right, moves to center, drags, exits bottom-left
          const startX = cx + 30;
          const startY = cy - 20;
          const endX = cx + dx - 15;
          const endY = cy + dy + 15;
          let cursorX: number, cursorY: number;
          let cursorStyle: "default" | "grab" | "grabbing";

          if (dragProgress < 0.08) {
            cursorX = startX + (cx - startX) * approach;
            cursorY = startY + (cy - startY) * approach;
            cursorStyle = "default";
          } else if (dragProgress < 0.12) {
            cursorX = cx;
            cursorY = cy;
            cursorStyle = "grab";
          } else if (dragProgress < 0.88) {
            cursorX = cx + dx;
            cursorY = cy + dy;
            cursorStyle = "grabbing";
          } else if (dragProgress < 0.92) {
            cursorX = cx + DRAG_TARGET.dx;
            cursorY = cy + DRAG_TARGET.dy;
            cursorStyle = "grab";
          } else {
            const exitT = (dragProgress - 0.92) / 0.08;
            cursorX = (cx + DRAG_TARGET.dx) + (endX - (cx + DRAG_TARGET.dx)) * exitT;
            cursorY = (cy + DRAG_TARGET.dy) + (endY - (cy + DRAG_TARGET.dy)) * exitT;
            cursorStyle = "default";
          }

          return (
            <>
              {/* Checkerboard where the selection was — visible once dragging starts */}
              {dragProgress > 0.12 && (
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
              {/* SVG outline on the moving piece */}
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
              {/* Cursor with style transitions */}
              {!isExiting || dragProgress < 0.99 ? (
                <DragCursor x={cursorX} y={cursorY} style={cursorStyle} />
              ) : null}
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
