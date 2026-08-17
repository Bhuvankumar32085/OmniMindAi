import React from "react";
import { FiDownload } from "react-icons/fi";
import { AiOutlineBarChart } from "react-icons/ai";

export interface PptContent {
  type: "ppt";
  base64_data: string;
  file_name?: string;
  mime_type?: string;
  title?: string;
  subtitle?: string;
  slide_count?: number;
  theme?: string;
  outline?: { title: string; slide_type?: string }[];
  message?: string;
}

const formatFileSize = (base64Data?: string) => {
  if (!base64Data) return "Ready";
  const bytes = Math.floor((base64Data.length * 3) / 4);
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const PptDownloadCard: React.FC<{ content: PptContent }> = ({ content }) => {
  const fileName = content.file_name || "OmniMind_Presentation.pptx";
  const outline = content.outline || [];
  const visibleSlides = outline.slice(0, 5);
  const remainingSlides = Math.max(0, outline.length - visibleSlides.length);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#151826] shadow-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-fuchsia-500/20 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
            <AiOutlineBarChart className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase text-orange-200">
                PPTX
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                {content.slide_count || outline.length || 1} slides
              </span>
              {content.theme && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-200">
                  {content.theme}
                </span>
              )}
            </div>
            <h3 className="truncate text-base font-bold text-white">
              {content.title || "OmniMind Presentation"}
            </h3>
            {content.subtitle && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                {content.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {visibleSlides.length > 0 && (
        <div className="space-y-2 p-4">
          {visibleSlides.map((slide, index) => (
            <div
              key={`${slide.title}-${index}`}
              className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2"
            >
              <span className="font-mono text-xs font-bold text-orange-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                {slide.title}
              </span>
              {slide.slide_type && (
                <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] capitalize text-slate-300 sm:inline">
                  {slide.slide_type}
                </span>
              )}
            </div>
          ))}
          {remainingSlides > 0 && (
            <p className="px-1 text-xs text-slate-400">
              +{remainingSlides} more slides included in the deck
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs text-slate-400">
          <p className="truncate font-medium text-slate-300">{fileName}</p>
          <p>{formatFileSize(content.base64_data)}</p>
        </div>
        <a
          href={`data:${content.mime_type || "application/vnd.openxmlformats-officedocument.presentationml.presentation"};base64,${content.base64_data}`}
          download={fileName}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-orange-600 active:scale-95"
        >
          <FiDownload className="h-4 w-4" />
          Download PPT
        </a>
      </div>
    </div>
  );
};
