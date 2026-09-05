"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Crop,
  Download,
  FileImage,
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RotateCcw,
  RotateCw,
  UploadCloud,
} from "lucide-react";
import { runFileTool } from "@/lib/api";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function PhotoEditorWorkspace({ slug }: { slug: string }) {
  const isCropper = slug === "image-cropper";

  const [file, setFile] = useState<File | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Cropper states
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [aspectRatio, setAspectRatio] = useState<string>("free"); // "free", "1:1", "4:3", "16:9"

  // Rotator states
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // Common export states
  const [outputFormat, setOutputFormat] = useState<string>("png");
  const [quality, setQuality] = useState<number>(85);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (chosen: File) => {
    setError(null);
    setResult(null);
    setFile(chosen);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (chosen) handleFile(chosen);
  };

  const onImageLoad = () => {
    if (imgRef.current) {
      const nw = imgRef.current.naturalWidth || 800;
      const nh = imgRef.current.naturalHeight || 600;
      setImgNaturalSize({ width: nw, height: nh });

      // Default crop box: center 80%
      const initW = Math.round(nw * 0.8);
      const initH = Math.round(nh * 0.8);
      const initX = Math.round((nw - initW) / 2);
      const initY = Math.round((nh - initH) / 2);
      setCropBox({ x: initX, y: initY, width: initW, height: initH });
    }
  };

  const applyAspectRatio = (ratioStr: string) => {
    setAspectRatio(ratioStr);
    if (!imgNaturalSize.width || !imgNaturalSize.height) return;
    const nw = imgNaturalSize.width;
    const nh = imgNaturalSize.height;

    if (ratioStr === "free") return;

    let targetRatio = 1.0;
    if (ratioStr === "1:1") targetRatio = 1.0;
    else if (ratioStr === "4:3") targetRatio = 4 / 3;
    else if (ratioStr === "16:9") targetRatio = 16 / 9;

    let newW = nw * 0.8;
    let newH = newW / targetRatio;
    if (newH > nh * 0.9) {
      newH = nh * 0.9;
      newW = newH * targetRatio;
    }
    const newX = Math.round((nw - newW) / 2);
    const newY = Math.round((nh - newH) / 2);
    setCropBox({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: Math.round(newW),
      height: Math.round(newH),
    });
  };

  const handleProcess = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("output_format", outputFormat);
      form.append("quality", String(quality));

      let endpointSlug = slug;
      if (isCropper) {
        endpointSlug = "image-cropper";
        form.append("x", String(Math.round(cropBox.x)));
        form.append("y", String(Math.round(cropBox.y)));
        form.append("width", String(Math.round(cropBox.width)));
        form.append("height", String(Math.round(cropBox.height)));
      } else {
        endpointSlug = "image-rotator";
        form.append("angle", String(rotation % 360));
        form.append("flip_horizontal", flipH ? "true" : "false");
        form.append("flip_vertical", flipV ? "true" : "false");
      }

      const stem = file.name.replace(/\.[^/.]+$/, "");
      const actionName = isCropper ? "cropped" : "rotated";
      const fallbackName = `${stem}_${actionName}.${outputFormat}`;

      const response = await runFileTool(endpointSlug, form, fallbackName);
      if (result?.url) URL.revokeObjectURL(result.url);
      const url = URL.createObjectURL(response.blob);
      setResult({
        url,
        name: response.filename,
        size: response.blob.size,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Processing failed.");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setResult(null);
    setError(null);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:pb-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        {!file ? (
          <label
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-48 sm:min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] p-4 sm:px-6 text-center transition hover:border-cyan-300 hover:bg-cyan-400/[0.08]"
          >
            <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*" onChange={onChoose} />
            <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 text-cyan-300" />
            <h2 className="mt-3 sm:mt-4 text-lg sm:text-xl font-semibold text-white">
              {isCropper ? "Choose an image to crop" : "Choose an image to rotate & flip"}
            </h2>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-400">Drag &amp; drop or click to upload (JPG, PNG, WebP, HEIC)</p>
            <span className="mt-3 sm:mt-4 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] sm:text-xs text-slate-400">
              {isCropper ? "Precise cropping · Aspect ratios · Lossless export" : "90° / 180° / 270° · Horizontal & Vertical flip"}
            </span>
          </label>
        ) : (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)}{" "}
                    {imgNaturalSize.width > 0 && `· ${imgNaturalSize.width} × ${imgNaturalSize.height} px`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Choose another
              </button>
            </div>

            {/* Visual Preview */}
            <div className="relative flex min-h-[320px] max-h-[460px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-4">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Preview"
                  onLoad={onImageLoad}
                  style={{
                    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                    transition: "transform 0.25s ease-out",
                  }}
                  className="max-h-[380px] max-w-full object-contain rounded-lg"
                />
              )}
            </div>

            {/* Cropper controls */}
            {isCropper ? (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    <Crop className="h-3.5 w-3.5" /> Crop Dimensions &amp; Aspect Ratio
                  </span>
                  <span className="text-xs text-slate-400">
                    Target: {Math.round(cropBox.width)} × {Math.round(cropBox.height)} px
                  </span>
                </div>

                {/* Aspect ratio presets */}
                <div className="flex flex-wrap gap-2">
                  {["free", "1:1", "4:3", "16:9"].map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => applyAspectRatio(ratio)}
                      className={`flex-1 sm:flex-initial min-w-[56px] text-center rounded-xl px-3.5 py-1.5 text-xs font-semibold uppercase transition ${
                        aspectRatio === ratio
                          ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20"
                          : "border border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/40"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                {/* Coordinate inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <label className="text-xs text-slate-400">
                    X offset
                    <input
                      type="number"
                      min={0}
                      max={imgNaturalSize.width}
                      value={Math.round(cropBox.x)}
                      onChange={(e) => setCropBox({ ...cropBox, x: Number(e.target.value) })}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 font-mono text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Y offset
                    <input
                      type="number"
                      min={0}
                      max={imgNaturalSize.height}
                      value={Math.round(cropBox.y)}
                      onChange={(e) => setCropBox({ ...cropBox, y: Number(e.target.value) })}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 font-mono text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Width (px)
                    <input
                      type="number"
                      min={1}
                      max={imgNaturalSize.width}
                      value={Math.round(cropBox.width)}
                      onChange={(e) => setCropBox({ ...cropBox, width: Number(e.target.value) })}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 font-mono text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Height (px)
                    <input
                      type="number"
                      min={1}
                      max={imgNaturalSize.height}
                      value={Math.round(cropBox.height)}
                      onChange={(e) => setCropBox({ ...cropBox, height: Number(e.target.value) })}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 font-mono text-xs text-white"
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* Rotator controls */
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    <RotateCw className="h-3.5 w-3.5" /> Rotation &amp; Flipping Controls
                  </span>
                  <span className="text-xs text-slate-400">Angle: {rotation % 360}°</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="flex-1 sm:flex-initial min-w-[130px] justify-center inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/40 hover:text-white transition"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-cyan-300" /> Rotate 90° CW
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 270) % 360)}
                    className="flex-1 sm:flex-initial min-w-[130px] justify-center inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/40 hover:text-white transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-cyan-300" /> Rotate 90° CCW
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 180) % 360)}
                    className="flex-1 sm:flex-initial min-w-[130px] justify-center inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/40 hover:text-white transition"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-cyan-300" /> Rotate 180°
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipH((f) => !f)}
                    className={`flex-1 sm:flex-initial min-w-[130px] justify-center inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                      flipH
                        ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                        : "border-white/10 bg-slate-900/60 text-slate-200 hover:border-cyan-400/40"
                    }`}
                  >
                    <FlipHorizontal className="h-3.5 w-3.5" /> Flip Horizontal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV((f) => !f)}
                    className={`flex-1 sm:flex-initial min-w-[130px] justify-center inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                      flipV
                        ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                        : "border-white/10 bg-slate-900/60 text-slate-200 hover:border-cyan-400/40"
                    }`}
                  >
                    <FlipVertical className="h-3.5 w-3.5" /> Flip Vertical
                  </button>
                </div>
              </div>
            )}

            {/* Export Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs text-slate-400">
                Output Format
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white"
                >
                  <option value="png">PNG (Lossless, transparency preserved)</option>
                  <option value="jpg">JPG (Compact file size)</option>
                  <option value="webp">WebP (Modern web format)</option>
                </select>
              </label>

              <label className="block text-xs text-slate-400">
                Quality: {quality}%
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="mt-3.5 w-full accent-cyan-400"
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3.5 text-sm text-red-200">
                {error}
              </p>
            )}

            {/* Process button */}
            <button
              type="button"
              onClick={handleProcess}
              disabled={busy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing Image...
                </>
              ) : isCropper ? (
                <>
                  <Crop className="h-4 w-4" /> Crop &amp; Save Image
                </>
              ) : (
                <>
                  <RotateCw className="h-4 w-4" /> Apply Rotation &amp; Save
                </>
              )}
            </button>

            {/* Result card */}
            {result && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 sm:p-5 sm:flex-row sm:items-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Your edited image is ready!</p>
                  <p className="truncate text-xs text-slate-400">
                    {result.name} · {formatSize(result.size)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                  <a
                    href={result.url}
                    download={result.name}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 transition"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (result?.url) URL.revokeObjectURL(result.url);
                      setResult(null);
                    }}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10"
                  >
                    Edit again
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

