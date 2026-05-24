"use client";

import type { AnchorPoint } from "@/lib/types";

interface ImageLayerProps {
  imageUrl: string;
  clipPoints?: AnchorPoint[];
  zIndex: number;
  visible: boolean;
}

const EDGE_SNAP = 0.5;

function snap(v: number): number {
  if (v <= EDGE_SNAP) return 0;
  if (v >= 100 - EDGE_SNAP) return 100;
  return v;
}

function toClipPath(points: AnchorPoint[]): string {
  return `polygon(${points.map((p) => `${snap(p.x)}% ${snap(p.y)}%`).join(", ")})`;
}

export function ImageLayer({
  imageUrl,
  clipPoints,
  zIndex,
  visible,
}: ImageLayerProps) {
  return (
    <img
      src={imageUrl}
      alt=""
      draggable={false}
      className="absolute inset-0 w-full h-full select-none"
      style={{
        objectFit: "fill",
        clipPath: clipPoints ? toClipPath(clipPoints) : undefined,
        zIndex,
        opacity: visible ? 1 : 0,
        transition: "opacity 100ms ease-out",
        pointerEvents: "none",
      }}
    />
  );
}
