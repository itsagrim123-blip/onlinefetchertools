"use client";

import { useMemo } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useBackendStatus } from "@/components/BackendStatusProvider";

export function BackendStatus() {
  const { status, isChecking, error, checkStatus } = useBackendStatus();

  const tooltipText = useMemo(() => {
    if (status === "online") return "Backend server is online and operational.";
    if (status === "checking") return "Checking backend server status...";
    if (error) return `Backend offline (${error})`;
    return "Backend server is currently offline.";
  }, [status, error]);

  return (
    <div
      role="status"
      aria-live="polite"
      title={tooltipText}
      className="inline-flex h-9 min-w-[136px] sm:min-w-[184px] items-center justify-between gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 sm:px-3 text-xs font-medium text-slate-200 backdrop-blur-xl transition-colors shrink-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        {status === "checking" ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-cyan-400" />
        ) : status === "online" ? (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </span>
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
        )}

        <span
          className={`truncate select-none ${
            status === "online"
              ? "text-emerald-300 font-medium"
              : status === "offline"
              ? "text-rose-300 font-medium"
              : "text-slate-300"
          }`}
        >
          {status === "checking" ? (
            <>
              Checking<span className="hidden sm:inline"> Backend...</span>
              <span className="sm:hidden">...</span>
            </>
          ) : status === "online" ? (
            <>
              <span className="hidden sm:inline">Backend </span>Online
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Backend </span>Offline
            </>
          )}
        </span>
      </div>

      {status === "offline" ? (
        <button
          type="button"
          onClick={checkStatus}
          disabled={isChecking}
          aria-label="Retry connection to backend"
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/25 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          <RotateCcw className={`h-2.5 w-2.5 ${isChecking ? "animate-spin" : ""}`} />
          <span>Retry</span>
        </button>
      ) : null}
    </div>
  );
}

