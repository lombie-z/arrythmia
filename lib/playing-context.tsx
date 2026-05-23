"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ALBUM_DATA } from "./album-data";

interface PlayingState {
  playingId: string | null;
  toggle: (trackId: string) => void;
  volume: number;
  setVolume: (v: number) => void;
}

const PlayingContext = createContext<PlayingState>({
  playingId: null,
  toggle: () => {},
  volume: 0.5,
  setVolume: () => {},
});

export function PlayingProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = useCallback(
    (trackId: string) => {
      if (playingId === trackId) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const track = ALBUM_DATA.tracks.find((t) => t.id === trackId);
      if (!track) return;

      const audio = new Audio(track.audioSrc);
      audio.volume = volume;
      audio.play().catch(() => {});
      audio.addEventListener("ended", () => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(trackId);
    },
    [playingId, volume],
  );

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <PlayingContext.Provider value={{ playingId, toggle, volume, setVolume }}>
      {children}
    </PlayingContext.Provider>
  );
}

export function usePlaying() {
  return useContext(PlayingContext);
}
