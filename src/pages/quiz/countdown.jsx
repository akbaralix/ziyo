import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sfx } from "../../utils/soundEffects.js";
import "./countdown.css";

export default function KahootCountdown({
  onComplete,
  quizTitle = "Hatif Quiz",
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
        scale: [0.75, 1.08, 1],
        rotate: [0, -6, 0],
        transition: { duration: 0.35, ease: "easeOut" },
      };
    }
    if (count === 2) {
      return {
        scale: [0.75, 1.08, 1],
        rotate: [0, 6, 0],
        transition: { duration: 0.35, ease: "easeOut" },
      };
    }
    if (count === 1) {
      return {
        scale: [0.75, 1.1, 1],
        rotate: [0, -5, 0],
        transition: { duration: 0.35, ease: "easeOut" },
      };
    }
    return {
      scale: [0.8, 1.08, 1],
      transition: { duration: 0.35, ease: "easeOut" },
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
        <div
          className={`countdown-box-container ${count === 0 ? "go-state" : ""}`}
        >
          <motion.div
            className={`rotating-countdown-box count-color-${count}`}
            animate={getBoxAnimation()}
            key={`box-${count}`}
          />

          <div className="countdown-number-inner">
            <AnimatePresence mode="wait">
              {count > 0 ? (
                <motion.div
                  key={count}
                  className="countdown-digit"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: [0.3, 1.2, 1], opacity: 1 }}
                  exit={{ scale: 1.35, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {count}
                </motion.div>
              ) : (
                <motion.div
                  key="go"
                  className="countdown-go-text"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  transition={{ duration: 0.3 }}
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
