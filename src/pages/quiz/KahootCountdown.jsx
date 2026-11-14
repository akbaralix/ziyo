import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCaretUp, FaCircle, FaSquare } from "react-icons/fa";
import { FaDiamond } from "react-icons/fa6";
import { sfx } from "../../utils/soundEffects.js";
import "./KahootCountdown.css";

export default function KahootCountdown({ onComplete, quizTitle = "Ziyo Quiz" }) {
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

  // Sanoqqa qarab 4 shaklning o'zgarish holati (teng o'zgaradi)
  const getShapeVariant = (index) => {
    // index: 0=red-triangle, 1=blue-diamond, 2=yellow-circle, 3=green-square
    if (count === 3) {
      return {
        scale: [0.8, 1.1, 1],
        rotate: [0, -10, 0],
        transition: { duration: 0.4 },
      };
    }
    if (count === 2) {
      return {
        scale: [1, 1.25, 1.1],
        rotate: [0, 90, 90],
        transition: { duration: 0.4 },
      };
    }
    if (count === 1) {
      return {
        scale: [1.1, 1.35, 1.2],
        rotate: [90, 180, 180],
        transition: { duration: 0.4 },
      };
    }
    return {
      scale: [1.2, 1.6, 2],
      opacity: [1, 0.8, 0],
      transition: { duration: 0.6 },
    };
  };

  return (
    <div className="kahoot-countdown-overlay">
      {/* 4 BURCHAKDAGI SHAKLLAR (CORNER SHAPES) */}
      <motion.div
        className="corner-shape corner-top-left shape-triangle"
        animate={getShapeVariant(0)}
        key={`corner-0-${count}`}
      >
        <FaCaretUp className="shape-icon" />
      </motion.div>

      <motion.div
        className="corner-shape corner-top-right shape-diamond"
        animate={getShapeVariant(1)}
        key={`corner-1-${count}`}
      >
        <FaDiamond className="shape-icon" />
      </motion.div>

      <motion.div
        className="corner-shape corner-bottom-left shape-circle"
        animate={getShapeVariant(2)}
        key={`corner-2-${count}`}
      >
        <FaCircle className="shape-icon" />
      </motion.div>

      <motion.div
        className="corner-shape corner-bottom-right shape-square"
        animate={getShapeVariant(3)}
        key={`corner-3-${count}`}
      >
        <FaSquare className="shape-icon" />
      </motion.div>

      {/* MARKAZIY BLOK */}
      <div className="countdown-center-content">
        <motion.div
          className="countdown-badge-label"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {quizTitle && <span className="quiz-name-tag">{quizTitle}</span>}
          <h2 className="get-ready-title">TAYYORLANING! 🚀</h2>
        </motion.div>

        {/* 4 Rangli Markaziy Shakllar Grid'i */}
        <div className="center-shapes-cluster">
          <motion.div
            className="center-shape-item shape-red"
            animate={getShapeVariant(0)}
            key={`center-0-${count}`}
          >
            <FaCaretUp />
          </motion.div>
          <motion.div
            className="center-shape-item shape-blue"
            animate={getShapeVariant(1)}
            key={`center-1-${count}`}
          >
            <FaDiamond />
          </motion.div>
          <motion.div
            className="center-shape-item shape-yellow"
            animate={getShapeVariant(2)}
            key={`center-2-${count}`}
          >
            <FaCircle />
          </motion.div>
          <motion.div
            className="center-shape-item shape-green"
            animate={getShapeVariant(3)}
            key={`center-3-${count}`}
          >
            <FaSquare />
          </motion.div>
        </div>

        {/* Markazdagi Raqam (3.. 2.. 1.. KETDIK!) */}
        <div className="countdown-number-wrapper">
          <AnimatePresence mode="wait">
            {count > 0 ? (
              <motion.div
                key={count}
                className="countdown-digit"
                initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
                animate={{ scale: [0.2, 1.25, 1], opacity: 1, rotate: 0 }}
                exit={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {count}
              </motion.div>
            ) : (
              <motion.div
                key="go"
                className="countdown-go-text"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                BOSHLADIK! 🎯
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="countdown-subtitle">
          {count > 0 ? "Birinchi savol boshlanmoqda..." : "Omad tilaymiz!"}
        </p>
      </div>
    </div>
  );
}
