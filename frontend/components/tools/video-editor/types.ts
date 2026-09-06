export type MediaType = "video" | "image" | "audio";

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  file: File;
  objectUrl: string;
  duration: number; // in seconds (for images, defaults to 3.0s)
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  filmstripFrames?: string[]; // Multiple sample frames across duration for timeline filmstrips
  size: number;
}

export type AspectRatioPreset = "16:9" | "9:16" | "1:1" | "4:5" | "original";

export type TransitionType =
  | "none"
  | "fade"
  | "dissolve"
  | "crossfade"
  | "wipe"
  | "wipe_left"
  | "wipe_right"
  | "slide_left"
  | "slide_right"
  | "zoom"
  | "blur";

export interface ClipTransition {
  type: TransitionType;
  duration: number; // in seconds, typically 0.5s - 1.0s
}

export interface VideoClip {
  id: string;
  assetId: string;
  name: string;
  type: "video" | "image";
  timelineStart: number; // timeline time in seconds where clip starts
  trackId?: string;      // track identifier e.g. "video_1"
  sourceDuration: number;
  startTrim: number; // seconds within the source asset
  endTrim: number;   // seconds within the source asset
  speed: number;     // 0.25 to 4.0
  isReversed: boolean;
  volume: number;    // 0.0 to 2.0 (1.0 = 100%)
  isMuted: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;

  // Transforms
  scale: number;        // 0.5 to 3.0 (default 1.0)
  rotation: number;     // 0 - 360 degrees
  flipHorizontal: boolean;
  flipVertical: boolean;
  offsetX: number;      // percentage offset (-50 to 50)
  offsetY: number;      // percentage offset (-50 to 50)
  opacity: number;      // 0.0 to 1.0 (default 1.0)
  cropPreset: "original" | "16:9" | "9:16" | "1:1" | "4:5" | "custom";

  filmstripFrames?: string[];

  // Filters & Adjustments
  filterPreset: FilterPreset | string;
  brightness: number;   // -100 to 100 (default 0)
  contrast: number;     // -100 to 100 (default 0)
  saturation: number;   // -100 to 100 (default 0)
  exposure?: number;    // -100 to 100
  temperature?: number; // -100 to 100
  tint?: number;        // -100 to 100
  highlights?: number;  // -100 to 100
  shadows?: number;     // -100 to 100
  vignette?: number;    // 0 to 100
  grain?: number;       // 0 to 100
  filterIntensity?: number; // 0 to 100

  // Transition to next clip
  transition?: ClipTransition;
}

export type FilterPreset =
  | "original"
  | "warm"
  | "cool"
  | "vintage"
  | "bw"
  | "fade"
  | "bright"
  | "contrast"
  | "cinematic"
  | "retro"
  | "film"
  | "soft";

export interface AudioTrackItem {
  id: string;
  assetId: string;
  name: string;
  sourceDuration: number;
  timelineStart: number; // timeline time when audio begins
  trackId?: string;
  startTrim: number;
  duration: number;      // duration played on timeline
  volume: number;        // 0.0 to 2.0 (1.0 = 100%)
  isMuted: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  voiceEffect?: "none" | "deep" | "high" | "robot" | "echo" | "radio";
  noiseReduction?: boolean;
}

export type TextAnimationType =
  | "none"
  | "fade"
  | "slide_bottom"
  | "slide_top"
  | "slide_left"
  | "slide_right"
  | "scale_up";

export interface TextLayerItem {
  id: string;
  text: string;
  timelineStart: number;
  trackId?: string;
  duration: number;
  fontSize: number;       // in pt / px
  fontColor: string;      // hex e.g. #ffffff
  fontFamily?: string;    // font-family name
  backgroundColor?: string; // hex or rgba
  strokeColor?: string;   // text outline stroke
  strokeWidth?: number;   // stroke width in px
  shadowColor?: string;   // text drop shadow
  shadowBlur?: number;    // blur radius
  alignment: "left" | "center" | "right";
  isBold: boolean;
  isItalic: boolean;
  animation: TextAnimationType;
  positionX: number;      // percentage 0 - 100 (center = 50)
  positionY: number;      // percentage 0 - 100 (bottom subtitle = 82)
}

export interface OverlayLayerItem {
  id: string;
  assetId: string;
  name: string;
  timelineStart: number;
  trackId?: string;
  duration: number;
  scale: number;          // 0.1 to 2.0
  opacity: number;        // 0.0 to 1.0
  positionX: number;      // % 0 - 100
  positionY: number;      // % 0 - 100
  rotation: number;       // 0 - 360
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
}

export interface TrackControls {
  video: { visible: boolean; locked: boolean };
  audio: { visible: boolean; locked: boolean };
  text: { visible: boolean; locked: boolean };
  overlay: { visible: boolean; locked: boolean };
}

export interface ProjectSettings {
  aspectRatio: AspectRatioPreset;
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  snapEnabled?: boolean;
}

export interface VideoProject {
  id: string;
  title: string;
  settings: ProjectSettings;
  assets: MediaAsset[];
  clips: VideoClip[];
  audioTracks: AudioTrackItem[];
  textLayers: TextLayerItem[];
  overlayLayers: OverlayLayerItem[];
  trackControls: TrackControls;
}

export interface ExportSettings {
  format: "mp4" | "webm" | "mov";
  resolution: "original" | "1440p" | "1080p" | "720p" | "480p";
  quality: "high" | "medium" | "low";
  fps: number;
  codec?: "h264" | "h265" | "vp9";
  bitrate?: "auto" | "high" | "medium";
}

export type SidebarTab =
  | "media"
  | "audio"
  | "text"
  | "stickers"
  | "filters"
  | "effects"
  | "transitions"
  | "captions"
  | "settings";

export type ClipPropertyTab = "video" | "audio" | "speed" | "adjust";

export type MobileSheetType =
  | null
  | "media"
  | "properties"
  | "clip_edit"
  | "audio"
  | "text"
  | "stickers"
  | "filters"
  | "adjust"
  | "speed"
  | "effects"
  | "transitions"
  | "captions"
  | "settings"
  | "export";

export type ActiveToolTab = SidebarTab;
