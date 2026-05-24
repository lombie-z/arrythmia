"use client";

type CursorStyle = "default" | "grab" | "grabbing";

const CURSORS: Record<CursorStyle, string> = {
  default:
    "M0,0 L0,11 L3,8 L6,13 L8,12 L5,7 L9,7 Z",
  grab:
    "M4,8 L4,4 L6,4 L6,3 L8,3 L8,4 L10,4 L10,3 L12,3 L12,4 L14,4 L14,5 L15,5 L15,10 L14,13 L4,13 L3,11 L3,9 Z",
  grabbing:
    "M4,8 L4,6 L6,6 L6,5 L8,5 L8,6 L10,6 L10,5 L12,5 L12,6 L14,6 L14,7 L15,7 L15,12 L14,14 L4,14 L3,12 L3,9 Z",
};

export function DragCursor({
  x,
  y,
  style,
}: {
  x: number;
  y: number;
  style: CursorStyle;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: 90,
        transform: "translate(-2px, -2px)",
        imageRendering: "pixelated",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
      >
        <path d={CURSORS[style]} fill="white" stroke="black" strokeWidth={0.8} />
      </svg>
    </div>
  );
}
