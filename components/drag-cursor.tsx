"use client";

export function DragCursor({ x, y }: { x: number; y: number }) {
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
      <svg width="24" height="24" viewBox="0 0 16 16" shapeRendering="crispEdges">
        <rect x="0" y="0" width="1" height="1" fill="white" />
        <rect x="0" y="1" width="1" height="1" fill="white" />
        <rect x="1" y="1" width="1" height="1" fill="black" />
        <rect x="0" y="2" width="1" height="1" fill="white" />
        <rect x="1" y="2" width="1" height="1" fill="black" />
        <rect x="2" y="2" width="1" height="1" fill="black" />
        <rect x="0" y="3" width="1" height="1" fill="white" />
        <rect x="1" y="3" width="1" height="1" fill="black" />
        <rect x="2" y="3" width="1" height="1" fill="white" />
        <rect x="3" y="3" width="1" height="1" fill="black" />
        <rect x="0" y="4" width="1" height="1" fill="white" />
        <rect x="1" y="4" width="1" height="1" fill="black" />
        <rect x="2" y="4" width="1" height="1" fill="white" />
        <rect x="3" y="4" width="1" height="1" fill="white" />
        <rect x="4" y="4" width="1" height="1" fill="black" />
        <rect x="0" y="5" width="1" height="1" fill="white" />
        <rect x="1" y="5" width="1" height="1" fill="black" />
        <rect x="2" y="5" width="1" height="1" fill="white" />
        <rect x="3" y="5" width="1" height="1" fill="white" />
        <rect x="4" y="5" width="1" height="1" fill="white" />
        <rect x="5" y="5" width="1" height="1" fill="black" />
        <rect x="0" y="6" width="1" height="1" fill="white" />
        <rect x="1" y="6" width="1" height="1" fill="black" />
        <rect x="2" y="6" width="1" height="1" fill="white" />
        <rect x="3" y="6" width="1" height="1" fill="black" />
        <rect x="4" y="6" width="1" height="1" fill="black" />
        <rect x="5" y="6" width="1" height="1" fill="black" />
        <rect x="0" y="7" width="1" height="1" fill="white" />
        <rect x="1" y="7" width="1" height="1" fill="black" />
        <rect x="3" y="7" width="1" height="1" fill="white" />
        <rect x="4" y="7" width="1" height="1" fill="black" />
        <rect x="0" y="8" width="1" height="1" fill="white" />
        <rect x="1" y="8" width="1" height="1" fill="black" />
        <rect x="4" y="8" width="1" height="1" fill="white" />
        <rect x="5" y="8" width="1" height="1" fill="black" />
        <rect x="0" y="9" width="1" height="1" fill="white" />
        <rect x="1" y="9" width="1" height="1" fill="black" />
        <rect x="5" y="9" width="1" height="1" fill="white" />
        <rect x="6" y="9" width="1" height="1" fill="black" />
        <rect x="0" y="10" width="1" height="1" fill="white" />
        <rect x="1" y="10" width="1" height="1" fill="black" />
        <rect x="0" y="11" width="1" height="1" fill="black" />
      </svg>
    </div>
  );
}
