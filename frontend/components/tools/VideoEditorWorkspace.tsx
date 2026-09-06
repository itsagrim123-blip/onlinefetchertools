"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Film,
  Layers,
  Music,
  Plus,
  Scissors,
  Sliders,
  Sparkles,
  Type,
  Video,
} from "lucide-react";
import { useProjectState } from "./video-editor/state/useProjectState";
import { CanvasPreview } from "./video-editor/components/CanvasPreview";
import { Timeline } from "./video-editor/components/Timeline";
import { ProjectMediaBin } from "./video-editor/components/ProjectMediaBin";
import { ClipInspector } from "./video-editor/components/inspector/ClipInspector";
import { AudioInspector } from "./video-editor/components/inspector/AudioInspector";
import { TextInspector } from "./video-editor/components/inspector/TextInspector";
import { FilterInspector } from "./video-editor/components/inspector/FilterInspector";
import { TransitionModal } from "./video-editor/components/inspector/TransitionModal";
import { ExportModal } from "./video-editor/components/ExportModal";
import {
  ActiveToolTab,
  AspectRatioPreset,
  ClipTransition,
  ExportSettings,
} from "./video-editor/types";
import { normalizeBlob, parseFilename, resolveMimeType } from "@/lib/download";

export function VideoEditorWorkspace() {
  const {
    project,
    totalDuration,
    currentTime,
    setCurrentTime,
    isPlaying,
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
    canUndo,
    canRedo,
    undo,
    redo,
    addAsset,
    removeAsset,
    addClipFromAsset,
    updateClip,
    removeClip,
    duplicateClip,
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
  } = useProjectState();

  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [transitionClipId, setTransitionClipId] = useState<string | null>(null);

  // Keyboard Shortcuts (Undo, Redo, Play/Pause, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Space -> Toggle Play
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Delete key
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          removeClip(selectedClipId);
        } else if (selectedAudioId) {
          e.preventDefault();
          removeAudioTrack(selectedAudioId);
        } else if (selectedTextId) {
          e.preventDefault();
          removeTextLayer(selectedTextId);
        } else if (selectedOverlayId) {
          e.preventDefault();
          removeOverlayLayer(selectedOverlayId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    togglePlay,
    selectedClipId,
    selectedAudioId,
    selectedTextId,
    selectedOverlayId,
    removeClip,
    removeAudioTrack,
    removeTextLayer,
    removeOverlayLayer,
  ]);

  // Active clip object
  const selectedClip = project.clips.find((c) => c.id === selectedClipId);
  const selectedAudio = project.audioTracks.find((a) => a.id === selectedAudioId);
  const selectedText = project.textLayers.find((t) => t.id === selectedTextId);

  // Handle Delete Selected
  const handleDeleteSelected = () => {
    if (selectedClipId) removeClip(selectedClipId);
    else if (selectedAudioId) removeAudioTrack(selectedAudioId);
    else if (selectedTextId) removeTextLayer(selectedTextId);
    else if (selectedOverlayId) removeOverlayLayer(selectedOverlayId);
  };

  // Handle Duplicate Selected
  const handleDuplicateSelected = () => {
    if (selectedClipId) duplicateClip(selectedClipId);
  };

  // Backend Export Execution
  const handleExportProject = async (
    settings: ExportSettings
  ): Promise<{ url: string; name: string; size: number } | null> => {
    // Construct backend manifest
    const manifest = {
      title: project.title || "video_project",
      settings: {
        aspect_ratio: project.settings.aspectRatio,
        canvas_width: project.settings.canvasWidth,
        canvas_height: project.settings.canvasHeight,
        fps: settings.fps,
      },
      clips: project.clips.map((c) => ({
        id: c.id,
        asset_id: c.assetId,
        name: c.name,
        type: c.type,
        source_duration: c.sourceDuration,
        start_trim: c.startTrim,
        end_trim: c.endTrim,
        speed: c.speed,
        is_reversed: c.isReversed,
        volume: c.volume,
        is_muted: c.isMuted,
        fade_in_duration: c.fadeInDuration,
        fade_out_duration: c.fadeOutDuration,
        scale: c.scale,
        rotation: c.rotation,
        flip_horizontal: c.flipHorizontal,
        flip_vertical: c.flipVertical,
        offset_x: c.offsetX,
        offset_y: c.offsetY,
        filter_preset: c.filterPreset,
        brightness: c.brightness,
        contrast: c.contrast,
        saturation: c.saturation,
        transition: c.transition
          ? {
              type: c.transition.type,
              duration: c.transition.duration,
            }
          : undefined,
      })),
      audio_tracks: project.audioTracks.map((a) => ({
        id: a.id,
        asset_id: a.assetId,
        name: a.name,
        source_duration: a.sourceDuration,
        timeline_start: a.timelineStart,
        start_trim: a.startTrim,
        duration: a.duration,
        volume: a.volume,
        is_muted: a.isMuted,
        fade_in_duration: a.fadeInDuration,
        fade_out_duration: a.fadeOutDuration,
      })),
      text_layers: project.textLayers.map((t) => ({
        id: t.id,
        text: t.text,
        timeline_start: t.timelineStart,
        duration: t.duration,
        font_size: t.fontSize,
        font_color: t.fontColor,
        background_color: t.backgroundColor,
        alignment: t.alignment,
        is_bold: t.isBold,
        is_italic: t.isItalic,
        animation: t.animation,
        position_x: t.positionX,
        position_y: t.positionY,
      })),
      overlay_layers: project.overlayLayers.map((o) => ({
        id: o.id,
        asset_id: o.assetId,
        name: o.name,
        timeline_start: o.timelineStart,
        duration: o.duration,
        scale: o.scale,
        opacity: o.opacity,
        position_x: o.positionX,
        position_y: o.positionY,
        rotation: o.rotation,
      })),
      export_settings: {
        format: settings.format,
        resolution: settings.resolution,
        quality: settings.quality,
        fps: settings.fps,
      },
    };

    const formData = new FormData();
    formData.append("manifest", JSON.stringify(manifest));

    // Append asset files
    for (const asset of project.assets) {
      formData.append(`asset_${asset.id}`, asset.file, asset.name);
    }

    const res = await fetch("/api/media/project-render", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let detail = "Export render failed.";
      try {
        const data = await res.json();
        if (data?.detail) detail = data.detail;
      } catch {
        // use default
      }
      throw new Error(detail);
    }

    const rawBlob = await res.blob();
    const filename = parseFilename(
      res.headers,
      project.title || "video_project",
      `.${settings.format}`
    );
    const mimeType = resolveMimeType(
      res.headers.get("content-type"),
      filename,
      rawBlob.type
    );
    const safeBlob = normalizeBlob(rawBlob, mimeType);
    const blobUrl = URL.createObjectURL(safeBlob);

    return {
      url: blobUrl,
      name: filename,
      size: safeBlob.size,
    };
  };

  // Transition Modal Helpers
  const transitionClip = project.clips.find((c) => c.id === transitionClipId);
  const handleApplyTransition = (trans: ClipTransition | undefined) => {
    if (transitionClipId) {
      updateClip(transitionClipId, { transition: trans });
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3.5 sm:p-4 text-white shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 shadow-inner">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={project.title}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="bg-transparent text-sm sm:text-base font-bold text-white border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:outline-none transition"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-Clip Video Editor · Real-time Preview & FFmpeg Render
            </p>
          </div>
        </div>

        {/* Aspect Ratio Selector & Export Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Aspect Ratio Presets */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs">
            {(["16:9", "9:16", "1:1", "4:5"] as AspectRatioPreset[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  project.settings.aspectRatio === ratio
                    ? "bg-cyan-400 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-950/40 hover:brightness-110 active:scale-95 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Preview Canvas + Inspector Side Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Canvas Preview Player (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <CanvasPreview
            project={project}
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            onTimeUpdate={setCurrentTime}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
          />
        </div>

        {/* Right Column: Tabbed Inspector & Media Bin (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Tool Navigation Tabs */}
          <div className="flex items-center justify-between gap-1 rounded-2xl border border-white/10 bg-slate-950/70 p-1.5 text-xs text-white">
            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium transition ${
                activeTab === "media"
                  ? "bg-cyan-400 text-slate-950 font-semibold shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Film className="h-3.5 w-3.5" /> Media
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium transition ${
                activeTab === "edit"
                  ? "bg-cyan-400 text-slate-950 font-semibold shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Scissors className="h-3.5 w-3.5" /> Clip
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audio")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium transition ${
                activeTab === "audio"
                  ? "bg-cyan-400 text-slate-950 font-semibold shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Music className="h-3.5 w-3.5" /> Audio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("text")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium transition ${
                activeTab === "text"
                  ? "bg-cyan-400 text-slate-950 font-semibold shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Type className="h-3.5 w-3.5" /> Text
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("filter")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium transition ${
                activeTab === "filter"
                  ? "bg-cyan-400 text-slate-950 font-semibold shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Filter
            </button>
          </div>

          {/* Active Tab Panel Content */}
          <div className="min-h-[380px]">
            {activeTab === "media" && (
              <ProjectMediaBin
                assets={project.assets}
                onAddAsset={addAsset}
                onRemoveAsset={removeAsset}
                onAddClipToTimeline={(id) => addClipFromAsset(id)}
                onAddAudioToTimeline={(id) => addAudioTrack(id, currentTime)}
                onAddOverlayToTimeline={(id) => addOverlayLayer(id, currentTime)}
              />
            )}

            {activeTab === "edit" && (
              selectedClip ? (
                <ClipInspector
                  clip={selectedClip}
                  onUpdateClip={(partial) => updateClip(selectedClip.id, partial)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-8 text-center text-slate-400 h-[340px]">
                  <Scissors className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-white">No Clip Selected</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Click on any clip in the timeline track below to adjust speed, reverse, transforms, or volume.
                  </p>
                </div>
              )
            )}

            {activeTab === "audio" && (
              selectedAudio ? (
                <AudioInspector
                  track={selectedAudio}
                  onUpdateTrack={(partial) => updateAudioTrack(selectedAudio.id, partial)}
                  onRemoveTrack={() => removeAudioTrack(selectedAudio.id)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-8 text-center text-slate-400 h-[340px] space-y-3">
                  <Music className="h-8 w-8 text-slate-600" />
                  <div>
                    <p className="text-xs font-semibold text-white">Background Music</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Upload an MP3/WAV file in the Media tab and click &quot;+ Track&quot; to add background music.
                    </p>
                  </div>
                </div>
              )
            )}

            {activeTab === "text" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Add titles, subtitles, or captions:</span>
                  <button
                    type="button"
                    onClick={() => addTextLayer(currentTime, "Sample Title")}
                    className="inline-flex h-8 items-center gap-1 rounded-xl bg-cyan-400/20 px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/30 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Text
                  </button>
                </div>

                {selectedText ? (
                  <TextInspector
                    layer={selectedText}
                    onUpdateLayer={(partial) => updateTextLayer(selectedText.id, partial)}
                    onRemoveLayer={() => removeTextLayer(selectedText.id)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-8 text-center text-slate-400 h-[280px]">
                    <Type className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-white">No Text Layer Selected</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Click &quot;Add Text&quot; or select a text block on the timeline.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "filter" && (
              selectedClip ? (
                <FilterInspector
                  clip={selectedClip}
                  onUpdateClip={(partial) => updateClip(selectedClip.id, partial)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-8 text-center text-slate-400 h-[340px]">
                  <Sparkles className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-white">No Clip Selected</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Select a clip in the timeline to apply color adjustments and preset filters.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Full-width Multi-Track Timeline */}
      <div className="w-full pt-1">
        <Timeline
          project={project}
          currentTime={currentTime}
          totalDuration={totalDuration}
          selectedClipId={selectedClipId}
          selectedAudioId={selectedAudioId}
          selectedTextId={selectedTextId}
          selectedOverlayId={selectedOverlayId}
          zoom={timelineZoom}
          canUndo={canUndo}
          canRedo={canRedo}
          onSeek={seekTo}
          onSelectClip={(id) => selectClip(id)}
          onSelectAudio={(id) => selectAudio(id)}
          onSelectText={(id) => selectText(id)}
          onSelectOverlay={(id) => selectOverlay(id)}
          onSplit={(t) => splitClipAtTime(t)}
          onTrimClip={(id, start, end) => trimClip(id, start, end)}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onUndo={undo}
          onRedo={redo}
          onZoomChange={setTimelineZoom}
          onOpenTransitionModal={(id) => setTransitionClipId(id)}
        />
      </div>

      {/* Transition Picker Modal */}
      {transitionClip && (
        <TransitionModal
          isOpen={Boolean(transitionClipId)}
          initialTransition={transitionClip.transition}
          onClose={() => setTransitionClipId(null)}
          onApply={handleApplyTransition}
        />
      )}

      {/* Export Render Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        project={project}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportProject}
      />
    </section>
  );
}
