"use client";

// Reversed so the letters read "SCROLL" along the path direction.
const LETTERS = "SCROLL".split("").reverse();
const N = LETTERS.length;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// Path layout, in vh units for both axes so the arc stays circular and the line
// hugs the left edge regardless of aspect ratio.
const CX = 13, CY = 12, R = 7.5;     // arc centre + radius (around the top-left corner)
const ARC_A0 = -78, ARC_A1 = -182;   // sweep: top -> around the corner -> left (degrees)
const LINE_X = 5.5, LINE_TOP = 6, SPACING = 3.6; // straightened vertical line
const STRAIGHTEN_END = 0.18;         // arc has fully straightened by here
const DESCEND_START = 0.24;          // line starts travelling down here
const DESCEND_MAX = 126;             // vh travelled by the end (off the bottom)

function letterAt(i: number, p: number) {
  const ti = N > 1 ? i / (N - 1) : 0;
  const s = smoothstep(0, STRAIGHTEN_END, p);          // 0 = arc, 1 = straight line
  const descend = DESCEND_MAX * smoothstep(DESCEND_START, 1, p);

  // Arc placement (letters follow the curve, standing up along it).
  const angDeg = lerp(ARC_A0, ARC_A1, ti);
  const ang = (angDeg * Math.PI) / 180;
  const ax = CX + R * Math.cos(ang);
  const ay = CY + R * Math.sin(ang);
  const aRot = angDeg + 90; // tangent — settles to -90 at the corner end

  // Straightened vertical line (each letter rotated 90deg left).
  const lx = LINE_X;
  const ly = LINE_TOP + ti * SPACING;
  const lRot = -90;

  return {
    x: lerp(ax, lx, s),
    y: lerp(ay, ly, s) + descend,
    rot: lerp(aRot, lRot, s),
  };
}

export function ScrollHint({ progress, visible }: { progress: number; visible: boolean }) {
  const p = clamp01(progress);
  // Visible from the start (invites the scroll); fades out as the line leaves.
  const opacity = visible ? (1 - smoothstep(0.9, 1.0, p)) * 0.6 : 0;

  return (
    <div
      className="select-none"
      style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none", opacity, transition: "opacity 300ms ease-out" }}
    >
      {LETTERS.map((ch, i) => {
        const { x, y, rot } = letterAt(i, p);
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${x}vh`,
              top: `${y}vh`,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              transition: "left 180ms ease-out, top 180ms ease-out, transform 180ms ease-out",
              fontFamily: "'Courier New', monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#8ba8d4",
              imageRendering: "pixelated",
              willChange: "transform, left, top",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}
