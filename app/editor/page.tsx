"use client";

import { useCallback, useRef, useState } from "react";
import { ALBUM_DATA } from "@/lib/album-data";

interface Point {
  x: number;
  y: number;
}

const LINE_COLOR = "#2563eb";
const LOCKED_COLOR = "#2563eb";

export default function Editor() {
  const [points, setPoints] = useState<Point[]>([]);
  const [allSelections, setAllSelections] = useState<Point[][]>([]);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [visibleExisting, setVisibleExisting] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const existingSelections = ALBUM_DATA.layers.map((l) => ({
    id: l.selection.id,
    trackId: l.selection.trackId,
    points: l.selection.points,
    imageUrl: l.imageUrl,
  }));

  const toggleExisting = (index: number) => {
    setVisibleExisting((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = +((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      const y = +((e.clientY - rect.top) / rect.height * 100).toFixed(1);
      setPoints((prev) => [...prev, { x, y }]);
    },
    [],
  );

  const finishSelection = () => {
    if (points.length < 3) return;
    setAllSelections((prev) => [...prev, points]);
    setPoints([]);
  };

  const undoPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const undoSelection = () => {
    if (allSelections.length === 0) return;
    const last = allSelections[allSelections.length - 1];
    setAllSelections((prev) => prev.slice(0, -1));
    setPoints(last);
  };

  const exportData = () => {
    const all = points.length >= 3 ? [...allSelections, points] : allSelections;
    return all
      .map(
        (sel, i) =>
          `// Selection ${i + 1} (${sel.length} points)\n[\n${sel.map((p) => `  { x: ${p.x}, y: ${p.y} },`).join("\n")}\n]`,
      )
      .join("\n\n");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setBgImage(url);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgImage(url);
  }, []);

  return (
    <div className="fixed inset-0 flex bg-neutral-950 text-white">
      {/* Canvas area */}
      <div
        className="flex-1 relative flex items-center justify-center bg-neutral-950 overflow-hidden"
        style={{ containerType: "size" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div
          ref={containerRef}
          className="relative cursor-crosshair"
          onClick={handleClick}
          style={{
            aspectRatio: "4 / 3",
            width: "100%",
            height: "100%",
            maxWidth: `calc(100cqh * ${4 / 3})`,
            maxHeight: `calc(100cqw / ${4 / 3})`,
            backgroundImage: bgImage ? `url(${bgImage})` : undefined,
            backgroundSize: "100% 100%",
          }}
        >
          {!bgImage && (
            <div className="absolute inset-0 flex items-center justify-center text-white/30 text-lg">
              drop an image here or use the file picker →
            </div>
          )}

          {/* Nested clipped images matching site compositing */}
          {(() => {
            const visible = existingSelections
              .map((sel, i) => ({ ...sel, index: i }))
              .filter((_, i) => visibleExisting.has(i));
            if (visible.length === 0) return null;

            let nested: React.ReactNode = null;
            for (let i = 0; i < visible.length; i++) {
              const sel = visible[i];
              nested = (
                <div
                  key={`nest-${sel.index}`}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    clipPath: `polygon(${sel.points.map((p) => `${p.x}% ${p.y}%`).join(", ")})`,
                  }}
                >
                  <img
                    src={sel.imageUrl}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full select-none"
                    style={{ objectFit: "fill" }}
                  />
                  {nested}
                </div>
              );
            }
            return nested;
          })()}

          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Existing selections from album-data (locked, rendered as lines) */}
            {existingSelections.map((sel, si) => {
              if (!visibleExisting.has(si)) return null;
              const pts = sel.points;
              return (
                <g key={`existing-${si}`} opacity={0.5}>
                  {pts.map((p, pi) => {
                    const next = pts[(pi + 1) % pts.length];
                    return (
                      <line
                        key={`line-${pi}`}
                        x1={`${p.x}%`}
                        y1={`${p.y}%`}
                        x2={`${next.x}%`}
                        y2={`${next.y}%`}
                        stroke={LOCKED_COLOR}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                      />
                    );
                  })}
                  {pts.map((p, pi) => (
                    <rect
                      key={`anchor-${pi}`}
                      x={`${p.x}%`}
                      y={`${p.y}%`}
                      width={5}
                      height={5}
                      fill="none"
                      stroke={LOCKED_COLOR}
                      strokeWidth={1}
                      transform="translate(-2.5, -2.5)"
                    />
                  ))}
                  <text
                    x={`${pts.reduce((s, p) => s + p.x, 0) / pts.length}%`}
                    y={`${pts.reduce((s, p) => s + p.y, 0) / pts.length}%`}
                    fill="rgba(255,255,255,0.4)"
                    fontSize={12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {si + 1}
                  </text>
                </g>
              );
            })}

            {/* New completed selections */}
            {allSelections.map((sel, si) => (
              <g key={`new-${si}`}>
                {sel.map((p, pi) => {
                  const next = sel[(pi + 1) % sel.length];
                  return (
                    <line
                      key={`line-${pi}`}
                      x1={`${p.x}%`}
                      y1={`${p.y}%`}
                      x2={`${next.x}%`}
                      y2={`${next.y}%`}
                      stroke={LINE_COLOR}
                      strokeWidth={1.5}
                    />
                  );
                })}
                {sel.map((p, pi) => (
                  <rect
                    key={`anchor-${pi}`}
                    x={`${p.x}%`}
                    y={`${p.y}%`}
                    width={7}
                    height={7}
                    fill="#fff"
                    stroke={LINE_COLOR}
                    strokeWidth={1}
                    transform="translate(-3.5, -3.5)"
                  />
                ))}
                <text
                  x={`${sel.reduce((s, p) => s + p.x, 0) / sel.length}%`}
                  y={`${sel.reduce((s, p) => s + p.y, 0) / sel.length}%`}
                  fill="white"
                  fontSize={14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {existingSelections.length + si + 1}
                </text>
              </g>
            ))}

            {/* Current selection in progress */}
            {points.map((p, i) => {
              const next = points[i + 1];
              return (
                <g key={i}>
                  {next && (
                    <line
                      x1={`${p.x}%`}
                      y1={`${p.y}%`}
                      x2={`${next.x}%`}
                      y2={`${next.y}%`}
                      stroke={LINE_COLOR}
                      strokeWidth={1.5}
                    />
                  )}
                  <rect
                    x={`${p.x}%`}
                    y={`${p.y}%`}
                    width={7}
                    height={7}
                    fill={i === 0 ? "#ff4444" : "#fff"}
                    stroke={LINE_COLOR}
                    strokeWidth={1}
                    transform="translate(-3.5, -3.5)"
                  />
                </g>
              );
            })}
          </svg>

          {/* Coordinate readout */}
          <div className="absolute top-3 left-3 text-xs font-mono text-white/50 pointer-events-none">
            {points.length} points · {allSelections.length} new
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l border-white/10 flex flex-col p-4 gap-3 overflow-y-auto">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-white/60">
          Selection Editor
        </h2>

        <label className="block text-xs text-white/40 cursor-pointer border border-dashed border-white/20 rounded px-3 py-2 text-center hover:border-white/40 transition-colors">
          choose image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </label>

        <div className="text-xs text-white/40 uppercase tracking-wide">
          Existing selections
        </div>
        <div className="flex flex-col gap-1">
          {existingSelections.map((sel, i) => (
            <label key={i} className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={visibleExisting.has(i)}
                onChange={() => toggleExisting(i)}
                className="rounded"
              />
              {i + 1}. {sel.trackId} ({sel.points.length} pts)
            </label>
          ))}
        </div>

        <hr className="border-white/10" />

        <div className="flex gap-2">
          <button
            onClick={undoPoint}
            disabled={points.length === 0}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
          >
            undo point
          </button>
          <button
            onClick={finishSelection}
            disabled={points.length < 3}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition-colors"
          >
            close selection
          </button>
        </div>

        <button
          onClick={undoSelection}
          disabled={allSelections.length === 0 && points.length === 0}
          className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
        >
          undo last selection
        </button>

        <button
          onClick={() => { setPoints([]); setAllSelections([]); }}
          className="text-xs px-3 py-1.5 rounded bg-red-900/50 hover:bg-red-900 transition-colors"
        >
          clear all
        </button>

        <hr className="border-white/10" />

        <div className="text-xs text-white/40 uppercase tracking-wide">
          Export
        </div>
        <pre className="text-[10px] font-mono text-white/70 bg-white/5 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap select-all">
          {exportData() || "// click on the image to place points"}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(exportData())}
          className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          copy to clipboard
        </button>
      </div>
    </div>
  );
}
