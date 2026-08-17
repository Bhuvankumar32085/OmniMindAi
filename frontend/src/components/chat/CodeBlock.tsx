import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  FiCheck,
  FiCode,
  FiCopy,
  FiEdit3,
  FiMaximize2,
  FiMinimize2,
  FiPlay,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";
import { LivePreviewModal } from "./LivePreviewModal";

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API failed, falling back", err);
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  }
};

interface CodeBlockProps {
  code: string;
  language?: string;
  setInputText?: (text: string) => void;
  messageId?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code: initialCode,
  language,
  messageId,
}) => {
  const [copied, setCopied] = useState(false);
  const [currentCode, setCurrentCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState<"code" | "edit">("code");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const lang = (language || "").toLowerCase();

  const isRunnable =
    ["html", "xml", "css", "js", "javascript", "jsx", "tsx", "web"].includes(lang) ||
    /<[a-z][\s\S]*>/i.test(currentCode) ||
    currentCode.includes("document.") ||
    currentCode.includes("<style") ||
    currentCode.includes("<script");

  const label = language || "code";

  const handleCopy = async () => {
    await copyToClipboard(currentCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const getPreviewHtml = () => {
    const trimmed = currentCode.trim();

    if (trimmed.toLowerCase().startsWith("<!doctype") || trimmed.toLowerCase().startsWith("<html")) {
      return trimmed;
    }

    if (lang === "css") {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${currentCode}</style>
</head>
<body class="bg-slate-900 text-white p-6 font-sans">
  <div class="max-w-md mx-auto p-5 rounded-2xl border border-white/10 shadow-2xl bg-slate-800 text-center space-y-3">
    <h2 class="text-xl font-bold text-indigo-400">CSS Live Preview</h2>
    <p class="text-sm text-slate-300">Your custom CSS is dynamically applied to this live frame.</p>
    <button class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow transition-all">Sample Button</button>
  </div>
</body>
</html>`;
    }

    if ((lang === "js" || lang === "javascript") && !trimmed.includes("<div") && !trimmed.includes("<button")) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; padding: 1.25rem; }
    #console { font-family: monospace; background: #1e293b; padding: 1rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.1); max-height: 380px; overflow-y: auto; }
    .log-line { border-bottom: 1px solid rgba(255,255,255,0.05); padding: 0.25rem 0; font-size: 0.875rem; color: #38bdf8; }
    .err-line { color: #f87171; }
  </style>
</head>
<body>
  <h3 class="text-base font-bold mb-2 text-indigo-400">⚡ Console Output</h3>
  <div id="console"></div>
  <script>
    const consoleDiv = document.getElementById('console');
    function logToScreen(msg, isErr = false) {
      const line = document.createElement('div');
      line.className = isErr ? 'log-line err-line' : 'log-line';
      line.textContent = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg);
      consoleDiv.appendChild(line);
    }
    const origLog = console.log;
    console.log = function(...args) { logToScreen(args.join(' ')); origLog.apply(console, args); };
    window.onerror = function(msg) { logToScreen('Error: ' + msg, true); };
    try {
      ${currentCode}
    } catch(err) {
      logToScreen(err.stack || err.message, true);
    }
  </script>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 1rem; }
  </style>
</head>
<body>
  ${currentCode}
</body>
</html>`;
  };

  const handleSendToAgent = () => {
    const instruction = refinementPrompt.trim()
      ? refinementPrompt.trim()
      : "Please refine and improve this code.";

    const promptText = `Here is my current code:\n\`\`\`${label}\n${currentCode}\n\`\`\`\n\nRequirements / Improvements needed:\n${instruction}`;

    // Direct Agent Submission with targetMessageId for in-place update!
    window.dispatchEvent(
      new CustomEvent("dispatch-agent-message", {
        detail: {
          promptText,
          targetMessageId: messageId,
        },
      })
    );

    setIsImproving(false);
    setRefinementPrompt("");
  };

  return (
    <>
      <div
        className={`my-4 overflow-hidden rounded-xl border border-white/10 bg-[#111827] shadow-xl transition-all ${
          isFullscreen
            ? "fixed inset-4 z-50 my-0 flex flex-col bg-[#0f172a]"
            : ""
        }`}
      >
        {/* Header / Navigation Bar */}
        <div className="flex flex-wrap min-h-11 items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-xs font-bold uppercase tracking-wider text-indigo-400">
              {label}
            </span>
            {isRunnable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Runnable
              </span>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("code")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                activeTab === "code"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <FiCode className="h-3.5 w-3.5" />
              <span>Code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                activeTab === "edit"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <FiEdit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>

            {/* LIVE PREVIEW BUTTON - OPENS PORTAL MODAL */}
            {isRunnable && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 transition-all hover:bg-emerald-500 active:scale-95"
              >
                <FiPlay className="h-3.5 w-3.5" />
                <span>Live Preview</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              title="Copy code"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
            >
              {copied ? (
                <FiCheck className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <FiCopy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImproving(!isImproving)}
              title="Refine with AI Agent"
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-2.5 text-xs font-semibold text-white shadow transition-transform active:scale-95 hover:brightness-110"
            >
              <FiRefreshCw className="h-3.5 w-3.5" />
              <span>Improve with AI</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10"
            >
              {isFullscreen ? (
                <FiMinimize2 className="h-3.5 w-3.5" />
              ) : (
                <FiMaximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Direct AI Improvement Input Drawer */}
        {isImproving && (
          <div className="border-b border-white/10 bg-purple-950/50 p-3 backdrop-blur-md">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-purple-300">
                🤖 What changes or improvements should the AI Agent make?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  placeholder="e.g. Add dark mode, add memory button to calculator, improve layout..."
                  className="flex-1 rounded-lg border border-purple-500/30 bg-purple-900/30 px-3 py-1.5 text-xs text-white placeholder-purple-300/50 focus:border-purple-400 focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleSendToAgent()}
                />
                <button
                  type="button"
                  onClick={handleSendToAgent}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 active:scale-95 transition-all"
                >
                  <FiSend className="h-3.5 w-3.5" />
                  <span>Send to Agent</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className={`relative ${isFullscreen ? "flex-1 overflow-hidden" : ""}`}>
          {activeTab === "code" && (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language || "text"}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: "1rem",
                background: "transparent",
                fontSize: "0.875rem",
                maxHeight: isFullscreen ? "calc(100vh - 120px)" : "500px",
                overflowY: "auto",
              }}
            >
              {currentCode}
            </SyntaxHighlighter>
          )}

          {activeTab === "edit" && (
            <div className="p-3">
              <textarea
                value={currentCode}
                onChange={(e) => setCurrentCode(e.target.value)}
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-[#0d1117] p-3 font-mono text-xs leading-relaxed text-emerald-400 focus:border-indigo-500 focus:outline-none resize-y"
                rows={isFullscreen ? 25 : 14}
              />
              <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-slate-400">
                <span>Edit code directly to update the live preview.</span>
                <span>{currentCode.length} characters</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DEDICATED LIVE PREVIEW PORTAL MODAL */}
      <LivePreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        htmlContent={getPreviewHtml()}
        title={`${label.toUpperCase()} Live Preview`}
        language={label}
      />
    </>
  );
};
