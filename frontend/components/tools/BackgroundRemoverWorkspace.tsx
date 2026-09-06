"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Columns,
  Download,
  FileImage,
  ImageIcon,
  Layers,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { removeImageBackground } from "@/lib/api";
import { useUISound } from "@/lib/sounds/useUISound";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

type ViewMode = "slider" | "side-by-side" | "result-only";

const PROCESSING_STAGES = [
  "Analyzing image structure...",
  "Segmenting foreground subject with AI...",
  "Refining fine edge details and hair...",
  "Generating transparent PNG...",
];

export function BackgroundRemoverWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [edgeRefinement, setEdgeRefinement] = useState<boolean>(false);
  const [backgroundType, setBackgroundType] = useState<"transparent" | "white" | "black" | "custom">("transparent");
  const [customColor, setCustomColor] = useState<string>("#3b82f6");

  // Processing states
  const [busy, setBusy] = useState<boolean>(false);
  const [isDraggingDrop, setIsDraggingDrop] = useState<boolean>(false);
  const [stageIndex, setStageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const { playUpload, playSuccess, playError, playDownload, playClick } = useUISound();

  // Result state
  const [result, setResult] = useState<{
    url: string;
    name: string;
    size: number;
    width?: number;
    height?: number;
  } | null>(null);

  // Interactive slider comparison state
  const [viewMode, setViewMode] = useState<ViewMode>("slider");
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0 - 100
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);

  // Object URLs
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Stage rotation during processing
  useEffect(() => {
    if (!busy) return;
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1 < PROCESSING_STAGES.length ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [busy]);

  const handleFile = (chosen: File) => {
    setError(null);
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);

    // Validate size (200MB max)
    const maxBytes = 200 * 1024 * 1024;
    if (chosen.size > maxBytes) {
      playError();
      setError("File exceeds the 200 MB maximum size limit.");
      return;
    }

    // Validate extension
    const ext = chosen.name.split(".").pop()?.toLowerCase();
    const validExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    if (!ext || !validExtensions.includes(ext)) {
      playError();
      setError("Unsupported format. Please choose a JPG, PNG, WebP, or HEIC image.");
      return;
    }

    playUpload();
    setFile(chosen);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingDrop(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (chosen) handleFile(chosen);
  };

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setImgNaturalSize({ width: naturalWidth, height: naturalHeight });
  };

  const handleProcess = async () => {
    if (!file) return;
    playClick();
    setStageIndex(0);
    setBusy(true);
    setError(null);

    try {
      const selectedBg =
        backgroundType === "transparent"
          ? undefined
          : backgroundType === "white"
          ? "#ffffff"
          : backgroundType === "black"
          ? "#000000"
          : customColor;

      const response = await removeImageBackground(file, {
        edgeRefinement,
        backgroundColor: selectedBg,
      });

      if (result?.url) URL.revokeObjectURL(result.url);
      const url = URL.createObjectURL(response.blob);

      setResult({
        url,
        name: response.filename,
        size: response.blob.size,
        width: response.width || imgNaturalSize.width,
        height: response.height || imgNaturalSize.height,
      });
      playSuccess();
    } catch (cause) {
      playError();
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to remove the background from this image. Please try another image."
      );
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    playClick();
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setResult(null);
    setError(null);
    setImgNaturalSize({ width: 0, height: 0 });
    setSliderPosition(50);
  };

  // Slider dragging logic (Mouse & Touch)
  const updateSliderPos = useCallback((clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percent);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingSlider(true);
    updateSliderPos(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSlider) {
      updateSliderPos(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSlider) {
      setIsDraggingSlider(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore capture release errors
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSliderPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      setSliderPosition((prev) => Math.min(100, prev + 5));
    }
  };

  // Checkerboard background style for genuine transparency visualization
  const checkerboardBg =
    "bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),radial-gradient(rgba(255,255,255,0.06)_1px,#090d16_1px)] [background-size:16px_16px] [background-position:0_0,8px_8px]";

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:pb-20 sm:px-6 lg:px-8 w-full max-w-full">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        {!file ? (
          /* ==================== UPLOAD STATE ==================== */
          <label
            onDrop={onDrop}
            onDragOver={(event) => { event.preventDefault(); setIsDraggingDrop(true); }}
            onDragLeave={() => setIsDraggingDrop(false)}
            className={`dropzone-interactive flex min-h-56 sm:min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-5 sm:px-6 text-center transition ${
              isDraggingDrop
                ? "border-cyan-300 bg-cyan-400/[0.12] scale-[1.01]"
                : "border-cyan-400/30 bg-cyan-400/[0.04] hover:border-cyan-300 hover:bg-cyan-400/[0.08]"
            }`}
          >
            <input
              type="file"
              className="sr-only"
              aria-label="Upload image"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
              onChange={onChoose}
            />
            <div className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 transition-transform duration-200 ${isDraggingDrop ? "scale-110 -translate-y-1" : ""}`}>
              <UploadCloud className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h2 className="mt-3 sm:mt-4 text-lg sm:text-xl font-semibold text-white">
              Upload an image to remove its background
            </h2>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-400">
              Drag &amp; drop or click to choose a photo
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] sm:text-xs text-slate-300">
                JPG · PNG · WebP · HEIC
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] sm:text-xs text-cyan-300">
                Real AI Segmentation
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] sm:text-xs text-emerald-300">
                Transparent PNG Export
              </span>
            </div>
          </label>
        ) : (
          /* ==================== WORKSPACE ACTIVE ==================== */
          <div className="space-y-6">
            {/* Top file meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3.5 sm:p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)}
                    {imgNaturalSize.width > 0 && ` · ${imgNaturalSize.width} × ${imgNaturalSize.height} px`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetAll}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Choose another
              </button>
            </div>

            {/* Viewport: Original Preview or Result Comparison */}
            {!result ? (
              /* Original image preview before processing */
              <div className="relative flex min-h-[280px] sm:min-h-[360px] max-h-[480px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-4">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Original Upload"
                    onLoad={onImageLoad}
                    className="max-h-[340px] sm:max-h-[420px] max-w-full object-contain rounded-lg shadow-lg"
                  />
                )}
                <span className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-400 border border-white/10">
                  Original
                </span>
              </div>
            ) : (
              /* Result Comparison View */
              <div className="space-y-3">
                {/* View Mode Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("slider")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition ${
                        viewMode === "slider"
                          ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Split Slider
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("side-by-side")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition ${
                        viewMode === "side-by-side"
                          ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Columns className="h-3.5 w-3.5" /> Side by Side
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("result-only")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition ${
                        viewMode === "result-only"
                          ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" /> Cutout Only
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {viewMode === "slider"
                      ? "Drag divider or use ← / → keys"
                      : viewMode === "side-by-side"
                      ? "Original vs Cutout"
                      : "Isolated transparent subject"}
                  </span>
                </div>

                {/* View Mode 1: Interactive Before / After Slider */}
                {viewMode === "slider" && (
                  <div
                    ref={sliderContainerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="slider"
                    aria-label="Before and after comparison slider"
                    aria-valuenow={Math.round(sliderPosition)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className={`relative flex min-h-[300px] sm:min-h-[400px] max-h-[500px] select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${checkerboardBg} p-2 touch-none cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`}
                  >
                    {/* Underlying Result Image (revealed on the right) */}
                    {result?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.url}
                        alt="Background Removed Result"
                        className="max-h-[360px] sm:max-h-[440px] max-w-full object-contain pointer-events-none"
                      />
                    )}

                    {/* Clipped Original Image (revealed on the left) */}
                    {previewUrl && (
                      <div
                        className="absolute inset-0 flex items-center justify-center overflow-hidden p-2 pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Original Before"
                          className="max-h-[360px] sm:max-h-[440px] max-w-full object-contain"
                        />
                      </div>
                    )}

                    {/* Divider Line & Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)] pointer-events-none"
                      style={{ left: `${sliderPosition}%` }}
                    >
                      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-cyan-300 bg-slate-950 text-cyan-300 shadow-xl shadow-cyan-950/80">
                        <SlidersHorizontal className="h-4 w-4 rotate-90" />
                      </div>
                    </div>

                    {/* Labels */}
                    <span className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 border border-white/10 pointer-events-none">
                      Original
                    </span>
                    <span className="absolute bottom-3 right-3 rounded-md bg-cyan-950/80 px-2.5 py-1 text-[11px] font-medium text-cyan-300 border border-cyan-400/20 pointer-events-none">
                      No Background (PNG)
                    </span>
                  </div>
                )}

                {/* View Mode 2: Side by Side */}
                {viewMode === "side-by-side" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Original */}
                    <div className="relative flex min-h-[260px] sm:min-h-[340px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-3">
                      {previewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="Original"
                          className="max-h-[300px] max-w-full object-contain rounded-lg"
                        />
                      )}
                      <span className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-400 border border-white/10">
                        Original
                      </span>
                    </div>

                    {/* Result on Checkerboard */}
                    <div
                      className={`relative flex min-h-[260px] sm:min-h-[340px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${checkerboardBg} p-3`}
                    >
                      {result?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.url}
                          alt="Removed Background"
                          className="max-h-[300px] max-w-full object-contain rounded-lg"
                        />
                      )}
                      <span className="absolute bottom-3 right-3 rounded-md bg-cyan-950/80 px-2.5 py-1 text-[11px] font-medium text-cyan-300 border border-cyan-400/20">
                        Removed Background
                      </span>
                    </div>
                  </div>
                )}

                {/* View Mode 3: Cutout Only */}
                {viewMode === "result-only" && (
                  <div
                    className={`relative flex min-h-[300px] sm:min-h-[400px] max-h-[500px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${checkerboardBg} p-4`}
                  >
                    {result?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.url}
                        alt="Transparent Cutout"
                        className="max-h-[360px] sm:max-h-[440px] max-w-full object-contain rounded-lg drop-shadow-2xl"
                      />
                    )}
                    <span className="absolute bottom-3 right-3 rounded-md bg-cyan-950/80 px-2.5 py-1 text-[11px] font-medium text-cyan-300 border border-cyan-400/20">
                      Transparent PNG
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Options Controls (Quality & Background Color) */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Edge Refinement Toggle */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    <Sparkles className="h-4 w-4" /> Edge Refinement
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={edgeRefinement}
                      onChange={(e) => setEdgeRefinement(e.target.checked)}
                      disabled={busy}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-800 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-cyan-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
                  </label>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {edgeRefinement
                    ? "High precision: Advanced alpha matting enabled for intricate hair, fur, and semi-transparent edges."
                    : "Standard: Fast and clean segmentation suitable for most photos, products, and portraits."}
                </p>
              </div>

              {/* Background Replacement Picker */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    <ImageIcon className="h-4 w-4" /> Background Fill
                  </span>
                  {backgroundType === "custom" && (
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      disabled={busy}
                      className="h-6 w-7 cursor-pointer rounded border border-white/20 bg-transparent p-0"
                    />
                  )}
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBackgroundType("transparent")}
                    disabled={busy}
                    className={`rounded-lg py-1.5 text-center text-xs font-medium transition ${
                      backgroundType === "transparent"
                        ? "bg-cyan-400 text-slate-950 font-semibold"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Clear PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundType("white")}
                    disabled={busy}
                    className={`rounded-lg py-1.5 text-center text-xs font-medium transition ${
                      backgroundType === "white"
                        ? "bg-cyan-400 text-slate-950 font-semibold"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundType("black")}
                    disabled={busy}
                    className={`rounded-lg py-1.5 text-center text-xs font-medium transition ${
                      backgroundType === "black"
                        ? "bg-cyan-400 text-slate-950 font-semibold"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Black
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundType("custom")}
                    disabled={busy}
                    className={`rounded-lg py-1.5 text-center text-xs font-medium transition ${
                      backgroundType === "custom"
                        ? "bg-cyan-400 text-slate-950 font-semibold"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message Display */}
            {error && (
              <p
                role="alert"
                className="animate-error-shake rounded-xl border border-red-400/30 bg-red-400/10 p-3.5 text-sm text-red-200"
              >
                {error}
              </p>
            )}

            {/* Stage Progress Shimmer when Processing (No fake percentages) */}
            {busy && (
              <div className="animate-subtle-enter space-y-2 rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-3.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2 font-medium text-cyan-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {PROCESSING_STAGES[stageIndex]}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Step {stageIndex + 1} of {PROCESSING_STAGES.length}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-full shimmer-bar rounded-full" />
                </div>
              </div>
            )}

            {/* Action Button: Remove Background */}
            <button
              type="button"
              onClick={handleProcess}
              disabled={busy}
              className="btn-interactive inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing image...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  <span>{result ? "Re-process with Current Settings" : "Remove Background"}</span>
                </>
              )}
            </button>

            {/* Download & Completion Card */}
            {result && (
              <div className="animate-subtle-enter flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 sm:p-5 sm:flex-row sm:items-center">
                <CheckCircle2 className="animate-check-pop h-6 w-6 text-emerald-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Background removed successfully!</p>
                  <p className="truncate text-xs text-slate-400">
                    {result.name} · {formatSize(result.size)}
                    {result.width && result.height ? ` · ${result.width} × ${result.height} px` : ""}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                  <a
                    href={result.url}
                    download={result.name}
                    onClick={() => playDownload()}
                    className="btn-interactive inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-200 active:scale-[0.98] transition shadow-lg shadow-emerald-950/20"
                  >
                    <Download className="h-4 w-4" /> Download PNG
                  </a>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="btn-interactive inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10 active:scale-[0.98] transition"
                  >
                    Another image
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
