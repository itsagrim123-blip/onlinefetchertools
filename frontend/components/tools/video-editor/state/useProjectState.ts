"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActiveToolTab,
  AspectRatioPreset,
  AudioTrackItem,
  ClipPropertyTab,
  MediaAsset,
  MediaType,
  MobileSheetType,
  OverlayLayerItem,
  SidebarTab,
  TextLayerItem,
  TrackControls,
  TransitionType,
  VideoClip,
  VideoProject,
} from "../types";
import {
  createDefaultAudioTrack,
  createDefaultClip,
  createDefaultOverlay,
  createDefaultTextLayer,
  createInitialProject,
  getEffectiveClipDuration,
  getTotalProjectDuration,
} from "./projectDefaults";

const MAX_HISTORY = 30;

export interface ClipTimeRange {
  clip: VideoClip;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ActiveTransitionInfo {
  type: TransitionType;
  duration: number;
  progress: number; // 0.0 to 1.0
  fromClip: VideoClip;
  toClip: VideoClip;
  fromLocalTime: number;
  toLocalTime: number;
}

export interface ActivePlaybackState {
  activeClipInfo: (ClipTimeRange & { localSourceTime: number }) | null;
  activeTransition: ActiveTransitionInfo | null;
}

export function computeClipTimeRanges(clips: VideoClip[]): ClipTimeRange[] {
  let fallbackOffset = 0;
  return clips.map((clip, index) => {
    const duration = getEffectiveClipDuration(clip);
    const requestedStart =
      typeof clip.timelineStart === "number" ? Math.max(0, clip.timelineStart) : fallbackOffset;
    // Strictly prevent overlap with preceding clip
    const startTime = Math.max(fallbackOffset, requestedStart);
    fallbackOffset = startTime + duration;
    return {
      clip: { ...clip, timelineStart: startTime },
      index,
      startTime,
      endTime: startTime + duration,
      duration,
    };
  });
}

export function findPlaybackStateAtTime(
  clipRanges: ClipTimeRange[],
  time: number
): ActivePlaybackState {
  if (clipRanges.length === 0) {
    return { activeClipInfo: null, activeTransition: null };
  }
  const clampedTime = Math.max(0, time);

  // Check for transition between adjacent clips first
  for (let i = 0; i < clipRanges.length - 1; i++) {
    const current = clipRanges[i];
    const next = clipRanges[i + 1];
    const transition = current.clip.transition;

    if (transition && transition.type !== "none" && transition.duration > 0) {
      // Adjacent if current.endTime is within 0.25s of next.startTime
      const gap = next.startTime - current.endTime;
      if (Math.abs(gap) <= 0.25) {
        const transDur = Math.min(transition.duration, current.duration * 0.8, next.duration * 0.8);
        const transStart = current.endTime - transDur;
        const transEnd = current.endTime;

        if (clampedTime >= transStart && clampedTime <= transEnd) {
          const progress = Math.max(0, Math.min(1, (clampedTime - transStart) / transDur));
          const elapsedA = clampedTime - current.startTime;
          const speedA = Math.max(0.1, current.clip.speed || 1.0);
          const localA = current.clip.isReversed
            ? current.clip.endTrim - elapsedA * speedA
            : current.clip.startTrim + elapsedA * speedA;

          const transElapsed = clampedTime - transStart;
          const speedB = Math.max(0.1, next.clip.speed || 1.0);
          const localB = next.clip.isReversed
            ? next.clip.endTrim - transElapsed * speedB
            : next.clip.startTrim + transElapsed * speedB;

          return {
            activeClipInfo: {
              ...current,
              localSourceTime: Math.max(current.clip.startTrim, Math.min(current.clip.endTrim, localA)),
            },
            activeTransition: {
              type: transition.type,
              duration: transDur,
              progress,
              fromClip: current.clip,
              toClip: next.clip,
              fromLocalTime: Math.max(current.clip.startTrim, Math.min(current.clip.endTrim, localA)),
              toLocalTime: Math.max(next.clip.startTrim, Math.min(next.clip.endTrim, localB)),
            },
          };
        }
      }
    }
  }

  // Normal active clip lookup
  for (const range of clipRanges) {
    if (clampedTime >= range.startTime && clampedTime < range.endTime) {
      const elapsedOnTimeline = clampedTime - range.startTime;
      const speed = Math.max(0.1, range.clip.speed || 1.0);
      let localSourceTime: number;
      if (range.clip.isReversed) {
        localSourceTime = range.clip.endTrim - elapsedOnTimeline * speed;
      } else {
        localSourceTime = range.clip.startTrim + elapsedOnTimeline * speed;
      }
      return {
        activeClipInfo: {
          ...range,
          localSourceTime: Math.max(range.clip.startTrim, Math.min(range.clip.endTrim, localSourceTime)),
        },
        activeTransition: null,
      };
    }
  }

  // Exact end boundary check
  if (clipRanges.length > 0) {
    const last = clipRanges[clipRanges.length - 1];
    if (Math.abs(clampedTime - last.endTime) < 0.05) {
      return {
        activeClipInfo: {
          ...last,
          localSourceTime: last.clip.isReversed ? last.clip.startTrim : last.clip.endTrim,
        },
        activeTransition: null,
      };
    }
  }

  return { activeClipInfo: null, activeTransition: null };
}

export function findClipAtTime(
  clipRanges: ClipTimeRange[],
  time: number
): (ClipTimeRange & { localSourceTime: number }) | null {
  return findPlaybackStateAtTime(clipRanges, time).activeClipInfo;
}

export function useProjectState(initial?: VideoProject) {
  const [project, setProject] = useState<VideoProject>(initial || createInitialProject);
  const [history, setHistory] = useState<VideoProject[]>([]);
  const [future, setFuture] = useState<VideoProject[]>([]);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Reference UI navigation states
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("media");
  const [clipTab, setClipTab] = useState<ClipPropertyTab>("video");
  const [mobileSheet, setMobileSheet] = useState<MobileSheetType>(null);
  const [timelineZoom, setTimelineZoom] = useState<number>(50); // pixels per second

  // Computed ranges & total duration
  const clipRanges = useMemo(() => computeClipTimeRanges(project.clips), [project.clips]);
  const totalDuration = useMemo(() => getTotalProjectDuration(project), [project]);

  // Synchronous refs for ultra-fast stable callbacks without re-render tearing
  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;
  const totalDurationRef = useRef<number>(totalDuration);
  totalDurationRef.current = totalDuration;

  // Push to undo stack
  const updateProjectWithHistory = useCallback((updater: (prev: VideoProject) => VideoProject) => {
    setProject((current) => {
      const next = updater(current);
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), current]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      const newHistory = h.slice(0, -1);
      setProject((current) => {
        setFuture((f) => [current, ...f]);
        return prev;
      });
      return newHistory;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      const newFuture = f.slice(1);
      setProject((current) => {
        setHistory((h) => [...h, current]);
        return next;
      });
      return newFuture;
    });
  }, []);

  // --- Track Controls (Visibility / Lock) ---
  const toggleTrackVisibility = useCallback(
    (track: keyof TrackControls) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        trackControls: {
          ...prev.trackControls,
          [track]: {
            ...prev.trackControls[track],
            visible: !prev.trackControls[track].visible,
          },
        },
      }));
    },
    [updateProjectWithHistory]
  );

  const toggleTrackLock = useCallback(
    (track: keyof TrackControls) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        trackControls: {
          ...prev.trackControls,
          [track]: {
            ...prev.trackControls[track],
            locked: !prev.trackControls[track].locked,
          },
        },
      }));
    },
    [updateProjectWithHistory]
  );

  // --- Asset Management ---
  const addAsset = useCallback(
    (
      file: File,
      type: MediaType,
      duration: number = 3.0,
      width?: number,
      height?: number,
      thumbnailUrl?: string,
      filmstripFrames?: string[]
    ): MediaAsset => {
      const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const objectUrl = URL.createObjectURL(file);
      const newAsset: MediaAsset = {
        id,
        name: file.name,
        type,
        file,
        objectUrl,
        duration,
        width,
        height,
        thumbnailUrl,
        filmstripFrames,
        size: file.size,
      };

      setProject((prev) => ({
        ...prev,
        assets: [...prev.assets, newAsset],
      }));

      return newAsset;
    },
    []
  );

  const removeAsset = useCallback((assetId: string) => {
    updateProjectWithHistory((prev) => {
      const asset = prev.assets.find((a) => a.id === assetId);
      if (asset?.objectUrl) {
        try {
          URL.revokeObjectURL(asset.objectUrl);
        } catch {
          // Ignore revocation issues
        }
      }
      return {
        ...prev,
        assets: prev.assets.filter((a) => a.id !== assetId),
        clips: prev.clips.filter((c) => c.assetId !== assetId),
        audioTracks: prev.audioTracks.filter((a) => a.assetId !== assetId),
        overlayLayers: prev.overlayLayers.filter((o) => o.assetId !== assetId),
      };
    });
  }, [updateProjectWithHistory]);

  // --- Clip Operations ---
  const addClipFromAsset = useCallback(
    (assetId: string, insertIndex?: number, timelineStart?: number) => {
      updateProjectWithHistory((prev) => {
        const asset = prev.assets.find((a) => a.id === assetId);
        if (!asset || asset.type === "audio") return prev;

        let startPos = 0;
        if (timelineStart !== undefined) {
          startPos = Math.max(0, timelineStart);
        } else if (prev.clips.length > 0) {
          const lastClip = prev.clips[prev.clips.length - 1];
          startPos = (lastClip.timelineStart || 0) + getEffectiveClipDuration(lastClip);
        }

        const newClip = createDefaultClip(asset, startPos);
        const newClips = [...prev.clips];
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= newClips.length) {
          newClips.splice(insertIndex, 0, newClip);
        } else {
          newClips.push(newClip);
        }

        setSelectedClipId(newClip.id);
        setClipTab("video");

        return {
          ...prev,
          clips: newClips,
        };
      });
    },
    [updateProjectWithHistory]
  );

  const updateClip = useCallback(
    (clipId: string, partial: Partial<VideoClip>) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) => (clip.id === clipId ? { ...clip, ...partial } : clip)),
      }));
    },
    [updateProjectWithHistory]
  );

  const removeClip = useCallback(
    (clipId: string) => {
      updateProjectWithHistory((prev) => {
        const remaining = prev.clips.filter((c) => c.id !== clipId);
        if (selectedClipId === clipId) {
          setSelectedClipId(remaining.length > 0 ? remaining[0].id : null);
        }
        return {
          ...prev,
          clips: remaining,
        };
      });
    },
    [selectedClipId, updateProjectWithHistory]
  );

  const duplicateClip = useCallback(
    (clipId: string) => {
      updateProjectWithHistory((prev) => {
        const index = prev.clips.findIndex((c) => c.id === clipId);
        if (index === -1) return prev;
        const orig = prev.clips[index];
        const copy: VideoClip = {
          ...orig,
          id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: `${orig.name} (Copy)`,
          timelineStart: (orig.timelineStart || 0) + getEffectiveClipDuration(orig),
        };
        const newClips = [...prev.clips];
        newClips.splice(index + 1, 0, copy);
        setSelectedClipId(copy.id);
        return {
          ...prev,
          clips: newClips,
        };
      });
    },
    [updateProjectWithHistory]
  );

  const reorderClips = useCallback(
    (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return;
      updateProjectWithHistory((prev) => {
        const result = Array.from(prev.clips);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return {
          ...prev,
          clips: result,
        };
      });
    },
    [updateProjectWithHistory]
  );

  const moveClip = useCallback(
    (clipId: string, newTimelineStart: number) => {
      updateProjectWithHistory((prev) => {
        const targetIndex = prev.clips.findIndex((c) => c.id === clipId);
        if (targetIndex === -1) return prev;
        const target = prev.clips[targetIndex];
        const targetDur = getEffectiveClipDuration(target);

        // Enforce strict boundaries with adjacent clips to prevent overlap
        const prevClip = targetIndex > 0 ? prev.clips[targetIndex - 1] : undefined;
        const nextClip = targetIndex < prev.clips.length - 1 ? prev.clips[targetIndex + 1] : undefined;

        const minStart = prevClip
          ? (prevClip.timelineStart || 0) + getEffectiveClipDuration(prevClip)
          : 0;
        const maxStart = nextClip
          ? Math.max(minStart, (nextClip.timelineStart || 0) - targetDur)
          : Infinity;

        const clampedStart = Math.max(minStart, Math.min(maxStart, newTimelineStart));

        const updated = prev.clips.map((c, i) =>
          i === targetIndex ? { ...c, timelineStart: clampedStart } : c
        );

        // Validate transitions between adjacent clips: if two clips moved apart, remove transition
        for (let i = 0; i < updated.length; i++) {
          const c = updated[i];
          if (c.transition && c.transition.type !== "none") {
            const next = updated[i + 1];
            if (!next) {
              c.transition = undefined;
            } else {
              const cEnd = (c.timelineStart || 0) + getEffectiveClipDuration(c);
              const gap = (next.timelineStart || 0) - cEnd;
              if (Math.abs(gap) > 0.25) {
                c.transition = undefined;
              }
            }
          }
        }

        return {
          ...prev,
          clips: updated,
        };
      });
    },
    [updateProjectWithHistory]
  );

  const splitClipAtTime = useCallback(
    (timelineTime?: number, clipIdToSplit?: string) => {
      const time = timelineTime !== undefined ? timelineTime : currentTimeRef.current;
      updateProjectWithHistory((prev) => {
        const ranges = computeClipTimeRanges(prev.clips);
        let targetRange: ClipTimeRange | undefined;

        if (clipIdToSplit) {
          targetRange = ranges.find((r) => r.clip.id === clipIdToSplit);
        } else {
          targetRange = ranges.find((r) => time >= r.startTime && time <= r.endTime);
        }

        if (!targetRange) return prev;

        const { clip, startTime, endTime, index } = targetRange;
        // Don't split if too close to boundaries (less than 0.15s)
        if (time <= startTime + 0.15 || time >= endTime - 0.15) {
          return prev;
        }

        const elapsed = time - startTime;
        const speed = Math.max(0.1, clip.speed || 1.0);
        const splitSourceOffset = clip.startTrim + elapsed * speed;

        const firstClip: VideoClip = {
          ...clip,
          endTrim: splitSourceOffset,
          transition: undefined, // clear transition at split point
        };

        const secondClip: VideoClip = {
          ...clip,
          id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timelineStart: time,
          startTrim: splitSourceOffset,
          endTrim: clip.endTrim,
          transition: undefined,
        };

        const newClips = [...prev.clips];
        newClips.splice(index, 1, firstClip, secondClip);

        setSelectedClipId(secondClip.id);

        return {
          ...prev,
          clips: newClips,
        };
      });
    },
    [updateProjectWithHistory]
  );

  const trimClip = useCallback(
    (clipId: string, newStartTrim: number, newEndTrim: number, newTimelineStart?: number) => {
      updateProjectWithHistory((prev) => {
        const targetIndex = prev.clips.findIndex((c) => c.id === clipId);
        if (targetIndex === -1) return prev;
        const clip = prev.clips[targetIndex];
        const prevClip = targetIndex > 0 ? prev.clips[targetIndex - 1] : undefined;
        const nextClip = targetIndex < prev.clips.length - 1 ? prev.clips[targetIndex + 1] : undefined;

        const minTimelineStart = prevClip
          ? (prevClip.timelineStart || 0) + getEffectiveClipDuration(prevClip)
          : 0;

        const safeTimelineStart =
          newTimelineStart !== undefined
            ? Math.max(minTimelineStart, newTimelineStart)
            : (clip.timelineStart || 0);

        const safeStart = Math.max(0, Math.min(newStartTrim, clip.sourceDuration - 0.1));
        let safeEnd = Math.max(safeStart + 0.1, Math.min(newEndTrim, clip.sourceDuration));

        // If next clip exists, ensure clip end does not collide into nextClip.timelineStart
        if (nextClip && typeof nextClip.timelineStart === "number") {
          const maxDuration = Math.max(0.1, nextClip.timelineStart - safeTimelineStart);
          const speed = Math.max(0.1, clip.speed || 1.0);
          const maxSourceSpan = maxDuration * speed;
          if (safeEnd - safeStart > maxSourceSpan) {
            safeEnd = safeStart + maxSourceSpan;
          }
        }

        return {
          ...prev,
          clips: prev.clips.map((c, i) =>
            i === targetIndex
              ? {
                  ...c,
                  startTrim: safeStart,
                  endTrim: safeEnd,
                  timelineStart: safeTimelineStart,
                }
              : c
          ),
        };
      });
    },
    [updateProjectWithHistory]
  );

  // Freeze Frame: splits current clip and inserts still frame
  const insertFreezeFrame = useCallback(
    (clipId: string, timelineTime?: number, frameDataUrl?: string, freezeDuration: number = 3.0) => {
      const time = timelineTime !== undefined ? timelineTime : currentTimeRef.current;
      const fallbackDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const safeDataUrl = frameDataUrl || fallbackDataUrl;
      // Create synthetic blob and file from safeDataUrl
      try {
        const byteString = atob(safeDataUrl.split(",")[1]);
        const mimeString = safeDataUrl.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const file = new File([blob], `freeze_${Date.now()}.png`, { type: mimeString });
        const asset = addAsset(file, "image", freezeDuration, undefined, undefined, safeDataUrl);

        updateProjectWithHistory((prev) => {
          const ranges = computeClipTimeRanges(prev.clips);
          const target = ranges.find((r) => r.clip.id === clipId);
          if (!target) return prev;

          const { clip, startTime, index } = target;
          const elapsed = Math.max(0, time - startTime);
          const splitOffset = clip.startTrim + elapsed * (clip.speed || 1.0);

          const clipA: VideoClip = { ...clip, endTrim: splitOffset };
          const freezeClip: VideoClip = {
            ...createDefaultClip(asset),
            name: `${clip.name} (Freeze)`,
            sourceDuration: freezeDuration,
            startTrim: 0,
            endTrim: freezeDuration,
          };
          const clipB: VideoClip = {
            ...clip,
            id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            startTrim: splitOffset,
          };

          const newClips = [...prev.clips];
          newClips.splice(index, 1, clipA, freezeClip, clipB);
          setSelectedClipId(freezeClip.id);
          return { ...prev, clips: newClips };
        });
      } catch (err) {
        console.error("Failed to insert freeze frame:", err);
      }
    },
    [addAsset, updateProjectWithHistory]
  );

  // --- Audio Track Operations ---
  const addAudioTrack = useCallback(
    (assetId: string, timelineStart?: number) => {
      const start = timelineStart !== undefined ? timelineStart : currentTimeRef.current;
      updateProjectWithHistory((prev) => {
        const asset = prev.assets.find((a) => a.id === assetId);
        if (!asset) return prev;
        const newTrack = createDefaultAudioTrack(asset, start);
        setSelectedAudioId(newTrack.id);
        setSidebarTab("audio");
        return {
          ...prev,
          audioTracks: [...prev.audioTracks, newTrack],
        };
      });
    },
    [updateProjectWithHistory]
  );

  const updateAudioTrack = useCallback(
    (trackId: string, partial: Partial<AudioTrackItem>) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        audioTracks: prev.audioTracks.map((t) => (t.id === trackId ? { ...t, ...partial } : t)),
      }));
    },
    [updateProjectWithHistory]
  );

  const removeAudioTrack = useCallback(
    (trackId: string) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        audioTracks: prev.audioTracks.filter((t) => t.id !== trackId),
      }));
      if (selectedAudioId === trackId) setSelectedAudioId(null);
    },
    [selectedAudioId, updateProjectWithHistory]
  );

  const duplicateAudioTrack = useCallback(
    (trackId: string) => {
      updateProjectWithHistory((prev) => {
        const orig = prev.audioTracks.find((t) => t.id === trackId);
        if (!orig) return prev;
        const copy: AudioTrackItem = {
          ...orig,
          id: `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: `${orig.name} (Copy)`,
          timelineStart: orig.timelineStart + 1.0,
        };
        setSelectedAudioId(copy.id);
        return {
          ...prev,
          audioTracks: [...prev.audioTracks, copy],
        };
      });
    },
    [updateProjectWithHistory]
  );

  const moveAudioTrack = useCallback(
    (trackId: string, newTimelineStart: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        audioTracks: prev.audioTracks.map((a) =>
          a.id === trackId ? { ...a, timelineStart: Math.max(0, newTimelineStart) } : a
        ),
      }));
    },
    [updateProjectWithHistory]
  );

  const resizeAudioTrack = useCallback(
    (trackId: string, newDuration: number, newStartTrim?: number, newTimelineStart?: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        audioTracks: prev.audioTracks.map((a) => {
          if (a.id !== trackId) return a;
          const duration = Math.max(0.2, newDuration);
          return {
            ...a,
            duration,
            startTrim: newStartTrim !== undefined ? Math.max(0, newStartTrim) : a.startTrim,
            timelineStart: newTimelineStart !== undefined ? Math.max(0, newTimelineStart) : a.timelineStart,
          };
        }),
      }));
    },
    [updateProjectWithHistory]
  );

  // Extract audio from video clip into an independent audio track
  const extractAudioFromClip = useCallback(
    (clipId: string) => {
      updateProjectWithHistory((prev) => {
        const ranges = computeClipTimeRanges(prev.clips);
        const targetRange = ranges.find((r) => r.clip.id === clipId);
        if (!targetRange || targetRange.clip.type !== "video") return prev;

        const clip = targetRange.clip;
        const asset = prev.assets.find((a) => a.id === clip.assetId);
        if (!asset) return prev;

        const effectiveDur = Math.max(0.1, (clip.endTrim - clip.startTrim) / Math.max(0.1, clip.speed || 1.0));

        const extractedAudio: AudioTrackItem = {
          id: `audio_extracted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          assetId: clip.assetId,
          name: `${clip.name} (Audio)`,
          sourceDuration: clip.sourceDuration,
          timelineStart: targetRange.startTime,
          startTrim: clip.startTrim,
          duration: effectiveDur,
          volume: clip.volume,
          isMuted: false,
          fadeInDuration: clip.fadeInDuration,
          fadeOutDuration: clip.fadeOutDuration,
          voiceEffect: "none",
          noiseReduction: false,
        };

        // Mute the original clip so audio isn't doubled
        const updatedClips = prev.clips.map((c) => (c.id === clipId ? { ...c, isMuted: true } : c));

        setSelectedAudioId(extractedAudio.id);
        setSelectedClipId(null);
        setSidebarTab("audio");

        return {
          ...prev,
          clips: updatedClips,
          audioTracks: [...prev.audioTracks, extractedAudio],
        };
      });
    },
    [updateProjectWithHistory]
  );

  // --- Text Layer Operations ---
  const addTextLayer = useCallback(
    (timelineStart?: number, text: string = "Happy Birthday") => {
      const start = timelineStart !== undefined ? timelineStart : currentTimeRef.current;
      updateProjectWithHistory((prev) => {
        const newLayer = createDefaultTextLayer(start, 4.0);
        newLayer.text = text;
        setSelectedTextId(newLayer.id);
        setSidebarTab("text");
        return {
          ...prev,
          textLayers: [...prev.textLayers, newLayer],
        };
      });
    },
    [updateProjectWithHistory]
  );

  const duplicateTextLayer = useCallback(
    (layerId: string) => {
      updateProjectWithHistory((prev) => {
        const orig = prev.textLayers.find((t) => t.id === layerId);
        if (!orig) return prev;
        const copy: TextLayerItem = {
          ...orig,
          id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timelineStart: orig.timelineStart + 0.5,
        };
        setSelectedTextId(copy.id);
        return {
          ...prev,
          textLayers: [...prev.textLayers, copy],
        };
      });
    },
    [updateProjectWithHistory]
  );

  const updateTextLayer = useCallback(
    (layerId: string, partial: Partial<TextLayerItem>) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((l) => (l.id === layerId ? { ...l, ...partial } : l)),
      }));
    },
    [updateProjectWithHistory]
  );

  const moveTextLayer = useCallback(
    (layerId: string, newTimelineStart: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((t) =>
          t.id === layerId ? { ...t, timelineStart: Math.max(0, newTimelineStart) } : t
        ),
      }));
    },
    [updateProjectWithHistory]
  );

  const resizeTextLayer = useCallback(
    (layerId: string, newDuration: number, newTimelineStart?: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((t) => {
          if (t.id !== layerId) return t;
          return {
            ...t,
            duration: Math.max(0.2, newDuration),
            timelineStart: newTimelineStart !== undefined ? Math.max(0, newTimelineStart) : t.timelineStart,
          };
        }),
      }));
    },
    [updateProjectWithHistory]
  );

  const removeTextLayer = useCallback(
    (layerId: string) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        textLayers: prev.textLayers.filter((l) => l.id !== layerId),
      }));
      if (selectedTextId === layerId) setSelectedTextId(null);
    },
    [selectedTextId, updateProjectWithHistory]
  );

  const addAutoCaptions = useCallback(
    (segments: { start: number; duration: number; text: string }[]) => {
      if (!segments || segments.length === 0) return;
      updateProjectWithHistory((prev) => {
        const newLayers: TextLayerItem[] = segments.map((seg, idx) => {
          const layer = createDefaultTextLayer(seg.start, Math.max(0.5, seg.duration));
          layer.id = `caption_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
          layer.text = seg.text;
          layer.fontSize = 24;
          layer.positionY = 82; // Position captions near the bottom
          layer.strokeColor = "#000000";
          layer.strokeWidth = 2;
          layer.shadowColor = "rgba(0,0,0,0.8)";
          layer.shadowBlur = 4;
          return layer;
        });
        if (newLayers.length > 0) {
          setSelectedTextId(newLayers[0].id);
        }
        return {
          ...prev,
          textLayers: [...prev.textLayers, ...newLayers],
        };
      });
    },
    [updateProjectWithHistory]
  );

  // --- Overlay Layer Operations ---
  const addOverlayLayer = useCallback(
    (assetId: string, timelineStart?: number) => {
      const start = timelineStart !== undefined ? timelineStart : currentTimeRef.current;
      updateProjectWithHistory((prev) => {
        const asset = prev.assets.find((a) => a.id === assetId);
        if (!asset || asset.type === "audio") return prev;
        const newOverlay = createDefaultOverlay(asset, start);
        setSelectedOverlayId(newOverlay.id);
        setSidebarTab("stickers");
        return {
          ...prev,
          overlayLayers: [...prev.overlayLayers, newOverlay],
        };
      });
    },
    [updateProjectWithHistory]
  );

  const duplicateOverlayLayer = useCallback(
    (layerId: string) => {
      updateProjectWithHistory((prev) => {
        const orig = prev.overlayLayers.find((o) => o.id === layerId);
        if (!orig) return prev;
        const copy: OverlayLayerItem = {
          ...orig,
          id: `overlay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timelineStart: orig.timelineStart + 0.5,
        };
        setSelectedOverlayId(copy.id);
        return {
          ...prev,
          overlayLayers: [...prev.overlayLayers, copy],
        };
      });
    },
    [updateProjectWithHistory]
  );

  const updateOverlayLayer = useCallback(
    (layerId: string, partial: Partial<OverlayLayerItem>) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        overlayLayers: prev.overlayLayers.map((o) => (o.id === layerId ? { ...o, ...partial } : o)),
      }));
    },
    [updateProjectWithHistory]
  );

  const moveOverlayLayer = useCallback(
    (layerId: string, newTimelineStart: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        overlayLayers: prev.overlayLayers.map((o) =>
          o.id === layerId ? { ...o, timelineStart: Math.max(0, newTimelineStart) } : o
        ),
      }));
    },
    [updateProjectWithHistory]
  );

  const resizeOverlayLayer = useCallback(
    (layerId: string, newDuration: number, newTimelineStart?: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        overlayLayers: prev.overlayLayers.map((o) => {
          if (o.id !== layerId) return o;
          return {
            ...o,
            duration: Math.max(0.2, newDuration),
            timelineStart: newTimelineStart !== undefined ? Math.max(0, newTimelineStart) : o.timelineStart,
          };
        }),
      }));
    },
    [updateProjectWithHistory]
  );

  const removeOverlayLayer = useCallback(
    (layerId: string) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        overlayLayers: prev.overlayLayers.filter((o) => o.id !== layerId),
      }));
      if (selectedOverlayId === layerId) setSelectedOverlayId(null);
    },
    [selectedOverlayId, updateProjectWithHistory]
  );

  const toggleSnap = useCallback(() => {
    updateProjectWithHistory((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        snapEnabled: !(prev.settings.snapEnabled ?? true),
      },
    }));
  }, [updateProjectWithHistory]);

  // --- Project Settings ---
  const setAspectRatio = useCallback(
    (aspectRatio: AspectRatioPreset) => {
      updateProjectWithHistory((prev) => {
        let width = 1920;
        let height = 1080;
        if (aspectRatio === "9:16") {
          width = 1080;
          height = 1920;
        } else if (aspectRatio === "1:1") {
          width = 1080;
          height = 1080;
        } else if (aspectRatio === "4:5") {
          width = 1080;
          height = 1350;
        }
        return {
          ...prev,
          settings: {
            ...prev.settings,
            aspectRatio,
            canvasWidth: width,
            canvasHeight: height,
          },
        };
      });
    },
    [updateProjectWithHistory]
  );

  const setProjectTitle = useCallback(
    (title: string) => {
      setProject((prev) => ({ ...prev, title }));
    },
    []
  );

  // --- Playback & Selection Controls ---
  const seekTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(totalDurationRef.current, time));
    setCurrentTime(clamped);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const cTime = currentTimeRef.current;
      const duration = totalDurationRef.current;
      if (!prev && cTime >= duration && duration > 0) {
        setCurrentTime(0);
      }
      return !prev;
    });
  }, []);

  const selectClip = useCallback((id: string | null) => {
    setSelectedClipId(id);
    setSelectedAudioId(null);
    setSelectedTextId(null);
    setSelectedOverlayId(null);
    if (id) {
      setClipTab("video");
    }
  }, []);

  const selectAudio = useCallback((id: string | null) => {
    setSelectedAudioId(id);
    setSelectedClipId(null);
    setSelectedTextId(null);
    setSelectedOverlayId(null);
    if (id) {
      setSidebarTab("audio");
    }
  }, []);

  const selectText = useCallback((id: string | null) => {
    setSelectedTextId(id);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setSelectedOverlayId(null);
    if (id) {
      setSidebarTab("text");
    }
  }, []);

  const selectOverlay = useCallback((id: string | null) => {
    setSelectedOverlayId(id);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setSelectedTextId(null);
    if (id) {
      setSidebarTab("stickers");
    }
  }, []);

  return {
    project,
    clipRanges,
    totalDuration,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    togglePlay,
    seekTo,
    selectedClipId,
    selectedAudioId,
    selectedTextId,
    selectedOverlayId,
    selectClip,
    selectAudio,
    selectText,
    selectOverlay,
    sidebarTab,
    setSidebarTab,
    clipTab,
    setClipTab,
    mobileSheet,
    setMobileSheet,
    timelineZoom,
    setTimelineZoom,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    toggleTrackVisibility,
    toggleTrackLock,
    addAsset,
    removeAsset,
    addClipFromAsset,
    updateClip,
    removeClip,
    duplicateClip,
    reorderClips,
    moveClip,
    splitClipAtTime,
    trimClip,
    insertFreezeFrame,
    addAudioTrack,
    updateAudioTrack,
    removeAudioTrack,
    duplicateAudioTrack,
    moveAudioTrack,
    resizeAudioTrack,
    extractAudioFromClip,
    addTextLayer,
    updateTextLayer,
    removeTextLayer,
    duplicateTextLayer,
    moveTextLayer,
    resizeTextLayer,
    addAutoCaptions,
    addOverlayLayer,
    updateOverlayLayer,
    removeOverlayLayer,
    duplicateOverlayLayer,
    moveOverlayLayer,
    resizeOverlayLayer,
    toggleSnap,
    setAspectRatio,
    setProjectTitle,
  };
}
