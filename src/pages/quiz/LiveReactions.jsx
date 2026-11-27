import React, { useState, useEffect, useRef } from "react";
import { FaTimes, FaSmile } from "react-icons/fa";
import "./LiveReactions.css";

const REACTION_EMOJIS = ["❤️", "🔥", "👍", "👏", "😂", "🎉", "😮", "🚀", "👀"];

export default function LiveReactions({
  socket,
  sessionId,
  senderName = "O'yinchi",
  showTrigger = true,
  enabled = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingList, setFloatingList] = useState([]);

  // Cooldown va takrorlanmas ID uchun ref'lar
  const [cooldownTime, setCooldownTime] = useState(0);
  const clickTimestampsRef = useRef([]);
  const counterRef = useRef(0); // Unikal ID uchun hisoblagich
  const enabledRef = useRef(enabled);

  const pickerRef = useRef(null);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      setIsOpen(false);
      setFloatingList([]);
    }
  }, [enabled]);

  useEffect(() => {
    if (!socket) return;

    const handleReaction = (data) => {
      if (!enabledRef.current) return;
      if (!data || !data.emoji) return;

      // Unikal ID hosil qilish (vaqt + random + increment counter)
      counterRef.current += 1;
      const id =
        data.id ||
        `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${counterRef.current}`;

      const left = Math.floor(Math.random() * 66) + 17;
      const rotate = Math.floor(Math.random() * 26) - 13;
      const size = Math.floor(Math.random() * 10) + 40;
      const duration = 2.4;

      const newReaction = {
        id,
        emoji: data.emoji,
        name: data.name || "",
        left,
        rotate,
        size,
        duration,
      };

      setFloatingList((prev) => [...prev.slice(-30), newReaction]);

      setTimeout(() => {
        setFloatingList((prev) => prev.filter((item) => item.id !== id));
      }, duration * 1000);
    };

    socket.on("receive_reaction", handleReaction);
    socket.on("recive_reaction", handleReaction);

    return () => {
      socket.off("receive_reaction", handleReaction);
      socket.off("recive_reaction", handleReaction);
    };
  }, [socket]);

  // Cooldown taymerini boshqarish
  useEffect(() => {
    let timer;
    if (cooldownTime > 0) {
      timer = setInterval(() => {
        setCooldownTime((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownTime]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSend = (emoji) => {
    if (!enabled || !socket || !sessionId || cooldownTime > 0) return;

    const now = Date.now();
    const recentClicks = clickTimestampsRef.current.filter(
      (timestamp) => now - timestamp < 5000,
    );

    recentClicks.push(now);
    clickTimestampsRef.current = recentClicks;

    if (recentClicks.length >= 3) {
      setCooldownTime(10);
      setIsOpen(false);
      clickTimestampsRef.current = [];
      return;
    }

    socket.emit("send_reaction", {
      emoji,
      sessionId,
      name: senderName,
    });
    setIsOpen(false);
  };

  return (
    <>
      <div className="floating-reactions-overlay">
        {floatingList.map((item) => (
          <div
            key={item.id}
            className="floating-reaction-item"
            style={{
              left: `${item.left}%`,
              animationDuration: `${item.duration}s`,
            }}
          >
            <span
              className="floating-reaction-emoji"
              style={{
                fontSize: `${item.size}px`,
                transform: `rotate(${item.rotate}deg)`,
              }}
            >
              {item.emoji}
            </span>
            {item.name && (
              <span className="floating-reaction-name">{item.name}</span>
            )}
          </div>
        ))}
      </div>

      {showTrigger && enabled && (
        <div className="live-reaction-controls" ref={pickerRef}>
          {isOpen && (
            <div className="live-reaction-picker">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="reaction-emoji-btn"
                  onClick={() => handleSend(emoji)}
                  title={`${emoji} yuborish`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                className="reaction-close-btn"
                onClick={() => setIsOpen(false)}
                title="Yopish"
              >
                <FaTimes />
              </button>
            </div>
          )}

          <button
            type="button"
            className={`live-reaction-trigger-btn ${isOpen ? "active" : ""} ${
              cooldownTime > 0 ? "cooldown" : ""
            }`}
            onClick={() => {
              if (cooldownTime > 0) return;
              setIsOpen((prev) => !prev);
            }}
            title={
              cooldownTime > 0
                ? `Juda tez bosmang! Qolgan vaqt: ${cooldownTime}s`
                : "Reaksiya bildirish"
            }
            disabled={cooldownTime > 0}
          >
            {cooldownTime > 0 ? (
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                {cooldownTime}s
              </span>
            ) : isOpen ? (
              <FaTimes />
            ) : (
              <FaSmile />
            )}
          </button>
        </div>
      )}
    </>
  );
}
