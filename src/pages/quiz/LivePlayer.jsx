import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaArrowLeft,
  FaClock,
  FaBookOpen,
  FaListOl,
  FaCaretUp,
  FaCircle,
  FaSquare,
} from "react-icons/fa";

import { FaDiamond } from "react-icons/fa6";

import { joinByPin } from "../../api/quizApi.js";
import { sfx } from "../../utils/soundEffects.js";
import "./LivePlayer.css";

const OPTION_COLORS = [
  { bg: "#ef4444", text: "#ffffff", shape: <FaCaretUp /> },
  { bg: "#3b82f6", text: "#ffffff", shape: <FaDiamond /> },
  { bg: "#eab308", text: "#ffffff", shape: <FaCircle /> },
  { bg: "#10b981", text: "#ffffff", shape: <FaSquare /> },
];

export default function LivePlayer() {
  const { pin: urlPin } = useParams();
  const navigate = useNavigate();

  // Join form state
  const [pin, setPin] = useState(urlPin || "");
  const [name, setName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u && (u.firstName || u.lastName))
        return `${u.firstName || ""} ${u.lastName || ""}`.trim();
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && p.name) return p.name;
    } catch {}
    return "";
  });

  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  // States: 'join' | 'lobby' | 'question' | 'answered' | 'answer_result' | 'ended'
  const [playerState, setPlayerState] = useState("join");
  const [errorMsg, setErrorMsg] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Answer result state
  const [answerFeedback, setAnswerFeedback] = useState(null); // { isCorrect, pointsEarned }
  const [correctIndex, setCorrectIndex] = useState(null);
  const [totalScore, setTotalScore] = useState(0);

  // Final Ended state & Review
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [questionsReview, setQuestionsReview] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [endViewTab, setEndViewTab] = useState("leaderboard"); // 'leaderboard' | 'review'
  const [myAnswerHistory, setMyAnswerHistory] = useState([]);

  const timerRef = useRef(null);
  const socketRef = useRef(null);

  const startTimer = (seconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(seconds);
    if (seconds <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        if (prev <= 6) {
          sfx.playTick(true);
        }
        return prev - 1;
      });
    }, 1000);
  };

  const connectToGame = ({ pinToUse, sessionIdToUse, playerIdToUse, nameToUse }) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const token = localStorage.getItem("token");
    const socketUrl =
      import.meta.env.VITE_API_URL || "https://ziyo.onrender.com";
    const newSocket = io(socketUrl, {
      auth: { token },
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("player:join", {
        sessionId: sessionIdToUse,
        playerId: playerIdToUse,
        name: nameToUse,
      });
    });

    newSocket.on("player:joined", (data) => {
      setPlayerId(data.playerId);
      if (data.name) setName(data.name);
      if (data.score !== undefined) setTotalScore(data.score);
      if (data.myAnswerHistory) setMyAnswerHistory(data.myAnswerHistory);

      // Sessiyani localStorage da saqlash (sahifa yangilanganda qayta ulanish uchun)
      localStorage.setItem(
        "ziyo_live_player",
        JSON.stringify({
          pin: pinToUse,
          sessionId: sessionIdToUse,
          playerId: data.playerId,
          name: data.name || nameToUse,
        })
      );

      setIsJoining(false);

      // O'yin holatini tiklash
      if (data.status === "question" && data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
        setCorrectIndex(null);
        setAnswerFeedback(null);
        startTimer(data.timeLeft ?? data.currentQuestion.timeLimit);
        if (data.hasAnswered) {
          setSelectedOption(data.chosenIndex);
          setPlayerState("answered");
        } else {
          setSelectedOption(null);
          setPlayerState("question");
        }
      } else if (data.status === "answer" && data.currentQuestion) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCurrentQuestion(data.currentQuestion);
        setCorrectIndex(data.correctIndex);
        setAnswerFeedback(data.myAnswer);
        setPlayerState("answer_result");
      } else if (data.status === "ended") {
        if (timerRef.current) clearInterval(timerRef.current);
        setPlayerState("ended");
      } else {
        setPlayerState("lobby");
      }
    });

    newSocket.on("player:join:error", (data) => {
      setErrorMsg(data.msg || "O'yinga qo'shilishda xatolik");
      setIsJoining(false);
      localStorage.removeItem("ziyo_live_player");
      setPlayerState("join");
    });

    // Question Start
    newSocket.on("question:start", (data) => {
      sfx.playStart();
      setPlayerState("question");
      setCurrentQuestion(data);
      setSelectedOption(null);
      setAnswerFeedback(null);
      setCorrectIndex(null);
      startTimer(data.timeLimit);
    });

    // Answer OK feedback for this player
    newSocket.on("player:answer:ok", (data) => {
      setAnswerFeedback(data);
      if (data.isCorrect) {
        sfx.playCorrect();
        setTotalScore((prev) => prev + data.pointsEarned);
      } else {
        sfx.playWrong();
      }
    });

    // Question Ended (Results)
    newSocket.on("question:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setCorrectIndex(data.correctIndex);
      setPlayerState("answer_result");
    });

    // Game Ended
    newSocket.on("game:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayerState("ended");
      setFinalLeaderboard(data.leaderboard || []);
      if (data.questionsReview) {
        setQuestionsReview(data.questionsReview);
      }

      const currentPlayerName = nameToUse || name;
      const found = data.leaderboard?.findIndex(
        (p) => p.name?.toLowerCase() === currentPlayerName?.trim().toLowerCase(),
      );
      if (found !== -1 && found !== undefined) {
        setMyRank(found + 1);
        if (found < 3) {
          sfx.playFanfare();
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
    });
  };

  // Auto verify PIN if urlPin is given or check stored session
  useEffect(() => {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
    } catch {}

    if (saved && saved.sessionId && saved.pin) {
      if (!urlPin || urlPin === saved.pin) {
        setPin(saved.pin);
        if (saved.name) setName(saved.name);
        setSessionId(saved.sessionId);
        setPlayerId(saved.playerId);
        setIsJoining(true);

        connectToGame({
          pinToUse: saved.pin,
          sessionIdToUse: saved.sessionId,
          playerIdToUse: saved.playerId,
          nameToUse: saved.name,
        });
        return;
      }
    }

    if (urlPin) {
      setPin(urlPin);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [urlPin]);

  // Handle Join
  const handleJoin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!pin.trim() || !name.trim()) {
      setErrorMsg("PIN kod va ismingizni kiriting!");
      return;
    }

    setIsJoining(true);
    try {
      // 1. Verify PIN via REST API
      const res = await joinByPin(pin.trim());
      if (!res.sessionId) {
        setErrorMsg("Bunday o'yin topilmadi!");
        setIsJoining(false);
        return;
      }

      setSessionId(res.sessionId);

      // Check if existing player info matches
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
      } catch {}

      const existingPlayerId =
        saved && saved.sessionId === res.sessionId ? saved.playerId : null;

      // 2. Connect Socket
      connectToGame({
        pinToUse: pin.trim(),
        sessionIdToUse: res.sessionId,
        playerIdToUse: existingPlayerId,
        nameToUse: name.trim(),
      });
    } catch (err) {
      setErrorMsg(err.message || "Ulanishda xatolik yuz berdi");
      setIsJoining(false);
    }
  };

  // Submit Answer
  const handleSelectOption = (index) => {
    if (selectedOption !== null || timeLeft <= 0) return;
    setSelectedOption(index);
    setPlayerState("answered");

    setMyAnswerHistory((prev) => [
      ...prev,
      { questionIndex: currentQuestion.questionIndex, chosenIndex: index },
    ]);

    const activeSocket = socketRef.current || socket;
    if (activeSocket && sessionId && playerId && currentQuestion) {
      activeSocket.emit("player:answer", {
        sessionId,
        playerId,
        questionIndex: currentQuestion.questionIndex,
        chosenIndex: index,
      });
    }
  };

  const handleExitGame = () => {
    localStorage.removeItem("ziyo_live_player");
    if (socketRef.current) socketRef.current.disconnect();
    navigate("/");
  };

  return (
    <div className="live-player-layout">
      {/* Top mini header */}
      <header className="player-top-header">
        {name && playerState !== "join" && (
          <span className="player-name-badge">
            👤 {name} • ⭐ {totalScore} ball
          </span>
        )}
      </header>

      {/* ==================== 1. JOIN SCREEN ==================== */}
      {playerState === "join" && (
        <div className="player-join-container">
          <div className="player-join-card">
            <div className="join-logo-box">🎮</div>
            <h2>Ziyo QUIZ</h2>
            <p>O'yin PIN kodini va ismingizni kiriting</p>

            {errorMsg && <div className="join-error-text">{errorMsg}</div>}

            <form onSubmit={handleJoin} className="player-join-form">
              <div className="join-input-group">
                <label>O'YIN KODI (PIN)</label>
                <input
                  type="text"
                  placeholder="Kodni kiritish"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>

              <div className="join-input-group">
                <label>SIZNING ISMINGIZ</label>
                <input
                  type="text"
                  placeholder="Ismingiz yoki taxallusingiz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>

              <button
                type="submit"
                className="player-enter-btn"
                disabled={isJoining}
              >
                {isJoining ? "Ulanmoqda..." : "O'yinga kirish 🚀"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== 2. LOBBY WAITING ==================== */}
      {playerState === "lobby" && (
        <div className="player-lobby-waiting">
          <motion.div
            className="lobby-waiting-card"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="pulse-avatar-circle">
              {name.charAt(0).toUpperCase()}
            </div>
            <h2>Siz o'yindasiz, {name}! 🎉</h2>
            <p>Boshlovchi o'yinni boshlashini kuting...</p>
            <div className="lobby-spinner" />
          </motion.div>
        </div>
      )}

      {/* ==================== 3. QUESTION SCREEN ==================== */}
      {(playerState === "question" || playerState === "answered") &&
        currentQuestion && (
          <div className="player-question-view">
            {/* Top Timer & Question Number */}
            <div className="player-q-topbar">
              <span className="player-q-num">
                Savol {currentQuestion.questionIndex + 1} /{" "}
                {currentQuestion.totalQuestions}
              </span>
              <div
                className={`player-timer-chip ${timeLeft <= 5 ? "urgent" : ""}`}
              >
                <FaClock /> {timeLeft}s
              </div>
            </div>

            {/* Question Text (Visible on player screen) */}
            <div className="player-q-text-card">
              <h3>{currentQuestion.text}</h3>
            </div>

            {/* Answer confirmation status if already clicked */}
            {playerState === "answered" && (
              <div className="player-answered-notice">
                <span>Javobingiz qabul qilindi! Natija kutilmoqda... ⏳</span>
              </div>
            )}

            {/* Options Grid (4 Large Colored Tappable Cards) */}
            <div className="player-options-grid">
              {currentQuestion.options.map((opt, idx) => {
                const color = OPTION_COLORS[idx % OPTION_COLORS.length];
                const isSelected = selectedOption === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`player-option-btn ${isSelected ? "selected" : ""}`}
                    style={{ backgroundColor: color.bg }}
                    disabled={selectedOption !== null || timeLeft <= 0}
                    onClick={() => handleSelectOption(idx)}
                  >
                    <span className="btn-shape-icon">{color.shape}</span>
                    <span className="btn-option-text">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* ==================== 4. ANSWER FEEDBACK RESULT ==================== */}
      {playerState === "answer_result" && (
        <div className="player-feedback-view">
          {answerFeedback?.isCorrect ? (
            <motion.div
              className="feedback-card correct"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <FaCheckCircle className="feedback-icon correct" />
              <h2>Barakalla! To'g'ri javob! 🎉</h2>
              <p className="points-won">+{answerFeedback.pointsEarned} ball</p>
              <span className="total-score-text">
                Umumiy ball: {totalScore}
              </span>
            </motion.div>
          ) : (
            <motion.div
              className="feedback-card wrong"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <FaTimesCircle className="feedback-icon wrong" />
              <h2>Afsus, noto'g'ri! ❌</h2>
              {correctIndex !== null &&
                currentQuestion?.options?.[correctIndex] && (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: "14px",
                      color: "#fca5a5",
                    }}
                  >
                    To'g'ri javob:{" "}
                    <strong>{currentQuestion.options[correctIndex]}</strong>
                  </p>
                )}
              <p className="points-won zero">+0 ball</p>
              <span className="total-score-text">
                Umumiy ball: {totalScore}
              </span>
            </motion.div>
          )}

          <div className="waiting-next-notice">Keyingi savol kutilmoqda...</div>
        </div>
      )}

      {/* ==================== 5. GAME ENDED PODIUM & REVIEW ==================== */}
      {playerState === "ended" && (
        <div className="player-ended-view">
          <motion.div
            className="ended-card"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="ended-trophy-icon">🏆</div>
            <h2>O'yin yakunlandi!</h2>
            <div className="my-rank-banner">
              {myRank ? (
                <>
                  <span className="rank-title">Sizning o'rningiz:</span>
                  <span className="rank-highlight">
                    {myRank === 1
                      ? "🥇 1-o'rin (G'olib!)"
                      : myRank === 2
                        ? "🥈 2-o'rin"
                        : myRank === 3
                          ? "🥉 3-o'rin"
                          : `#${myRank}-o'rin`}
                  </span>
                </>
              ) : (
                <span className="rank-title">Ishtirokingiz uchun rahmat!</span>
              )}
              <span className="final-points">
                To'plangan ball: {totalScore}
              </span>
            </div>

            {/* Sub-tabs: Leaderboard vs Mistakes Review */}
            <div className="ended-subtabs">
              <button
                type="button"
                className={`ended-tab-btn ${endViewTab === "leaderboard" ? "active" : ""}`}
                onClick={() => setEndViewTab("leaderboard")}
              >
                <FaListOl /> Top ishtirokchilar
              </button>
              <button
                type="button"
                className={`ended-tab-btn ${endViewTab === "review" ? "active" : ""}`}
                onClick={() => setEndViewTab("review")}
              >
                <FaBookOpen /> Xatolar ustida ishlash
              </button>
            </div>

            {/* TAB 1: Leaderboard */}
            {endViewTab === "leaderboard" && (
              <div className="player-top3-list">
                <h4>Top ishtirokchilar reytingi:</h4>
                {finalLeaderboard.slice(0, 5).map((p, idx) => (
                  <div
                    key={idx}
                    className={`top3-item ${idx === 0 ? "first" : ""}`}
                  >
                    <span>
                      {idx === 0
                        ? "🥇"
                        : idx === 1
                          ? "🥈"
                          : idx === 2
                            ? "🥉"
                            : `${idx + 1}.`}{" "}
                      {p.name}
                    </span>
                    <strong>{p.score} ball</strong>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Review Mistakes / Xatolar ustida ishlash */}
            {endViewTab === "review" && (
              <div className="player-review-list">
                <h4>Savollar va tahlil:</h4>
                {questionsReview.length > 0 ? (
                  questionsReview.map((q, idx) => {
                    const myAns = myAnswerHistory.find(
                      (a) => a.questionIndex === idx,
                    );
                    const isMyCorrect = myAns?.chosenIndex === q.correctIndex;

                    return (
                      <div
                        key={idx}
                        className={`review-question-card ${
                          isMyCorrect ? "correct-border" : "wrong-border"
                        }`}
                      >
                        <div className="review-q-header">
                          <span className="review-q-num">#{idx + 1}</span>
                          <span className="review-q-title">{q.text}</span>
                          <span className="review-status-icon">
                            {isMyCorrect ? (
                              <FaCheckCircle style={{ color: "#10b981" }} />
                            ) : (
                              <FaTimesCircle style={{ color: "#ef4444" }} />
                            )}
                          </span>
                        </div>

                        <div className="review-options">
                          {q.options.map((opt, oIdx) => {
                            const isCorrectOpt = oIdx === q.correctIndex;
                            const isMyPick = myAns?.chosenIndex === oIdx;

                            return (
                              <div
                                key={oIdx}
                                className={`review-opt-item ${
                                  isCorrectOpt
                                    ? "opt-correct"
                                    : isMyPick
                                      ? "opt-wrong"
                                      : ""
                                }`}
                              >
                                <span>{opt}</span>
                                {isCorrectOpt && (
                                  <span className="badge-tag">To'g'ri</span>
                                )}
                                {isMyPick && !isCorrectOpt && (
                                  <span className="badge-tag wrong">
                                    Siz tanlagan
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="review-explanation">
                            💡 <strong>Tushuntirish:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="no-review-text">Savollar tahlili yuklanmadi.</p>
                )}
              </div>
            )}

            <button
              type="button"
              className="exit-game-btn"
              onClick={handleExitGame}
            >
              <FaArrowLeft /> Bosh sahifaga qaytish
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
