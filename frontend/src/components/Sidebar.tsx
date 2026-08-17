import React, { useEffect, useState } from "react";
import {
  FiLogOut,
  FiSun,
  FiMoon,
  FiPlus,
  FiMoreVertical,
  FiMessageSquare,
  FiEdit2,
} from "react-icons/fi";
import { FcVoicePresentation } from "react-icons/fc";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAppSelector, useAppDispatch } from "../hooks/redux";
import {
  addConversation,
  setSelectedConversation,
  updateConversationTitle,
} from "../features/conversation/conversationSlice";
import { gatwayApi } from "../utils/axios";
import axios from "axios";

// NOTE: Import your api instance and Redux action here
// import { gatwayApi } from "../../api/gatwayApi";
// import { updateConversationTitle } from "../../redux/slices/conversationSlice";

const theme = {
  bgSidebar: "dark:bg-[#171923]/90 bg-white/90 backdrop-blur-xl",
  textSub: "dark:text-gray-400 text-gray-500",
  border: "dark:border-white/10 border-gray-200",
  hover: "dark:hover:bg-white/10 hover:bg-gray-100",
};

const standardSlideVariants: Variants = {
  hidden: { x: "-100%" },
  visible: { x: 0, transition: { duration: 0.3, ease: "easeInOut" } },
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  handleLogout: () => void;
  onOpenPlans?: () => void;
  onOpenAdmin?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  toggleDarkMode,
  handleLogout,
  onOpenPlans,
  onOpenAdmin,
}) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((store) => store.auth);
  const { conversations, selectedConversation } = useAppSelector(
    (store) => store.conversation,
  );
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  // State for tracking which conversation's 3-dot menu is open
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // States for custom rename modal
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [renameOriginalTitle, setRenameOriginalTitle] = useState("");


  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) {
        onClose();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [onClose]);

  // Handle global click to close 3-dot menu if clicked outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // --- Title Update Handler ---
  const handleUpdateTitleClick = (
    conversationId: string,
    currentTitle: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setActiveMenuId(null); // Dropdown band kar do
    setRenameConversationId(conversationId);
    setRenameOriginalTitle(currentTitle);
    setRenameInputValue(currentTitle || "");
    setIsRenameModalOpen(true);
  };

  const submitRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameConversationId || !renameInputValue.trim() || renameInputValue === renameOriginalTitle) {
      setIsRenameModalOpen(false);
      return;
    }

    try {
      // 1. Hit API
      const response = await gatwayApi.patch(
        `/chat/conversation/${renameConversationId}`,
        {
          title: renameInputValue,
        },
      );

      if (response.data) {
        // 2. Update in Redux
        dispatch(
          updateConversationTitle({
            conversationId: renameConversationId,
            title: renameInputValue,
          }),
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(error.response?.data || error.message);
      } else {
        console.error("Unexpected error:", error);
      }
    } finally {
      setIsRenameModalOpen(false);
    }
  };

  const newConversation = async () => {
    try {
      const { data } = await gatwayApi.post("/chat/conversation");
      if (data.success) {
        dispatch(addConversation(data.data));
        dispatch(setSelectedConversation(data.data._id));
        if (!isDesktop) {
          onClose();
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(error.response?.data || error.message);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  };

  return (
    <AnimatePresence>
      {(isOpen || isDesktop) && (
        <>
          {/* Mobile Overlay */}
          {!isDesktop && isOpen && (
            <motion.div
              className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={onClose}
            />
          )}

          <motion.aside
            className={`fixed md:relative z-30 flex h-full w-72 flex-col ${theme.bgSidebar} border-r ${theme.border} shadow-2xl md:shadow-none`}
            variants={standardSlideVariants}
            initial={isDesktop ? false : "hidden"}
            animate={isDesktop ? false : "visible"}
            exit={isDesktop ? undefined : "hidden"}
          >
            {/* Top / New Chat */}
            <div className="p-4">
              <button
                onClick={newConversation}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border ${theme.border} p-3 text-sm font-semibold transition-all duration-300 ${theme.hover} hover:scale-[1.02] active:scale-95`}
              >
                <span
                  className={`flex items-center gap-2 text-gray-800 dark:text-white`}
                >
                  <FiPlus className="text-lg text-indigo-500" />
                  New Chat
                </span>
                <FcVoicePresentation className="h-4 w-4 opacity-50" />
              </button>
            </div>

            {/* History Section (Mapped Conversations) */}
            <div
              className={`flex-1 overflow-y-auto hide-scrollbar p-4 text-sm ${theme.textSub} space-y-1`}
            >
              <p className="px-2 py-2 text-xs font-bold uppercase tracking-wider opacity-60">
                Recent Chats
              </p>

              {conversations && conversations.length > 0 ? (
                conversations.map((conv) => (
                  <div key={conv._id} className="relative group">
                    <button
                      onClick={() =>
                        dispatch(setSelectedConversation(conv._id))
                      }
                      className={`group flex w-full items-center justify-between rounded-lg p-2.5 text-left ${selectedConversation == conv._id
                          ? "bg-gray-700"
                          : theme.hover
                        } transition-all duration-200`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <FiMessageSquare className="text-gray-400 shrink-0" />
                        <span className="truncate">
                          {conv.title || "New Chat"}
                        </span>
                      </div>

                      {/* 3-dots Menu Button */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(
                            activeMenuId === conv._id ? null : conv._id,
                          );
                        }}
                        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-opacity shrink-0 ${activeMenuId === conv._id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      >
                        <FiMoreVertical className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                      </div>
                    </button>

                    {/* Pop-up Dropdown (Change Title) */}
                    <AnimatePresence>
                      {activeMenuId === conv._id && (
                        <motion.div
                          initial={{ opacity: 0, y: -5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-2 top-10 z-50 w-36 rounded-lg bg-white dark:bg-[#2D3748] shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden"
                          onClick={(e) => e.stopPropagation()} // Click event stop taki menu band na ho
                        >
                          <button
                            onClick={(e) =>
                              handleUpdateTitleClick(conv._id, conv.title, e)
                            }
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          >
                            <FiEdit2 className="w-4 h-4" />
                            Change Title
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              ) : (
                <p className="px-2 text-xs opacity-50">No conversations yet.</p>
              )}
            </div>

            {/* Bottom Section */}
            <div className={`space-y-3 border-t ${theme.border} p-4`}>
              <div className="flex">
                {/* User Profile Section */}
                {user && (
                  <div
                    className={`flex items-center gap-3 rounded-xl p-3 ${theme.hover} transition-all duration-300 cursor-default`}
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-semibold truncate dark:text-white text-gray-800">
                        {user.name}
                      </span>
                      <span className={`text-xs truncate ${theme.textSub}`}>
                        {user.email}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={toggleDarkMode}
                  className={`flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-all duration-300 ${theme.hover}`}
                >
                  <span
                    className={`flex items-center gap-3 ${!isDarkMode ? "text-gray-800" : "text-white"}`}
                  >
                    {isDarkMode ? (
                      <FiSun className="h-5 w-5 text-yellow-400" />
                    ) : (
                      <FiMoon className="h-5 w-5 text-indigo-500" />
                    )}
                  </span>
                </button>
              </div>

              {/* Buy Credits & Admin Buttons */}
              <div className="space-y-1.5 pt-2">
                <button
                  onClick={onOpenPlans}
                  className="flex w-full items-center justify-between gap-2 rounded-xl p-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-500 hover:scale-[1.02] text-xs font-bold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Buy AI Credits / Upgrade
                  </span>
                </button>

                {user?.role === "admin" && (
                  <button
                    onClick={onOpenAdmin}
                    className="flex w-full items-center justify-between gap-2 rounded-xl p-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:scale-[1.02] text-xs font-bold transition-all"
                  >
                    <span>🛡️ Admin Dashboard</span>
                  </button>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700/50 pt-3">
                <button
                  onClick={handleLogout}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-sm font-bold text-red-500 transition-all duration-300 ${theme.hover} hover:text-red-400`}
                >
                  <FiLogOut className="h-5 w-5" />
                  Log Out
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}

      {/* Rename Modal Popup */}
      <AnimatePresence>
        {isRenameModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-white dark:bg-[#1a1c29] p-6 shadow-2xl"
            >
              <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Rename Chat</h3>
              <form onSubmit={submitRename}>
                <input
                  type="text"
                  autoFocus
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Enter new title..."
                />
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRenameModalOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 active:scale-95 transition-all"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default Sidebar;
