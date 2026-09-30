import { motion } from "framer-motion";

interface LudiLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

export default function LudiLoader({ 
  size = "md", 
  message = "Loading...",
  className = ""
}: LudiLoaderProps) {
  const sizeConfig = {
    sm: {
      trophy: "text-2xl",
      text: "text-lg",
      container: "h-24",
      spacing: "mb-2"
    },
    md: {
      trophy: "text-4xl",
      text: "text-2xl",
      container: "h-32",
      spacing: "mb-4"
    },
    lg: {
      trophy: "text-6xl",
      text: "text-4xl",
      container: "h-48",
      spacing: "mb-6"
    }
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex flex-col items-center justify-center ${config.container} ${className}`}>
      {/* Animated Trophy */}
      <motion.div
        className={config.spacing}
        animate={{ 
          rotate: [0, 360],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          rotate: { duration: 2, repeat: Infinity, ease: "linear" },
          scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <motion.i 
          className={`fas fa-trophy text-primary ${config.trophy}`}
          animate={{ 
            textShadow: [
              "0 0 5px rgba(59, 130, 246, 0.3)",
              "0 0 15px rgba(59, 130, 246, 0.6)",
              "0 0 5px rgba(59, 130, 246, 0.3)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* LUDI Text with Pulse Effect */}
      <motion.h2
        className={`font-bold text-neutral-900 tracking-wider ${config.text}`}
        animate={{ 
          opacity: [0.7, 1, 0.7]
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      >
        {"LUDI".split("").map((letter, index) => (
          <motion.span
            key={index}
            className="inline-block"
            animate={{ 
              y: [0, -5, 0]
            }}
            transition={{ 
              delay: index * 0.1,
              duration: 0.6,
              repeat: Infinity,
              repeatDelay: 1.2,
              ease: "easeInOut"
            }}
          >
            {letter}
          </motion.span>
        ))}
      </motion.h2>

      {/* Loading Message */}
      {message && (
        <motion.p
          className="text-sm text-neutral-500 mt-2"
          animate={{ 
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          {message}
        </motion.p>
      )}

      {/* Loading Dots */}
      <div className="flex space-x-1 mt-3">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-2 h-2 bg-primary rounded-full"
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{ 
              delay: index * 0.2,
              duration: 0.8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Full-screen overlay loader for major loading states
export function LudiFullScreenLoader({ 
  message = "Loading..." 
}: { 
  message?: string 
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <LudiLoader size="lg" message={message} />
    </motion.div>
  );
}

// Inline loader for smaller loading states
export function LudiInlineLoader({ 
  size = "sm", 
  message 
}: { 
  size?: "sm" | "md", 
  message?: string 
}) {
  return (
    <div className="flex items-center justify-center py-8">
      <LudiLoader size={size} message={message} />
    </div>
  );
}