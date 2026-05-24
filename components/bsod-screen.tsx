"use client";

export function BsodScreen({ progress }: { progress: number }) {
  const flickering = progress > 0.7 && progress < 0.95;
  const fadingOut = progress > 0.9;

  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center px-[10%] ${flickering ? "bsod-flicker" : ""}`}
      style={{
        zIndex: 100,
        background: "#0078D7",
        opacity: fadingOut ? Math.max(0, 1 - (progress - 0.9) * 10) : 1,
        transition: fadingOut ? "opacity 100ms" : undefined,
      }}
    >
      <div
        className="text-white"
        style={{
          fontSize: "clamp(80px, 15vw, 160px)",
          fontWeight: 100,
          lineHeight: 1,
        }}
      >
        :(
      </div>
      <div
        className="text-white mt-6"
        style={{
          fontSize: "clamp(14px, 2vw, 22px)",
          fontWeight: 300,
        }}
      >
        Your PC ran into a problem and needs to restart.
        We&apos;re just collecting some error info, and then we&apos;ll restart
        for you.
      </div>
      <div
        className="text-white mt-4"
        style={{
          fontSize: "clamp(14px, 2vw, 22px)",
          fontWeight: 300,
        }}
      >
        0% complete
      </div>
      <div
        className="text-white/60 mt-12"
        style={{ fontSize: "clamp(8px, 1vw, 12px)" }}
      >
        If you&apos;d like to know more, you can search online later for this
        error: ARRHYTHMIA_TRACK_OVERFLOW
      </div>
    </div>
  );
}
