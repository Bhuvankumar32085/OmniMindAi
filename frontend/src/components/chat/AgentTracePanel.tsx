import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiActivity,
  FiMessageSquare,
  FiSearch,
  FiCode,
  FiCheck,
  FiFileText,
  FiImage,
  FiDatabase,
  FiCpu,
  FiBarChart2,
} from "react-icons/fi";

export interface AgentRun {
  name: string;
  status: "idle" | "running" | "completed" | "error";
  duration_ms: number;
  selected_agent?: string;
  review_status?: "approved" | "needs_revision";
  detail?: string;
  error?: string;
}

export interface AgentTrace {
  selected_agent?: string;
  total_duration_ms: number;
  steps: AgentRun[];
}

const getAgentMeta = (name?: string) => {
  switch (name) {
    case "manager":
      return {
        label: "Manager Agent",
        bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
        color: "text-indigo-600 dark:text-indigo-400",
        border: "border-indigo-500/30",
        Icon: FiActivity,
      };
    case "clarification":
      return {
        label: "Clarification Agent",
        bg: "bg-amber-500/10 dark:bg-amber-500/20",
        color: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
        Icon: FiMessageSquare,
      };
    case "chat":
      return {
        label: "Chat Agent",
        bg: "bg-blue-500/10 dark:bg-blue-500/20",
        color: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/30",
        Icon: FiMessageSquare,
      };
    case "search":
      return {
        label: "Search Agent",
        bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        color: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
        Icon: FiSearch,
      };
    case "coding":
      return {
        label: "Coding Agent",
        bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
        color: "text-cyan-600 dark:text-cyan-400",
        border: "border-cyan-500/30",
        Icon: FiCode,
      };
    case "review":
      return {
        label: "Review Agent",
        bg: "bg-purple-500/10 dark:bg-purple-500/20",
        color: "text-purple-600 dark:text-purple-400",
        border: "border-purple-500/30",
        Icon: FiCheck,
      };
    case "pdf":
      return {
        label: "PDF Agent",
        bg: "bg-rose-500/10 dark:bg-rose-500/20",
        color: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/30",
        Icon: FiFileText,
      };
    case "ppt":
      return {
        label: "PPT Agent",
        bg: "bg-orange-500/10 dark:bg-orange-500/20",
        color: "text-orange-600 dark:text-orange-400",
        border: "border-orange-500/30",
        Icon: FiBarChart2,
      };
    case "image":
      return {
        label: "Image Agent",
        bg: "bg-pink-500/10 dark:bg-pink-500/20",
        color: "text-pink-600 dark:text-pink-400",
        border: "border-pink-500/30",
        Icon: FiImage,
      };
    case "rag":
      return {
        label: "RAG Agent",
        bg: "bg-teal-500/10 dark:bg-teal-500/20",
        color: "text-teal-600 dark:text-teal-400",
        border: "border-teal-500/30",
        Icon: FiDatabase,
      };
    default:
      return {
        label: "AI Processing",
        bg: "bg-gray-500/10 dark:bg-gray-500/20",
        color: "text-gray-600 dark:text-gray-400",
        border: "border-gray-500/30",
        Icon: FiCpu,
      };
  }
};

const formatDuration = (ms: number) => {
  if (!ms || ms <= 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const AgentTracePanel: React.FC<{
  trace?: AgentTrace;
  isDarkMode: boolean;
}> = ({ trace, isDarkMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!trace?.steps?.length) return null;

  const totalDuration = formatDuration(trace.total_duration_ms);
  const selectedMeta = getAgentMeta(trace.selected_agent);
  const runningStep = trace.steps.find((step) => step.status === "running");

  const getDetail = (step: AgentRun) => {
    if (step.error) return step.error;
    if (step.name === "manager" && step.selected_agent) {
      return `Routed to ${getAgentMeta(step.selected_agent).label}`;
    }
    if (step.review_status) {
      return step.review_status === "approved" ? "Approved" : "Needs revision";
    }
    return step.detail || null;
  };

  return (
    <div
      className={`mb-4 overflow-hidden rounded-xl border transition-all duration-300 ${
        isDarkMode
          ? "border-white/10 bg-black/20"
          : "border-gray-200 bg-gray-50/80"
      }`}
    >
      <div
        className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedMeta.bg} ${selectedMeta.color}`}
          >
            <selectedMeta.Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Agent workflow</p>
            <p className="truncate text-xs opacity-70">
              {runningStep
                ? `${getAgentMeta(runningStep.name).label} running`
                : trace.selected_agent
                  ? `${selectedMeta.label} completed`
                  : "Routing request"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-current/10 px-2.5 py-1 text-xs font-semibold opacity-80">
            <FiClock className="h-3.5 w-3.5" />
            <span>{totalDuration}</span>
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
            {isExpanded ? (
              <FiChevronUp className="h-4 w-4 opacity-70" />
            ) : (
              <FiChevronDown className="h-4 w-4 opacity-70" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-[300px] overflow-y-auto border-t border-black/5 p-3 space-y-2 dark:border-white/10 custom-scrollbar">
          {trace.steps.map((step, idx) => {
            const meta = getAgentMeta(step.name);
            const detail = getDetail(step);
            const isRunning = step.status === "running";
            const isError = step.status === "error";

            return (
              <motion.div
                key={`${step.name}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-xs transition-all ${
                  isDarkMode
                    ? `${meta.bg} ${meta.border}`
                    : "border-black/5 bg-white shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${meta.bg} ${meta.color}`}
                  >
                    <meta.Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{meta.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                          isError
                            ? "bg-red-500/10 text-red-500"
                            : isRunning
                              ? "bg-sky-500/10 text-sky-500"
                              : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>
                    {detail && (
                      <p className="mt-0.5 truncate text-xs opacity-65">{detail}</p>
                    )}
                  </div>
                </div>

                <span className="flex-shrink-0 whitespace-nowrap font-mono text-xs opacity-70">
                  {formatDuration(step.duration_ms)}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
