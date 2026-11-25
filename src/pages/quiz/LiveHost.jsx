import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlay,
  FaUsers,
  FaForward,
  FaTrophy,
  FaCrown,
  FaArrowLeft,
  FaVolumeUp,
  FaVolumeMute,
  FaCaretUp,
  FaCircle,
  FaSquare,
  FaCopy,
} from "react-icons/fa";
import { FaDiamond } from "react-icons/fa6";
import { toast } from "react-toastify";
import { sfx } from "../../utils/soundEffects.js";
import KahootCountdown from "./countdown.jsx";
import backgroundImage from "../../assets/game/live-game-bg.jpg";
import lobbyAudio from "../../assets/Jason Beauchamp - Kahoot Lobby Music.mp3";
import liveResponseWait from "../../assets/live-kutish.mp3";
import lobbyStatsAudio from "../../assets/Video Project 4.m4a";
import LiveReactions from "./LiveReactions.jsx";
import "./LiveHost.css";

const OPTION_COLORS = [
  {
    bg: "rgb(226, 27, 60)",
    text: "#ffffff",
    shape: <FaCaretUp />,
    name: "Qizil",
  },
  {
    bg: "rgb(19, 104, 206)",
    text: "#ffffff",
    shape: <FaDiamond />,
    name: "Ko'k",
  },
  {
    bg: "rgb(216, 158, 0)",
    text: "#ffffff",
    shape: <FaCircle />,
    name: "Sariq",
  },
  {
    bg: "rgb(38, 137, 12)",
    text: "#ffffff",
    shape: <FaSquare />,
    name: "Yashil",
  },
];

export default function LiveHost() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState("lobby"); // 'lobby' | 'question' | 'answer' | 'ended'
  const [pin, setPin] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [creatorId, setCreatorId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // Question State
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  // Answer / Leaderboard State
  const [correctIndex, setCorrectIndex] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // Final Ended State
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);

  // Kahoot Countdown State
  const [isCountingDown, setIsCountingDown] = useState(false);
  const isCountingDownRef = useRef(false);
  const pendingQuestionRef = useRef(null);

  const timerRef = useRef(null);

  const audioRef = useRef(null);
  const waitAudio = useRef(null);
  const audioStatsRef = useRef(null);

  const safePlay = useCallback(
    (audio) => {
      if (!audio || isMuted) return;
      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err.name !== "AbortError") {
              console.warn("Audio play notice:", err.message);
            }
          });
        }
      } catch (e) {
        console.warn("Audio error:", e);
      }
    },
    [isMuted],
  );

  useEffect(() => {
    if (typeof Audio === "undefined") return undefined;

    audioRef.current = new Audio(lobbyAudio);
    audioRef.current.loop = true;
    audioRef.current.preload = "auto";

    waitAudio.current = new Audio(liveResponseWait);
    waitAudio.current.loop = true;
    waitAudio.current.preload = "auto";

    audioStatsRef.current = new Audio(lobbyStatsAudio);
    audioStatsRef.current.preload = "auto";

    return () => {
      audioRef.current?.pause();
      waitAudio.current?.pause();
      audioStatsRef.current?.pause();
      audioRef.current = null;
      waitAudio.current = null;
      audioStatsRef.current = null;
    };
  }, []);

  const toggleAudio = useCallback(() => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      if (gameState === "lobby" && !isCountingDown) {
        safePlay(audioRef.current);
      } else if (gameState === "question") {
        safePlay(waitAudio.current);
      } else if (gameState === "answer" || gameState === "ended") {
        safePlay(audioStatsRef.current);
      }
    }
  }, [gameState, isCountingDown, safePlay]);

  useEffect(() => {
    const handleFirstUserInteraction = () => {
      if (
        !isMuted &&
        gameState === "lobby" &&
        !isCountingDown &&
        audioRef.current
      ) {
        safePlay(audioRef.current);
      }
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("keydown", handleFirstUserInteraction);
    };

    window.addEventListener("click", handleFirstUserInteraction);
    window.addEventListener("keydown", handleFirstUserInteraction);

    return () => {
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("keydown", handleFirstUserInteraction);
    };
  }, [isMuted, gameState, isCountingDown, safePlay]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.pause();
    if (waitAudio.current) waitAudio.current.pause();
    if (audioStatsRef.current) audioStatsRef.current.pause();

    if (!isMuted) {
      if (gameState === "lobby" && !isCountingDown) {
        safePlay(audioRef.current);
      } else if (gameState === "question") {
        if (waitAudio.current) waitAudio.current.currentTime = 0;
        safePlay(waitAudio.current);
      } else if (gameState === "answer" || gameState === "ended") {
        if (audioStatsRef.current) audioStatsRef.current.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (waitAudio.current) waitAudio.current.pause();
      if (audioStatsRef.current) audioStatsRef.current.pause();
    };
  }, [gameState, isCountingDown, isMuted, safePlay]);

  const startCountdown = useCallback((initialTime) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(initialTime);
    if (initialTime <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        if (prev <= 6) {
          sfx.playTick(true);
        } else {
          sfx.playTick(false);
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const triggerConfetti = useCallback(() => {
    const end = Date.now() + 3.5 * 1000;
    const colors = ["#bb0000", "#ffffff", "#2563eb", "#eab308", "#10b981"];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const getCurrentUserId = useCallback(() => {
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u && (u._id || u.id)) return String(u._id || u.id);
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && (p._id || p.id)) return String(p._id || p.id);
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload && (payload.userId || payload.id)) {
          return String(payload.userId || payload.id);
        }
      }
    } catch {}
    return null;
  }, []);

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socketUrl =
      import.meta.env.VITE_API_URL || "https://ziyo.onrender.com";
    const newSocket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    setSocket(newSocket);

    // Internet uzilib qayta ulanganda avtomatik qayta ulanish va sinxronlash
    const handleOnline = () => {
      toast.info("Internet aloqasi tiklandi. O'yin holati yangilanmoqda...", {
        autoClose: 2000,
      });
      if (!newSocket.connected) {
        newSocket.connect();
      } else {
        newSocket.emit("host:join", { sessionId });
      }
    };

    const handleOffline = () => {
      toast.warning("Internet uzildi! Ulanish kutilmoqda...", {
        autoClose: 3500,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    newSocket.on("connect", () => {
      newSocket.emit("host:join", { sessionId });
    });

    newSocket.on("error", (data) => {
      if (data?.msg) {
        toast.error(data.msg);
      }
    });

    newSocket.on("host:joined", (data) => {
      setPin(data.pin);
      setQuizTitle(data.quizTitle);
      if (data.creatorId || data.hostId) {
        setCreatorId(String(data.creatorId || data.hostId));
      }

      // O'yinchilar massivini xavfsiz qabul qilish
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }

      const joinUrl = `${window.location.origin}/live/${data.pin}`;
      QRCode.toDataURL(joinUrl, { width: 220, margin: 1 })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);

      if (data.status === "question" && data.currentQuestion) {
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        setGameState("question");
        setCurrentQuestion(data.currentQuestion);
        setAnsweredCount(data.answeredCount || 0);
        setCorrectIndex(null);
        startCountdown(data.timeLeft ?? data.currentQuestion.timeLimit);
      } else if (data.status === "answer" && data.currentQuestion) {
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        if (timerRef.current) clearInterval(timerRef.current);
        setGameState("answer");
        setCurrentQuestion(data.currentQuestion);
        setCorrectIndex(data.correctIndex);
        setLeaderboard(data.leaderboard || []);
      } else if (data.status === "ended") {
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        if (timerRef.current) clearInterval(timerRef.current);
        setGameState("ended");
        setFinalLeaderboard(data.leaderboard || []);
      } else {
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        setGameState("lobby");
      }
    });

    // 💡 Yangi o'yinchi qo'shilganda dublikat bo'lmasligi va tez chiqishi uchun tekshiruv
    newSocket.on("player:new", (player) => {
      sfx.playJoin();
      setPlayers((prev) => {
        const playerId = player.id || player._id;
        const exists = prev.some((p) => (p.id || p._id) === playerId);
        if (exists) {
          return prev.map((p) =>
            (p.id || p._id) === playerId ? { ...p, ...player } : p,
          );
        }
        return [...prev, player];
      });
    });

    // O'yinchi chiqib ketganda
    newSocket.on("player:left", ({ playerId }) => {
      setPlayers((prev) => prev.filter((p) => (p.id || p._id) !== playerId));
    });

    // O'yinchi avatarni o'zgartirganda
    newSocket.on("player:avatar:updated", ({ playerId, profilePic }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          (p.id || p._id) === playerId ? { ...p, profilePic } : p,
        ),
      );
    });

    // O'yinchi ismini o'zgartirganda
    newSocket.on("player:name:updated", ({ playerId, name }) => {
      setPlayers((prev) =>
        prev.map((p) => ((p.id || p._id) === playerId ? { ...p, name } : p)),
      );
    });

    newSocket.on("game:started", () => {
      setIsCountingDown(true);
      isCountingDownRef.current = true;
    });

    newSocket.on("question:start", (data) => {
      if (isCountingDownRef.current) {
        pendingQuestionRef.current = data;
      } else {
        sfx.playStart();
        setGameState("question");
        setCurrentQuestion(data);
        setAnsweredCount(0);
        setCorrectIndex(null);
        startCountdown(data.timeLimit);
      }
    });

    newSocket.on("answer:progress", (data) => {
      setAnsweredCount(data.answered);
    });

    newSocket.on("question:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState("answer");
      setCorrectIndex(data.correctIndex);
      setLeaderboard(data.leaderboard || []);
    });

    newSocket.on("game:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState("ended");
      setFinalLeaderboard(data.leaderboard || []);
      sfx.playFanfare();
      triggerConfetti();
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearInterval(timerRef.current);
      newSocket.disconnect();
    };
  }, [sessionId, startCountdown, triggerConfetti]);

  const handleStartGame = useCallback(() => {
    if (players.length === 0) {
      toast.warning(
        "O'yinni boshlash uchun kamida 1 ta o'yinchi qo'shilishi kerak!",
      );
      return;
    }
    setIsCountingDown(true);
    isCountingDownRef.current = true;
    socket?.emit("host:start", { sessionId });
  }, [players.length, socket, sessionId]);

  const handleCountdownComplete = useCallback(() => {
    setIsCountingDown(false);
    isCountingDownRef.current = false;
    setGameState("question");
    if (pendingQuestionRef.current) {
      const qData = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      sfx.playStart();
      setCurrentQuestion(qData);
      setAnsweredCount(0);
      setCorrectIndex(null);
      startCountdown(qData.timeLimit);
    }
  }, [startCountdown]);

  const handleNextQuestion = useCallback(() => {
    audioStatsRef.current?.pause();
    socket?.emit("host:next", { sessionId });
  }, [socket, sessionId]);

  const handleEndGameEarly = useCallback(() => {
    const currentUserId = getCurrentUserId();

    if (
      creatorId &&
      currentUserId &&
      String(creatorId) !== String(currentUserId)
    ) {
      toast.error(
        "Faqat o'yinni yaratgan foydalanuvchi uni yakunlashi mumkin!",
      );
      return;
    }

    toast.warn(
      <div>
        <p style={{ marginBottom: 8 }}>Rostdan ham o'yinni tugatmoqchimisiz?</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              socket?.emit("host:end", { sessionId, userId: currentUserId });
              toast.dismiss("end-confirm");
            }}
            style={{
              background: "#e90606",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Ha, yakunlash
          </button>
          <button
            onClick={() => toast.dismiss("end-confirm")}
            style={{
              background: "#e2e8f0",
              color: "#0f172a",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            Bekor qilish
          </button>
        </div>
      </div>,
      {
        toastId: "end-confirm",
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
      },
    );
  }, [creatorId, sessionId, socket, getCurrentUserId]);

  const currentUserId = useMemo(() => getCurrentUserId(), [getCurrentUserId]);
  const isCreator =
    !creatorId || !currentUserId || String(creatorId) === String(currentUserId);

  return (
    <div
      className="live-host-screen"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <header className="live-host-nav">
        <div className="host-nav-brand">
          <span className="live-quiz-title">{quizTitle}</span>
        </div>

        <div className="host-nav-meta">
          <button
            type="button"
            className="host-sound-btn"
            onClick={toggleAudio}
            title={isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
          >
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </button>

          <div className="host-players-badge">
            <FaUsers /> {players.length}
          </div>

          {gameState !== "ended" && isCreator && (
            <button
              type="button"
              className="host-end-btn"
              onClick={handleEndGameEarly}
            >
              O'yinni yakunlash
            </button>
          )}

          {gameState === "lobby" && !isCountingDown && (
            <button
              type="button"
              className="lobby-start-btn"
              onClick={handleStartGame}
              disabled={players.length === 0}
            >
              <FaPlay /> O'yinni boshlash
            </button>
          )}
        </div>
      </header>

      {isCountingDown && (
        <KahootCountdown
          quizTitle={quizTitle}
          onComplete={handleCountdownComplete}
        />
      )}

      {gameState === "lobby" && (
        <div className="host-lobby-view">
          <div className="lobby-hero-card">
            <div className="lobby-instructions">
              <h2>O'yinga qo'shiling! 🚀</h2>
              <p className="lobby-url">
                Brauzerda kiring:{" "}
                <strong>
                  {window.location.host}/live/{pin}
                </strong>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.host}/live/${pin}`,
                    );
                    toast.success("O'yin URL manzili nusxalandi!");
                  }}
                  className="live-copy-btn"
                >
                  <FaCopy />
                </button>
              </p>
              <div className="lobby-pin-box">
                <span className="pin-label">O'YIN KODI (PIN):</span>
                <div
                  onClick={() => {
                    navigator.clipboard
                      .writeText(pin)
                      .then(() => {
                        toast.success("PIN nusxalandi: " + pin);
                      })
                      .catch((err) => {
                        console.error("Nusxalashda xatolik:", err);
                      });
                  }}
                  className="pin-digits"
                >
                  {pin}
                </div>
              </div>
            </div>

            {qrDataUrl && (
              <div className="lobby-qr-box">
                <img src={qrDataUrl} alt="QR kod" className="lobby-qr-img" />
                <span className="qr-caption">Kamera orqali skanerlang</span>
              </div>
            )}
          </div>

          <div className="lobby-players-section">
            <div className="lobby-players-grid">
              <AnimatePresence>
                {players.map((p, idx) => (
                  <motion.div
                    key={p.id || p._id || idx}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="lobby-player-chip"
                  >
                    <span className="player-avatar-circle">
                      {p.profilePic ? (
                        <img
                          src={p.profilePic}
                          alt={p.name}
                          className="player-avatar-img"
                        />
                      ) : (
                        p.name?.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="player-chip-name">{p.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {players.length === 0 && (
                <div className="lobby-no-players">
                  Ishtirokchilar ulanishi kutilmoqda... PIN kod yoki QR orqali
                  kiring!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {gameState === "question" && currentQuestion && (
        <div className="host-question-view">
          <div className="question-top-bar">
            <span className="question-counter">
              Savol {currentQuestion.questionIndex + 1} /{" "}
              {currentQuestion.totalQuestions}
            </span>

            <div
              className={`countdown-circle-badge ${timeLeft <= 5 ? "urgent" : ""}`}
            >
              {timeLeft}
            </div>

            <span className="answers-counter">
              {answeredCount} / {players.length} Javob
            </span>
          </div>

          <div className="host-question-banner">
            <h1>{currentQuestion.text}</h1>
          </div>

          <div className="host-options-grid">
            {currentQuestion.options.map((opt, idx) => {
              const optColor = OPTION_COLORS[idx % OPTION_COLORS.length];
              return (
                <div
                  key={idx}
                  className="host-option-card"
                  style={{ backgroundColor: optColor.bg }}
                >
                  <span className="option-shape-icon">{optColor.shape}</span>
                  <span className="option-text-label">{opt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {gameState === "answer" && currentQuestion && (
        <div className="host-answer-view">
          <div className="answer-header-box">
            <h2>Natijalar & To'g'ri javob</h2>
            <button
              type="button"
              className="host-next-btn"
              onClick={handleNextQuestion}
            >
              Keyingi <FaForward />
            </button>
          </div>

          <div className="host-options-grid small">
            {currentQuestion.options.map((opt, idx) => {
              const optColor = OPTION_COLORS[idx % OPTION_COLORS.length];
              const isCorrect = idx === correctIndex;
              return (
                <div
                  key={idx}
                  className={`host-option-card ${isCorrect ? "correct-highlight" : "dimmed"}`}
                  style={{
                    backgroundColor: optColor.bg,
                    boxShadow: "rgba(0, 0, 0, 0.2) 0px -6px 0px 0px inset",
                  }}
                >
                  <span className="option-shape-icon">{optColor.shape}</span>
                  <span className="option-text-label">{opt}</span>
                  {isCorrect && (
                    <span className="correct-badge">✔ To'g'ri</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="host-leaderboard-card">
            <h3>
              <FaTrophy /> Yetakchilar jadvali
            </h3>
            <div className="leaderboard-list">
              {leaderboard.map((item, idx) => (
                <motion.div
                  key={item.id || item._id || item.name || idx}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`leaderboard-row ${idx === 0 ? "top-1" : ""}`}
                >
                  <div className="lb-rank">
                    {idx === 0
                      ? "🥇 1"
                      : idx === 1
                        ? "🥈 2"
                        : idx === 2
                          ? "🥉 3"
                          : `${idx + 1}`}
                  </div>
                  <div className="lb-player-cell">
                    {item.profilePic ? (
                      <img
                        src={item.profilePic}
                        alt={item.name}
                        className="lb-avatar"
                      />
                    ) : (
                      <span className="lb-avatar-fallback">
                        {item.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="lb-name">{item.name}</span>
                  </div>
                  <div className="lb-score">
                    {item.score.toLocaleString()} ball
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameState === "ended" && (
        <div className="host-podium-view">
          <div className="podium-title-box">
            <h1>G'oliblarni tabriklaymiz! 🎉</h1>
          </div>

          <div className="podium-container">
            {finalLeaderboard[1] && (
              <motion.div
                className="podium-pillar pillar-2"
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.7, type: "spring" }}
              >
                <div className="pillar-player-info">
                  <div className="pillar-avatar silver">
                    {finalLeaderboard[1].profilePic ? (
                      <img
                        src={finalLeaderboard[1].profilePic}
                        alt={finalLeaderboard[1].name}
                        className="pillar-avatar-img"
                      />
                    ) : (
                      "🥈"
                    )}
                  </div>
                  <span className="pillar-player-name">
                    {finalLeaderboard[1].name}
                  </span>
                  <span className="pillar-score">
                    {finalLeaderboard[1].score} ball
                  </span>
                </div>
                <div className="pillar-block block-2">
                  <span className="rank-num">2</span>
                </div>
              </motion.div>
            )}

            {finalLeaderboard[0] && (
              <motion.div
                className="podium-pillar pillar-1"
                initial={{ y: 250, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.8, type: "spring" }}
              >
                <div className="pillar-player-info">
                  <FaCrown className="crown-icon" />
                  <div className="pillar-avatar gold">
                    {finalLeaderboard[0].profilePic ? (
                      <img
                        src={finalLeaderboard[0].profilePic}
                        alt={finalLeaderboard[0].name}
                        className="pillar-avatar-img"
                      />
                    ) : (
                      "👑"
                    )}
                  </div>
                  <span className="pillar-player-name">
                    {finalLeaderboard[0].name}
                  </span>
                  <span className="pillar-score">
                    {finalLeaderboard[0].score} ball
                  </span>
                </div>
                <div className="pillar-block block-1">
                  <span className="rank-num">1</span>
                </div>
              </motion.div>
            )}

            {finalLeaderboard[2] && (
              <motion.div
                className="podium-pillar pillar-3"
                initial={{ y: 150, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
              >
                <div className="pillar-player-info">
                  <div className="pillar-avatar bronze">
                    {finalLeaderboard[2].profilePic ? (
                      <img
                        src={finalLeaderboard[2].profilePic}
                        alt={finalLeaderboard[2].name}
                        className="pillar-avatar-img"
                      />
                    ) : (
                      "🥉"
                    )}
                  </div>
                  <span className="pillar-player-name">
                    {finalLeaderboard[2].name}
                  </span>
                  <span className="pillar-score">
                    {finalLeaderboard[2].score} ball
                  </span>
                </div>
                <div className="pillar-block block-3">
                  <span className="rank-num">3</span>
                </div>
              </motion.div>
            )}
          </div>

          {finalLeaderboard.length > 3 && (
            <div className="podium-full-rankings">
              <h3>Ishtirokchilar natijalari</h3>
              <div className="full-rankings-table">
                {finalLeaderboard.slice(3).map((player, idx) => (
                  <div key={player.id || player._id || player.name || idx} className="ranking-table-row">
                    <span className="rank-col">#{idx + 4}</span>
                    <div className="ranking-player-cell">
                      {player.profilePic ? (
                        <img
                          src={player.profilePic}
                          alt={player.name}
                          className="ranking-table-avatar"
                        />
                      ) : (
                        <span className="ranking-table-avatar-fallback">
                          {player.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="name-col">{player.name}</span>
                    </div>
                    <span className="score-col">{player.score} ball</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="podium-actions">
            <button
              type="button"
              className="finish-btn"
              onClick={() => navigate("/profil")}
            >
              <FaArrowLeft /> Profilga qaytish
            </button>
          </div>
        </div>
      )}

      {/* Kahoot-style Live Reaksiyalar (Host va barcha ishtirokchilar uchun) */}
      {sessionId && socket && (
        <LiveReactions
          socket={socket}
          sessionId={sessionId}
          senderName="Boshlovchi"
          showTrigger={true}
        />
      )}
    </div>
  );
}
