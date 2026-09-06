"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileAudio,
  FileVideo,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
} from "lucide-react";
import {
  analyzeMediaForNoise,
  NoiseAnalysisResult,
  NoiseRemoverOptions,
  removeAudioNoise,
} from "@/lib/api";
import { useUISound } from "@/lib/sounds/useUISound";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv"];

const PROCESSING_STAGES = [
  "Uploading media file to secure sandbox...",
  "Analyzing frequency spectrum and voice harmonics...",
  "Detecting continuous background noise and electrical hum...",
  "Running neural noise suppression network (RNNoise)...",
  "Enhancing vocal clarity, presence, and dynamics...",
  "Normalizing loudness (EBU R128) and finalizing...",
];

type NoiseMode = "auto" | "light" | "balanced" | "strong";

const MODES: Array<{
  id: NoiseMode;
  name: string;
  badge: string;
  desc: string;
  defaultStrength: number;
}> = [
  {
    id: "auto",
    name: "Auto",
    badge: "Recommended",
    desc: "Intelligently balances noise reduction while preserving vocal nuances.",
    defaultStrength: 60,
  },
  {
    id: "light",
    name: "Light",
    badge: "Voice Priority",
    desc: "Subtle cleanup. Retains 100% natural vocal texture, ideal for podcasts.",
    defaultStrength: 45,
  },
  {
    id: "balanced",
    name: "Balanced",
    badge: "All-Rounder",
    desc: "Eliminates fan noise, computer hum, and AC hiss with great speech clarity.",
    defaultStrength: 65,
  },
  {
    id: "strong",
    name: "Strong",
    badge: "Aggressive",
    desc: "Deep background noise removal for noisy rooms, street sound, and heavy rumble.",
    defaultStrength: 85,
  },
];

export function NoiseRemoverWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<NoiseAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Settings
  const [mode, setMode] = useState<NoiseMode>("auto");
  const [strength, setStrength] = useState<number>(60);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [voiceEnhancement, setVoiceEnhancement] = useState<boolean>(true);
  const [humRemoval, setHumRemoval] = useState<"auto" | "50hz" | "60hz" | "off">("auto");
  const [lowFrequencyCleanup, setLowFrequencyCleanup] = useState<"auto" | "60hz" | "80hz" | "100hz" | "off">("auto");
  const [normalize, setNormalize] = useState<boolean>(true);
  const [outputFormat, setOutputFormat] = useState<"auto" | "mp3" | "wav" | "video">("auto");

  // Processing state
  const [processing, setProcessing] = useState<boolean>(false);
  const [stageIndex, setStageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingDrop, setIsDraggingDrop] = useState<boolean>(false);

  // Result state
  const [result, setResult] = useState<{
    url: string;
    filename: string;
    blob: Blob;
    cleanedPeaks: number[];
  } | null>(null);

  // Synchronized Audio Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTrack, setActiveTrack] = useState<"original" | "cleaned">("cleaned");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const cleanedAudioRef = useRef<HTMLAudioElement | null>(null);
  const originalVideoRef = useRef<HTMLVideoElement | null>(null);
  const cleanedVideoRef = useRef<HTMLVideoElement | null>(null);

  const { playUpload, playSuccess, playError, playDownload, playClick, playToggle } = useUISound();

  // Object URLs
  const originalMediaUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (originalMediaUrl) URL.revokeObjectURL(originalMediaUrl);
    };
  }, [originalMediaUrl]);

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  // Stage progression during processing
  useEffect(() => {
    if (!processing) return;
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1 < PROCESSING_STAGES.length ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, [processing]);

  // Handle incoming file selection
  const handleFileSelect = async (chosen: File) => {
    setError(null);
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setIsPlaying(false);
    setCurrentTime(0);

    const maxBytes = 200 * 1024 * 1024; // 200 MB
    if (chosen.size > maxBytes) {
      playError();
      setError("File exceeds the 200 MB maximum size limit.");
      return;
    }

    const name = chosen.name.toLowerCase();
    const isAudio = SUPPORTED_AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
    const isVideo = SUPPORTED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));

    if (!isAudio && !isVideo) {
      playError();
      setError("Unsupported format. Please upload MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, WEBM, or MKV.");
      return;
    }

    playUpload();
    setFile(chosen);
    setAnalyzing(true);

    try {
      const data = await analyzeMediaForNoise(chosen);
      setAnalysis(data);
      if (data.duration) setDuration(data.duration);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze audio characteristics.";
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleModeChange = (newMode: NoiseMode) => {
    playToggle();
    setMode(newMode);
    const modeConfig = MODES.find((m) => m.id === newMode);
    if (modeConfig) {
      setStrength(modeConfig.defaultStrength);
    }
  };

  // Trigger real noise removal
  const handleProcess = async () => {
    if (!file) return;
    setError(null);
    setProcessing(true);
    setStageIndex(0);
    playClick();

    try {
      const options: NoiseRemoverOptions = {
        mode,
        strength,
        voiceEnhancement,
        humRemoval,
        lowFrequencyCleanup,
        normalize,
        outputFormat,
      };

      const res = await removeAudioNoise(file, options);
      const url = URL.createObjectURL(res.blob);
      setResult({
        url,
        filename: res.filename,
        blob: res.blob,
        cleanedPeaks: res.cleanedPeaks.length ? res.cleanedPeaks : (analysis?.waveform || []),
      });
      setActiveTrack("cleaned");
      setIsPlaying(false);
      playSuccess();
    } catch (err: unknown) {
      playError();
      const msg = err instanceof Error ? err.message : "Noise removal failed. Please check your media file.";
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    playClick();
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setAnalysis(null);
    setResult(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
  };

  // Synchronized playback controls
  const togglePlay = () => {
    playClick();
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);

    const isVid = analysis?.has_video;
    const currentAudio = activeTrack === "original" ? originalAudioRef.current : cleanedAudioRef.current;
    const currentVideo = activeTrack === "original" ? originalVideoRef.current : cleanedVideoRef.current;
    const player = isVid ? currentVideo : currentAudio;

    if (player) {
      if (willPlay) {
        player.play().catch(() => setIsPlaying(false));
      } else {
        player.pause();
      }
    }
  };

  const switchActiveTrack = (track: "original" | "cleaned") => {
    playToggle();
    if (track === activeTrack) return;

    const isVid = analysis?.has_video;
    const oldPlayer = isVid
      ? activeTrack === "original" ? originalVideoRef.current : cleanedVideoRef.current
      : activeTrack === "original" ? originalAudioRef.current : cleanedAudioRef.current;

    const newPlayer = isVid
      ? track === "original" ? originalVideoRef.current : cleanedVideoRef.current
      : track === "original" ? originalAudioRef.current : cleanedAudioRef.current;

    const time = oldPlayer?.currentTime ?? currentTime;

    if (oldPlayer) {
      oldPlayer.pause();
    }

    setActiveTrack(track);

    if (newPlayer) {
      newPlayer.currentTime = time;
      if (isPlaying) {
        newPlayer.play().catch(() => setIsPlaying(false));
      }
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    const isVid = analysis?.has_video;
    const origPlayer = isVid ? originalVideoRef.current : originalAudioRef.current;
    const cleanPlayer = isVid ? cleanedVideoRef.current : cleanedAudioRef.current;

    if (origPlayer) origPlayer.currentTime = newTime;
    if (cleanPlayer) cleanPlayer.currentTime = newTime;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const target = e.currentTarget;
    setCurrentTime(target.currentTime);
    if (target.duration && !isNaN(target.duration) && target.duration > 0) {
      setDuration(target.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = () => {
    if (!result) return;
    playDownload();
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingDrop(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingDrop(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingDrop(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mx-auto max-w-4xl w-full px-2 sm:px-4">
      {/* Hidden audio/video elements for synchronized playback */}
      {originalMediaUrl && !analysis?.has_video && (
        <audio
          ref={originalAudioRef}
          src={originalMediaUrl}
          onTimeUpdate={activeTrack === "original" ? handleTimeUpdate : undefined}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}
      {result?.url && !analysis?.has_video && (
        <audio
          ref={cleanedAudioRef}
          src={result.url}
          onTimeUpdate={activeTrack === "cleaned" ? handleTimeUpdate : undefined}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      {/* STEP 1: Upload Screen */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 sm:p-14 text-center transition-all duration-300 ${
            isDraggingDrop
              ? "border-cyan-400 bg-cyan-400/10 scale-[1.01]"
              : "border-white/15 bg-slate-900/50 hover:border-cyan-400/50 hover:bg-slate-900/80"
          }`}
        >
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-xl shadow-cyan-950/40">
            <Wand2 className="h-8 w-8 sm:h-10 sm:w-10 animate-pulse" />
          </div>

          <h2 className="mt-6 text-xl sm:text-2xl font-semibold text-white">
            Upload Audio or Video to Clean
          </h2>
          <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-400 leading-relaxed">
            Drag & drop voice recordings, podcasts, interviews or video clips. Our AI model removes AC, fan, hiss, electrical hum, and room noise.
          </p>

          <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-95">
            <UploadCloud className="h-4 w-4" /> Choose Audio / Video File
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,.mov,.webm,.mkv,audio/*,video/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />
          </label>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-medium text-cyan-200">
              Audio: MP3 · WAV · M4A · AAC · FLAC · OGG
            </span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-medium text-slate-300">
              Video: MP4 · MOV · WEBM · MKV
            </span>
            <span className="text-slate-500">Up to 200 MB</span>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        /* Workspace when file is selected */
        <div className="space-y-6">
          {/* File summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                {analysis?.has_video ? <FileVideo className="h-6 w-6" /> : <FileAudio className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-white truncate max-w-[240px] sm:max-w-md">
                  {file.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{formatSize(file.size)}</span>
                  <span>•</span>
                  <span>{formatDuration(analysis?.duration || duration)}</span>
                  {analysis?.has_video && (
                    <>
                      <span>•</span>
                      <span className="text-cyan-300 font-medium">Video (Audio cleaned & remuxed)</span>
                    </>
                  )}
                  {analyzing && (
                    <span className="inline-flex items-center gap-1 text-cyan-300">
                      <Loader2 className="h-3 w-3 animate-spin" /> Analyzing audio...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={processing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Replace File
            </button>
          </div>

          {/* Processing Progress Overlay */}
          {processing && (
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md animate-subtle-enter">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 mx-auto items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-xl shadow-cyan-950/40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>

              <h3 className="mt-4 text-lg font-semibold text-white">
                Removing Noise & Enhancing Voice...
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-cyan-300">
                {PROCESSING_STAGES[stageIndex]}
              </p>

              <div className="mt-6 w-full max-w-md mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, ((stageIndex + 1) / PROCESSING_STAGES.length) * 100)}%` }}
                />
              </div>

              <div className="mt-4 flex justify-between max-w-md mx-auto text-[11px] text-slate-500">
                <span>Stage {stageIndex + 1} of {PROCESSING_STAGES.length}</span>
                <span>Local neural model processing</span>
              </div>
            </div>
          )}

          {/* BEFORE / AFTER PREVIEW (Shown after processing) */}
          {result && !processing && (
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-6 animate-subtle-enter">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-base font-semibold text-white">Noise Successfully Removed</span>
                </div>

                {/* A/B Quick Switcher */}
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1 text-xs">
                  <button
                    onClick={() => switchActiveTrack("original")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      activeTrack === "original"
                        ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Original Audio
                  </button>
                  <button
                    onClick={() => switchActiveTrack("cleaned")}
                    className={`rounded-lg px-3 py-1.5 font-medium transition ${
                      activeTrack === "cleaned"
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Cleaned Voice ✨
                  </button>
                </div>
              </div>

              {/* Video Player if video input */}
              {analysis?.has_video && (
                <div className="relative aspect-video max-h-[360px] w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-white/10">
                  <video
                    ref={activeTrack === "original" ? originalVideoRef : cleanedVideoRef}
                    src={activeTrack === "original" ? originalMediaUrl || undefined : result.url}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    className="h-full w-full object-contain"
                    playsInline
                  />
                  <div className="absolute top-3 left-3 rounded-md border border-white/15 bg-black/70 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
                    {activeTrack === "original" ? (
                      <span className="text-amber-300">Original Video (With Noise)</span>
                    ) : (
                      <span className="text-emerald-300">Cleaned Video (Voice Enhanced)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Dual Waveform Visualizer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Listening to:{" "}
                    <strong className={activeTrack === "cleaned" ? "text-emerald-300" : "text-cyan-300"}>
                      {activeTrack === "cleaned" ? "Cleaned Audio (Background Noise Removed)" : "Original Audio (Raw Input)"}
                    </strong>
                  </span>
                  <span className="font-mono text-slate-400">
                    {formatDuration(currentTime)} / {formatDuration(duration || analysis?.duration || 0)}
                  </span>
                </div>

                {/* Interactive Waveform Bar Visualizer */}
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    handleSeek(ratio * (duration || analysis?.duration || 1));
                  }}
                  className="relative h-20 w-full cursor-pointer rounded-xl border border-white/10 bg-slate-950/80 p-2 flex items-center gap-[2px] overflow-hidden group hover:border-cyan-500/40"
                >
                  {/* Playhead indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white z-10 pointer-events-none shadow-[0_0_8px_white]"
                    style={{
                      left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                    }}
                  />

                  {/* Waveform peaks */}
                  {(activeTrack === "cleaned" ? result.cleanedPeaks : (analysis?.waveform || Array(100).fill(0.2))).map(
                    (peak, idx) => {
                      const playPercent = duration ? (currentTime / duration) * 100 : 0;
                      const barPercent = (idx / 100) * 100;
                      const isPlayed = barPercent <= playPercent;
                      const barHeight = Math.max(8, peak * 60);

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex items-center justify-center h-full"
                        >
                          <div
                            style={{ height: `${barHeight}px` }}
                            className={`w-full rounded-sm transition-all duration-75 ${
                              activeTrack === "cleaned"
                                ? isPlayed
                                  ? "bg-emerald-400"
                                  : "bg-emerald-800/40 group-hover:bg-emerald-700/50"
                                : isPlayed
                                ? "bg-cyan-400"
                                : "bg-cyan-800/40 group-hover:bg-cyan-700/50"
                            }`}
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Master Player Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-95"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => switchActiveTrack(activeTrack === "original" ? "cleaned" : "original")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                  >
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                    Toggle A/B ({activeTrack === "cleaned" ? "Switch to Original" : "Switch to Cleaned"})
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-95"
                  >
                    <Download className="h-4 w-4" /> Download Cleaned File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONTROLS & SETTINGS (Shown when not currently processing) */}
          {!processing && (
            <div className="space-y-6">
              {/* Noise Reduction Mode Selection */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-cyan-400" /> Noise Reduction Mode
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select how aggressively the AI separates background noise from speech.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {MODES.map((m) => {
                    const isSelected = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleModeChange(m.id)}
                        className={`text-left rounded-xl p-3.5 border transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-950/40 scale-[1.01]"
                            : "border-white/10 bg-slate-950/50 hover:border-white/20 hover:bg-slate-950/80"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{m.name}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isSelected
                                ? "border-cyan-400/40 bg-cyan-400/20 text-cyan-200"
                                : "border-white/10 bg-white/5 text-slate-400"
                            }`}>
                              {m.badge}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Strength Slider */}
                <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" /> Reduction Strength
                    </span>
                    <span className="font-mono text-cyan-300 font-semibold bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-md text-xs">
                      {strength}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={strength}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setStrength(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                  />

                  <div className="flex justify-between text-[11px] text-slate-500 px-0.5">
                    <span>0% (Minimal / Pass-through)</span>
                    <span>50%</span>
                    <span>100% (Maximum Suppression)</span>
                  </div>
                </div>
              </div>

              {/* Advanced Settings Accordion */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 shadow-xl overflow-hidden backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm font-medium text-slate-300 hover:text-white transition"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Zap className="h-4 w-4 text-cyan-400" /> Advanced Audio Tuning & DSP Settings
                  </span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAdvanced && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-white/10 space-y-5 text-xs text-slate-300 animate-subtle-enter">
                    {/* Voice Enhancement Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                      <div>
                        <div className="font-medium text-white flex items-center gap-1.5">
                          <Mic className="h-3.5 w-3.5 text-cyan-400" /> Voice Enhancement
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Applies intelligent vocal presence EQ (formants boost) and transparent compression for clear diction.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVoiceEnhancement(!voiceEnhancement)}
                        className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                          voiceEnhancement
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "bg-white/5 text-slate-400 border border-white/10"
                        }`}
                      >
                        {voiceEnhancement ? "ON (Recommended)" : "OFF"}
                      </button>
                    </div>

                    {/* Hum Removal */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <div>
                        <div className="font-medium text-white">Electrical Hum Removal</div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Sharp notch filtering targeting 50Hz (Asia/EU) or 60Hz (US) ground loops and harmonics.
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {(["auto", "50hz", "60hz", "off"] as const).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setHumRemoval(h)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition capitalize ${
                              humRemoval === h
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : "bg-white/5 text-slate-400 border border-white/10"
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Low-frequency rumble cleanup */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <div>
                        <div className="font-medium text-white">Low-Frequency Rumble Cleanup</div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          High-pass filter removing mic thumps, desk vibrations, and heavy air conditioning rumble.
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {(["auto", "60hz", "80hz", "100hz", "off"] as const).map((lf) => (
                          <button
                            key={lf}
                            type="button"
                            onClick={() => setLowFrequencyCleanup(lf)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition capitalize ${
                              lowFrequencyCleanup === lf
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : "bg-white/5 text-slate-400 border border-white/10"
                            }`}
                          >
                            {lf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Safe Loudness Normalization */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <div>
                        <div className="font-medium text-white">Safe Loudness Normalization</div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Standard EBU R128 (-16 LUFS) normalization to prevent clipping or whispering audio.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNormalize(!normalize)}
                        className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                          normalize
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "bg-white/5 text-slate-400 border border-white/10"
                        }`}
                      >
                        {normalize ? "ON (Recommended)" : "OFF"}
                      </button>
                    </div>

                    {/* Target Output Format */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <div>
                        <div className="font-medium text-white">Export Format</div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {analysis?.has_video ? "Keeps video stream losslessly while replacing audio." : "Preferred format for download."}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {(analysis?.has_video
                          ? (["video", "mp3", "wav"] as const)
                          : (["auto", "mp3", "wav"] as const)
                        ).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setOutputFormat(fmt as "auto" | "mp3" | "wav" | "video")}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition uppercase ${
                              outputFormat === fmt
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : "bg-white/5 text-slate-400 border border-white/10"
                            }`}
                          >
                            {fmt === "video" ? "MP4 Video" : fmt === "auto" ? "Original" : fmt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button: Clean Audio */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={processing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-cyan-500/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" /> Remove Background Noise Now
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

