import React, { useState, useEffect, useRef } from "react";
import { FaTimes, FaSmile } from "react-icons/fa";
import "./LiveReactions.css";

const REACTION_EMOJIS = ["❤️", "🔥", "👍", "👏", "😂", "🎉", "😮", "🚀", "👀"];

export default function LiveReactions({
  socket,
  sessionId,
  senderName = "O'yinchi",
  showTrigger = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingList, setFloatingList] = useState([]);
  const pickerRef = useRef(null);

  // Socketdan yangi reaktsiya qabul qilish
  useEffect(() => {
    if (!socket) return;

    const handleReaction = (data) => {
      if (!data || !data.emoji) return;

      const id =
        data.id ||
        `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const left = Math.floor(Math.random() * 66) + 17; // 17% dan 83% gacha
      const rotate = Math.floor(Math.random() * 26) - 13; // -13deg dan +13deg
      const size = Math.floor(Math.random() * 10) + 40; // 40px - 50px
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

      // Animatsiya tugagach tozalash
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

  // Click outside listener for picker
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

  // Reaksiya yuborish
  const handleSend = (emoji) => {
    if (!socket || !sessionId) return;

    socket.emit("send_reaction", {
      emoji,
      sessionId,
      name: senderName,
    });
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating emojis overlay - barcha ishtirokchilar va hostda uchib chiqadi */}
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

      {/* Reaksiya yuborish tugmasi va menyusi */}
      {showTrigger && (
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
            className={`live-reaction-trigger-btn ${isOpen ? "active" : ""}`}
            onClick={() => setIsOpen((prev) => !prev)}
            title="Reaksiya bildirish"
          >
            {isOpen ? <FaTimes /> : <FaSmile />}
          </button>
        </div>
      )}
    </>
  );
}
