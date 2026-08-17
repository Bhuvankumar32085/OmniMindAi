import React, { useRef, useEffect } from "react";
import { FiCode, FiSend, FiFileText } from "react-icons/fi";
import { AiOutlineBarChart, AiOutlinePicture } from "react-icons/ai";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import axios from "axios";
import {
  addConversation,
  addMessage,
  setSelectedConversation,
  setLoading,
  updateMessage,
} from "../features/conversation/conversationSlice";
import type { AgentTrace } from "../features/conversation/conversationSlice";
import { fetchCreditBalance } from "../features/credit/creditSlice";
import { gatwayApi } from "../utils/axios";

const theme = {
  bgSidebar: "dark:bg-[#171923]/90 bg-white/90 backdrop-blur-xl",
  textSub: "dark:text-gray-400 text-gray-500",
  border: "dark:border-white/10 border-gray-200",
  hover: "dark:hover:bg-white/10 hover:bg-gray-100",
  inputBg: "dark:bg-[#1e2028]/80 bg-white/80",
};

const standardFadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
};

const standardScaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, scale: 0.9 },
};

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  isAttachmentMenuOpen: boolean;
  toggleAttachmentMenu: () => void;
  isDarkMode: boolean;
}

const createInitialAgentTrace = (): AgentTrace => {
  const now = new Date().toISOString();

  return {
    workflow_started_at: now,
    workflow_completed_at: null,
    total_duration_ms: 0,
    selected_agent: null,
    current_agent: "manager",
    steps: [
      {
        id: "manager-pending",
        name: "manager",
        status: "running",
        started_at: now,
        started_offset_ms: 0,
        duration_ms: null,
      },
    ],
  };
};

const normalizeAssistantContent = (
  responseContent: unknown,
  agentTrace?: AgentTrace,
  fallbackText = "",
) => {
  if (
    responseContent &&
    typeof responseContent === "object" &&
    "type" in responseContent
  ) {
    const objectContent = responseContent as Record<string, unknown>;

    return {
      ...objectContent,
      agent_trace: agentTrace ?? objectContent.agent_trace,
    };
  }

  return {
    type: "text",
    text: typeof responseContent === "string" ? responseContent : fallbackText,
    agent_trace: agentTrace,
  };
};

const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  isAttachmentMenuOpen,
  toggleAttachmentMenu,
  isDarkMode,
}) => {
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null); // Menu toggle button ka ref
  const dispatch = useAppDispatch();

  const { selectedConversation, loading, messages } = useAppSelector(
    (store) => store.conversation,
  );

  // === NEW FIX: Attachment Menu बाहर क्लिक करने पर बंद हो जाएगा ===
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // अगर क्लिक menu के बाहर हुआ है और toggle बटन पर भी नहीं हुआ है, तब मेनू बंद करें
      if (
        isAttachmentMenuOpen &&
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target as Node) &&
        attachmentButtonRef.current &&
        !attachmentButtonRef.current.contains(event.target as Node)
      ) {
        toggleAttachmentMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAttachmentMenuOpen, toggleAttachmentMenu]);

  const executeSendMessage = async (textToSend: string, targetMessageId?: string) => {
    if (!textToSend.trim()) return;

    const messageToSend = textToSend.trim();
    let activeConversationId = selectedConversation;

    // 1. User ka message turant add karein (Sirf naye messages ke liye)
    if (!targetMessageId) {
      dispatch(
        addMessage({
          _id: crypto.randomUUID(),
          conversation_id: selectedConversation || "temp_id",
          role: "user",
          content: messageToSend,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      );
    }

    // 2. Agar conversation pehle se nahi hai toh naya create karein
    if (!activeConversationId) {
      try {
        const { data } = await gatwayApi.post("/chat/conversation");
        if (data.success) {
          dispatch(addConversation(data.data));
          dispatch(setSelectedConversation(data.data._id));
          activeConversationId = data.data._id;
        }
      } catch (error) {
        console.error("Failed to create conversation", error);
        dispatch(setLoading(false));
        return;
      }
    }

    // 3. AI ke liye target message ID ya naya ID use karein
    const existingMsg = messages.find((m) => m._id === targetMessageId);
    const previousContent = existingMsg ? existingMsg.content : undefined;

    const aiMessageId = targetMessageId || crypto.randomUUID();
    const initialAgentTrace = createInitialAgentTrace();

    if (targetMessageId) {
      dispatch(
        updateMessage({
          _id: targetMessageId,
          content: {
            type: "text",
            text: "✨ Your code is being upgraded... Please wait while AI agent builds the updated version.",
            agent_trace: initialAgentTrace,
          },
          conversation_id: activeConversationId || "temp_id",
        }),
      );
    } else {
      dispatch(
        addMessage({
          _id: aiMessageId,
          conversation_id: activeConversationId || "temp_id",
          role: "assistant",
          content: {
            type: "text",
            text: "",
            agent_trace: initialAgentTrace,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      );
    }

    dispatch(setLoading(true));
    let latestAgentTrace: AgentTrace | undefined = initialAgentTrace;

    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";

      const response = await fetch(`${serverUrl}/agent/call-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          conversation_id: activeConversationId,
          user_message: messageToSend,
          target_message_id: targetMessageId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported by this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";
      let streamedContent = "";
      let hasReceivedDelta = false;

      const updateAssistantMessage = (
        contentOverride?: unknown,
        traceOverride?: AgentTrace,
        newId?: string,
      ) => {
        if (traceOverride) {
          latestAgentTrace = traceOverride;
        }

        dispatch(
          updateMessage({
            _id: aiMessageId,
            new_id: newId,
            content: normalizeAssistantContent(
              contentOverride ?? streamedContent,
              latestAgentTrace,
              streamedContent,
            ),
            conversation_id: activeConversationId!,
          }),
        );
      };

      // Jaise hi stream ka pehla tukda aaye, general loading spinner hata dein
      dispatch(setLoading(false));

      const handleSseEvent = (rawEvent: string) => {
        const dataStr = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s?/, ""))
          .join("\n")
          .trim();

        if (!dataStr) return;

        // === NEW FIX: Added try-catch block here to prevent app crash ===
        try {
          const parsedData = JSON.parse(dataStr);
          const eventTrace = parsedData.data?.agent_trace as
            | AgentTrace
            | undefined;

          if (eventTrace) {
            updateAssistantMessage(undefined, eventTrace);
          }

          if (parsedData.type === "delta") {
            const textDelta = parsedData.data?.text || "";
            if (!textDelta) return;

            if (!hasReceivedDelta) {
              streamedContent = "";
              hasReceivedDelta = true;
            }

            streamedContent += textDelta;

            updateAssistantMessage();
          }
          // Agent status/timing update
          else if (parsedData.type === "agent" || parsedData.type === "status") {
            updateAssistantMessage(undefined, eventTrace);
          }
          // Agar stream poori tarah end ho gayi hai
          else if (parsedData.type === "end") {
            const finalResponse = parsedData.data?.final_response;
            const savedMessageId = parsedData.data?.saved_message_id;

            if (finalResponse !== undefined && finalResponse !== null) {
              updateAssistantMessage(finalResponse, eventTrace, savedMessageId);
            }
          }
          // Purane backend format ke liye fallback
          else if (parsedData.type === "chunk") {
            const nodeData = parsedData.data;
            let currentText = null;

            for (const key in nodeData) {
              if (nodeData[key] && nodeData[key].final_response) {
                currentText = nodeData[key].final_response;
              }
            }

            if (currentText) {
              streamedContent =
                typeof currentText === "string"
                  ? currentText
                  : currentText.text || "";
              hasReceivedDelta = true;

              dispatch(
                updateMessage({
                  _id: aiMessageId,
                  content: normalizeAssistantContent(
                    currentText,
                    latestAgentTrace,
                    streamedContent,
                  ),
                }),
              );
            }
          }
          // Agar backend se koi error message aaya ho
          else if (parsedData.success === false) {
            const isInsufficient = parsedData.code === "INSUFFICIENT_CREDITS";
            const reqCredits = parsedData.data?.required;
            const currentBal = parsedData.data?.balance;

            const errorText = isInsufficient
              ? `Insufficient AI Credits. You have ${currentBal !== undefined ? currentBal : 0} credits remaining, but this operation requires ${reqCredits !== undefined ? reqCredits : 5} credits. Please buy credits to continue.`
              : parsedData.message || "An error occurred.";

            dispatch(
              updateMessage({
                _id: aiMessageId,
                content: {
                  type: "error",
                  message: errorText,
                  agent_trace: latestAgentTrace,
                },
              }),
            );
          }
        } catch (error) {
          // JSON Parse fail hone par yahan aayega, app crash nahi hoga
          console.error("Error parsing stream chunk JSON:", error);
        }
      };

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            handleSseEvent(event);
          }
        }
      }

      const remaining = buffer + decoder.decode();
      if (remaining.trim()) {
        handleSseEvent(remaining);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(error.response?.data || error.message);
      } else {
        console.error("Unexpected error during streaming:", error);
      }
      if (targetMessageId && previousContent) {
        dispatch(
          updateMessage({
            _id: targetMessageId,
            content: previousContent,
            conversation_id: activeConversationId!,
          }),
        );
      } else {
        dispatch(
          updateMessage({
            _id: aiMessageId,
            content: {
              type: "error",
              message: "Failed to fetch response from server.",
              agent_trace: latestAgentTrace,
            },
          }),
        );
      }
    } finally {
      dispatch(setLoading(false));
      dispatch(fetchCreditBalance());
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    executeSendMessage(text);
  };

  useEffect(() => {
    const handleCustomSend = (e: Event) => {
      const customEvent = e as CustomEvent<string | { promptText: string; targetMessageId?: string }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail === "string") {
          executeSendMessage(customEvent.detail);
        } else if (typeof customEvent.detail === "object" && customEvent.detail.promptText) {
          executeSendMessage(customEvent.detail.promptText, customEvent.detail.targetMessageId);
        }
      }
    };

    window.addEventListener("dispatch-agent-message", handleCustomSend);
    return () => {
      window.removeEventListener("dispatch-agent-message", handleCustomSend);
    };
  }, [selectedConversation, dispatch]);

  // === NEW FIX: Enter key दबाने पर मैसेज सेंड करने का फंक्शन ===
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // अगर Shift + Enter नहीं दबाया है (सिर्फ Enter), तो मैसेज सेंड करें
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // नई लाइन बनने से रोकेगा
      if (inputText.trim() && !loading) {
        handleSend();
      }
    }
  };

  return (
    <motion.div
      className={`w-full pt-4 pb-8 px-4 md:px-8 z-20`}
      variants={standardFadeVariants}
    >
      <div className="mx-auto max-w-4xl relative">
        {/* Attachment Popover Menu */}
        <AnimatePresence>
          {isAttachmentMenuOpen && (
            <motion.div
              ref={attachmentMenuRef}
              className={`absolute bottom-[110%] left-0 w-64 rounded-2xl border ${theme.border} ${theme.bgSidebar} shadow-2xl p-2 z-50 backdrop-blur-xl`}
              variants={standardScaleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {[
                {
                  icon: FiFileText,
                  label: "Upload Document",
                  sub: "PDF, DOCX, TXT",
                  color: "text-rose-500",
                  bg: "bg-rose-500/10",
                },
                {
                  icon: AiOutlineBarChart,
                  label: "Generate PPT",
                  sub: "Create presentation",
                  color: "text-orange-500",
                  bg: "bg-orange-500/10",
                },
                {
                  icon: AiOutlinePicture,
                  label: "Generate Image",
                  sub: "DALL-E Integration",
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                },
                {
                  icon: FiCode,
                  label: "Code Workspace",
                  sub: "HTML/CSS/JS",
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
              ].map((item, idx) => (
                <button
                  key={idx}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 ${theme.hover} transition-all duration-200 text-left group`}
                >
                  <div
                    className={`h-10 w-10 rounded-lg ${item.bg} flex items-center justify-center ${item.color} text-lg group-hover:scale-110 transition-transform`}
                  >
                    <item.icon />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{item.label}</div>
                    <div className={`text-xs opacity-60`}>{item.sub}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Container (Glassmorphic) */}
        <div
          className={`relative flex items-end rounded-[2rem] border ${theme.border} ${theme.inputBg} backdrop-blur-xl shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all duration-300 p-2`}
        >
          {/* Attachment Button (+) */}
          <button
            ref={attachmentButtonRef} // <-- Added Ref Here
            onClick={toggleAttachmentMenu}
            className={`p-3 m-1 rounded-full ${theme.hover} ${isAttachmentMenuOpen
              ? "bg-indigo-500/20 text-indigo-500"
              : "text-gray-400 hover:text-current"
              } transition-all duration-200 flex-shrink-0`}
          >
            <motion.svg
              className={`h-6 w-6`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: isAttachmentMenuOpen ? 45 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              ></path>
            </motion.svg>
          </button>

          {/* Text Input */}
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown} // <-- Added Keydown event
            placeholder="Message OmniMindAi..."
            className={`flex-1 max-h-40 min-h-[52px] resize-none bg-transparent py-3.5 px-2 focus:outline-none ${isDarkMode ? "dark:text-gray-100" : "text-gray-800"
              } placeholder-gray-500 text-base`}
            style={{ overflowY: "auto" }}
          />

          {/* Submit Button */}
          <button
            disabled={!inputText.trim() || loading}
            onClick={handleSend}
            className={`p-3 m-1 rounded-full flex-shrink-0 transition-all duration-300 ${inputText.trim() && !loading
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg hover:shadow-indigo-500/50 hover:scale-105"
              : "bg-gray-200/10 text-gray-500 cursor-not-allowed"
              }`}
          >
            <FiSend className="h-5 w-5" />
          </button>
        </div>

        <p className="hidden md:block text-center text-xs text-gray-500 mt-4 font-medium opacity-80">
          OmniMindAi can make mistakes. Verify important information before use.
        </p>
      </div>
    </motion.div>
  );
};

export default ChatInput;