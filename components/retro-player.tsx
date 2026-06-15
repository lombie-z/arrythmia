"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ALBUM_DATA } from "@/lib/album-data";

// 4-state volume: off -> low -> normal -> high. Index 2 (normal) is the default.
const VOLUME_LEVELS = [0, 0.22, 0.5, 1.0];

// Lazily-created shared Web Audio context for the TV static hiss (resumed on the
// first gesture, which has already happened via power-on by the time you surf).
let sharedCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

function VolIcon({ level }: { level: number }) {
  const color = level === 0 ? "#667799" : "#88aaff";
  return (
    <svg viewBox="0 0 24 16" width={18} height={12} style={{ display: "block" }}>
      <path d="M2 6 H6 L11 2 V14 L6 10 H2 Z" fill={color} />
      {level === 0 ? (
        <path d="M13.5 5 L18.5 11 M18.5 5 L13.5 11" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      ) : (
        <g stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none">
          {level >= 1 && <path d="M13 5.5 Q15.3 8 13 10.5" />}
          {level >= 2 && <path d="M15.5 3.5 Q19 8 15.5 12.5" />}
          {level >= 3 && <path d="M18 1.8 Q22 8 18 14.2" />}
        </g>
      )}
    </svg>
  );
}

interface RetroPlayerProps {
  selectionIndex: number;
  totalSections: number;
  onSkipForward: () => void;
  onSkipBack: () => void;
  onPlayingChange?: (playing: boolean) => void;
  autoplay?: boolean;
  isStamping?: boolean;
  muted?: boolean;
}

export function RetroPlayer({
  selectionIndex,
  totalSections,
  onSkipForward,
  onSkipBack,
  onPlayingChange,
  autoplay,
  isStamping,
  muted,
}: RetroPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHD, setIsHD] = useState(false);
  const [volIndex, setVolIndex] = useState(2); // normal
  const volRef = useRef(VOLUME_LEVELS[2]);
  const mutedRef = useRef(!!muted);
  const rafRef = useRef<number>(0);
  const wasPlayingRef = useRef(false);

  // Keep the live audio element in sync with the chosen volume level, ducking to
  // silence while `muted` (used to mute audio during the static channel-change).
  useEffect(() => {
    volRef.current = VOLUME_LEVELS[volIndex];
    mutedRef.current = !!muted;
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volRef.current;
  }, [volIndex, muted]);

  // TV static hiss while the channel-change static is showing. White noise gated
  // by `muted` so it lasts exactly as long as the static, scaled to the chosen
  // volume so it tracks the music level (and stays silent when volume is off).
  useEffect(() => {
    if (!muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const level = VOLUME_LEVELS[volIndex] * 0.2;
    if (level <= 0) return;

    const frames = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) ch[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(level, t0 + 0.012);
    src.connect(hp).connect(gain).connect(ctx.destination);
    src.start();

    return () => {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.05);
      try { src.stop(t + 0.06); } catch {}
    };
  }, [muted, volIndex]);

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
      if (!wasPlayingRef.current) wasPlayingRef.current = !prev.paused;
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
    audio.volume = mutedRef.current ? 0 : volRef.current;
    audioRef.current = audio;

    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      wasPlayingRef.current = true;
      onSkipForward();
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);

    // While the static is showing, leave the next track cued at 0:00 and paused —
    // it's started from the top when the static clears, so it's a hard cut, not a
    // mid-stream fade-in. (Resume is handled by the `muted` effect below.)
    if (shouldContinue && !mutedRef.current) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      if (!wasPlayingRef.current) wasPlayingRef.current = !audio.paused;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [audioSrc]);

  // Hard-cut the audio across the static channel-change: pause while the static
  // shows, then play from the top when it clears (so the next song starts at
  // 0:00 instead of rolling silently underneath). A same-track scene change just
  // pauses/resumes in place; a new track is already cued at 0:00 from above.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      if (!audio.paused) {
        wasPlayingRef.current = true;
        audio.pause();
      }
    } else if (wasPlayingRef.current) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [muted]);

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
      wasPlayingRef.current = true;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      wasPlayingRef.current = false;
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
          <div className="truncate tracking-wider" style={{ color: muted ? "#556688" : "#88aaff", fontSize: 10 }}>
            {muted ? "— — —" : (track?.title ?? "—")}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setVolIndex((i) => (i + 1) % VOLUME_LEVELS.length)}
              aria-label="Volume"
              title="Volume"
              className="cursor-pointer transition-colors flex items-center"
              style={{
                padding: "1px 4px",
                border: "1px solid rgba(80, 80, 255, 0.3)",
                background: "transparent",
              }}
            >
              <VolIcon level={volIndex} />
            </button>
            <button
              onClick={() => setIsHD((v) => !v)}
              className="cursor-pointer transition-colors"
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
        </div>

        <div style={{ color: "#556688", fontSize: 9, textAlign: "right" }}>
          {muted ? "-:-- / -:--" : `${formatTime(progress)} / ${formatTime(duration)}`}
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
