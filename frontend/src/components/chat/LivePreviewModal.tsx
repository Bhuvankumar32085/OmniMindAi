import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiExternalLink,
  FiX,
  FiMonitor,
  FiTablet,
  FiSmartphone,
  FiRotateCw,
} from "react-icons/fi";

interface LivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  title?: string;
  language?: string;
}

export const LivePreviewModal: React.FC<LivePreviewModalProps> = ({
  isOpen,
  onClose,
  htmlContent,
  title = "Live Sandbox Preview",
  language = "HTML",
}) => {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [key, setKey] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenNewTab = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const getViewportWidth = () => {
    if (viewport === "mobile") return "w-[375px] max-w-full";
    if (viewport === "tablet") return "w-[768px] max-w-full";
    return "w-full max-w-6xl";
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-3 md:p-6 backdrop-blur-xl animate-fadeIn">
      <div
        className={`flex h-[92vh] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d1117] shadow-2xl transition-all duration-300 ${getViewportWidth()}`}
      >
        {/* Modal Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="truncate font-bold text-sm text-white">
              {title}
            </h3>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
              {language}
            </span>
          </div>

          {/* Device Viewport Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-black/50 p-1 border border-white/10">
            <button
              onClick={() => setViewport("desktop")}
              title="Desktop View (100%)"
              className={`flex h-7 px-2.5 items-center gap-1 rounded-lg text-xs font-semibold transition-all ${
                viewport === "desktop"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FiMonitor className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              onClick={() => setViewport("tablet")}
              title="Tablet View (768px)"
              className={`flex h-7 px-2.5 items-center gap-1 rounded-lg text-xs font-semibold transition-all ${
                viewport === "tablet"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FiTablet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tablet</span>
            </button>
            <button
              onClick={() => setViewport("mobile")}
              title="Mobile View (375px)"
              className={`flex h-7 px-2.5 items-center gap-1 rounded-lg text-xs font-semibold transition-all ${
                viewport === "mobile"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FiSmartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setKey((k) => k + 1)}
              title="Reload Frame"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <FiRotateCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleOpenNewTab}
              title="Open in New Tab"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <FiExternalLink className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Close Preview"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white transition-colors border border-red-500/30"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Sandboxed Content Frame */}
        <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
          <iframe
            key={key}
            title="Live Code Sandbox Portal Frame"
            srcDoc={htmlContent}
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
            className="h-full w-full rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
