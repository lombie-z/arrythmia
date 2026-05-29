"use client";

const ARROW_GRID = [
  [0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0],
  [1,0,0,1,1,0,0,1],
  [1,1,0,1,1,0,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,0],
];

export function ScrollHint({ visible }: { visible: boolean }) {
  return (
    <div
      className="absolute select-none"
      style={{
        zIndex: 100,
        pointerEvents: "none",
        opacity: visible ? 0.5 : 0,
        transition: "opacity 600ms ease-out",
        bottom: 16,
        left: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        animation: visible ? "scroll-hint-pulse 2s ease-in-out infinite" : "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "#8ba8d4",
          imageRendering: "pixelated",
        }}
      >
        SCROLL
      </div>
      <svg
        viewBox="0 0 8 10"
        width={24}
        height={30}
        style={{ imageRendering: "pixelated" }}
      >
        <g shapeRendering="crispEdges">
          {ARROW_GRID.flatMap((row, y) =>
            row.map((cell, x) => {
              if (cell === 0) return null;
              return (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  fill="#8ba8d4"
                />
              );
            }),
          )}
        </g>
      </svg>
    </div>
  );
}
