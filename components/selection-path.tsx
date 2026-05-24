"use client";

import type { AnchorPoint } from "@/lib/types";

const ANCHOR_SIZE = 7;
const HALF_ANCHOR = ANCHOR_SIZE / 2;
const LINE_COLOR = "#2563eb";
const ANCHOR_FILL = "#ffffff";
const ANCHOR_STROKE = "#2563eb";

const EDGE_THRESHOLD = 1;

function isOnEdge(p: AnchorPoint): boolean {
  return p.x <= EDGE_THRESHOLD || p.x >= 100 - EDGE_THRESHOLD ||
         p.y <= EDGE_THRESHOLD || p.y >= 100 - EDGE_THRESHOLD;
}

interface SelectionPathProps {
  points: AnchorPoint[];
  drawnSegments: number;
  dissolving: boolean;
  playing: boolean;
}

export function SelectionPath({
  points,
  drawnSegments,
  dissolving,
  playing,
}: SelectionPathProps) {
  const n = points.length;
  const clamped = Math.min(drawnSegments, n);

  const segments: { from: AnchorPoint; to: AnchorPoint; hidden: boolean }[] = [];
  for (let i = 0; i < clamped; i++) {
    const from = points[i];
    const to = points[(i + 1) % n];
    segments.push({ from, to, hidden: isOnEdge(from) && isOnEdge(to) });
  }

  const visibleAnchorCount = clamped === n ? n : Math.min(clamped + 1, n);

  const edgeFlags = points.map((p) => isOnEdge(p));
  function shouldShowAnchor(i: number): boolean {
    if (!edgeFlags[i]) return true;
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    return !edgeFlags[prev] || !edgeFlags[next];
  }

  return (
    <g
      style={{
        opacity: dissolving ? 0 : 1,
        transition: dissolving ? "opacity 80ms ease-out" : undefined,
      }}
    >
      {segments.map((seg, i) =>
        seg.hidden ? null : (
          <line
            key={`seg-${i}`}
            x1={`${seg.from.x}%`}
            y1={`${seg.from.y}%`}
            x2={`${seg.to.x}%`}
            y2={`${seg.to.y}%`}
            stroke={LINE_COLOR}
            strokeWidth={1.5}
            className={playing ? "ripple-line" : ""}
          />
        ),
      )}

      {Array.from({ length: visibleAnchorCount }).map((_, i) => {
        const p = points[i];
        if (!shouldShowAnchor(i)) return null;
        return (
          <rect
            key={`anchor-${i}`}
            x={`${p.x}%`}
            y={`${p.y}%`}
            width={ANCHOR_SIZE}
            height={ANCHOR_SIZE}
            fill={ANCHOR_FILL}
            stroke={ANCHOR_STROKE}
            strokeWidth={1}
            transform={`translate(-${HALF_ANCHOR}, -${HALF_ANCHOR})`}
            style={{ pointerEvents: "none" }}
          />
        );
      })}
    </g>
  );
}
