export interface AnchorPoint {
  x: number;
  y: number;
}

export interface SelectionRegion {
  id: string;
  points: AnchorPoint[];
  trackId: string;
}

export interface Track {
  id: string;
  title: string;
  audioSrc: string;
  variantImage?: string;
}

export interface CollageItem {
  imageUrl: string;
  points: AnchorPoint[];
  trail?: { dx: number; dy: number; count: number };
}

export interface Layer {
  imageUrl: string;
  selection: SelectionRegion;
  collageItems?: CollageItem[];
}

export interface AlbumSequence {
  layers: Layer[];
  finalImage: string;
  tracks: Track[];
}

export type ScrollPhase =
  | "idle"
  | "drawing"
  | "closing"
  | "masking"
  | "dissolving"
  | "dragging"
  | "dragging-in"
  | "bsod"
  | "complete";
