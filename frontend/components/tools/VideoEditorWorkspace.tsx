"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProjectState } from "./video-editor/state/useProjectState";
import { EditorTopBar } from "./video-editor/components/EditorTopBar";
import { EditorSidebar } from "./video-editor/components/EditorSidebar";
import { EditorToolDrawer } from "./video-editor/components/EditorToolDrawer";
import { CanvasPreview } from "./video-editor/components/CanvasPreview";
import { EditorToolbar } from "./video-editor/components/EditorToolbar";
import { RightPropertiesPanel } from "./video-editor/components/RightPropertiesPanel";
import { Timeline } from "./video-editor/components/Timeline";
import { EditorStatusBar } from "./video-editor/components/EditorStatusBar";
import { MobileBottomNav } from "./video-editor/components/mobile/MobileBottomNav";
import { MobileBottomSheet } from "./video-editor/components/mobile/MobileBottomSheet";
import { ExportModal } from "./video-editor/components/ExportModal";
import { TransitionModal } from "./video-editor/components/inspector/TransitionModal";
import {
  AspectRatioPreset,
  ClipPropertyTab,
  ClipTransition,
  ExportSettings,
  FilterPreset,
  MediaType,
  MobileSheetType,
  SidebarTab,
  TransitionType,
} from "./video-editor/types";
import { normalizeBlob, parseFilename, resolveMimeType } from "@/lib/download";
import { Keyboard, X } from "lucide-react";

function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isDesktop;
}

export function VideoEditorWorkspace() {
  const {
    project,
    clipRanges,
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
    sidebarTab,
    setSidebarTab,
    clipTab,
    setClipTab,
    mobileSheet,
    setMobileSheet,
    timelineZoom,
    setTimelineZoom,
    canUndo,
    canRedo,
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
    splitClipAtTime,
    trimClip,
    insertFreezeFrame,
    addAudioTrack,
    updateAudioTrack,
    removeAudioTrack,
    duplicateAudioTrack,
    extractAudioFromClip,
    addTextLayer,
    updateTextLayer,
    removeTextLayer,
    duplicateTextLayer,
    addAutoCaptions,
    addOverlayLayer,
    updateOverlayLayer,
    removeOverlayLayer,
    duplicateOverlayLayer,
    moveClip,
    moveAudioTrack,
    resizeAudioTrack,
    moveTextLayer,
    resizeTextLayer,
    moveOverlayLayer,
    resizeOverlayLayer,
    toggleSnap,
    setAspectRatio,
    setProjectTitle,
  } = useProjectState();

  const isDesktop = useIsDesktop(1024);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [transitionClipId, setTransitionClipId] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Selected entities
  const selectedClip = useMemo(
    () => project.clips.find((c) => c.id === selectedClipId),
    [project.clips, selectedClipId]
  );
  const selectedAudio = useMemo(
    () => project.audioTracks.find((a) => a.id === selectedAudioId),
    [project.audioTracks, selectedAudioId]
  );
  const selectedText = useMemo(
    () => project.textLayers.find((t) => t.id === selectedTextId),
    [project.textLayers, selectedTextId]
  );
  const selectedOverlay = useMemo(
    () => project.overlayLayers.find((o) => o.id === selectedOverlayId),
    [project.overlayLayers, selectedOverlayId]
  );

  // Check if split is active at current playhead
  const canSplit = useMemo(() => {
    if (project.clips.length === 0) return false;
    return clipRanges.some(
      (r) => currentTime > r.startTime + 0.15 && currentTime < r.endTime - 0.15
    );
  }, [project.clips.length, clipRanges, currentTime]);

  const hasSelectedItem = Boolean(
    selectedClipId || selectedAudioId || selectedTextId || selectedOverlayId
  );

  // Operations
  const handleDeleteSelected = useCallback(() => {
    if (selectedClipId) removeClip(selectedClipId);
    else if (selectedAudioId) removeAudioTrack(selectedAudioId);
    else if (selectedTextId) removeTextLayer(selectedTextId);
    else if (selectedOverlayId) removeOverlayLayer(selectedOverlayId);
  }, [selectedClipId, selectedAudioId, selectedTextId, selectedOverlayId, removeClip, removeAudioTrack, removeTextLayer, removeOverlayLayer]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedClipId) duplicateClip(selectedClipId);
    else if (selectedAudioId) duplicateAudioTrack(selectedAudioId);
    else if (selectedTextId) duplicateTextLayer(selectedTextId);
    else if (selectedOverlayId) duplicateOverlayLayer(selectedOverlayId);
  }, [selectedClipId, selectedAudioId, selectedTextId, selectedOverlayId, duplicateClip, duplicateAudioTrack, duplicateTextLayer, duplicateOverlayLayer]);

  const handleReverseSelected = useCallback(() => {
    if (selectedClip) {
      updateClip(selectedClip.id, { isReversed: !selectedClip.isReversed });
    }
  }, [selectedClip, updateClip]);

  const handleFreezeFrameSelected = useCallback(() => {
    if (selectedClipId) {
      insertFreezeFrame(selectedClipId, undefined, undefined, 2.0);
    }
  }, [selectedClipId, insertFreezeFrame]);

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

      // Space -> Play / Pause
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
        if (hasSelectedItem) {
          e.preventDefault();
          handleDeleteSelected();
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
    hasSelectedItem,
    handleDeleteSelected,
  ]);

  // Backend Export Execution
  const handleExportProject = async (
    settings: ExportSettings
  ): Promise<{ url: string; name: string; size: number } | null> => {
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
        timeline_start: c.timelineStart,
        track_id: c.trackId || "video_1",
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
        opacity: c.opacity ?? 1.0,
        crop_preset: c.cropPreset || "original",
        filter_preset: c.filterPreset,
        brightness: c.brightness,
        contrast: c.contrast,
        saturation: c.saturation,
        exposure: c.exposure || 0,
        temperature: c.temperature || 0,
        tint: c.tint || 0,
        highlights: c.highlights || 0,
        shadows: c.shadows || 0,
        vignette: c.vignette || 0,
        grain: c.grain || 0,
        filter_intensity: c.filterIntensity ?? 100,
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
        track_id: a.trackId || "audio_1",
        start_trim: a.startTrim,
        duration: a.duration,
        volume: a.volume,
        is_muted: a.isMuted,
        fade_in_duration: a.fadeInDuration,
        fade_out_duration: a.fadeOutDuration,
        voice_effect: a.voiceEffect || "none",
        noise_reduction: Boolean(a.noiseReduction),
      })),
      text_layers: project.textLayers.map((t) => ({
        id: t.id,
        text: t.text,
        timeline_start: t.timelineStart,
        track_id: t.trackId || "text_1",
        duration: t.duration,
        font_size: t.fontSize,
        font_color: t.fontColor,
        font_family: t.fontFamily || "Arial",
        background_color: t.backgroundColor,
        stroke_color: t.strokeColor || null,
        stroke_width: t.strokeWidth || 0,
        shadow_color: t.shadowColor || null,
        shadow_blur: t.shadowBlur || 0,
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
        track_id: o.trackId || "overlay_1",
        duration: o.duration,
        scale: o.scale,
        opacity: o.opacity,
        position_x: o.positionX,
        position_y: o.positionY,
        rotation: o.rotation,
        blend_mode: o.blendMode || "normal",
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

  // Stable Modal and Dialog Toggles
  const handleOpenExportModal = useCallback(() => setIsExportModalOpen(true), []);
  const handleCloseExportModal = useCallback(() => setIsExportModalOpen(false), []);
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleOpenHelp = useCallback(() => setIsHelpOpen(true), []);
  const handleCloseHelp = useCallback(() => setIsHelpOpen(false), []);

  const handleAspectRatioChange = useCallback(
    (ratio: AspectRatioPreset) => {
      setAspectRatio(ratio);
    },
    [setAspectRatio]
  );

  const handleUpdateSettings = useCallback(
    (settings: { aspectRatio?: AspectRatioPreset }) => {
      if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
    },
    [setAspectRatio]
  );

  // Tool Drawer Actions
  const handleAddClipFromAsset = useCallback(
    (assetId: string) => addClipFromAsset(assetId),
    [addClipFromAsset]
  );
  const handleAddAudioAtCurrent = useCallback(
    (assetId: string) => addAudioTrack(assetId),
    [addAudioTrack]
  );
  const handleAddOverlayAtCurrent = useCallback(
    (assetId: string) => addOverlayLayer(assetId),
    [addOverlayLayer]
  );
  const handleAddTextAtCurrent = useCallback(
    (time?: number, text?: string) => addTextLayer(time, text || "Sample Title"),
    [addTextLayer]
  );
  const handleApplyFilterPreset = useCallback(
    (filter: string) => {
      if (selectedClipId) updateClip(selectedClipId, { filterPreset: filter as FilterPreset });
    },
    [selectedClipId, updateClip]
  );
  const handleApplyDrawerTransition = useCallback(
    (trans: TransitionType) => {
      if (selectedClipId) updateClip(selectedClipId, { transition: { type: trans, duration: 0.5 } });
    },
    [selectedClipId, updateClip]
  );

  // Inspector Partial Handlers
  const handleUpdateClipPartial = useCallback(
    (partial: Parameters<typeof updateClip>[1]) => {
      if (selectedClipId) updateClip(selectedClipId, partial);
    },
    [selectedClipId, updateClip]
  );
  const handleUpdateAudioPartial = useCallback(
    (partial: Parameters<typeof updateAudioTrack>[1]) => {
      if (selectedAudioId) updateAudioTrack(selectedAudioId, partial);
    },
    [selectedAudioId, updateAudioTrack]
  );
  const handleRemoveAudioSelected = useCallback(() => {
    if (selectedAudioId) removeAudioTrack(selectedAudioId);
  }, [selectedAudioId, removeAudioTrack]);

  const handleUpdateTextPartial = useCallback(
    (partial: Parameters<typeof updateTextLayer>[1]) => {
      if (selectedTextId) updateTextLayer(selectedTextId, partial);
    },
    [selectedTextId, updateTextLayer]
  );
  const handleRemoveTextSelected = useCallback(() => {
    if (selectedTextId) removeTextLayer(selectedTextId);
  }, [selectedTextId, removeTextLayer]);

  const handleUpdateOverlayPartial = useCallback(
    (partial: Parameters<typeof updateOverlayLayer>[1]) => {
      if (selectedOverlayId) updateOverlayLayer(selectedOverlayId, partial);
    },
    [selectedOverlayId, updateOverlayLayer]
  );
  const handleRemoveOverlaySelected = useCallback(() => {
    if (selectedOverlayId) removeOverlayLayer(selectedOverlayId);
  }, [selectedOverlayId, removeOverlayLayer]);

  // Toolbar tab switchers
  const handleTrimTab = useCallback(() => setClipTab("video"), [setClipTab]);
  const handleSpeedTab = useCallback(() => setClipTab("speed"), [setClipTab]);
  const handleAudioTab = useCallback(() => setClipTab("audio"), [setClipTab]);
  const handleFiltersTab = useCallback(() => {
    setClipTab("adjust");
    setSidebarTab("filters");
  }, [setClipTab, setSidebarTab]);
  const handleAdjustTab = useCallback(() => setClipTab("adjust"), [setClipTab]);
  const handleAddMediaClick = useCallback(() => setSidebarTab("media"), [setSidebarTab]);

  const handleSplitCurrentTime = useCallback(() => {
    splitClipAtTime();
  }, [splitClipAtTime]);

  // Mobile Handlers
  const handleOpenMobileSheet = useCallback((sheet: MobileSheetType) => {
    setMobileSheet(sheet);
  }, [setMobileSheet]);
  const handleCloseMobileSheet = useCallback(() => {
    setMobileSheet(null);
  }, [setMobileSheet]);

  const handleMobileTrim = useCallback(() => handleOpenMobileSheet("clip_edit"), [handleOpenMobileSheet]);
  const handleMobileSpeed = useCallback(() => handleOpenMobileSheet("speed"), [handleOpenMobileSheet]);
  const handleMobileFilters = useCallback(() => handleOpenMobileSheet("filters"), [handleOpenMobileSheet]);
  const handleMobileAdjust = useCallback(() => handleOpenMobileSheet("adjust"), [handleOpenMobileSheet]);
  const handleMobileAddMedia = useCallback(() => handleOpenMobileSheet("media"), [handleOpenMobileSheet]);

  const handleMobileDeleteSelected = useCallback(() => {
    handleDeleteSelected();
    setMobileSheet(null);
  }, [handleDeleteSelected, setMobileSheet]);

  // Transition Modal Helpers
  const transitionClip = useMemo(
    () => project.clips.find((c) => c.id === transitionClipId),
    [project.clips, transitionClipId]
  );
  const handleApplyTransition = useCallback(
    (trans: ClipTransition | undefined) => {
      if (transitionClipId) {
        updateClip(transitionClipId, { transition: trans });
      }
    },
    [transitionClipId, updateClip]
  );
  const handleCloseTransitionModal = useCallback(() => setTransitionClipId(null), []);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white select-none overflow-hidden">
      {/* Top Header Bar */}
      <EditorTopBar
        projectTitle={project.title}
        aspectRatio={project.settings.aspectRatio}
        canExport={project.clips.length > 0}
        onProjectTitleChange={setProjectTitle}
        onAspectRatioChange={handleAspectRatioChange}
        onExportClick={handleOpenExportModal}
        onSettingsClick={handleOpenSettings}
        onHelpClick={handleOpenHelp}
      />

      {/* Conditional Layout: Mount either Desktop Studio or Mobile Layout */}
      {isDesktop ? (
        /* ========================================================================= */
        /* DESKTOP LAYOUT (4-column Studio Workspace: Sidebar + Drawer + Center + Right) */
        /* ========================================================================= */
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
          {/* Upper Studio: Sidebar, Drawer, Dominant Preview Player, Properties Panel */}
          <div className="flex flex-1 min-h-0 w-full overflow-hidden border-b border-white/10">
            {/* Col 1: Vertical Sidebar (80px) */}
            <EditorSidebar
              activeTab={sidebarTab}
              onSelectTab={setSidebarTab}
            />

            {/* Col 2: Contextual Tool Drawer (300px) */}
            <EditorToolDrawer
              activeTab={sidebarTab}
              project={project}
              onAddAsset={addAsset}
              onRemoveAsset={removeAsset}
              onAddClipToTimeline={handleAddClipFromAsset}
              onAddAudioToTimeline={handleAddAudioAtCurrent}
              onAddOverlayToTimeline={handleAddOverlayAtCurrent}
              onAddTextLayer={handleAddTextAtCurrent}
              onAddAutoCaptions={addAutoCaptions}
              onApplyFilterPreset={handleApplyFilterPreset}
              selectedClipFilterPreset={selectedClip?.filterPreset}
              onApplyTransition={handleApplyDrawerTransition}
              onSetAspectRatio={handleAspectRatioChange}
              onUpdateTitle={setProjectTitle}
            />

            {/* Col 3: Center Stage: Dominant Preview Canvas (Flexible width & height) */}
            <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-950/60 p-2 sm:p-3 overflow-hidden">
              <CanvasPreview
                project={project}
                currentTime={currentTime}
                totalDuration={totalDuration}
                isPlaying={isPlaying}
                onTimeUpdate={setCurrentTime}
                onTogglePlay={togglePlay}
                onSeek={seekTo}
                onUpdateSettings={handleUpdateSettings}
                onOpenSettings={handleOpenSettings}
                selectedOverlayId={selectedOverlayId}
                onSelectOverlay={selectOverlay}
                onUpdateOverlay={updateOverlayLayer}
                onDeleteOverlay={removeOverlayLayer}
                selectedTextId={selectedTextId}
                onSelectText={selectText}
                onUpdateText={updateTextLayer}
              />
            </div>

            {/* Col 4: Right Properties Inspector (320px) */}
            <RightPropertiesPanel
              project={project}
              selectedClip={selectedClip}
              selectedAudio={selectedAudio}
              selectedText={selectedText}
              selectedOverlay={selectedOverlay}
              activeTab={clipTab}
              onTabChange={setClipTab}
              onUpdateClip={handleUpdateClipPartial}
              onUpdateAudio={handleUpdateAudioPartial}
              onRemoveAudio={handleRemoveAudioSelected}
              onUpdateText={handleUpdateTextPartial}
              onRemoveText={handleRemoveTextSelected}
              onUpdateOverlay={handleUpdateOverlayPartial}
              onRemoveOverlay={handleRemoveOverlaySelected}
              onSetAspectRatio={handleAspectRatioChange}
              onDeleteSelected={handleDeleteSelected}
              onReverseClip={handleReverseSelected}
              onFreezeFrame={handleFreezeFrameSelected}
              onExtractAudio={extractAudioFromClip}
              onDuplicateSelected={handleDuplicateSelected}
            />
          </div>

          {/* Row 2: Full-width Mid Editing Toolbar spanning directly above the timeline */}
          <div className="w-full shrink-0 border-b border-white/10 bg-slate-950">
            <EditorToolbar
              selectedClip={selectedClip}
              hasSelectedClip={Boolean(selectedClipId)}
              hasSelectedItem={hasSelectedItem}
              canSplit={canSplit}
              onSplit={handleSplitCurrentTime}
              onDelete={handleDeleteSelected}
              onDuplicate={handleDuplicateSelected}
              onTrim={handleTrimTab}
              onCrop={handleTrimTab}
              onSpeed={handleSpeedTab}
              onVolume={handleAudioTab}
              onFilters={handleFiltersTab}
              onAdjust={handleAdjustTab}
              onReverse={handleReverseSelected}
              onFreezeFrame={handleFreezeFrameSelected}
            />
          </div>

          {/* Row 3: Full-width Docked Timeline */}
          <div className="w-full h-[224px] shrink-0 overflow-hidden bg-slate-950">
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
              onSelectClip={selectClip}
              onSelectAudio={selectAudio}
              onSelectText={selectText}
              onSelectOverlay={selectOverlay}
              onSplit={splitClipAtTime}
              onTrimClip={trimClip}
              onDuplicate={handleDuplicateSelected}
              onDelete={handleDeleteSelected}
              onUndo={undo}
              onRedo={redo}
              onZoomChange={setTimelineZoom}
              onOpenTransitionModal={setTransitionClipId}
              onToggleTrackVisibility={toggleTrackVisibility}
              onToggleTrackLock={toggleTrackLock}
              onAddMediaClick={handleAddMediaClick}
              onMoveClip={moveClip}
              onMoveAudio={moveAudioTrack}
              onResizeAudio={resizeAudioTrack}
              onMoveText={moveTextLayer}
              onResizeText={resizeTextLayer}
              onMoveOverlay={moveOverlayLayer}
              onResizeOverlay={resizeOverlayLayer}
              onToggleSnap={toggleSnap}
              hideTopToolbar={true}
            />
          </div>

          {/* Row 4: Status Bar */}
          <div className="w-full shrink-0">
            <EditorStatusBar
              project={project}
              totalDuration={totalDuration}
              zoom={timelineZoom}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onZoomChange={setTimelineZoom}
              onOpenSettings={handleOpenSettings}
            />
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MOBILE PORTRAIT LAYOUT (320px - 430px Responsive Stacked Experience) */
        /* ========================================================================= */
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-slate-950">
          {/* Preview Player Stage */}
          <div className="flex-1 min-h-0 w-full p-2 overflow-hidden flex flex-col items-center justify-center">
            <CanvasPreview
              project={project}
              currentTime={currentTime}
              totalDuration={totalDuration}
              isPlaying={isPlaying}
              onTimeUpdate={setCurrentTime}
              onTogglePlay={togglePlay}
              onSeek={seekTo}
              onUpdateSettings={handleUpdateSettings}
              onOpenSettings={handleOpenSettings}
              selectedOverlayId={selectedOverlayId}
              onSelectOverlay={selectOverlay}
              onUpdateOverlay={updateOverlayLayer}
              onDeleteOverlay={removeOverlayLayer}
              selectedTextId={selectedTextId}
              onSelectText={selectText}
              onUpdateText={updateTextLayer}
            />
          </div>

          {/* Compact Mid Editing Toolbar */}
          <div className="w-full shrink-0 border-t border-white/10 bg-slate-950">
            <EditorToolbar
              selectedClip={selectedClip}
              hasSelectedClip={Boolean(selectedClipId)}
              hasSelectedItem={hasSelectedItem}
              canSplit={canSplit}
              onSplit={handleSplitCurrentTime}
              onDelete={handleDeleteSelected}
              onDuplicate={handleDuplicateSelected}
              onTrim={handleMobileTrim}
              onCrop={handleMobileTrim}
              onSpeed={handleMobileSpeed}
              onVolume={handleMobileTrim}
              onFilters={handleMobileFilters}
              onAdjust={handleMobileAdjust}
              onReverse={handleReverseSelected}
              onFreezeFrame={handleFreezeFrameSelected}
            />
          </div>

          {/* Contained Timeline with touch scrubbing */}
          <div className="w-full h-[150px] shrink-0 border-t border-white/10 bg-slate-950 overflow-hidden">
            <Timeline
              project={project}
              currentTime={currentTime}
              totalDuration={totalDuration}
              selectedClipId={selectedClipId}
              selectedAudioId={selectedAudioId}
              selectedTextId={selectedTextId}
              selectedOverlayId={selectedOverlayId}
              zoom={Math.min(timelineZoom, 35)}
              canUndo={canUndo}
              canRedo={canRedo}
              onSeek={seekTo}
              onSelectClip={selectClip}
              onSelectAudio={selectAudio}
              onSelectText={selectText}
              onSelectOverlay={selectOverlay}
              onSplit={splitClipAtTime}
              onTrimClip={trimClip}
              onDuplicate={handleDuplicateSelected}
              onDelete={handleDeleteSelected}
              onUndo={undo}
              onRedo={redo}
              onZoomChange={setTimelineZoom}
              onOpenTransitionModal={setTransitionClipId}
              onToggleTrackVisibility={toggleTrackVisibility}
              onToggleTrackLock={toggleTrackLock}
              onAddMediaClick={handleMobileAddMedia}
              onMoveClip={moveClip}
              onMoveAudio={moveAudioTrack}
              onResizeAudio={resizeAudioTrack}
              onMoveText={moveTextLayer}
              onResizeText={resizeTextLayer}
              onMoveOverlay={moveOverlayLayer}
              onResizeOverlay={resizeOverlayLayer}
              onToggleSnap={toggleSnap}
              hideTopToolbar={true}
            />
          </div>

          {/* Mobile Fixed Bottom Nav */}
          <MobileBottomNav
            hasSelectedClip={Boolean(selectedClipId)}
            canSplit={canSplit}
            onOpenSheet={handleOpenMobileSheet}
            onSplit={handleSplitCurrentTime}
            onDelete={handleDeleteSelected}
          />

          {/* Mobile Slide-up Bottom Sheets */}
          <MobileBottomSheet
            isOpen={Boolean(mobileSheet)}
            type={mobileSheet}
            title={
              mobileSheet === "media"
                ? "Project Media"
                : mobileSheet === "audio"
                ? "Background Music & Audio"
                : mobileSheet === "text"
                ? "Text & Titles"
                : mobileSheet === "stickers"
                ? "Stickers & Overlays"
                : mobileSheet === "filters"
                ? "Filter Presets"
                : mobileSheet === "adjust"
                ? "Color Adjustments"
                : mobileSheet === "speed"
                ? "Playback Speed"
                : mobileSheet === "clip_edit"
                ? "Clip Properties"
                : mobileSheet === "settings"
                ? "Project Settings"
                : "Tools"
            }
            onClose={handleCloseMobileSheet}
          >
            {mobileSheet === "media" && (
              <EditorToolDrawer
                activeTab="media"
                project={project}
                onAddAsset={addAsset}
                onRemoveAsset={removeAsset}
                onAddClipToTimeline={(assetId) => {
                  handleAddClipFromAsset(assetId);
                  handleCloseMobileSheet();
                }}
                onAddAudioToTimeline={(assetId) => {
                  handleAddAudioAtCurrent(assetId);
                  handleCloseMobileSheet();
                }}
                onAddOverlayToTimeline={(assetId) => {
                  handleAddOverlayAtCurrent(assetId);
                  handleCloseMobileSheet();
                }}
                onAddTextLayer={(time, text) => {
                  handleAddTextAtCurrent(time, text);
                  handleCloseMobileSheet();
                }}
                onApplyFilterPreset={handleApplyFilterPreset}
                selectedClipFilterPreset={selectedClip?.filterPreset}
                onApplyTransition={handleApplyDrawerTransition}
                onSetAspectRatio={handleAspectRatioChange}
                onUpdateTitle={setProjectTitle}
              />
            )}

            {mobileSheet === "audio" && (
              <EditorToolDrawer
                activeTab="audio"
                project={project}
                onAddAsset={addAsset}
                onRemoveAsset={removeAsset}
                onAddClipToTimeline={() => {}}
                onAddAudioToTimeline={(assetId) => {
                  handleAddAudioAtCurrent(assetId);
                  handleCloseMobileSheet();
                }}
                onAddOverlayToTimeline={() => {}}
                onAddTextLayer={() => {}}
                onApplyFilterPreset={() => {}}
                onApplyTransition={() => {}}
                onSetAspectRatio={handleAspectRatioChange}
                onUpdateTitle={setProjectTitle}
              />
            )}

            {mobileSheet === "text" && (
              <EditorToolDrawer
                activeTab="text"
                project={project}
                onAddAsset={addAsset}
                onRemoveAsset={removeAsset}
                onAddClipToTimeline={() => {}}
                onAddAudioToTimeline={() => {}}
                onAddOverlayToTimeline={() => {}}
                onAddTextLayer={(time, text) => {
                  handleAddTextAtCurrent(time, text);
                  handleCloseMobileSheet();
                }}
                onAddAutoCaptions={(segments) => {
                  addAutoCaptions(segments);
                  handleCloseMobileSheet();
                }}
                onApplyFilterPreset={() => {}}
                onApplyTransition={() => {}}
                onSetAspectRatio={handleAspectRatioChange}
                onUpdateTitle={setProjectTitle}
              />
            )}

            {mobileSheet === "stickers" && (
              <EditorToolDrawer
                activeTab="stickers"
                project={project}
                onAddAsset={addAsset}
                onRemoveAsset={removeAsset}
                onAddClipToTimeline={() => {}}
                onAddAudioToTimeline={() => {}}
                onAddOverlayToTimeline={(assetId) => {
                  handleAddOverlayAtCurrent(assetId);
                  handleCloseMobileSheet();
                }}
                onAddTextLayer={() => {}}
                onApplyFilterPreset={() => {}}
                onApplyTransition={() => {}}
                onSetAspectRatio={handleAspectRatioChange}
                onUpdateTitle={setProjectTitle}
              />
            )}

            {mobileSheet === "filters" && (
              <EditorToolDrawer
                activeTab="filters"
                project={project}
                onAddAsset={addAsset}
                onRemoveAsset={removeAsset}
                onAddClipToTimeline={() => {}}
                onAddAudioToTimeline={() => {}}
                onAddOverlayToTimeline={() => {}}
                onAddTextLayer={() => {}}
                onApplyFilterPreset={handleApplyFilterPreset}
                selectedClipFilterPreset={selectedClip?.filterPreset}
                onApplyTransition={() => {}}
                onSetAspectRatio={handleAspectRatioChange}
                onUpdateTitle={setProjectTitle}
              />
            )}

            {(mobileSheet === "adjust" || mobileSheet === "speed" || mobileSheet === "clip_edit") && (
              <RightPropertiesPanel
                project={project}
                selectedClip={selectedClip}
                selectedAudio={selectedAudio}
                selectedText={selectedText}
                selectedOverlay={selectedOverlay}
                activeTab={
                  mobileSheet === "speed"
                    ? "speed"
                    : mobileSheet === "adjust"
                    ? "adjust"
                    : "video"
                }
                onTabChange={setClipTab}
                onUpdateClip={handleUpdateClipPartial}
                onUpdateAudio={handleUpdateAudioPartial}
                onRemoveAudio={handleRemoveAudioSelected}
                onUpdateText={handleUpdateTextPartial}
                onRemoveText={handleRemoveTextSelected}
                onUpdateOverlay={handleUpdateOverlayPartial}
                onRemoveOverlay={handleRemoveOverlaySelected}
                onSetAspectRatio={handleAspectRatioChange}
                onDeleteSelected={handleMobileDeleteSelected}
                onReverseClip={handleReverseSelected}
                onFreezeFrame={handleFreezeFrameSelected}
                onExtractAudio={extractAudioFromClip}
                onDuplicateSelected={handleDuplicateSelected}
              />
            )}

            {mobileSheet === "settings" && (
              <div className="space-y-4 p-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Canvas Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["16:9", "9:16", "1:1", "4:5"] as AspectRatioPreset[]).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => handleAspectRatioChange(ratio)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          project.settings.aspectRatio === ratio
                            ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                            : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </MobileBottomSheet>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS: Export, Transitions, Help / Shortcuts, Settings */}
      {/* ========================================================================= */}

      {/* Transition Picker Modal */}
      {transitionClip && (
        <TransitionModal
          isOpen={Boolean(transitionClipId)}
          initialTransition={transitionClip.transition}
          onClose={handleCloseTransitionModal}
          onApply={handleApplyTransition}
        />
      )}

      {/* Export Render Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        project={project}
        onClose={handleCloseExportModal}
        onExport={handleExportProject}
      />

      {/* Shortcuts & Help Modal */}
      {isHelpOpen && (
        <div
          onClick={handleCloseHelp}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl text-white animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold">Keyboard Shortcuts</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseHelp}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-white/5 text-xs mt-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Play / Pause</span>
                <kbd className="px-2 py-1 bg-slate-900 border border-white/10 rounded font-mono text-[11px] text-cyan-300">Space</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Undo Action</span>
                <kbd className="px-2 py-1 bg-slate-900 border border-white/10 rounded font-mono text-[11px] text-cyan-300">Ctrl + Z</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Redo Action</span>
                <kbd className="px-2 py-1 bg-slate-900 border border-white/10 rounded font-mono text-[11px] text-cyan-300">Ctrl + Y / Ctrl + Shift + Z</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Delete Selected Item</span>
                <kbd className="px-2 py-1 bg-slate-900 border border-white/10 rounded font-mono text-[11px] text-red-300">Delete / Backspace</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Split Clip at Playhead</span>
                <kbd className="px-2 py-1 bg-slate-900 border border-white/10 rounded font-mono text-[11px] text-amber-300">Split button / S</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Settings Modal */}
      {isSettingsOpen && (
        <div
          onClick={handleCloseSettings}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl text-white animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold">Project & Canvas Settings</h3>
              <button
                type="button"
                onClick={handleCloseSettings}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-2">Aspect Ratio Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["16:9", "9:16", "1:1", "4:5"] as AspectRatioPreset[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleAspectRatioChange(ratio)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                        project.settings.aspectRatio === ratio
                          ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                          : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Canvas Resolution</label>
                <p className="text-[11px] text-slate-400 font-mono">
                  {project.settings.canvasWidth} × {project.settings.canvasHeight} px ({project.settings.fps} fps)
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseSettings}
                  className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
