import { useState, useEffect, useRef } from "react";
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
} from "react-icons/fa";
import { FaDiamond } from "react-icons/fa6";
import { IoSparkles } from "react-icons/io5";
import { sfx } from "../../utils/soundEffects.js";
import "./LiveHost.css";

const OPTION_COLORS = [
  { bg: "#ef4444", text: "#ffffff", shape: <FaCaretUp />, name: "Qizil" },
  { bg: "#3b82f6", text: "#ffffff", shape: <FaDiamond />, name: "Ko'k" },
  { bg: "#eab308", text: "#ffffff", shape: <FaCircle />, name: "Sariq" },
  { bg: "#10b981", text: "#ffffff", shape: <FaSquare />, name: "Yashil" },
];

export default function LiveHost() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState("lobby"); // 'lobby' | 'question' | 'answer' | 'ended'
  const [pin, setPin] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
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

  const timerRef = useRef(null);

  const toggleAudio = () => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
  };

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    const newSocket = io("http://localhost:3000", {
      auth: { token },
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("host:join", { sessionId });
    });

    newSocket.on("host:joined", (data) => {
      setPin(data.pin);
      setQuizTitle(data.quizTitle);
      if (data.players) setPlayers(data.players);

      // Generate QR Code
      const joinUrl = `${window.location.origin}/live/${data.pin}`;
      QRCode.toDataURL(joinUrl, { width: 220, margin: 1 })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    });

    // New Player Joined
    newSocket.on("player:new", (player) => {
      sfx.playJoin();
      setPlayers((prev) => {
        if (prev.some((p) => p.id === player.id)) return prev;
        return [...prev, player];
      });
    });

    // Player Left
    newSocket.on("player:left", ({ playerId }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    });

    // Game Started
    newSocket.on("game:started", () => {
      sfx.playStart();
      setGameState("question");
    });

    // Question Start
    newSocket.on("question:start", (data) => {
      sfx.playStart();
      setGameState("question");
      setCurrentQuestion(data);
      setTimeLeft(data.timeLimit);
      setAnsweredCount(0);
      setCorrectIndex(null);

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
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
    });

    // Answer Progress
    newSocket.on("answer:progress", (data) => {
      setAnsweredCount(data.answered);
    });

    // Question Ended (Show Answers)
    newSocket.on("question:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState("answer");
      setCorrectIndex(data.correctIndex);
      setLeaderboard(data.leaderboard || []);
    });

    // Game Ended (Podium)
    newSocket.on("game:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState("ended");
      setFinalLeaderboard(data.leaderboard || []);
      sfx.playFanfare();
      // Confetti fire
      triggerConfetti();
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      newSocket.disconnect();
    };
  }, [sessionId]);

  const triggerConfetti = () => {
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
  };

  const handleStartGame = () => {
    if (players.length === 0) {
      alert("O'yinni boshlash uchun kamida 1 ta o'yinchi qo'shilishi kerak!");
      return;
    }
    socket.emit("host:start", { sessionId });
  };

  const handleNextQuestion = () => {
    socket.emit("host:next", { sessionId });
  };

  const handleEndGameEarly = () => {
    if (window.confirm("Rostdan ham o'yinni tugatmoqchimisiz?")) {
      socket.emit("host:end", { sessionId });
    }
  };

  return (
    <div className="live-host-screen">
      {/* Top Header */}
      <header className="live-host-nav">
        <div className="host-nav-brand">
          {/* <span className="live-logo-tag">ZIYO QUIZ</span> */}
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
            <FaUsers /> {players.length} ishtirokchi
          </div>

          {gameState !== "ended" && (
            <button
              type="button"
              className="host-end-btn"
              onClick={handleEndGameEarly}
            >
              O'yinni yakunlash
            </button>
          )}
        </div>
      </header>

      {/* ==================== 1. LOBBY STATE ==================== */}
      {gameState === "lobby" && (
        <div className="host-lobby-view">
          <div className="lobby-hero-card">
            <div className="lobby-instructions">
              <h2>O'yinga qo'shiling! 🚀</h2>
              <p className="lobby-url">
                Brauzerda kiring: <strong>{window.location.host}/live</strong>
              </p>
              <div className="lobby-pin-box">
                <span className="pin-label">O'YIN KODI (PIN):</span>
                <div className="pin-digits">{pin}</div>
              </div>
            </div>

            {qrDataUrl && (
              <div className="lobby-qr-box">
                <img src={qrDataUrl} alt="QR kod" className="lobby-qr-img" />
                <span className="qr-caption">Kamera orqali skanerlang</span>
              </div>
            )}
          </div>

          {/* Joined Players Area */}
          <div className="lobby-players-section">
            <div className="lobby-players-header">
              <h3>
                <FaUsers /> Ishtirokchilar ({players.length})
              </h3>
              <button
                type="button"
                className="lobby-start-btn"
                onClick={handleStartGame}
                disabled={players.length === 0}
              >
                <FaPlay /> O'yinni boshlash
              </button>
            </div>

            <div className="lobby-players-grid">
              <AnimatePresence>
                {players.map((p, idx) => (
                  <motion.div
                    key={p.id || idx}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="lobby-player-chip"
                  >
                    <span className="player-avatar-circle">
                      {p.name.charAt(0).toUpperCase()}
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

      {/* ==================== 2. QUESTION STATE ==================== */}
      {gameState === "question" && currentQuestion && (
        <div className="host-question-view">
          {/* Top Bar: Progress, Question Counter, Timer */}
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
              {answeredCount} / {players.length} javob berdi
            </span>
          </div>

          {/* Question Text */}
          <div className="host-question-banner">
            <h1>{currentQuestion.text}</h1>
          </div>

          {/* Options Grid */}
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

      {/* ==================== 3. ANSWER & LEADERBOARD STATE ==================== */}
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

          {/* Options with correct indicator */}
          <div className="host-options-grid small">
            {currentQuestion.options.map((opt, idx) => {
              const optColor = OPTION_COLORS[idx % OPTION_COLORS.length];
              const isCorrect = idx === correctIndex;
              return (
                <div
                  key={idx}
                  className={`host-option-card ${isCorrect ? "correct-highlight" : "dimmed"}`}
                  style={{ backgroundColor: optColor.bg }}
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

          {/* Top 5 Leaderboard */}
          <div className="host-leaderboard-card">
            <h3>
              <FaTrophy /> Yetakchilar jadvali
            </h3>
            <div className="leaderboard-list">
              {leaderboard.map((item, idx) => (
                <motion.div
                  key={idx}
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
                  <div className="lb-name">{item.name}</div>
                  <div className="lb-score">
                    {item.score.toLocaleString()} ball
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. PODIUM / GAME ENDED ==================== */}
      {gameState === "ended" && (
        <div className="host-podium-view">
          <div className="podium-title-box">
            <h1>G'oliblarni tabriklaymiz! 🎉</h1>
            <p>Ajoyib o'yin bo'ldi!</p>
          </div>

          {/* 3D Animated Podium */}
          <div className="podium-container">
            {/* 2nd Place */}
            {finalLeaderboard[1] && (
              <motion.div
                className="podium-pillar pillar-2"
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.7, type: "spring" }}
              >
                <div className="pillar-player-info">
                  <div className="pillar-avatar silver">🥈</div>
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

            {/* 1st Place */}
            {finalLeaderboard[0] && (
              <motion.div
                className="podium-pillar pillar-1"
                initial={{ y: 250, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.8, type: "spring" }}
              >
                <div className="pillar-player-info">
                  <FaCrown className="crown-icon" />
                  <div className="pillar-avatar gold">👑</div>
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

            {/* 3rd Place */}
            {finalLeaderboard[2] && (
              <motion.div
                className="podium-pillar pillar-3"
                initial={{ y: 150, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
              >
                <div className="pillar-player-info">
                  <div className="pillar-avatar bronze">🥉</div>
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

          {/* Full participants table */}
          <div className="podium-full-rankings">
            <h3>Barcha ishtirokchilar natijalari</h3>
            <div className="full-rankings-table">
              {finalLeaderboard.map((player, idx) => (
                <div key={idx} className="ranking-table-row">
                  <span className="rank-col">#{idx + 1}</span>
                  <span className="name-col">{player.name}</span>
                  <span className="score-col">{player.score} ball</span>
                </div>
              ))}
            </div>
          </div>

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
    </div>
  );
}
