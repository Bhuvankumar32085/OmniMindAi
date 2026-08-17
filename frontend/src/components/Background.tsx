import React from "react";
import { motion } from "framer-motion";

interface BackgroundProps {
  isDarkMode: boolean;
  stars: {
    id: number;
    top: number;
    left: number;
    width: number;
    height: number;
    duration: number;
  }[];
}

const Background: React.FC<BackgroundProps> = ({ isDarkMode, stars }) => {
  return (
    <>
      {/* ================= ANIMATED BACKGROUND (Color Mixing Blobs) ================= */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[
          {
            key: 1,
            x: "-10%",
            y: "-20%",
            delay: 0,
            dark: "bg-indigo-600",
            light: "bg-indigo-50", // Changed to a very pale blue
          },
          {
            key: 2,
            x: "-10%",
            y: "10%",
            delay: 2000,
            dark: "bg-purple-600",
            light: "bg-purple-50", // Changed to a very pale purple
          },
          {
            key: 3,
            x: "20%",
            y: "-20%",
            delay: 4000,
            dark: "bg-blue-600",
            light: "bg-sky-50", // Changed to a very pale cyan/sky blue
          },
        ].map((blob) => (
          <motion.div
            key={blob.key}
            className={`absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 ${isDarkMode ? blob.dark + " opacity-40" : blob.light}`} // Reduced opacity for Light Mode, kept a bit higher for dark
            initial={{ x: blob.x, y: blob.y, scale: 1 }}
            animate={{
              x: ["-10%", "30px", "-20px", "-10%"],
              y: ["-20%", "-50px", "20px", "-20%"],
              scale: [1, 1.1, 0.9, 1],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: blob.delay / 1000,
            }}
          />
        ))}
      </div>

      {/* ================= BACKGROUND STARRY & CLOUD ANIMATIONS ================= */}
      {isDarkMode && (
        <motion.div
          className="absolute inset-0 opacity-80 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1 }}
        >
          {/* Rendering stars array directly */}
          {stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute rounded-full bg-white"
              style={{
                top: `${star.top}%`,
                left: `${star.left}%`,
                width: `${star.width}px`,
                height: `${star.height}px`,
              }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: star.duration,
                repeat: Infinity,
              }}
            />
          ))}
        </motion.div>
      )}

      {!isDarkMode && (
        <motion.div
          className="absolute inset-0 opacity-100 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {/* Clouds Animation for Light Mode */}
          {[
            {
              key: 1,
              top: "30%",
              left: "-10%",
              width: "40%",
              height: "20%",
              blur: "blur-3xl",
              opacity: 0.6,
              delay: 0,
            },
            {
              key: 2,
              top: "10%",
              left: "70%",
              width: "35%",
              height: "15%",
              blur: "blur-3xl",
              opacity: 0.7,
              delay: 2000,
            },
            {
              key: 3,
              top: "50%",
              left: "10%",
              width: "30%",
              height: "18%",
              blur: "blur-3xl",
              opacity: 0.55,
              delay: 4000,
            },
          ].map((cloud) => (
            <motion.div
              key={cloud.key}
              className={`absolute ${cloud.blur} bg-white rounded-full ${cloud.top} ${cloud.left} ${cloud.width} ${cloud.height}`}
              initial={{ opacity: 0 }}
              animate={{
                opacity: cloud.opacity,
                x: ["0%", cloud.left === "-10%" ? "110%" : "-110%", "0%"],
              }}
              transition={{
                duration: cloud.left === "-10%" ? 10 : 15,
                repeat: Infinity,
                ease: "linear",
                delay: cloud.delay / 1000,
              }}
            />
          ))}
        </motion.div>
      )}
    </>
  );
};

export default Background;