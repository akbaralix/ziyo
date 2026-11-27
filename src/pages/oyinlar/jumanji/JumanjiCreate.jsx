import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import {
  IoArrowBack,
  IoPlayCircle,
} from "react-icons/io5";
import "./JumanjiCreate.css";

export default function JumanjiCreate() {
  const navigate = useNavigate();

  // User checking
  const currentUser = (() => {
    try {
      const u =
        JSON.parse(localStorage.getItem("hatify_user")) ||
        JSON.parse(localStorage.getItem("ziyo_user"));
      if (u) return u;
      const p =
        JSON.parse(localStorage.getItem("hatify_user_profile")) ||
        JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p) return p;
    } catch {}
    return null;
  })();

  const [title, setTitle] = useState("Jumanji: Sehrli O'rmon Sarguzashti");
  const [hostName, setHostName] = useState(() => {
    if (currentUser?.firstName) {
      return `${currentUser.firstName} ${currentUser.lastName || ""}`.trim();
    }
    return currentUser?.name || currentUser?.username || "";
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    if (!hostName.trim()) {
      toast.warn("Iltimos, ismingizni kiriting!");
      return;
    }

    setIsCreating(true);

    const socketUrl =
      import.meta.env.VITE_API_URL || window.location.origin;

    const socket = io(`${socketUrl}/jumanji`, {
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    socket.on("connect", () => {
      socket.emit("create_room", {
        hostName: hostName.trim(),
        hostId: currentUser?._id || currentUser?.id || null,
        title: title.trim(),
      });
    });

    socket.on("room_created", ({ roomId }) => {
      socket.disconnect();
      // O'yin yaratilgach, avtomatik xona o'yin sahifasiga yo'naltiriladi
      // Ismni saqlab qo'yamiz
      localStorage.setItem("jumanji_player_name", hostName.trim());
      navigate(`/jumanji/${roomId}`);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err);
      setIsCreating(false);
      socket.disconnect();
      toast.error("Serverga ulanishda xatolik yuz berdi!");
    });
  };

  return (
    <div className="jumanji-create-page">
      <div className="jumanji-create-card">
        <button
          className="jumanji-back-btn"
          onClick={() => navigate("/oyinlar")}
          title="O'yinlarga qaytish"
        >
          <IoArrowBack /> O'yinlarga qaytish
        </button>

        <div className="jumanji-form-grid">
          <div className="jumanji-form-side">
            <div className="jumanji-field">
              <label>O'yin nomi</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O'yin nomini kiriting..."
                maxLength={60}
              />
            </div>

            <div className="jumanji-field">
              <label>Sizning ismingiz (O'yin egasi)</label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Ismingizni kiriting..."
                maxLength={25}
              />
              {currentUser && (
                <span className="jumanji-user-hint">
                  ✓ Tizimga kirgan foydalanuvchi: {hostName}
                </span>
              )}
            </div>

            <button
              className="jumanji-start-create-btn"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <span>O'yin xonasi tayyorlanmoqda...</span>
              ) : (
                <>
                  <IoPlayCircle size={24} />
                  Boshlash
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
