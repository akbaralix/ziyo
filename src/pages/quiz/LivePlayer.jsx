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
  FaDice,
  FaCheck,
} from "react-icons/fa";

import { FaDiamond } from "react-icons/fa6";
import quizLogoImg from "../../assets/game/quiz-log-img.jpg";

import quizAvatar1 from "../../assets/quiz-avatar/quiz-avatar1.jpg";
import quizAvatar2 from "../../assets/quiz-avatar/quiz-avatar2.jpg";
import quizAvatar3 from "../../assets/quiz-avatar/quiz-avatar3.jpg";
import quizAvatar4 from "../../assets/quiz-avatar/quiz-avatar4.jpg";
import quizAvatar5 from "../../assets/quiz-avatar/quiz-avatar5.jpg";
import quizAvatar6 from "../../assets/quiz-avatar/quiz-avatar6.jpg";
import quizAvatar7 from "../../assets/quiz-avatar/quiz-avatar7.jpg";
import quizAvatar8 from "../../assets/quiz-avatar/quiz-avatar8.jpg";
import quizAvatar9 from "../../assets/quiz-avatar/quiz-avatar9.jpg";
import quizAvatar10 from "../../assets/quiz-avatar/quiz-avatar10.png";
import quizAvatar11 from "../../assets/quiz-avatar/quiz-avatar11.png";
import quizAvatar12 from "../../assets/quiz-avatar/quiz-avatar12.jpg";

export const QUIZ_AVATARS = [
  { id: 1, src: quizAvatar1, name: "Qahramon 1" },
  { id: 2, src: quizAvatar2, name: "Qahramon 2" },
  { id: 3, src: quizAvatar3, name: "Qahramon 3" },
  { id: 4, src: quizAvatar4, name: "Qahramon 4" },
  { id: 5, src: quizAvatar5, name: "Qahramon 5" },
  { id: 6, src: quizAvatar6, name: "Qahramon 6" },
  { id: 7, src: quizAvatar7, name: "Qahramon 7" },
  { id: 8, src: quizAvatar8, name: "Qahramon 8" },
  { id: 9, src: quizAvatar9, name: "Qahramon 9" },
  { id: 10, src: quizAvatar10, name: "Qahramon 10" },
  { id: 12, src: quizAvatar11, name: "Qahramon 10" },
  { id: 12, src: quizAvatar12, name: "Qahramon 10" },
];

import { joinByPin } from "../../api/quizApi.js";
import { sfx } from "../../utils/soundEffects.js";
import { toast } from "react-toastify";
import KahootCountdown from "./countdown.jsx";
import LiveReactions from "./LiveReactions.jsx";
import "./LivePlayer.css";

const OPTION_COLORS = [
  { bg: "rgb(226, 27, 60)", text: "#ffffff", shape: <FaCaretUp /> },
  { bg: "rgb(19, 104, 206)", text: "#ffffff", shape: <FaDiamond /> },
  { bg: "rgb(216, 158, 0)", text: "#ffffff", shape: <FaCircle /> },
  { bg: "rgb(38, 137, 12)", text: "#ffffff", shape: <FaSquare /> },
];
const REACT_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉"];

export default function LivePlayer() {
  const { pin: urlPin } = useParams();
  const navigate = useNavigate();

  // Join form state
  const [pin, setPin] = useState(urlPin || "");
  const [name, setName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u && (u.firstName || u.lastName))
        return `${u.firstName || ""}`.trim();
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && p.name) return p.name;
    } catch {}
    return "";
  });

  const [profilePic, setProfilePic] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
      if (saved && saved.profilePic) return saved.profilePic;
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u && u.profilePic) return u.profilePic;
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && p.profilePic) return p.profilePic;
    } catch {}
    return quizAvatar1;
  });

  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [quizTitle, setQuizTitle] = useState("");

  // States: 'join' | 'lobby' | 'question' | 'answered' | 'answer_result' | 'ended'
  const [playerState, setPlayerState] = useState("join");
  const [errorMsg, setErrorMsg] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Answer result state
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [, setCorrectIndex] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [currentRank, setCurrentRank] = useState(null);
  const [totalPlayersCount, setTotalPlayersCount] = useState(0);

  // Kahoot Countdown state
  const [isCountingDown, setIsCountingDown] = useState(false);
  const isCountingDownRef = useRef(false);
  const pendingQuestionRef = useRef(null);
  const pendingAnswerFeedbackRef = useRef(null);
  const [showReactionIcons, setshowReactionIcons] = useState(false);

  // Final Ended state & Review
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [questionsReview, setQuestionsReview] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [endViewTab, setEndViewTab] = useState("leaderboard");
  const [myAnswerHistory, setMyAnswerHistory] = useState([]);

  const timerRef = useRef(null);
  const socketRef = useRef(null);
  const hasAutoJoinedUrlPinRef = useRef(false);
  const sessionInfoRef = useRef({
    pin: "",
    sessionId: "",
    playerId: null,
    name: "",
    profilePic: "",
  });

  // Internet uzilib qayta ulanganda avtomatik sinxronizatsiya
  useEffect(() => {
    const handleOnline = () => {
      toast.info("Internet aloqasi tiklandi. O'yin yangilanmoqda...", {
        autoClose: 2000,
      });
      const currentSocket = socketRef.current;
      if (currentSocket) {
        if (!currentSocket.connected) {
          currentSocket.connect();
        } else {
          const s = sessionInfoRef.current;
          let savedLocal = {};
          try {
            savedLocal =
              JSON.parse(localStorage.getItem("ziyo_live_player")) || {};
          } catch {}
          currentSocket.emit("player:join", {
            sessionId: s.sessionId || savedLocal.sessionId,
            playerId: s.playerId || savedLocal.playerId,
            name: s.name || savedLocal.name,
            profilePic: s.profilePic || savedLocal.profilePic,
          });
        }
      }
    };

    const handleOffline = () => {
      toast.warning("Internet uzildi! Aloqa qayta tiklanishi kutilmoqda...", {
        autoClose: 3500,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    isCountingDownRef.current = false;

    if (pendingQuestionRef.current) {
      const qData = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      sfx.playStart();
      setPlayerState("question");
      setCurrentQuestion(qData);
      setSelectedOption(null);
      setAnswerFeedback(null);
      pendingAnswerFeedbackRef.current = null;
      setCorrectIndex(null);
      startTimer(qData.timeLimit);
    } else if (currentQuestion) {
      sfx.playStart();
      setPlayerState("question");
      startTimer(currentQuestion.timeLimit);
    }
  };

  const connectToGame = ({
    pinToUse,
    sessionIdToUse,
    playerIdToUse,
    nameToUse,
    profilePicToUse,
  }) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const activePic = profilePicToUse || profilePic || quizAvatar1;

    sessionInfoRef.current = {
      pin: pinToUse,
      sessionId: sessionIdToUse,
      playerId: playerIdToUse,
      name: nameToUse,
      profilePic: activePic,
    };

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

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      let savedLocal = {};
      try {
        savedLocal = JSON.parse(localStorage.getItem("ziyo_live_player")) || {};
      } catch {}

      const s = sessionInfoRef.current;
      const currentPid = s.playerId || savedLocal.playerId || null;
      const currentSid = s.sessionId || savedLocal.sessionId || sessionIdToUse;
      const currentName = s.name || savedLocal.name || nameToUse;
      const currentPic = s.profilePic || savedLocal.profilePic || activePic;

      newSocket.emit("player:join", {
        sessionId: currentSid,
        playerId: currentPid,
        name: currentName,
        profilePic: currentPic,
      });
    });

    newSocket.on("player:joined", (data) => {
      setPlayerId(data.playerId);
      sessionInfoRef.current.playerId = data.playerId;
      if (data.name) {
        setName(data.name);
        sessionInfoRef.current.name = data.name;
      }
      if (data.profilePic) {
        setProfilePic(data.profilePic);
        sessionInfoRef.current.profilePic = data.profilePic;
      }
      if (data.quizTitle) {
        setQuizTitle(data.quizTitle);
      }
      if (data.myAnswerHistory) setMyAnswerHistory(data.myAnswerHistory);

      localStorage.setItem(
        "ziyo_live_player",
        JSON.stringify({
          pin: sessionInfoRef.current.pin || pinToUse,
          sessionId: sessionInfoRef.current.sessionId || sessionIdToUse,
          playerId: data.playerId,
          name: data.name || sessionInfoRef.current.name || nameToUse,
          profilePic:
            data.profilePic || sessionInfoRef.current.profilePic || activePic,
        }),
      );

      setIsJoining(false);

      if (data.status === "question" && data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
        setCorrectIndex(null);
        setAnswerFeedback(null);
        startTimer(data.timeLeft ?? data.currentQuestion.timeLimit);
        if (data.hasAnswered) {
          setSelectedOption(data.chosenIndex);
          setPlayerState("answered");
          if (data.myAnswer) {
            pendingAnswerFeedbackRef.current = data.myAnswer;
            setTotalScore(
              Math.max(
                0,
                (data.score || 0) - (data.myAnswer.pointsEarned || 0),
              ),
            );
          } else if (data.score !== undefined) {
            setTotalScore(data.score);
          }
        } else {
          setSelectedOption(null);
          setPlayerState("question");
          if (data.score !== undefined) setTotalScore(data.score);
        }
      } else if (data.status === "answer" && data.currentQuestion) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCurrentQuestion(data.currentQuestion);
        setCorrectIndex(data.correctIndex);
        setAnswerFeedback(data.myAnswer);
        setPlayerState("answer_result");
        if (data.score !== undefined) setTotalScore(data.score);
        if (data.myRank) setCurrentRank(data.myRank);
        if (data.totalPlayers) setTotalPlayersCount(data.totalPlayers);
      } else if (data.status === "ended") {
        if (timerRef.current) clearInterval(timerRef.current);
        setPlayerState("ended");
        if (data.score !== undefined) setTotalScore(data.score);
        if (data.leaderboard) setFinalLeaderboard(data.leaderboard);
        if (data.questionsReview) setQuestionsReview(data.questionsReview);
        if (data.myRank) setMyRank(data.myRank);
      } else {
        if (data.score !== undefined) setTotalScore(data.score);
        setPlayerState("lobby");
      }
    });

    newSocket.on("player:avatar:updated", (data) => {
      const currentPid = sessionInfoRef.current.playerId;
      if (data.playerId === currentPid) {
        setProfilePic(data.profilePic);
        sessionInfoRef.current.profilePic = data.profilePic;
      }
    });

    newSocket.on("player:join:error", (data) => {
      const msg = data.msg || "O'yinga qo'shilishda xatolik";
      setErrorMsg(msg);
      toast.error(msg);
      setIsJoining(false);
      if (msg.includes("topilmadi")) {
        localStorage.removeItem("ziyo_live_player");
        setPlayerState("join");
      }
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
        setPlayerState("question");
        setCurrentQuestion(data);
        setSelectedOption(null);
        setAnswerFeedback(null);
        pendingAnswerFeedbackRef.current = null;
        setCorrectIndex(null);
        startTimer(data.timeLimit);
      }
    });

    newSocket.on("player:answer:ok", (data) => {
      // Kahoot kabi: javob qabul qilinganini saqlab turamiz,
      // lekin barcha o'yinchilar javob berib (yoki vaqt tugab) raund yakunlanmaguncha
      // bal qo'shilmaydi va ovoz chalinmaydi
      pendingAnswerFeedbackRef.current = data;
    });

    newSocket.on("question:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setCorrectIndex(data.correctIndex);

      // Savol raundi tugadi: endi natijani ko'rsatamiz va bal qo'shamiz
      const feedback = pendingAnswerFeedbackRef.current;
      pendingAnswerFeedbackRef.current = null;

      if (feedback) {
        setAnswerFeedback(feedback);
        if (feedback.isCorrect) {
          sfx.playCorrect();
          setTotalScore((prev) => prev + (feedback.pointsEarned || 0));
        } else {
          sfx.playWrong();
        }
        if (feedback.totalPlayers) {
          setTotalPlayersCount(feedback.totalPlayers);
        }
      } else {
        // O'yinchi savol vaqtida javob bermadi
        sfx.playWrong();
        setAnswerFeedback({
          isCorrect: false,
          pointsEarned: 0,
          noAnswer: true,
        });
      }

      const lb = data.allLeaderboard || data.leaderboard || [];
      if (lb.length > 0) {
        const myPid = sessionInfoRef.current.playerId || playerId;
        const myName = (sessionInfoRef.current.name || name || "")
          .trim()
          .toLowerCase();
        const foundIdx = lb.findIndex(
          (p) =>
            (myPid && p.id && String(p.id) === String(myPid)) ||
            (p.name && p.name.trim().toLowerCase() === myName),
        );
        if (foundIdx !== -1) {
          setCurrentRank(foundIdx + 1);
          setTotalPlayersCount(data.totalPlayers || lb.length);
        } else if (feedback?.rank) {
          setCurrentRank(feedback.rank);
        }
      } else if (feedback?.rank) {
        setCurrentRank(feedback.rank);
      }

      setPlayerState("answer_result");
    });

    newSocket.on("game:ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayerState("ended");
      setFinalLeaderboard(data.leaderboard || []);
      if (data.questionsReview) {
        setQuestionsReview(data.questionsReview);
      }

      const currentPlayerName = nameToUse || name;
      const found = data.leaderboard?.findIndex(
        (p) =>
          p.name?.toLowerCase() === currentPlayerName?.trim().toLowerCase(),
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

  // Handle Join (event parametrini ixtiyoriy qilamiz)
  const handleJoin = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setErrorMsg("");

    if (!pin.trim() || !name.trim()) {
      const msg = "PIN kod va ismingizni kiriting!";
      setErrorMsg(msg);
      return;
    }

    setIsJoining(true);
    try {
      const res = await joinByPin(pin.trim());
      if (!res.sessionId) {
        const msg = "Bunday o'yin topilmadi!";
        setErrorMsg(msg);
        toast.error(msg);
        setIsJoining(false);
        return;
      }

      setSessionId(res.sessionId);

      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
      } catch {}

      const existingPlayerId =
        saved && saved.sessionId === res.sessionId ? saved.playerId : null;

      connectToGame({
        pinToUse: pin.trim(),
        sessionIdToUse: res.sessionId,
        playerIdToUse: existingPlayerId,
        nameToUse: name.trim(),
        profilePicToUse: profilePic,
      });
    } catch (err) {
      const msg = err.message || "Ulanishda xatolik yuz berdi";
      setErrorMsg(msg);
      toast.error(msg);
      setIsJoining(false);
    }
  };

  // Auto verify PIN or stored session / auto login
  useEffect(() => {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
    } catch {}

    if (saved && saved.sessionId && saved.pin) {
      if (!urlPin || urlPin === saved.pin) {
        setPin(saved.pin);
        if (saved.name) setName(saved.name);
        if (saved.profilePic) setProfilePic(saved.profilePic);
        setSessionId(saved.sessionId);
        setPlayerId(saved.playerId);
        setIsJoining(true);

        connectToGame({
          pinToUse: saved.pin,
          sessionIdToUse: saved.sessionId,
          playerIdToUse: saved.playerId,
          nameToUse: saved.name,
          profilePicToUse: saved.profilePic,
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

  // Faqat URL orqali PIN kelganda (QR-kod yoki havola orqali ochilganda) va user login bo'lsa bir marta avtomatik kirish
  useEffect(() => {
    if (urlPin && !hasAutoJoinedUrlPinRef.current) {
      const userIsLogin =
        !!localStorage.getItem("ziyo_user") ||
        !!localStorage.getItem("ziyo_user_profile");

      if (userIsLogin && name.trim() && playerState === "join") {
        hasAutoJoinedUrlPinRef.current = true;
        handleJoin();
      }
    }
  }, [urlPin, name]);

  const handleSelectAvatar = (avatarSrc) => {
    setProfilePic(avatarSrc);

    try {
      const saved = JSON.parse(
        localStorage.getItem("ziyo_live_player") || "{}",
      );
      saved.profilePic = avatarSrc;
      localStorage.setItem("ziyo_live_player", JSON.stringify(saved));
    } catch {}

    const activeSocket = socketRef.current || socket;
    if (activeSocket && sessionId && playerId) {
      activeSocket.emit("player:update-avatar", {
        sessionId,
        playerId,
        profilePic: avatarSrc,
      });
    }
  };

  const handleRandomAvatar = () => {
    const available = QUIZ_AVATARS.filter((a) => a.src !== profilePic);
    const pick =
      available[Math.floor(Math.random() * available.length)] ||
      QUIZ_AVATARS[0];
    handleSelectAvatar(pick.src);
  };

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
  const handleSendEmoji = (emoji) => {
    setshowReactionIcons(false);

    // Faol socketni aniqlab olamiz
    const activeSocket = socketRef.current || socket;

    if (activeSocket && sessionId) {
      activeSocket.emit("send_reaction", {
        emoji: emoji,
        sessionId: sessionId, // Xonani aniqlash uchun sessionId yuboriladi
        name: name, // Kim yuborgani ko'rinishi uchun (ixtiyoriy)
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
      {/* ==================== KAHOOT COUNTDOWN OVERLAY ==================== */}
      {isCountingDown && (
        <KahootCountdown
          quizTitle={quizTitle || "Ziyo Quiz"}
          onComplete={handleCountdownComplete}
        />
      )}

      {/* Top mini header */}
      <header className="player-top-header">
        {name && playerState !== "join" && (
          <div className="player-name-badge">
            <span className="player-badge-avatar-wrap">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt={name}
                  className="player-badge-avatar"
                />
              ) : (
                <span className="player-badge-avatar-fallback">👤</span>
              )}
            </span>
            <span className="player-badge-name">{name}</span>
            {currentRank &&
              playerState !== "question" &&
              playerState !== "answered" && (
                <span className="player-badge-rank">
                  {currentRank === 1
                    ? "🥇"
                    : currentRank === 2
                      ? "🥈"
                      : currentRank === 3
                        ? "🥉"
                        : "🏅"}{" "}
                  #{currentRank}-o'rin
                </span>
              )}
            <span className="player-badge-score">⭐ {totalScore} ball</span>
          </div>
        )}
      </header>

      {/* ==================== 1. JOIN SCREEN ==================== */}
      {playerState === "join" && (
        <div className="player-join-container">
          <div className="player-join-card">
            <h2>Ziyo QUIZ</h2>

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
              {profilePic ? (
                <img src={profilePic} alt={name} className="pulse-avatar-img" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <h2>Siz o'yindasiz, {name}! 🎉</h2>
            <p className="lobby-wait-text">
              Boshlovchi o'yinni boshlashini kuting...
            </p>
            <div className="kahoot-avatar-picker-box">
              <div className="picker-header">
                <span className="picker-title">🎭 Avataringizni tanlang</span>
                <button
                  type="button"
                  className="random-avatar-btn"
                  onClick={handleRandomAvatar}
                  title="Tasodifiy avatar"
                >
                  <FaDice /> Tasodifiy
                </button>
              </div>

              <div className="kahoot-avatar-grid">
                {QUIZ_AVATARS.map((av) => {
                  const isSelected = profilePic === av.src;
                  return (
                    <motion.button
                      key={av.id}
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={`kahoot-avatar-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => handleSelectAvatar(av.src)}
                      title={av.name}
                    >
                      <img
                        src={av.src}
                        alt={av.name}
                        className="kahoot-avatar-img"
                      />
                      {isSelected && (
                        <div className="avatar-check-badge">
                          <FaCheck />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== 3. QUESTION SCREEN ==================== */}
      {(playerState === "question" || playerState === "answered") &&
        currentQuestion && (
          <div className="player-question-view">
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

            <div className="player-q-text-card">
              <h3>{currentQuestion.text}</h3>
            </div>

            {playerState === "answered" && (
              <div className="player-answered-notice">
                <div className="answered-pulse-loader" />
                <span className="player-answered-title">
                  Javobingiz qabul qilindi!
                </span>
                <span className="player-answered-sub">
                  Boshqa ishtirokchilar javobi kutilmoqda... ⏳
                </span>
              </div>
            )}

            <div className="player-options-grid">
              {currentQuestion.options.map((opt, idx) => {
                const color = OPTION_COLORS[idx % OPTION_COLORS.length];
                const isSelected = selectedOption === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`player-option-btn ${
                      isSelected ? "selected" : ""
                    }`}
                    style={{
                      backgroundColor: color.bg,
                      boxShadow: "rgba(0, 0, 0, 0.2) 0px -6px 0px 0px inset",
                    }}
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
              className="feedback-card"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <FaCheckCircle className="feedback-icon correct" />
              <h2>Barakalla! To'g'ri javob! 🎉</h2>
              <p className="points-won">+{answerFeedback.pointsEarned} ball</p>
              <span className="total-score-text">
                Umumiy ball: <strong>{totalScore}</strong>
              </span>

              {currentRank && (
                <div
                  className={`feedback-rank-box rank-${
                    currentRank <= 3 ? currentRank : "other"
                  }`}
                >
                  <span className="feedback-rank-sublabel">
                    Sizning joriy o'rningiz:
                  </span>
                  <div className="feedback-rank-main">
                    {currentRank === 1 && "🥇 1-o'rin 🔥"}
                    {currentRank === 2 && "🥈 2-o'rin"}
                    {currentRank === 3 && "🥉 3-o'rin"}
                    {currentRank > 3 && `🏅 #${currentRank}-o'rin`}
                  </div>
                  {totalPlayersCount > 0 && (
                    <span className="feedback-rank-count">
                      Jami {totalPlayersCount} ishtirokchi orasida
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              className="feedback-card"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <FaTimesCircle className="feedback-icon wrong" />
              <h2>
                {answerFeedback?.noAnswer
                  ? "Vaqt tugadi! Javob belgilanmadi"
                  : "Afsus, noto'g'ri! ❌"}
              </h2>

              <span className="total-score-text">
                Umumiy ball: <strong>{totalScore}</strong>
              </span>

              {currentRank && (
                <div
                  className={`feedback-rank-box rank-${
                    currentRank <= 3 ? currentRank : "other"
                  }`}
                >
                  <span className="feedback-rank-sublabel">
                    Sizning joriy o'rningiz:
                  </span>
                  <div className="feedback-rank-main">
                    {currentRank === 1 && "🥇 1-o'rin 🔥"}
                    {currentRank === 2 && "🥈 2-o'rin"}
                    {currentRank === 3 && "🥉 3-o'rin"}
                    {currentRank > 3 && `🏅 #${currentRank}-o'rin`}
                  </div>
                  {totalPlayersCount > 0 && (
                    <span className="feedback-rank-count">
                      Jami {totalPlayersCount} ishtirokchi orasida
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}
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
              <div className="my-rank-avatar-wrapper">
                <img
                  src={profilePic || quizAvatar1}
                  alt={name}
                  className="my-rank-avatar-img"
                />
                {myRank === 1 && <span className="my-rank-crown">👑</span>}
              </div>
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

            <div className="ended-subtabs">
              <button
                type="button"
                className={`ended-tab-btn ${
                  endViewTab === "leaderboard" ? "active" : ""
                }`}
                onClick={() => setEndViewTab("leaderboard")}
              >
                <FaListOl /> Top ishtirokchilar
              </button>
              <button
                type="button"
                className={`ended-tab-btn ${
                  endViewTab === "review" ? "active" : ""
                }`}
                onClick={() => setEndViewTab("review")}
              >
                <FaBookOpen /> Xatolar ustida ishlash
              </button>
            </div>

            {endViewTab === "leaderboard" && (
              <div className="player-top3-list">
                <h4>Top ishtirokchilar reytingi:</h4>
                {finalLeaderboard.slice(0, 5).map((p, idx) => {
                  const isCurrent =
                    p.id === playerId ||
                    p.name?.trim().toLowerCase() === name?.trim().toLowerCase();
                  const pAvatar = isCurrent
                    ? profilePic || p.profilePic
                    : p.profilePic;

                  return (
                    <div
                      key={idx}
                      className={`top3-item ${
                        idx === 0 ? "first" : ""
                      } ${isCurrent ? "me-highlight" : ""}`}
                    >
                      <div className="top3-item-left">
                        <span className="top3-rank-icon">
                          {idx === 0
                            ? "🥇"
                            : idx === 1
                              ? "🥈"
                              : idx === 2
                                ? "🥉"
                                : `${idx + 1}.`}
                        </span>
                        {pAvatar ? (
                          <img
                            src={pAvatar}
                            alt={p.name}
                            className="top3-player-avatar"
                          />
                        ) : (
                          <span className="top3-player-avatar-fallback">
                            {p.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="top3-player-name">
                          {p.name}{" "}
                          {isCurrent && <span className="me-label">(Siz)</span>}
                        </span>
                      </div>
                      <strong>{p.score} ball</strong>
                    </div>
                  );
                })}
              </div>
            )}

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
                      </div>
                    );
                  })
                ) : (
                  <p className="no-review-text">
                    Tahlil ma'lumotlari mavjud emas.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              className="exit-game-btn"
              onClick={handleExitGame}
            >
              <FaArrowLeft /> Asosiy sahifaga qaytish
            </button>
          </motion.div>
        </div>
      )}
      {/* Kahoot-style Live Reaksiyalar (barcha qatnashchilar va hostda ko'rinadi) */}
      {playerState !== "join" && (
        <LiveReactions
          socket={socketRef.current || socket}
          sessionId={sessionId}
          senderName={name || "O'yinchi"}
          showTrigger={true}
        />
      )}
    </div>
  );
}
