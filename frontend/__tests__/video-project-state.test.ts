import { renderHook, act } from "@testing-library/react";
import {
  computeClipTimeRanges,
  findClipAtTime,
  useProjectState,
} from "@/components/tools/video-editor/state/useProjectState";
import {
  createDefaultClip,
  getEffectiveClipDuration,
  getTotalProjectDuration,
} from "@/components/tools/video-editor/state/projectDefaults";
import { MediaAsset, VideoClip, VideoProject } from "@/components/tools/video-editor/types";

// Mock URL methods for jsdom
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = jest.fn(() => "blob:mock-url");
  URL.revokeObjectURL = jest.fn();
}

describe("Video Editor Project State & Utilities", () => {
  const dummyAsset: MediaAsset = {
    id: "asset_1",
    name: "test.mp4",
    type: "video",
    file: new File([""], "test.mp4", { type: "video/mp4" }),
    objectUrl: "blob:test",
    duration: 10.0,
    size: 1024,
  };

  describe("projectDefaults", () => {
    it("creates a default clip correctly from asset", () => {
      const clip = createDefaultClip(dummyAsset);
      expect(clip.assetId).toBe("asset_1");
      expect(clip.sourceDuration).toBe(10.0);
      expect(clip.startTrim).toBe(0);
      expect(clip.endTrim).toBe(10.0);
      expect(clip.speed).toBe(1.0);
      expect(clip.isReversed).toBe(false);
      expect(clip.volume).toBe(1.0);
    });

    it("computes effective clip duration accounting for trim and speed", () => {
      const clip = createDefaultClip(dummyAsset);
      clip.startTrim = 2.0;
      clip.endTrim = 8.0; // 6 seconds raw
      clip.speed = 2.0;   // 2x speed => 3.0 seconds effective
      expect(getEffectiveClipDuration(clip)).toBe(3.0);
    });
  });

  describe("computeClipTimeRanges and findClipAtTime", () => {
    it("computes sequential timeline ranges for clips", () => {
      const clip1 = { ...createDefaultClip(dummyAsset), id: "c1", startTrim: 0, endTrim: 4, speed: 1 };
      const clip2 = { ...createDefaultClip(dummyAsset), id: "c2", startTrim: 0, endTrim: 6, speed: 1 };
      const ranges = computeClipTimeRanges([clip1, clip2]);

      expect(ranges).toHaveLength(2);
      expect(ranges[0].startTime).toBe(0);
      expect(ranges[0].endTime).toBe(4);
      expect(ranges[1].startTime).toBe(4);
      expect(ranges[1].endTime).toBe(10);
    });

    it("finds the active clip and local source time at a given timeline position", () => {
      const clip1 = { ...createDefaultClip(dummyAsset), id: "c1", startTrim: 1, endTrim: 5, speed: 1 }; // 4s: [0, 4]
      const clip2 = { ...createDefaultClip(dummyAsset), id: "c2", startTrim: 0, endTrim: 6, speed: 2 }; // 3s: [4, 7]
      const ranges = computeClipTimeRanges([clip1, clip2]);

      const match1 = findClipAtTime(ranges, 2.5);
      expect(match1).not.toBeNull();
      expect(match1?.clip.id).toBe("c1");
      expect(match1?.localSourceTime).toBe(1 + 2.5); // startTrim + elapsed

      const match2 = findClipAtTime(ranges, 5.0); // 1.0s into clip2
      expect(match2).not.toBeNull();
      expect(match2?.clip.id).toBe("c2");
      expect(match2?.localSourceTime).toBe(0 + 1.0 * 2); // 2.0s into source
    });
  });

  describe("useProjectState hook actions", () => {
    it("adds clip, trims it, splits it, and supports undo/redo", () => {
      const { result } = renderHook(() => useProjectState());

      // 1. Add Asset
      let asset: MediaAsset;
      act(() => {
        asset = result.current.addAsset(dummyAsset.file, "video", 10.0);
      });
      expect(result.current.project.assets).toHaveLength(1);

      // 2. Add Clip to timeline
      act(() => {
        result.current.addClipFromAsset(result.current.project.assets[0].id);
      });
      expect(result.current.project.clips).toHaveLength(1);
      const clipId = result.current.project.clips[0].id;
      expect(result.current.totalDuration).toBe(10.0);

      // 3. Trim Clip
      act(() => {
        result.current.trimClip(clipId, 1.0, 7.0);
      });
      expect(result.current.project.clips[0].startTrim).toBe(1.0);
      expect(result.current.project.clips[0].endTrim).toBe(7.0);
      expect(result.current.totalDuration).toBe(6.0);

      // 4. Split Clip at timeline time 3.0 (which is 2s from start of clip)
      act(() => {
        result.current.splitClipAtTime(3.0, clipId);
      });
      expect(result.current.project.clips).toHaveLength(2);
      expect(result.current.project.clips[0].startTrim).toBe(1.0);
      expect(result.current.project.clips[0].endTrim).toBe(4.0);
      expect(result.current.project.clips[1].startTrim).toBe(4.0);
      expect(result.current.project.clips[1].endTrim).toBe(7.0);
      expect(result.current.totalDuration).toBe(6.0);

      // 5. Test Undo
      expect(result.current.canUndo).toBe(true);
      act(() => {
        result.current.undo();
      });
      expect(result.current.project.clips).toHaveLength(1);
      expect(result.current.project.clips[0].endTrim).toBe(7.0);

      // 6. Test Redo
      expect(result.current.canRedo).toBe(true);
      act(() => {
        result.current.redo();
      });
      expect(result.current.project.clips).toHaveLength(2);
    });

    it("handles reordering and duplicating clips", () => {
      const { result } = renderHook(() => useProjectState());

      act(() => {
        const a1 = result.current.addAsset(dummyAsset.file, "video", 5.0);
        result.current.addClipFromAsset(a1.id);
      });

      const firstClipId = result.current.project.clips[0].id;

      // Duplicate
      act(() => {
        result.current.duplicateClip(firstClipId);
      });
      expect(result.current.project.clips).toHaveLength(2);
      expect(result.current.project.clips[1].name).toContain("(Copy)");

      // Reorder
      act(() => {
        result.current.reorderClips(0, 1);
      });
      expect(result.current.project.clips[0].name).toContain("(Copy)");
    });

    it("handles audio and text layers", () => {
      const { result } = renderHook(() => useProjectState());

      act(() => {
        const a1 = result.current.addAsset(
          new File([""], "song.mp3", { type: "audio/mp3" }),
          "audio",
          30.0
        );
        result.current.addAudioTrack(a1.id, 0);
        result.current.addTextLayer(2.0, "Hello World");
      });

      expect(result.current.project.audioTracks).toHaveLength(1);
      expect(result.current.project.textLayers).toHaveLength(1);
      expect(result.current.project.textLayers[0].text).toBe("Hello World");
      expect(result.current.project.textLayers[0].timelineStart).toBe(2.0);
    });

    it("strictly prevents split clips or moved clips from overlapping adjacent clips", () => {
      const { result } = renderHook(() => useProjectState());

      act(() => {
        const a1 = result.current.addAsset(dummyAsset.file, "video", 20.0);
        result.current.addClipFromAsset(a1.id); // [0, 20]
      });

      const initialClipId = result.current.project.clips[0].id;

      // Split at 8.0s -> clip1: [0, 8], clip2: [8, 20]
      act(() => {
        result.current.splitClipAtTime(8.0, initialClipId);
      });

      expect(result.current.project.clips).toHaveLength(2);
      const clip1 = result.current.project.clips[0];
      const clip2 = result.current.project.clips[1];
      expect(clip1.timelineStart).toBe(0);
      expect(clip2.timelineStart).toBe(8.0);

      // Attempt to drag clip2 to 5.0s (into clip1)
      act(() => {
        result.current.moveClip(clip2.id, 5.0);
      });

      // Must be clamped to 8.0 (clip1 end), NEVER overlapping clip1!
      expect(result.current.project.clips[1].timelineStart).toBe(8.0);

      // Trimming clip1 end cannot push into clip2
      act(() => {
        result.current.trimClip(clip1.id, 0, 15.0);
      });
      // clip1 endTrim should be clamped so it doesn't exceed clip2's start (8.0s)
      expect(result.current.project.clips[0].endTrim).toBeLessThanOrEqual(8.0);
    });

    it("auto-heals any overlapping clips in computeClipTimeRanges", () => {
      // Create two clips that would overlap if not clamped
      const rawClip1 = { ...createDefaultClip(dummyAsset), id: "c1", startTrim: 0, endTrim: 10, timelineStart: 0 };
      const rawClip2 = { ...createDefaultClip(dummyAsset), id: "c2", startTrim: 0, endTrim: 10, timelineStart: 5 }; // overlaps c1 by 5s

      const ranges = computeClipTimeRanges([rawClip1, rawClip2]);
      expect(ranges[0].startTime).toBe(0);
      expect(ranges[0].endTime).toBe(10);
      // c2 MUST start at 10, not 5!
      expect(ranges[1].startTime).toBe(10);
      expect(ranges[1].endTime).toBe(20);
    });
  });
});

