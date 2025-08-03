import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LogoRevealProps {
  onComplete?: () => void;
  skipAnimation?: boolean;
}

export default function LogoReveal({ onComplete, skipAnimation = false }: LogoRevealProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(skipAnimation);

  useEffect(() => {
    if (skipAnimation) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    }, currentStep === 0 ? 1500 : currentStep === 1 ? 1300 : currentStep === 2 ? 1500 : 0);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete, skipAnimation]);

  if (isComplete) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        {/* Trophy Icon Animation */}
        <motion.div
          className="mb-8"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ 
            scale: currentStep >= 0 ? 1 : 0, 
            rotate: currentStep >= 0 ? 0 : -180 
          }}
          transition={{ 
            duration: 0.8, 
            ease: "easeOut",
            type: "spring",
            bounce: 0.4
          }}
        >
          <motion.i 
            className="fas fa-trophy text-primary text-8xl"
            animate={{ 
              textShadow: currentStep >= 1 ? "0 0 20px rgba(59, 130, 246, 0.5)" : "none",
            }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>

        {/* LUDI Text Animation */}
        <div className="relative">
          <motion.h1
            className="text-6xl font-bold text-neutral-900 tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: currentStep >= 1 ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          >
            {"LUDI".split("").map((letter, index) => (
              <motion.span
                key={index}
                className="inline-block"
                initial={{ y: 50, opacity: 0 }}
                animate={{ 
                  y: currentStep >= 1 ? 0 : 50, 
                  opacity: currentStep >= 1 ? 1 : 0 
                }}
                transition={{ 
                  delay: 0.2 + index * 0.1,
                  duration: 0.5,
                  ease: "easeOut"
                }}
              >
                {letter}
              </motion.span>
            ))}
          </motion.h1>

          {/* Underline Animation */}
          <div className="w-64 mx-auto mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: currentStep >= 2 ? "100%" : 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Tagline Animation */}
        <motion.p
          className="text-xl text-neutral-600 mt-6 font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: currentStep >= 2 ? 1 : 0,
            y: currentStep >= 2 ? 0 : 20
          }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Don't just watch
        </motion.p>

        {/* Particles/Sparkle Effect */}
        <AnimatePresence>
          {currentStep >= 2 && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-primary rounded-full"
                  style={{
                    left: `${30 + Math.random() * 40}%`,
                    top: `${30 + Math.random() * 40}%`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    y: [-20, -40, -60],
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.2,
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Loading Progress */}
        <motion.div
          className="w-64 h-1 bg-neutral-200 rounded-full mx-auto mt-12 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: currentStep >= 1 ? 1 : 0 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            initial={{ width: "0%" }}
            animate={{ 
              width: currentStep === 1 ? "33%" : 
                     currentStep === 2 ? "66%" : 
                     currentStep >= 3 ? "100%" : "0%" 
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}