import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sfx } from "../../utils/soundEffects.js";
import "./countdown.css";

export default function KahootCountdown({
  onComplete,
  quizTitle = "Hatif Quiz",
  startsAt = null,
  serverOffsetMs = 0,
}) {
  const [count, setCount] = useState(3);
  const onCompleteRef = useRef(onComplete);
  const serverOffsetRef = useRef(serverOffsetMs);
  const lastSoundStepRef = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    serverOffsetRef.current = serverOffsetMs;
  }, [serverOffsetMs]);

  useEffect(() => {
    completedRef.current = false;
    lastSoundStepRef.current = null;

    const now = Date.now();
    let targetEndAt = now + 3400;
    if (typeof startsAt === "number" && Number.isFinite(startsAt)) {
      const localEndsAt = startsAt - (Number(serverOffsetRef.current) || 0);
      const remaining = localEndsAt - now;
      if (remaining > 250 && remaining <= 5500) {
        targetEndAt = localEndsAt;
      } else if (remaining <= 250) {
        targetEndAt = now + 250;
      }
    }

    const updateStep = () => {
      const remaining = targetEndAt - Date.now();
      if (remaining <= 0) {
        setCount(0);
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
        return true;
      }

      let nextCount = 0;
      if (remaining > 2400) nextCount = 3;
      else if (remaining > 1450) nextCount = 2;
      else if (remaining > 550) nextCount = 1;
      else nextCount = 0;

      setCount((prev) => (prev !== nextCount ? nextCount : prev));
      return false;
    };

    if (updateStep()) return undefined;

    const intervalId = setInterval(() => {
      if (updateStep()) {
        clearInterval(intervalId);
      }
    }, 60);

    return () => clearInterval(intervalId);
  }, [startsAt]);

  useEffect(() => {
    if (lastSoundStepRef.current === count) return;
    lastSoundStepRef.current = count;
    if (count > 0) {
      sfx.playTick(true);
    } else {
      sfx.playStart();
    }
  }, [count]);

  const getBoxAnimation = () => {
    if (count === 3) {
      return {
        scale: [0.8, 1.08, 1],
        rotate: [0, -6, 0],
        transition: { duration: 0.25, ease: "easeOut" },
      };
    }
    if (count === 2) {
      return {
        scale: [0.8, 1.08, 1],
        rotate: [0, 6, 0],
        transition: { duration: 0.25, ease: "easeOut" },
      };
    }
    if (count === 1) {
      return {
        scale: [0.8, 1.1, 1],
        rotate: [0, -5, 0],
        transition: { duration: 0.25, ease: "easeOut" },
      };
    }
    return {
      scale: [0.85, 1.08, 1],
      transition: { duration: 0.25, ease: "easeOut" },
    };
  };

  return (
    <div className="kahoot-countdown-overlay">
      <div className="countdown-center-content">
        <motion.div
          className="countdown-badge-label"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {quizTitle && <span className="quiz-name-tag">{quizTitle}</span>}
          <h2 className="get-ready-title">TAYYORLANING! 🚀</h2>
        </motion.div>

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
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
                  exit={{ scale: 1.25, opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {count}
                </motion.div>
              ) : (
                <motion.div
                  key="go"
                  className="countdown-go-text"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [0.6, 1.12, 1], opacity: 1 }}
                  exit={{ scale: 1.15, opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  BOSHLADIK! 🎯
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="countdown-subtitle">
          {count > 0 ? "Birinchi savol boshlanmoqda..." : "Savol yuklanmoqda..."}
        </p>
      </div>
    </div>
  );
}
