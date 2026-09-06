"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  Film,
  Music,
  Image as ImageIcon,
  Plus,
  Trash2,
  UploadCloud,
  Layers,
  Loader2,
} from "lucide-react";
import { MediaAsset, MediaType } from "../types";
import { formatBytes, formatTimecode } from "../state/projectDefaults";
import { probeMediaFile } from "../utils/mediaUtils";

interface ProjectMediaBinProps {
  assets: MediaAsset[];
  onAddAsset: (
    file: File,
    type: MediaType,
    duration: number,
    width?: number,
    height?: number,
    thumbnailUrl?: string
  ) => MediaAsset;
  onRemoveAsset: (assetId: string) => void;
  onAddClipToTimeline: (assetId: string) => void;
  onAddAudioToTimeline: (assetId: string) => void;
  onAddOverlayToTimeline: (assetId: string) => void;
}

export function ProjectMediaBin({
  assets,
  onAddAsset,
  onRemoveAsset,
  onAddClipToTimeline,
  onAddAudioToTimeline,
  onAddOverlayToTimeline,
}: ProjectMediaBinProps) {
  const [filter, setFilter] = useState<"all" | MediaType>("all");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAssets = assets.filter((asset) => {
    if (filter === "all") return true;
    return asset.type === filter;
  });

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const probed = await probeMediaFile(file);
        const newAsset = onAddAsset(
          file,
          probed.type,
          probed.duration,
          probed.width,
          probed.height,
          probed.thumbnailUrl
        );

        // Auto-add first uploaded video or image directly to timeline if timeline is empty
        if (assets.length === 0 && i === 0 && probed.type !== "audio") {
          onAddClipToTimeline(newAsset.id);
        }
      }
    } catch (err) {
      console.error("Failed to process files in media bin:", err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-slate-950/60 p-3.5 sm:p-4 text-white">
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Project Media ({assets.length})
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              filter === "all" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("video")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
              filter === "video" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <Film className="h-3 w-3" /> Videos
          </button>
          <button
            type="button"
            onClick={() => setFilter("audio")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
              filter === "audio" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <Music className="h-3 w-3" /> Audio
          </button>
          <button
            type="button"
            onClick={() => setFilter("image")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
              filter === "image" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <ImageIcon className="h-3 w-3" /> Images
          </button>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
          isDragging
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-white/10 bg-white/[0.02] hover:border-cyan-400/50 hover:bg-white/[0.04]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2 text-cyan-300 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing media assets...
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5">
            <UploadCloud className="h-6 w-6 text-cyan-400" />
            <p className="text-xs font-medium text-slate-200">
              Click or drag & drop video, image, or audio
            </p>
            <p className="text-[11px] text-slate-400">MP4, WebM, MOV, MP3, WAV, JPG, PNG</p>
          </div>
        )}
      </div>

      {/* Asset Cards Grid / List */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 max-h-[260px] sm:max-h-[300px]">
        {filteredAssets.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No {filter !== "all" ? filter : ""} assets in project yet.
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-2.5 transition hover:border-cyan-400/40"
            >
              {/* Thumbnail / Icon */}
              <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center">
                {asset.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
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

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200" title={asset.name}>
                  {asset.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="uppercase font-mono text-cyan-400">{asset.type}</span>
                  <span>•</span>
                  <span>{formatBytes(asset.size)}</span>
                  {asset.width && asset.height && (
                    <>
                      <span>•</span>
                      <span>{asset.width}x{asset.height}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {asset.type === "audio" ? (
                  <button
                    type="button"
                    onClick={() => onAddAudioToTimeline(asset.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-purple-500/20 px-2.5 text-[11px] font-medium text-purple-300 hover:bg-purple-500/30 transition"
                    title="Add to Audio Track"
                  >
                    <Plus className="h-3.5 w-3.5" /> Track
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onAddClipToTimeline(asset.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-cyan-400/20 px-2.5 text-[11px] font-medium text-cyan-300 hover:bg-cyan-400/30 transition"
                      title="Add Clip to Main Timeline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Clip
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddOverlayToTimeline(asset.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition"
                      title="Add as PIP Overlay"
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAsset(asset.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition"
                  title="Remove Asset"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

