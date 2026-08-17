import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FiAlertTriangle,
  FiMenu,
  FiMessageSquare,
} from "react-icons/fi";
import { AiOutlineFilePdf } from "react-icons/ai";
import { useAppSelector } from "../hooks/redux";
import type { Message } from "../features/conversation/conversationSlice";
import { MarkdownMessage } from "./chat/MarkdownMessage";
import { AgentTracePanel } from "./chat/AgentTracePanel";
import { PptDownloadCard, type PptContent } from "./chat/PptDownloadCard";
import ChatInput from "./ChatInput";
import CreditBadge from "./CreditBadge";

interface MainContentProps {
  toggleSidebar: () => void;
  isLogin: boolean;
  handleLoging: () => void;
  isDarkMode: boolean;
  inputText: string;
  setInputText: (text: string) => void;
  isAttachmentMenuOpen: boolean;
  toggleAttachmentMenu: () => void;
  onOpenPlans?: () => void;
}

// Framer Motion Animation Variants
const parentFadeVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const childFadeVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

const MainContent: React.FC<MainContentProps> = ({
  toggleSidebar,
  isDarkMode,
  inputText,
  setInputText,
  isAttachmentMenuOpen,
  toggleAttachmentMenu,
  onOpenPlans,
}) => {
  const [loading] = useState<boolean>(false);

  // Redux Store Se Data Fetch Kar Rahe Hain
  const { messages } = useAppSelector((state) => state.conversation);
  const { user } = useAppSelector((state) => state.auth);

  const getAgentTrace = (content: any) => {
    if (!content || typeof content === "string") return undefined;
    return content.agent_trace;
  };

  const handleClarificationAnswer = async (
    questionId: string,
    optionText: string,
  ) => {
    try {
      const promptText = `Selected Option for ${questionId}: ${optionText}`;
      window.dispatchEvent(
        new CustomEvent("dispatch-agent-message", { detail: promptText })
      );
    } catch (error) {
      console.error("Error dispatching clarification response:", error);
    }
  };

  const theme = {
    bg: isDarkMode ? "bg-[#090D16]" : "bg-[#F8FAFC]",
    textMain: isDarkMode ? "text-slate-100" : "text-slate-900",
    textSub: isDarkMode ? "text-slate-400" : "text-slate-500",
    cardBg: isDarkMode
      ? "bg-[#111726]/80 backdrop-blur-md"
      : "bg-white/80 backdrop-blur-md",
    border: isDarkMode ? "border-white/10" : "border-slate-200/80",
    headerBg: isDarkMode
      ? "bg-[#090D16]/80 border-b border-white/5"
      : "bg-white/80 border-b border-slate-200/80",
  };

  return (
    <div
      className={`flex flex-col flex-1 h-full min-w-0 transition-colors duration-300 relative overflow-hidden ${theme.bg} ${theme.textMain}`}
    >
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      {/* Top Navigation Header */}
      <header
        className={`flex items-center justify-between px-4 md:px-8 py-3 z-20 backdrop-blur-xl ${theme.headerBg}`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-xl border ${theme.border} ${theme.cardBg} ${theme.textMain} hover:scale-105 active:scale-95 transition-all shadow-sm`}
            title="Toggle Sidebar"
          >
            <FiMenu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <h1 className="font-extrabold text-lg md:text-xl tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              OmniMindAi
            </h1>
          </div>
        </div>

        {/* User Info / Avatar & AI Credit Badge */}
        <div className="flex items-center space-x-3">
          <CreditBadge onOpenPlans={onOpenPlans || (() => {})} />

          {user && (
            <div className="flex items-center space-x-2">
              <img
                src={
                  user.avatar ||
                  "https://api.dicebear.com/7.x/bottts/svg?seed=Omni"
                }
                alt="User Avatar"
                className="w-8 h-8 rounded-full border border-indigo-500/30"
              />
              <span className="hidden md:inline text-xs font-semibold">
                {user.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center px-4 md:px-6 relative z-10">
        <motion.div
          className="w-full max-w-4xl flex flex-col flex-1"
          variants={parentFadeVariants}
          initial="hidden"
          animate="visible"
        >
          {loading ? (
            /* Loading State */
            <div className="flex space-x-2 items-center justify-center h-full my-auto">
              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" />
              <div
                className="w-3 h-3 rounded-full bg-purple-500 animate-bounce"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="w-3 h-3 rounded-full bg-pink-500 animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
          ) : messages && messages.length !== 0 ? (
            /* Messages List */
            <div className="flex flex-col w-full space-y-6 pb-24 pt-4">
              {messages.map((msg: Message, index: number) => {
                const isUser = msg.role === "user";
                const agentTrace = getAgentTrace(msg.content);

                return (
                  <motion.div
                    key={msg._id || index}
                    variants={childFadeVariants}
                    className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] md:max-w-[80%] rounded-2xl p-4 shadow-md ${
                        isUser
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-indigo-500/10"
                          : `${theme.cardBg} border ${theme.border} ${theme.textMain} rounded-bl-sm backdrop-blur-xl shadow-black/5`
                      }`}
                    >
                      {!isUser && (
                        <AgentTracePanel
                          trace={agentTrace}
                          isDarkMode={isDarkMode}
                        />
                      )}

                      {/* Content Renderer */}
                      {typeof msg.content === "string" ? (
                        isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                            {msg.content}
                          </p>
                        ) : (
                          <MarkdownMessage
                            text={msg.content}
                            setInputText={setInputText}
                            messageId={msg._id}
                          />
                        )
                      ) : msg.content.type === "image" ? (
                        <div className="flex justify-center rounded-xl overflow-hidden bg-black/5 dark:bg-black/20">
                          {msg.content.base64_data ? (
                            <img
                              src={`data:${msg.content.mime_type || "image/png"};base64,${msg.content.base64_data}`}
                              alt="AI Generated"
                              className="max-h-[500px] w-auto object-contain rounded-xl hover:scale-[1.02] transition-transform duration-300 shadow-xl"
                            />
                          ) : (
                            <span className="p-4 text-sm text-gray-500">
                              Processing image...
                            </span>
                          )}
                        </div>
                      ) : msg.content.type === "pdf" ? (
                        <div className="flex flex-col gap-3 p-4 bg-[#1E1E2E] border border-white/10 rounded-xl w-64 shadow-lg">
                          <div className="flex items-center gap-3">
                            <AiOutlineFilePdf className="text-3xl text-red-500 drop-shadow-md" />
                            <span className="font-semibold text-gray-100 text-sm truncate">
                              Document.pdf
                            </span>
                          </div>
                          <a
                            href={`data:${msg.content.mime_type || "application/pdf"};base64,${msg.content.base64_data}`}
                            download="OmniMind_Generated.pdf"
                            className="flex items-center justify-center w-full py-2 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-lg transition-all font-medium text-sm shadow-md"
                          >
                            Download PDF
                          </a>
                        </div>
                      ) : msg.content.type === "ppt" ? (
                        <PptDownloadCard content={msg.content as PptContent} />
                      ) : msg.content.type === "error" ? (
                        <div className="flex items-center gap-2 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
                          <FiAlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium">
                            {msg.content.message}
                          </span>
                        </div>
                      ) : msg.content.type === "text" ? (
                        msg.content.text ? (
                          <MarkdownMessage
                            text={msg.content.text}
                            setInputText={setInputText}
                            messageId={msg._id}
                          />
                        ) : null
                      ) : msg.content.type === "clarification" ? (
                        <div className="flex flex-col gap-2">
                          {msg.content.text ? (
                            <MarkdownMessage
                              text={msg.content.text}
                              setInputText={setInputText}
                              messageId={msg._id}
                            />
                          ) : null}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                              Clarification Requested
                            </span>
                          </div>
                          {(msg.content as any).questions &&
                            (msg.content as any).questions.length > 0 && (
                              <div className="mt-3 space-y-4">
                                {(msg.content as any).questions.map((q: any) => (
                                  <div
                                    key={q.id}
                                    className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2"
                                  >
                                    <p className="text-xs font-bold text-slate-200">
                                      {q.question}
                                    </p>
                                    {q.options && q.options.length > 0 && (
                                      <div className="flex flex-wrap gap-2 pt-1">
                                        {q.options.map(
                                          (opt: string, optIdx: number) => (
                                            <button
                                              key={optIdx}
                                              onClick={() =>
                                                handleClarificationAnswer(
                                                  q.id,
                                                  opt,
                                                )
                                              }
                                              className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs rounded-lg border border-indigo-500/30 transition-colors"
                                            >
                                              {opt}
                                            </button>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Welcome / Empty Screen */
            <div className="flex flex-col items-center justify-center flex-1 my-auto text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-500/20">
                <FiMessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold mb-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                What can I help you build today?
              </h2>
              <p className={`max-w-md text-sm ${theme.textSub}`}>
                OmniMindAI multi-agent suite can generate full-stack code, PPT presentations, PDF documents, research web data, and much more.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer Chat Input */}
      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        isAttachmentMenuOpen={isAttachmentMenuOpen}
        toggleAttachmentMenu={toggleAttachmentMenu}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default MainContent;
