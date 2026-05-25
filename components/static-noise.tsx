"use client";

import { useEffect, useRef } from "react";

export function StaticNoise({ zIndex = 0 }: { zIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const scale = 4;
    let w = 0;
    let h = 0;
    let imageData: ImageData;

    function resize() {
      w = Math.ceil(canvas!.offsetWidth / scale);
      h = Math.ceil(canvas!.offsetHeight / scale);
      canvas!.width = w;
      canvas!.height = h;
      imageData = ctx!.createImageData(w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let alive = true;

    function draw() {
      if (!alive) return;
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 60) | 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v + ((Math.random() * 8) | 0);
        d[i + 3] = 255;
      }
      ctx!.putImageData(imageData, 0, 0);
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        zIndex,
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}
