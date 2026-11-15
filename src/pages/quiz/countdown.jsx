import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sfx } from "../../utils/soundEffects.js";
import "./countdown.css";

export default function KahootCountdown({
  onComplete,
  quizTitle = "Ziyo Quiz",
}) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    // Har bir sanoqda ovoz chiqarish
    if (count > 0) {
      sfx.playTick(true);
    } else {
      sfx.playStart();
    }

    if (count <= 0) {
      const finishTimer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 700);
      return () => clearTimeout(finishTimer);
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  // Markaziy to'rtburchakning har 1 soniyadagi animatsiya holati
  const getBoxAnimation = () => {
    if (count === 3) {
      return {
        scale: [0.8, 1.15, 1],
        rotate: [0, 90, 0],
        transition: { duration: 0.5 },
      };
    }
    if (count === 2) {
      return {
        scale: [1, 1.25, 1.1],
        rotate: [0, -90, -90],
        transition: { duration: 0.5 },
      };
    }
    if (count === 1) {
      return {
        scale: [1.1, 1.4, 1.25],
        rotate: [-90, -180, -180],
        transition: { duration: 0.5 },
      };
    }
    return {
      scale: [1.25, 1.8, 2.2],
      opacity: [1, 0.7, 0],
      rotate: [-180, -360, -360],
      transition: { duration: 0.6 },
    };
  };

  return (
    <div className="kahoot-countdown-overlay">
      <div className="countdown-center-content">
        {/* Sarlavha va Badge */}
        <motion.div
          className="countdown-badge-label"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {quizTitle && <span className="quiz-name-tag">{quizTitle}</span>}
          <h2 className="get-ready-title">TAYYORLANING! 🚀</h2>
        </motion.div>

        {/* Aylanuvchi to'rtburchak va markazdagi raqam konteyneri */}
        <div className="countdown-box-container">
          <motion.div
            className="rotating-countdown-box"
            animate={getBoxAnimation()}
            key={`box-${count}`}
          />

          <div className="countdown-number-inner">
            <AnimatePresence mode="wait">
              {count > 0 ? (
                <motion.div
                  key={count}
                  className="countdown-digit"
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: [0.2, 1.25, 1], opacity: 1 }}
                  exit={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  {count}
                </motion.div>
              ) : (
                <motion.div
                  key="go"
                  className="countdown-go-text"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: [0.3, 1.2, 1], opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  BOSHLADIK! 🎯
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="countdown-subtitle">
          {count > 0 ? "Birinchi savol boshlanmoqda..." : "Omad tilaymiz!"}
        </p>
      </div>
    </div>
  );
}
