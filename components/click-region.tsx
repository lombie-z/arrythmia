"use client";

import type { AnchorPoint } from "@/lib/types";

interface ClickRegionProps {
  points: AnchorPoint[];
  trackId: string;
  isPlaying: boolean;
  onClick: () => void;
}

const EDGE_SNAP = 2;

function snap(v: number): number {
  if (v <= EDGE_SNAP) return 0;
  if (v >= 100 - EDGE_SNAP) return 100;
  return v;
}

function toClipPath(points: AnchorPoint[]): string {
  return `polygon(${points.map((p) => `${snap(p.x)}% ${snap(p.y)}%`).join(", ")})`;
}

export function ClickRegion({
  points,
  isPlaying,
  onClick,
  somethingPlaying,
}: ClickRegionProps & { somethingPlaying: boolean }) {
  const dimmed = somethingPlaying && !isPlaying;
  return (
    <div
      className="absolute inset-0 cursor-pointer"
      style={{
        clipPath: toClipPath(points),
        zIndex: 60,
        background: isPlaying
          ? "rgba(0, 212, 255, 0.06)"
          : dimmed
            ? "rgba(0, 0, 0, 0.3)"
            : "transparent",
        transition: "background 400ms ease-out",
      }}
      onClick={onClick}
    />
  );
}
