import { motion } from "framer-motion";

const LoadingScreen = () => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0f172a]">
      <div className="flex flex-col items-center gap-5">
        <motion.div
          className="h-16 w-16 rounded-full border-4 border-indigo-500 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 0.8,
            ease: "linear",
          }}
        />

        <motion.h1
          className="text-2xl font-bold text-white"
          animate={{
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
          }}
        >
          OmniMind AI
        </motion.h1>

        <p className="text-gray-400">Checking your session...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
