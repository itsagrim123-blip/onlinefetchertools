"use client";

import { memo, ChangeEvent, useRef, useState } from "react";
import {
  Film,
  Music,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  Sparkles,
  Subtitles,
  Trash2,
  Type,
  Upload,
  Layers,
  Smile,
  Wand2,
  Shuffle,
  Settings as SettingsIcon,
  Check,
  Loader2,
} from "lucide-react";
import {
  AspectRatioPreset,
  MediaAsset,
  MediaType,
  SidebarTab,
  TransitionType,
  VideoProject,
} from "../types";
import { formatTimecode } from "../state/projectDefaults";
import { extractFilmstripFrames, probeMediaFile } from "../utils/mediaUtils";

interface EditorToolDrawerProps {
  activeTab: SidebarTab;
  project: VideoProject;
  currentTime?: number;
  onAddAsset: (
    file: File,
    type: MediaType,
    duration: number,
    width?: number,
    height?: number,
    thumbnailUrl?: string,
    filmstripFrames?: string[]
  ) => MediaAsset;
  onRemoveAsset: (id: string) => void;
  onAddClipToTimeline: (assetId: string) => void;
  onAddAudioToTimeline: (assetId: string) => void;
  onAddOverlayToTimeline: (assetId: string) => void;
  onAddTextLayer: (timelineStart?: number, text?: string) => void;
  onApplyFilterPreset: (preset: string) => void;
  selectedClipFilterPreset?: string;
  onApplyTransition: (type: TransitionType) => void;
  onSetAspectRatio: (ratio: AspectRatioPreset) => void;
  onUpdateTitle: (title: string) => void;
  onAddAutoCaptions?: (segments: { start: number; duration: number; text: string }[]) => void;
}

export const EditorToolDrawer = memo(function EditorToolDrawer({
  activeTab,
  project,
  currentTime,
  onAddAsset,
  onRemoveAsset,
  onAddClipToTimeline,
  onAddAudioToTimeline,
  onAddOverlayToTimeline,
  onAddTextLayer,
  onApplyFilterPreset,
  selectedClipFilterPreset,
  onApplyTransition,
  onSetAspectRatio,
  onUpdateTitle,
  onAddAutoCaptions,
}: EditorToolDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaFilter, setMediaFilter] = useState<"all" | MediaType>("all");
  const [activeKebabId, setActiveKebabId] = useState<string | null>(null);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState<boolean>(false);
  const [captionsError, setCaptionsError] = useState<string | null>(null);

  const handleGenerateAutoCaptions = async () => {
    const videoAsset = project.assets.find((a) => a.type === "video");
    if (!videoAsset) {
      setCaptionsError("Please upload or add a video first.");
      return;
    }
    setIsGeneratingCaptions(true);
    setCaptionsError(null);
    try {
      let fileToUpload = videoAsset.file;
      if (!fileToUpload) {
        const resp = await fetch(videoAsset.objectUrl);
        const blob = await resp.blob();
        fileToUpload = new File([blob], videoAsset.name || "video.mp4", { type: blob.type || "video/mp4" });
      }
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("language", "auto");
      const res = await fetch("/api/media/auto-captions/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Auto captions failed (${res.status})`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.segments) && data.segments.length > 0) {
        const parsed = data.segments
          .map((seg: { start?: number; end?: number; text?: string }) => ({
            start: seg.start || 0,
            duration: Math.max(0.8, (seg.end || (seg.start || 0) + 2.0) - (seg.start || 0)),
            text: (seg.text || "").trim(),
          }))
          .filter((s: { text: string }) => s.text.length > 0);

        if (onAddAutoCaptions) {
          onAddAutoCaptions(parsed);
        } else {
          parsed.forEach((s: { start: number; text: string }) => onAddTextLayer(s.start, s.text));
        }
      } else {
        setCaptionsError("No spoken words detected in the video.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate AI captions.";
      setCaptionsError(msg);
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const probed = await probeMediaFile(file);
      let filmstrip: string[] | undefined;
      if (probed.type === "video") {
        filmstrip = await extractFilmstripFrames(file, 6);
      }
      const newAsset = onAddAsset(
        file,
        probed.type,
        probed.duration,
        probed.width,
        probed.height,
        probed.thumbnailUrl,
        filmstrip
      );

      // Auto-add first clip if timeline is currently empty
      if (project.clips.length === 0 && i === 0 && probed.type !== "audio") {
        onAddClipToTimeline(newAsset.id);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredAssets = project.assets.filter((a) => {
    if (mediaFilter === "all") return true;
    return a.type === mediaFilter;
  });

  return (
    <div className="w-72 sm:w-80 shrink-0 bg-slate-950/70 border-r border-white/10 flex flex-col h-full overflow-hidden select-none">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* --- MEDIA TAB --- */}
      {activeTab === "media" && (
        <div className="flex flex-col h-full p-3.5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Media</h2>
            <button
              type="button"
              onClick={handleUploadClick}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
          </div>

          {/* Filter Pills matching reference image: All, Videos, Images, Audio */}
          <div className="flex items-center gap-1.5 py-3 border-b border-white/5">
            {(["all", "video", "image", "audio"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setMediaFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition capitalize ${
                  mediaFilter === cat
                    ? "bg-cyan-400 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat === "all" ? "All" : cat === "video" ? "Videos" : cat === "image" ? "Images" : "Audio"}
              </button>
            ))}
          </div>

          {/* Media Items List matching reference image layout */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1">
            {filteredAssets.length === 0 ? (
              <div
                onClick={handleUploadClick}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-cyan-400/40 hover:bg-white/[0.02] text-center"
              >
                <Upload className="h-6 w-6 text-cyan-400 mb-1.5" />
                <p className="text-xs font-medium text-slate-300">Click to upload media</p>
                <p className="text-[11px] text-slate-500 mt-0.5">MP4, WebM, MOV, MP3, JPG, PNG</p>
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative flex items-center justify-between gap-2.5 p-2 rounded-xl border border-white/5 bg-slate-900/60 hover:border-cyan-400/40 hover:bg-slate-900 transition"
                >
                  {/* Thumbnail / Icon with Play indicator */}
                  <div
                    onClick={() => {
                      if (asset.type === "audio") onAddAudioToTimeline(asset.id);
                      else onAddClipToTimeline(asset.id);
                    }}
                    className="relative h-12 w-16 shrink-0 rounded-lg overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center cursor-pointer"
                  >
                    {asset.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.thumbnailUrl} alt={asset.name} className="h-full w-full object-cover" />
                    ) : asset.type === "audio" ? (
                      <Music className="h-5 w-5 text-purple-400" />
                    ) : asset.type === "image" ? (
                      <ImageIcon className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Film className="h-5 w-5 text-cyan-400" />
                    )}
                    <span className="absolute bottom-0.5 right-1 rounded bg-black/80 px-1 text-[9px] font-mono text-white">
                      {formatTimecode(asset.duration)}
                    </span>
                  </div>

                  {/* Title & Duration */}
                  <div
                    onClick={() => {
                      if (asset.type === "audio") onAddAudioToTimeline(asset.id);
                      else onAddClipToTimeline(asset.id);
                    }}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <p className="truncate text-xs font-medium text-slate-200" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatTimecode(asset.duration)}
                    </p>
                  </div>

                  {/* Kebab menu trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveKebabId(activeKebabId === asset.id ? null : asset.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Popover Action Menu */}
                    {activeKebabId === asset.id && (
                      <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-white/10 bg-slate-950 p-1 shadow-2xl text-xs">
                        {asset.type !== "audio" && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddClipToTimeline(asset.id);
                              setActiveKebabId(null);
                            }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 text-left"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Clip
                          </button>
                        )}
                        {asset.type === "audio" && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddAudioToTimeline(asset.id);
                              setActiveKebabId(null);
                            }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-purple-300 hover:bg-purple-500/20 text-left"
                          >
                            <Music className="h-3.5 w-3.5" /> Add Audio
                          </button>
                        )}
                        {asset.type !== "audio" && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddOverlayToTimeline(asset.id);
                              setActiveKebabId(null);
                            }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-amber-300 hover:bg-amber-500/20 text-left"
                          >
                            <Layers className="h-3.5 w-3.5" /> Add as Overlay
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveAsset(asset.id);
                            setActiveKebabId(null);
                          }}
                          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/20 text-left"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- AUDIO TAB --- */}
      {activeTab === "audio" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Audio & Music</h2>
            <button
              type="button"
              onClick={handleUploadClick}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-purple-400/40 bg-purple-500/10 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Audio
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Add background music or sound effects to the audio track.</p>
          <div className="space-y-2 overflow-y-auto flex-1">
            {project.assets
              .filter((a) => a.type === "audio")
              .map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Music className="h-4 w-4 text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{asset.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{formatTimecode(asset.duration)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddAudioToTimeline(asset.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/20 text-xs font-medium text-purple-300 hover:bg-purple-500/30"
                  >
                    <Plus className="h-3 w-3" /> Track
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- TEXT TAB --- */}
      {activeTab === "text" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Text & Titles</h2>
          </div>
          <button
            type="button"
            onClick={() => onAddTextLayer(currentTime, "Happy Birthday")}
            className="flex items-center justify-center gap-2 h-10 w-full rounded-xl bg-cyan-400 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition"
          >
            <Plus className="h-4 w-4" /> Add Text Layer
          </button>
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Presets</p>
            <button
              type="button"
              onClick={() => onAddTextLayer(currentTime, "Title Header")}
              className="w-full p-3 rounded-xl border border-white/10 bg-slate-900/60 hover:border-cyan-400 text-left transition"
            >
              <p className="text-sm font-bold text-white">Title Header</p>
              <p className="text-[10px] text-slate-400">Bold headline text</p>
            </button>
            <button
              type="button"
              onClick={() => onAddTextLayer(currentTime, "Subtitle caption text")}
              className="w-full p-3 rounded-xl border border-white/10 bg-slate-900/60 hover:border-cyan-400 text-left transition"
            >
              <p className="text-xs font-medium text-white">Subtitle / Lower Third</p>
              <p className="text-[10px] text-slate-400">Lower positioned caption</p>
            </button>
          </div>
        </div>
      )}

      {/* --- STICKERS TAB --- */}
      {activeTab === "stickers" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Stickers & Overlays</h2>
            <button
              type="button"
              onClick={handleUploadClick}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-amber-400/40 bg-amber-500/10 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Image
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Upload images or stickers to place them as Picture-in-Picture layers.</p>
          <div className="grid grid-cols-2 gap-2 pt-2 overflow-y-auto">
            {project.assets
              .filter((a) => a.type === "image")
              .map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => onAddOverlayToTimeline(asset.id)}
                  className="flex flex-col items-center p-2 rounded-xl border border-white/10 bg-slate-900 hover:border-amber-400 cursor-pointer transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.objectUrl} alt={asset.name} className="h-16 w-16 object-contain rounded-lg" />
                  <p className="text-[10px] text-slate-300 truncate w-full text-center mt-1">{asset.name}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- FILTERS TAB --- */}
      {activeTab === "filters" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Filters & Looks</h2>
          </div>
          <p className="text-[11px] text-slate-400">Select a clip on the timeline to apply visual color filters.</p>
          <div className="grid grid-cols-2 gap-2 overflow-y-auto">
            {[
              { id: "original", label: "Original", color: "from-slate-700 to-slate-800" },
              { id: "cinematic", label: "Cinematic", color: "from-teal-700 to-amber-900" },
              { id: "warm", label: "Warm Sunset", color: "from-amber-600 to-orange-800" },
              { id: "cool", label: "Cool Nordic", color: "from-cyan-600 to-blue-800" },
              { id: "retro", label: "Retro 90s", color: "from-yellow-700 to-amber-900" },
              { id: "film", label: "Film Grain", color: "from-stone-700 to-amber-950" },
              { id: "soft", label: "Dreamy Soft", color: "from-rose-600 to-purple-800" },
              { id: "bw", label: "B&W Noir", color: "from-slate-400 to-slate-900" },
              { id: "fade", label: "Faded Mood", color: "from-stone-500 to-zinc-800" },
              { id: "bright", label: "Bright Pop", color: "from-sky-400 to-indigo-600" },
              { id: "contrast", label: "High Drama", color: "from-violet-700 to-slate-950" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onApplyFilterPreset(f.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition bg-gradient-to-br ${f.color} ${
                  selectedClipFilterPreset === f.id
                    ? "border-cyan-400 ring-2 ring-cyan-400/50"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <span className="text-xs font-bold text-white drop-shadow">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- EFFECTS TAB --- */}
      {activeTab === "effects" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Effects</h2>
          </div>
          <p className="text-[11px] text-slate-400">Stylistic enhancements applied to current clip.</p>
          <div className="space-y-2">
            {["Vignette", "Film Grain", "Exposure Boost", "Temperature Shift"].map((eff) => (
              <div
                key={eff}
                className="p-3 rounded-xl border border-white/10 bg-slate-900/60 flex items-center justify-between text-xs"
              >
                <span className="font-semibold text-white">{eff}</span>
                <span className="text-[10px] text-cyan-400 font-mono">Adjust Tab</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TRANSITIONS TAB --- */}
      {activeTab === "transitions" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Transitions</h2>
          </div>
          <p className="text-[11px] text-slate-400">Apply transition to next clip on the timeline.</p>
          <div className="space-y-2 overflow-y-auto">
            {[
              { id: "none" as const, label: "Cut (None)", desc: "Instant clip switch" },
              { id: "fade" as const, label: "Dissolve / Fade", desc: "Smooth crossfade blend" },
              { id: "dissolve" as const, label: "Cross Dissolve", desc: "Classic video cross dissolve" },
              { id: "crossfade" as const, label: "Cinematic Crossfade", desc: "Audio & video crossfade blend" },
              { id: "blur" as const, label: "Blur Transition", desc: "Defocus & focus zoom" },
              { id: "slide_left" as const, label: "Slide Left", desc: "Next clip enters from right" },
              { id: "slide_right" as const, label: "Slide Right", desc: "Next clip enters from left" },
              { id: "zoom" as const, label: "Zoom Cross", desc: "Dynamic zoom transition" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onApplyTransition(t.id)}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-slate-900/60 hover:border-cyan-400 text-left transition"
              >
                <p className="text-xs font-semibold text-white">{t.label}</p>
                <p className="text-[10px] text-slate-400">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- CAPTIONS TAB --- */}
      {activeTab === "captions" && (
        <div className="flex flex-col h-full p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Auto Captions & Subtitles</h2>
          </div>

          {/* AI Auto-Transcribe Button */}
          <div className="p-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] space-y-2">
            <div className="flex items-center gap-2 text-cyan-300">
              <Wand2 className="h-4 w-4" />
              <h3 className="text-xs font-bold">AI Auto Captions</h3>
            </div>
            <p className="text-[11px] text-slate-300">
              Automatically extract speech from your video and create timed subtitle blocks on the timeline.
            </p>
            <button
              type="button"
              disabled={isGeneratingCaptions}
              onClick={handleGenerateAutoCaptions}
              className="flex items-center justify-center gap-2 h-9 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-xs font-bold text-slate-950 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
            >
              {isGeneratingCaptions ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing Speech...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Auto-Generate Subtitles
                </>
              )}
            </button>
          </div>

          {captionsError && (
            <p className="p-2.5 rounded-xl border border-red-400/30 bg-red-400/10 text-xs text-red-300">
              {captionsError}
            </p>
          )}

          <div className="pt-2 border-t border-white/10 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300">Manual Subtitles</h4>
            <button
              type="button"
              onClick={() => onAddTextLayer(currentTime, "Enter subtitle here...")}
              className="flex items-center justify-center gap-1.5 h-9 w-full rounded-xl border border-white/10 bg-slate-900 text-xs font-semibold text-slate-200 hover:bg-white/5 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add Manual Caption at Playhead
            </button>
            <p className="text-[10px] text-slate-500">Add customizable text layers directly at the current playhead position.</p>
          </div>
        </div>
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === "settings" && (
        <div className="flex flex-col h-full p-3.5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide">Project Settings</h2>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Project Title</label>
            <input
              type="text"
              value={project.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="w-full h-9 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs text-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["16:9", "9:16", "1:1", "4:5"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onSetAspectRatio(r)}
                  className={`h-8 rounded-lg text-xs font-semibold transition ${
                    project.settings.aspectRatio === r
                      ? "bg-cyan-400 text-slate-950 font-bold"
                      : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

