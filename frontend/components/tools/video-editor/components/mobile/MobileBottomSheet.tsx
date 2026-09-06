"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { MobileSheetType } from "../../types";

interface MobileBottomSheetProps {
  isOpen: boolean;
  type: MobileSheetType | null;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function MobileBottomSheet({
  isOpen,
  title,
  onClose,
  children,
}: MobileBottomSheetProps) {
  // Prevent body scroll when sheet is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm select-none lg:hidden"
    >
      {/* Sheet panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-h-[82vh] rounded-t-3xl border-t border-white/15 bg-slate-950 px-4 pt-3 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200"
      >
        {/* Top Grab Handle */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/20" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="flex-1 overflow-y-auto mt-3 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
