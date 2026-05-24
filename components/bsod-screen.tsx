"use client";

export function BsodScreen({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.round(progress * 125));
  const flickering = pct >= 90 && progress < 0.95;
  const fadingOut = progress > 0.9;

  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center px-[10%] ${flickering ? "bsod-flicker" : ""}`}
      style={{
        zIndex: 100,
        background: "#0000aa",
        opacity: fadingOut ? Math.max(0, 1 - (progress - 0.9) * 10) : 1,
        transition: fadingOut ? "opacity 100ms" : undefined,
        fontFamily: "'Courier New', 'Lucida Console', monospace",
      }}
    >
      <div
        className="text-white"
        style={{
          fontSize: "clamp(80px, 15vw, 160px)",
          fontWeight: 100,
          lineHeight: 1,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        ;)
      </div>
      <div
        className="text-white mt-6"
        style={{
          fontSize: "clamp(12px, 1.8vw, 20px)",
          fontWeight: 400,
        }}
      >
        Your PC ran into a problem and needs to restart.
        We&apos;re just collecting some error info, and then we&apos;ll restart
        for you.
      </div>
      <div
        className="text-white mt-4"
        style={{
          fontSize: "clamp(12px, 1.8vw, 20px)",
          fontWeight: 400,
        }}
      >
        {pct}% complete
      </div>
      <div
        className="text-white/60 mt-12"
        style={{ fontSize: "clamp(8px, 1vw, 11px)" }}
      >
        If you&apos;d like to know more, you can search online later for this
        error: ARRHYTHMIA_TRACK_OVERFLOW
      </div>
    </div>
  );
}
