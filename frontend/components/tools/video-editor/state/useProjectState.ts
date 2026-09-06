"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ActiveToolTab,
  AspectRatioPreset,
  AudioTrackItem,
  MediaAsset,
  MediaType,
  OverlayLayerItem,
  TextLayerItem,
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

export function computeClipTimeRanges(clips: VideoClip[]): ClipTimeRange[] {
  let currentOffset = 0;
  return clips.map((clip, index) => {
    const duration = getEffectiveClipDuration(clip);
    const range: ClipTimeRange = {
      clip,
      index,
      startTime: currentOffset,
      endTime: currentOffset + duration,
      duration,
    };
    currentOffset += duration;
    return range;
  });
}

export function findClipAtTime(
  clipRanges: ClipTimeRange[],
  time: number
): (ClipTimeRange & { localSourceTime: number }) | null {
  if (clipRanges.length === 0) return null;
  const clampedTime = Math.max(0, time);

  for (const range of clipRanges) {
    if (clampedTime >= range.startTime && clampedTime <= range.endTime) {
      const elapsedOnTimeline = clampedTime - range.startTime;
      const speed = Math.max(0.1, range.clip.speed || 1.0);
      let localSourceTime: number;
      if (range.clip.isReversed) {
        localSourceTime = range.clip.endTrim - elapsedOnTimeline * speed;
      } else {
        localSourceTime = range.clip.startTrim + elapsedOnTimeline * speed;
      }
      return {
        ...range,
        localSourceTime: Math.max(range.clip.startTrim, Math.min(range.clip.endTrim, localSourceTime)),
      };
    }
  }

  // If time exceeds last clip, select last clip clamped to end
  const last = clipRanges[clipRanges.length - 1];
  return {
    ...last,
    localSourceTime: last.clip.isReversed ? last.clip.startTrim : last.clip.endTrim,
  };
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
  const [activeTab, setActiveTab] = useState<ActiveToolTab>("media");
  const [timelineZoom, setTimelineZoom] = useState<number>(50); // pixels per second

  // Computed ranges & total duration
  const clipRanges = useMemo(() => computeClipTimeRanges(project.clips), [project.clips]);
  const totalDuration = useMemo(() => getTotalProjectDuration(project), [project]);

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

  // --- Asset Management ---
  const addAsset = useCallback(
    (
      file: File,
      type: MediaType,
      duration: number = 3.0,
      width?: number,
      height?: number,
      thumbnailUrl?: string
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
    (assetId: string, insertIndex?: number) => {
      updateProjectWithHistory((prev) => {
        const asset = prev.assets.find((a) => a.id === assetId);
        if (!asset || asset.type === "audio") return prev;

        const newClip = createDefaultClip(asset);
        const newClips = [...prev.clips];
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= newClips.length) {
          newClips.splice(insertIndex, 0, newClip);
        } else {
          newClips.push(newClip);
        }

        setSelectedClipId(newClip.id);
        setActiveTab("edit");

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

  const splitClipAtTime = useCallback(
    (timelineTime: number, clipIdToSplit?: string) => {
      updateProjectWithHistory((prev) => {
        const ranges = computeClipTimeRanges(prev.clips);
        let targetRange: ClipTimeRange | undefined;

        if (clipIdToSplit) {
          targetRange = ranges.find((r) => r.clip.id === clipIdToSplit);
        } else {
          targetRange = ranges.find((r) => timelineTime >= r.startTime && timelineTime <= r.endTime);
        }

        if (!targetRange) return prev;

        const { clip, startTime, endTime, index } = targetRange;
        // Don't split if too close to boundaries (less than 0.15s)
        if (timelineTime <= startTime + 0.15 || timelineTime >= endTime - 0.15) {
          return prev;
        }

        const elapsed = timelineTime - startTime;
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
          startTrim: splitSourceOffset,
          endTrim: clip.endTrim,
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
    (clipId: string, newStartTrim: number, newEndTrim: number) => {
      updateProjectWithHistory((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const safeStart = Math.max(0, Math.min(newStartTrim, clip.sourceDuration - 0.1));
          const safeEnd = Math.max(safeStart + 0.1, Math.min(newEndTrim, clip.sourceDuration));
          return {
            ...clip,
            startTrim: safeStart,
            endTrim: safeEnd,
          };
        }),
      }));
    },
    [updateProjectWithHistory]
  );

  // --- Audio Track Operations ---
  const addAudioTrack = useCallback(
    (assetId: string, timelineStart: number = 0) => {
      updateProjectWithHistory((prev) => {
        const asset = prev.assets.find((a) => a.id === assetId);
        if (!asset) return prev;
        const newTrack = createDefaultAudioTrack(asset, timelineStart);
        setSelectedAudioId(newTrack.id);
        setActiveTab("audio");
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

  // --- Text Layer Operations ---
  const addTextLayer = useCallback(
    (timelineStart?: number, text: string = "Sample Text") => {
      const start = timelineStart !== undefined ? timelineStart : currentTime;
      updateProjectWithHistory((prev) => {
        const newLayer = createDefaultTextLayer(start, 3.0);
        newLayer.text = text;
        setSelectedTextId(newLayer.id);
        setActiveTab("text");
        return {
          ...prev,
          textLayers: [...prev.textLayers, newLayer],
        };
      });
    },
    [currentTime, updateProjectWithHistory]
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

  // --- Overlay Layer Operations ---
  const addOverlayLayer = useCallback(
    (assetId: string, timelineStart?: number) => {
      const start = timelineStart !== undefined ? timelineStart : currentTime;
      updateProjectWithHistory((prev) => {
        const asset = prev.assets.find((a) => a.id === assetId);
        if (!asset || asset.type === "audio") return prev;
        const newOverlay = createDefaultOverlay(asset, start);
        setSelectedOverlayId(newOverlay.id);
        setActiveTab("overlay");
        return {
          ...prev,
          overlayLayers: [...prev.overlayLayers, newOverlay],
        };
      });
    },
    [currentTime, updateProjectWithHistory]
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
  const seekTo = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(totalDuration, time));
      setCurrentTime(clamped);
    },
    [totalDuration]
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentTime >= totalDuration && totalDuration > 0) {
        setCurrentTime(0);
      }
      return !prev;
    });
  }, [currentTime, totalDuration]);

  const selectClip = useCallback((id: string | null) => {
    setSelectedClipId(id);
    setSelectedAudioId(null);
    setSelectedTextId(null);
    setSelectedOverlayId(null);
    if (id) setActiveTab("edit");
  }, []);

  const selectAudio = useCallback((id: string | null) => {
    setSelectedAudioId(id);
    setSelectedClipId(null);
    setSelectedTextId(null);
    setSelectedOverlayId(null);
    if (id) setActiveTab("audio");
  }, []);

  const selectText = useCallback((id: string | null) => {
    setSelectedTextId(id);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setSelectedOverlayId(null);
    if (id) setActiveTab("text");
  }, []);

  const selectOverlay = useCallback((id: string | null) => {
    setSelectedOverlayId(id);
    setSelectedClipId(null);
    setSelectedAudioId(null);
    setSelectedTextId(null);
    if (id) setActiveTab("overlay");
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
    activeTab,
    setActiveTab,
    timelineZoom,
    setTimelineZoom,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    addAsset,
    removeAsset,
    addClipFromAsset,
    updateClip,
    removeClip,
    duplicateClip,
    reorderClips,
    splitClipAtTime,
    trimClip,
    addAudioTrack,
    updateAudioTrack,
    removeAudioTrack,
    addTextLayer,
    updateTextLayer,
    removeTextLayer,
    addOverlayLayer,
    updateOverlayLayer,
    removeOverlayLayer,
    setAspectRatio,
    setProjectTitle,
  };
}

