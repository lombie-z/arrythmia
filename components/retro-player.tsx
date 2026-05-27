"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ALBUM_DATA } from "@/lib/album-data";

interface RetroPlayerProps {
  selectionIndex: number;
  totalSections: number;
  onSkipForward: () => void;
  onSkipBack: () => void;
  onPlayingChange?: (playing: boolean) => void;
  autoplay?: boolean;
  isStamping?: boolean;
}

export function RetroPlayer({
  selectionIndex,
  totalSections,
  onSkipForward,
  onSkipBack,
  onPlayingChange,
  autoplay,
  isStamping,
}: RetroPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHD, setIsHD] = useState(false);
  const rafRef = useRef<number>(0);
  const wasPlayingRef = useRef(false);

  const trackIndex = Math.min(selectionIndex, ALBUM_DATA.tracks.length - 1);
  const track = ALBUM_DATA.tracks[trackIndex];
  const isLastSection = selectionIndex >= totalSections;

  const audioSrc = track
    ? isHD
      ? track.audioSrc
      : track.audioSrc.replace("/hd/", "/lo/")
    : null;

  const prevSrcRef = useRef<string | null>(null);

  useEffect(() => {
    if (audioSrc && audioSrc === prevSrcRef.current && audioRef.current) return;
    prevSrcRef.current = audioSrc;

    const prev = audioRef.current;
    const shouldContinue = wasPlayingRef.current;

    if (prev) {
      wasPlayingRef.current = !prev.paused;
      prev.pause();
      prev.removeAttribute("src");
      prev.load();
      audioRef.current = null;
    }

    setProgress(0);
    setDuration(0);
    setIsPlaying(false);

    if (!audioSrc) return;

    const audio = new Audio(audioSrc);
    audio.volume = 0.5;
    audioRef.current = audio;

    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setIsPlaying(false);
      wasPlayingRef.current = false;
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);

    if (shouldContinue) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      wasPlayingRef.current = !audio.paused;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [audioSrc]);

  useEffect(() => {
    if (!isStamping) {
      if (audioRef.current) audioRef.current.playbackRate = 1;
      return;
    }
    const interval = setInterval(() => {
      if (audioRef.current) {
        audioRef.current.playbackRate = 0.7 + Math.random() * 0.7;
      }
    }, 80);
    return () => {
      clearInterval(interval);
      if (audioRef.current) audioRef.current.playbackRate = 1;
    };
  }, [isStamping]);

  useEffect(() => {
    if (autoplay && audioRef.current && audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [autoplay]);

  useEffect(() => {
    const tick = () => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:absolute sm:left-auto sm:translate-x-0 sm:top-4 sm:right-4 sm:w-auto player-glitch-in" style={{ zIndex: 200 }} data-player>
      <div
        className="flex flex-col gap-2 sm:gap-1.5 px-4 py-3 sm:py-3 font-mono text-sm sm:text-xs"
        style={{
          background: "rgba(0, 0, 30, 0.85)",
          border: "1px solid rgba(80, 80, 255, 0.3)",
          boxShadow: "0 0 20px rgba(0, 0, 180, 0.2), inset 0 0 30px rgba(0, 0, 0, 0.5)",
          minWidth: 210,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="truncate tracking-wider" style={{ color: "#88aaff", fontSize: 10 }}>
            {track?.title ?? "—"}
          </div>
          <button
            onClick={() => setIsHD((v) => !v)}
            className="shrink-0 cursor-pointer transition-colors"
            style={{
              fontSize: 8,
              letterSpacing: "0.1em",
              padding: "1px 4px",
              border: `1px solid ${isHD ? "rgba(130, 180, 255, 0.6)" : "rgba(80, 80, 255, 0.3)"}`,
              background: isHD ? "rgba(37, 99, 235, 0.3)" : "transparent",
              color: isHD ? "#aaccff" : "#556688",
            }}
          >
            HD
          </button>
        </div>

        <div style={{ color: "#556688", fontSize: 9, textAlign: "right" }}>
          {`${formatTime(progress)} / ${formatTime(duration)}`}
        </div>

        <div
          className="relative w-full cursor-pointer"
          style={{ height: 10, background: "rgba(80, 80, 255, 0.15)" }}
          onClick={(e) => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = pct * duration;
            setProgress(pct * duration);
          }}
        >
          <div
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #2563eb, #88aaff)" }}
          />
        </div>

        <div className="flex items-center justify-center gap-8 sm:gap-6 py-1 sm:py-0" style={{ color: "#88aaff" }}>
          <button onClick={onSkipBack} className="hover:opacity-70 transition-opacity cursor-pointer text-lg sm:text-sm">⏮</button>
          <button onClick={togglePlay} className="hover:opacity-70 transition-opacity cursor-pointer text-xl sm:text-base">
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={onSkipForward} className="hover:opacity-70 transition-opacity cursor-pointer text-lg sm:text-sm">⏭</button>
        </div>
      </div>
    </div>
  );
}
