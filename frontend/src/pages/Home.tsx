import { useState, useEffect, useRef } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebase";
import { gatwayApi } from "../utils/axios";
import axios from "axios";
import { FcGoogle } from "react-icons/fc";
import { motion } from "framer-motion";
import Background from "../components/Background";
import Sidebar from "../components/Sidebar";
import MainContent from "../components/MainContent";
import PlansModal from "../components/PlansModal";
import AdminDashboard from "../components/AdminDashboard";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { login, logout } from "../features/auth/authSlice";
import { useConversations } from "../hooks/useConversations";

const Home = () => {
  // Application State
  useConversations();
  const { isAuthenticated } = useAppSelector((store) => store.auth);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLogin, setIsLogin] = useState<boolean>(isAuthenticated);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const dispatch = useAppDispatch();

  console.log("isAuthenticated => ", isAuthenticated)

  const [stars, setStars] = useState<
    {
      id: number;
      top: number;
      left: number;
      width: number;
      height: number;
      duration: number;
    }[]
  >([]);

  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target as Node)
      ) {
        setIsAttachmentMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLoging = async () => {
    try {
      const googleRes = await signInWithPopup(auth, googleProvider);
      const token = await googleRes.user.getIdToken();
      const { data } = await gatwayApi.post("/auth/login-signup", { token });
      if (data.success) {
        setIsLogin(true);
        dispatch(login(data.data));
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(error.response?.data || error.message);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      const { data } = await gatwayApi.get("/auth/logout");
      if (data.success) {
        setIsLogin(false);
        dispatch(logout());
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(error.response?.data || error.message);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  };

  useEffect(() => {
    const a = async () => {
      const generatedStars = [...Array(100)].map(() => ({
        id: Math.random(),
        top: Math.random() * 100,
        left: Math.random() * 100,
        width: Math.random() * 3,
        height: Math.random() * 3,
        duration: Math.random() * 5 + 3,
      }));
      setStars(generatedStars);
    };
    a();
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleAttachmentMenu = () => {
    setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
  };

  const overlayBg = isDarkMode
    ? "dark:bg-black/60 dark:backdrop-blur-sm"
    : "bg-white/60 backdrop-blur-sm";

  return (
    <div
      className={`flex h-screen w-full ${isDarkMode ? "dark:bg-[#0f1117] dark:text-gray-100" : "bg-[#f4f6f8] text-gray-800"} overflow-hidden font-sans transition-colors duration-500 relative`}
    >
      <Background isDarkMode={isDarkMode} stars={stars} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        handleLogout={handleLogout}
        onOpenPlans={() => setIsPlansModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
      />

      {/* Home Content Overlay (Sign In Message) */}
      {!isLogin && (
        <motion.div
          className={`absolute inset-0 z-999 ${overlayBg} flex flex-col items-center justify-center p-8 text-center space-y-6`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-20 w-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-xl animate-pulse">
            <FcGoogle className="h-10 w-10 p-1" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Please sign in to access OmniMindAi.
          </h1>
          <p className="text-xl text-gray-500">
            Access advanced AI features and history.
          </p>
          <button
            onClick={handleLoging}
            className="flex items-center gap-3 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md"
          >
            <FcGoogle className="h-6 w-6 bg-white rounded-full p-0.5" />
            Sign in with Google
          </button>
        </motion.div>
      )}

      <MainContent
        toggleSidebar={toggleSidebar}
        isLogin={isLogin}
        handleLoging={handleLoging}
        isDarkMode={isDarkMode}
        inputText={inputText}
        setInputText={setInputText}
        isAttachmentMenuOpen={isAttachmentMenuOpen}
        toggleAttachmentMenu={toggleAttachmentMenu}
        onOpenPlans={() => setIsPlansModalOpen(true)}
      />

      <PlansModal
        isOpen={isPlansModalOpen}
        onClose={() => setIsPlansModalOpen(false)}
      />

      <AdminDashboard
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
};

export default Home;
