import {
  AudioTrackItem,
  MediaAsset,
  OverlayLayerItem,
  TextLayerItem,
  VideoClip,
  VideoProject,
} from "../types";

export function createDefaultClip(asset: MediaAsset): VideoClip {
  const duration = asset.duration > 0 ? asset.duration : 3.0;
  return {
    id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    assetId: asset.id,
    name: asset.name,
    type: asset.type === "image" ? "image" : "video",
    sourceDuration: duration,
    startTrim: 0,
    endTrim: duration,
    speed: 1.0,
    isReversed: false,
    volume: 1.0,
    isMuted: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    scale: 1.0,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    offsetX: 0,
    offsetY: 0,
    filterPreset: "original",
    brightness: 0,
    contrast: 0,
    saturation: 0,
  };
}

export function createDefaultAudioTrack(asset: MediaAsset, timelineStart: number = 0): AudioTrackItem {
  const duration = asset.duration > 0 ? asset.duration : 10.0;
  return {
    id: `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    assetId: asset.id,
    name: asset.name,
    sourceDuration: duration,
    timelineStart: Math.max(0, timelineStart),
    startTrim: 0,
    duration: duration,
    volume: 1.0,
    isMuted: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
  };
}

export function createDefaultTextLayer(timelineStart: number = 0, duration: number = 3.0): TextLayerItem {
  return {
    id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    text: "Sample Text",
    timelineStart: Math.max(0, timelineStart),
    duration: Math.max(1.0, duration),
    fontSize: 28,
    fontColor: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.4)",
    alignment: "center",
    isBold: false,
    isItalic: false,
    animation: "fade",
    positionX: 50,
    positionY: 82,
  };
}

export function createDefaultOverlay(asset: MediaAsset, timelineStart: number = 0): OverlayLayerItem {
  const duration = asset.duration > 0 ? asset.duration : 4.0;
  return {
    id: `overlay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    assetId: asset.id,
    name: asset.name,
    timelineStart: Math.max(0, timelineStart),
    duration: duration,
    scale: 0.4,
    opacity: 1.0,
    positionX: 75,
    positionY: 25,
    rotation: 0,
  };
}

export function getEffectiveClipDuration(clip: VideoClip): number {
  const trimmed = Math.max(0.1, clip.endTrim - clip.startTrim);
  const safeSpeed = Math.max(0.1, clip.speed || 1.0);
  return trimmed / safeSpeed;
}

export function getTotalProjectDuration(project: VideoProject): number {
  if (!project.clips || project.clips.length === 0) return 0;
  return project.clips.reduce((acc, clip) => acc + getEffectiveClipDuration(clip), 0);
}

export function createInitialProject(): VideoProject {
  return {
    id: `proj_${Date.now()}`,
    title: "Untitled Video Project",
    settings: {
      aspectRatio: "16:9",
      canvasWidth: 1920,
      canvasHeight: 1080,
      fps: 30,
    },
    assets: [],
    clips: [],
    audioTracks: [],
    textLayers: [],
    overlayLayers: [],
  };
}

export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  const formattedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${formattedMins}:${formattedSecs}`;
}

export function parseTimecode(val: string): number {
  const parts = val.trim().split(":");
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(val) || 0;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

