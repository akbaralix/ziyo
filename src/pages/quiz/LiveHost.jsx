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
  FaBars,
  FaTimes,
  FaCheck,
  FaSmile,
  FaLock,
  FaUnlock,
  FaExpand,
  FaCompress,
  FaImage,
  FaPowerOff,
  FaLink,
} from "react-icons/fa";
import { FaDiamond } from "react-icons/fa6";
import { toast } from "react-toastify";
import { sfx } from "../../utils/soundEffects.js";
import { getAuthToken } from "../../utils/authSession.js";
import KahootCountdown from "./countdown.jsx";
import backgroundImage from "../../assets/game/live-game-bg.jpg";
import quizBgMath from "../../assets/images/quiz_bg_math_1795793371507.jpg";
import quizBgAstronomy from "../../assets/images/quiz_bg_astronomy_1795793371984.jpg";
import quizBgKnowledge from "../../assets/images/quiz_bg_knowledge_1795793372275.jpg";
import quizBgLogic from "../../assets/images/quiz_bg_logic_1795793372533.jpg";
import quizBgScience from "../../assets/images/quiz_bg_science_1795793372766.jpg";
import lobbyAudio from "../../assets/Jason Beauchamp - Kahoot Lobby Music.mp3";
import liveResponseWait from "../../assets/live-kutish.mp3";
import lobbyStatsAudio from "../../assets/Video Project 4.m4a";
import LiveReactions from "./LiveReactions.jsx";
import "./LiveHost.css";

const HOST_BG_STORAGE_KEY = "ziyo_host_bg_theme";

const QUIZ_BACKGROUNDS = [
  { id: "default", label: "Klassik arena", src: backgroundImage },
  { id: "math", label: "Matematika", src: quizBgMath },
  { id: "astronomy", label: "Kosmos", src: quizBgAstronomy },
  { id: "knowledge", label: "Kutubxona", src: quizBgKnowledge },
  { id: "logic", label: "Mantiq", src: quizBgLogic },
  { id: "science", label: "Fizika & Kimyo", src: quizBgScience },
];

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

const TRUE_FALSE_COLORS = [
  {
    bg: "rgb(38, 137, 12)",
    text: "#ffffff",
    shape: <FaCheck />,
    name: "To'g'ri",
  },
  {
    bg: "rgb(226, 27, 60)",
    text: "#ffffff",
    shape: <FaTimes />,
    name: "Noto'g'ri",
  },
];

export default function LiveHost() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState("lobby"); // 'lobby' | 'question' | 'answer' | 'ended'
  const [sessionError, setSessionError] = useState("");
  const [pin, setPin] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [creatorId, setCreatorId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // Host drawer & session preferences
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmEndStep, setConfirmEndStep] = useState(false);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false,
  );
  const [selectedBgId, setSelectedBgId] = useState(() => {
    try {
      const saved = localStorage.getItem(HOST_BG_STORAGE_KEY);
      if (saved && QUIZ_BACKGROUNDS.some((bg) => bg.id === saved)) {
        return saved;
      }
    } catch {}
    return "default";
  });

  // Action locks (ikki marta bosilishining oldini olish)
  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

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
  const [countdownStartsAt, setCountdownStartsAt] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const isCountingDownRef = useRef(false);
  const countdownFinishedRef = useRef(false);
  const countdownFallbackTimerRef = useRef(null);
  const pendingQuestionRef = useRef(null);
  const serverOffsetRef = useRef(0);
  const lastTickSecRef = useRef(null);

  const timerRef = useRef(null);
  const socketRef = useRef(null);

  const audioRef = useRef(null);
  const waitAudio = useRef(null);
  const audioStatsRef = useRef(null);

  const syncServerClock = useCallback((serverTime) => {
    if (typeof serverTime === "number" && Number.isFinite(serverTime)) {
      const offset = serverTime - Date.now();
      serverOffsetRef.current = offset;
      setServerOffsetMs(offset);
    }
  }, []);

  const clearQuestionTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    lastTickSecRef.current = null;
  }, []);

  const startSyncedTimer = useCallback(
    (questionEndsAt, fallbackSeconds) => {
      clearQuestionTimer();

      const now = Date.now();
      const targetLocalEnd =
        typeof questionEndsAt === "number" && Number.isFinite(questionEndsAt)
          ? questionEndsAt - serverOffsetRef.current
          : now + Math.max(0, Number(fallbackSeconds) || 0) * 1000;

      const updateRemaining = () => {
        const remainingSec = Math.max(
          0,
          Math.ceil((targetLocalEnd - Date.now()) / 1000),
        );
        setTimeLeft(remainingSec);

        if (remainingSec > 0 && lastTickSecRef.current !== remainingSec) {
          lastTickSecRef.current = remainingSec;
          sfx.playTick(remainingSec <= 5);
        }

        if (remainingSec <= 0) {
          clearQuestionTimer();
        }
      };

      updateRemaining();
      if (targetLocalEnd > Date.now()) {
        timerRef.current = setInterval(updateRemaining, 200);
      }
    },
    [clearQuestionTimer],
  );

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
      const u =
        JSON.parse(localStorage.getItem("hatify_user")) ||
        JSON.parse(localStorage.getItem("ziyo_user"));
      if (u && (u._id || u.id)) return String(u._id || u.id);
      const p =
        JSON.parse(localStorage.getItem("hatify_user_profile")) ||
        JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && (p._id || p.id)) return String(p._id || p.id);
      const token = getAuthToken();
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
    const token = getAuthToken();
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!newSocket.connected) {
          newSocket.connect();
        } else {
          newSocket.emit("host:join", { sessionId });
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    newSocket.on("connect", () => {
      newSocket.emit("host:join", { sessionId });
    });

    newSocket.on("host:error", (data) => {
      if (data?.fatal) {
        setSessionError(data.msg || "O'yin sessiyasi topilmadi");
      }
    });

    newSocket.on("error", (data) => {
      setIsStarting(false);
      setIsAdvancing(false);
      if (data?.msg) {
        toast.error(data.msg);
      }
    });

    newSocket.on("host:joined", (data) => {
      setSessionError("");
      syncServerClock(data.serverTime);
      setPin(data.pin || "");
      setQuizTitle(data.quizTitle || "");
      if (data.creatorId || data.hostId) {
        setCreatorId(String(data.creatorId || data.hostId));
      }
      if (typeof data.reactionsEnabled === "boolean") {
        setReactionsEnabled(data.reactionsEnabled);
      }
      if (typeof data.isLocked === "boolean") {
        setIsRoomLocked(data.isLocked);
      }
      if (
        data.backgroundTheme &&
        data.backgroundTheme !== "default" &&
        QUIZ_BACKGROUNDS.some((bg) => bg.id === data.backgroundTheme)
      ) {
        setSelectedBgId(data.backgroundTheme);
      }

      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }

      if (data.pin) {
        const joinUrl = `${window.location.origin}/live/${data.pin}`;
        QRCode.toDataURL(joinUrl, { width: 220, margin: 1 })
          .then((url) => setQrDataUrl(url))
          .catch(console.error);
      }

      setIsStarting(false);
      setIsAdvancing(false);

      if (data.status === "active") {
        clearQuestionTimer();
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        countdownFinishedRef.current = false;
        setCountdownStartsAt(data.startsAt || Date.now() + 2000);
        setIsCountingDown(true);
        isCountingDownRef.current = true;
        setGameState("lobby");
      } else if (data.status === "question" && data.currentQuestion) {
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        countdownFinishedRef.current = false;
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        pendingQuestionRef.current = null;
        setGameState("question");
        setCurrentQuestion(data.currentQuestion);
        setAnsweredCount(data.answeredCount || 0);
        setCorrectIndex(null);
        startSyncedTimer(
          data.questionEndsAt || data.currentQuestion.questionEndsAt,
          data.timeLeft ?? data.currentQuestion.timeLimit,
        );
      } else if (data.status === "answer" && data.currentQuestion) {
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        countdownFinishedRef.current = false;
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        pendingQuestionRef.current = null;
        clearQuestionTimer();
        setGameState("answer");
        setCurrentQuestion(data.currentQuestion);
        setCorrectIndex(data.correctIndex);
        setLeaderboard(data.leaderboard || []);
      } else if (data.status === "ended") {
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        countdownFinishedRef.current = false;
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        pendingQuestionRef.current = null;
        clearQuestionTimer();
        setGameState("ended");
        setFinalLeaderboard(data.leaderboard || []);
      } else {
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        countdownFinishedRef.current = false;
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        pendingQuestionRef.current = null;
        clearQuestionTimer();
        setGameState("lobby");
      }
    });

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

    newSocket.on("player:left", ({ playerId }) => {
      setPlayers((prev) => prev.filter((p) => (p.id || p._id) !== playerId));
    });

    newSocket.on("player:avatar:updated", ({ playerId, profilePic }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          (p.id || p._id) === playerId ? { ...p, profilePic } : p,
        ),
      );
    });

    newSocket.on("player:name:updated", ({ playerId, name }) => {
      setPlayers((prev) =>
        prev.map((p) => ((p.id || p._id) === playerId ? { ...p, name } : p)),
      );
    });

    newSocket.on("session:reactions-toggled", (data) => {
      setReactionsEnabled(data?.reactionsEnabled !== false);
    });

    newSocket.on("session:lock-toggled", (data) => {
      setIsRoomLocked(Boolean(data?.isLocked));
    });

    newSocket.on("game:started", (data) => {
      syncServerClock(data?.serverTime);
      setIsStarting(false);
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
        countdownFallbackTimerRef.current = null;
      }
      countdownFinishedRef.current = false;
      pendingQuestionRef.current = null;
      setCountdownStartsAt(data?.startsAt || Date.now() + 3400);
      setIsCountingDown(true);
      isCountingDownRef.current = true;
    });

    newSocket.on("question:start", (data) => {
      syncServerClock(data?.serverTime);
      setIsAdvancing(false);
      setIsStarting(false);

      if (isCountingDownRef.current && !countdownFinishedRef.current) {
        pendingQuestionRef.current = data;
      } else {
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        countdownFinishedRef.current = false;
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        pendingQuestionRef.current = null;
        sfx.playStart();
        setGameState("question");
        setCurrentQuestion(data);
        setAnsweredCount(0);
        setCorrectIndex(null);
        startSyncedTimer(data.questionEndsAt, data.timeLimit);
      }
    });

    newSocket.on("answer:progress", (data) => {
      setAnsweredCount(data.answered);
    });

    newSocket.on("question:ended", (data) => {
      syncServerClock(data?.serverTime);
      clearQuestionTimer();
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
        countdownFallbackTimerRef.current = null;
      }
      countdownFinishedRef.current = false;
      setIsCountingDown(false);
      isCountingDownRef.current = false;
      pendingQuestionRef.current = null;
      setIsAdvancing(false);
      setGameState("answer");
      setCorrectIndex(data.correctIndex);
      setLeaderboard(data.leaderboard || []);
    });

    newSocket.on("game:ended", (data) => {
      syncServerClock(data?.serverTime);
      clearQuestionTimer();
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
        countdownFallbackTimerRef.current = null;
      }
      countdownFinishedRef.current = false;
      setIsCountingDown(false);
      isCountingDownRef.current = false;
      pendingQuestionRef.current = null;
      setIsAdvancing(false);
      setIsStarting(false);
      toast.dismiss("end-confirm");
      setGameState("ended");
      setFinalLeaderboard(data.leaderboard || []);
      sfx.playFanfare();
      triggerConfetti();
    });

    return () => {
      toast.dismiss("end-confirm");
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearQuestionTimer();
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
        countdownFallbackTimerRef.current = null;
      }
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [
    sessionId,
    syncServerClock,
    clearQuestionTimer,
    startSyncedTimer,
    triggerConfetti,
  ]);

  const handleStartGame = useCallback(() => {
    if (isStarting || isCountingDown) return;
    if (players.length === 0) {
      toast.warning(
        "O'yinni boshlash uchun kamida 1 ta o'yinchi qo'shilishi kerak!",
      );
      return;
    }
    if (!socket?.connected) {
      toast.warning("Server bilan aloqa tiklanmoqda, biroz kuting...");
      socket?.connect();
      return;
    }
    setIsStarting(true);
    socket.emit("host:start", { sessionId });
  }, [isStarting, isCountingDown, players.length, socket, sessionId]);

  const handleCountdownComplete = useCallback(() => {
    if (pendingQuestionRef.current) {
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
        countdownFallbackTimerRef.current = null;
      }
      countdownFinishedRef.current = false;
      setIsCountingDown(false);
      isCountingDownRef.current = false;
      const qData = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      sfx.playStart();
      setGameState("question");
      setCurrentQuestion(qData);
      setAnsweredCount(0);
      setCorrectIndex(null);
      startSyncedTimer(qData.questionEndsAt, qData.timeLimit);
    } else {
      // Savol hali serverdan yetib kelmagan bo'lsa, lobby'ga qaytmasdan kutamiz
      countdownFinishedRef.current = true;
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
      }
      countdownFallbackTimerRef.current = setTimeout(() => {
        if (countdownFinishedRef.current) {
          socketRef.current?.emit("host:join", { sessionId });
        }
      }, 2000);
    }
  }, [sessionId, startSyncedTimer]);

  const handleNextQuestion = useCallback(() => {
    if (isAdvancing) return;
    if (!socket?.connected) {
      toast.warning("Server bilan aloqa tiklanmoqda...");
      socket?.connect();
      return;
    }
    setIsAdvancing(true);
    audioStatsRef.current?.pause();
    socket.emit("host:next", { sessionId });
  }, [isAdvancing, socket, sessionId]);

  const handleConfirmEndGame = useCallback(() => {
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
    socket?.emit("host:end", { sessionId });
    setConfirmEndStep(false);
    setIsMenuOpen(false);
  }, [creatorId, sessionId, socket, getCurrentUserId]);

  const handleToggleReactions = useCallback(() => {
    const nextVal = !reactionsEnabled;
    setReactionsEnabled(nextVal);
    if (socket?.connected && sessionId) {
      socket.emit("host:toggle-reactions", { sessionId, enabled: nextVal });
    }
    toast.info(
      nextVal ? "Reaksiyalar yoqildi" : "Reaksiyalar o'chirildi",
      { autoClose: 1800 },
    );
  }, [reactionsEnabled, socket, sessionId]);

  const handleToggleRoomLock = useCallback(() => {
    if (gameState === "ended") return;
    const nextLocked = !isRoomLocked;
    setIsRoomLocked(nextLocked);
    if (socket?.connected && sessionId) {
      socket.emit("host:toggle-lock", { sessionId, locked: nextLocked });
    }
    toast.info(
      nextLocked
        ? "Xona qulflandi — yangi o'yinchilar kira olmaydi"
        : "Xona ochildi — yangi o'yinchilar qo'shila oladi",
      { autoClose: 2200 },
    );
  }, [gameState, isRoomLocked, socket, sessionId]);

  const handleSelectBackground = useCallback(
    (bgId) => {
      setSelectedBgId(bgId);
      try {
        localStorage.setItem(HOST_BG_STORAGE_KEY, bgId);
      } catch {}
      if (socket?.connected && sessionId) {
        socket.emit("host:set-background", { sessionId, backgroundTheme: bgId });
      }
    },
    [socket, sessionId],
  );

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.warning("To'liq ekran rejimini brauzer qo'llab-quvvatlamadi");
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
        setConfirmEndStep(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  const activeBackground = useMemo(
    () =>
      QUIZ_BACKGROUNDS.find((bg) => bg.id === selectedBgId) ||
      QUIZ_BACKGROUNDS[0],
    [selectedBgId],
  );

  const screenBgStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(rgba(12, 13, 28, 0.56), rgba(12, 13, 28, 0.72)), url(${activeBackground.src})`,
    }),
    [activeBackground],
  );

  const currentUserId = useMemo(() => getCurrentUserId(), [getCurrentUserId]);
  const isCreator =
    !creatorId || !currentUserId || String(creatorId) === String(currentUserId);

  if (sessionError) {
    return (
      <div
        className="live-host-screen"
        style={{
          ...screenBgStyle,
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "rgba(21, 20, 38, 0.92)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "20px",
            padding: "32px 28px",
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: "20px" }}>
            O&apos;yin ochilmadi
          </h2>
          <p style={{ margin: "0 0 22px", color: "#cbd5e1", fontSize: "14px" }}>
            {sessionError}
          </p>
          <button
            type="button"
            className="finish-btn"
            onClick={() => navigate("/oyinlar")}
            style={{ width: "100%", justifyContent: "center" }}
          >
            <FaArrowLeft /> O&apos;yinlarga qaytish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-host-screen" style={screenBgStyle}>
      <header className="live-host-nav">
        <div className="host-nav-brand">
          <span className="live-quiz-title">{quizTitle}</span>
          {isRoomLocked && gameState === "lobby" && (
            <span className="host-locked-badge" title="Xona qulflangan">
              <FaLock /> Qulflangan
            </span>
          )}
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

          {gameState === "lobby" && !isCountingDown && (
            <button
              type="button"
              className="lobby-start-btn"
              onClick={handleStartGame}
              disabled={players.length === 0 || isStarting}
            >
              <FaPlay /> {isStarting ? "Boshlanmoqda..." : "O'yinni boshlash"}
            </button>
          )}

          <button
            type="button"
            className={`host-hamburger-btn ${isMenuOpen ? "active" : ""}`}
            onClick={() => {
              setConfirmEndStep(false);
              setIsMenuOpen((prev) => !prev);
            }}
            aria-label="O'yin sozlamalari menyusi"
            aria-expanded={isMenuOpen}
            title="Sozlamalar va menyu"
          >
            <FaBars />
          </button>
        </div>
      </header>

      {isCountingDown && (
        <KahootCountdown
          quizTitle={quizTitle}
          startsAt={countdownStartsAt}
          serverOffsetMs={serverOffsetMs}
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
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`${window.location.host}/live/${pin}`)
                      .then(() => {
                        toast.success("O'yin URL manzili nusxalandi!");
                      })
                      .catch(() => {
                        toast.error("URL manzilini nusxalab bo'lmadi");
                      });
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
                    if (!pin) return;
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
                  {pin || "......"}
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

      {gameState === "question" && currentQuestion && (() => {
        const isTrueFalseQ =
          currentQuestion.type === "true_false" ||
          (currentQuestion.options?.length === 2 && !currentQuestion.type);
        const palette = isTrueFalseQ ? TRUE_FALSE_COLORS : OPTION_COLORS;
        return (
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
              {isTrueFalseQ && (
                <span className="host-tf-type-tag">To&apos;g&apos;ri / Noto&apos;g&apos;ri</span>
              )}
              <h1>{currentQuestion.text}</h1>
            </div>

            <div
              className={`host-options-grid ${isTrueFalseQ ? "true-false-grid" : ""}`}
            >
              {currentQuestion.options.map((opt, idx) => {
                const optColor = palette[idx % palette.length];
                return (
                  <div
                    key={idx}
                    className={`host-option-card ${isTrueFalseQ ? "true-false-card" : ""}`}
                    style={{ backgroundColor: optColor.bg }}
                  >
                    <span className="option-shape-icon">{optColor.shape}</span>
                    <span className="option-text-label">{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {gameState === "answer" && currentQuestion && (() => {
        const isTrueFalseQ =
          currentQuestion.type === "true_false" ||
          (currentQuestion.options?.length === 2 && !currentQuestion.type);
        const palette = isTrueFalseQ ? TRUE_FALSE_COLORS : OPTION_COLORS;
        return (
          <div className="host-answer-view">
            <div className="answer-header-box">
              <h2>Natijalar & To&apos;g&apos;ri javob</h2>
              <button
                type="button"
                className="host-next-btn"
                onClick={handleNextQuestion}
                disabled={isAdvancing}
              >
                {isAdvancing ? "Yuklanmoqda..." : "Keyingi"} <FaForward />
              </button>
            </div>

            <div
              className={`host-options-grid small ${isTrueFalseQ ? "true-false-grid" : ""}`}
            >
              {currentQuestion.options.map((opt, idx) => {
                const optColor = palette[idx % palette.length];
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
                      <span className="correct-badge">✔ To&apos;g&apos;ri</span>
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
        );
      })()}

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
                  <div
                    key={player.id || player._id || player.name || idx}
                    className="ranking-table-row"
                  >
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

      <AnimatePresence>
        {isMenuOpen && (
          <div className="host-drawer-portal">
            <motion.div
              className="host-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => {
                setIsMenuOpen(false);
                setConfirmEndStep(false);
              }}
            />

            <motion.aside
              className="host-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              aria-label="Boshlovchi menyusi"
            >
              <div className="host-drawer-header">
                <div className="host-drawer-title-group">
                  <h3>O&apos;yin boshqaruvi</h3>
                  {pin && <span className="host-drawer-pin">PIN: {pin}</span>}
                </div>
                <button
                  type="button"
                  className="host-drawer-close"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setConfirmEndStep(false);
                  }}
                  aria-label="Menyuni yopish"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="host-drawer-body">
                {/* 1. Background Picker */}
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <FaImage />
                    <span>Orqa fon rasmi</span>
                  </div>
                  <div className="drawer-bg-grid">
                    {QUIZ_BACKGROUNDS.map((bg) => {
                      const isActive = selectedBgId === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          className={`drawer-bg-card ${isActive ? "active" : ""}`}
                          onClick={() => handleSelectBackground(bg.id)}
                        >
                          <img
                            src={bg.src}
                            alt={bg.label}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="drawer-bg-overlay">
                            <span className="drawer-bg-label">{bg.label}</span>
                            {isActive && (
                              <span className="drawer-bg-check">
                                <FaCheck />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 2. Game Settings */}
                <section className="drawer-section">
                  <div className="drawer-section-header">
                    <span>O&apos;yin sozlamalari</span>
                  </div>

                  <div className="drawer-toggle-list">
                    <button
                      type="button"
                      className="drawer-toggle-row"
                      onClick={handleToggleReactions}
                    >
                      <div className="drawer-toggle-info">
                        <span className="drawer-toggle-icon">
                          <FaSmile />
                        </span>
                        <div className="drawer-toggle-text">
                          <strong>Reaksiyalar</strong>
                          <span>
                            {reactionsEnabled
                              ? "Ishtirokchilar emoji yuborishi yoqilgan"
                              : "Emoji reaksiyalar o'chirilgan"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`drawer-switch ${reactionsEnabled ? "on" : ""}`}
                      >
                        <span className="drawer-switch-knob" />
                      </span>
                    </button>

                    <button
                      type="button"
                      className="drawer-toggle-row"
                      onClick={toggleAudio}
                    >
                      <div className="drawer-toggle-info">
                        <span className="drawer-toggle-icon">
                          {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                        </span>
                        <div className="drawer-toggle-text">
                          <strong>Musiqa va ovoz</strong>
                          <span>
                            {isMuted
                              ? "Ovoz va effektlar o'chirilgan"
                              : "Musiqa va effektlar yoqilgan"}
                          </span>
                        </div>
                      </div>
                      <span className={`drawer-switch ${!isMuted ? "on" : ""}`}>
                        <span className="drawer-switch-knob" />
                      </span>
                    </button>

                    {gameState !== "ended" && (
                      <button
                        type="button"
                        className="drawer-toggle-row"
                        onClick={handleToggleRoomLock}
                      >
                        <div className="drawer-toggle-info">
                          <span className="drawer-toggle-icon">
                            {isRoomLocked ? <FaLock /> : <FaUnlock />}
                          </span>
                          <div className="drawer-toggle-text">
                            <strong>Xonani qulflash</strong>
                            <span>
                              {isRoomLocked
                                ? "Yangi ishtirokchilar kirishi yopiq"
                                : "Yangi ishtirokchilar qo'shila oladi"}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`drawer-switch ${isRoomLocked ? "on warn" : ""}`}
                        >
                          <span className="drawer-switch-knob" />
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="drawer-toggle-row"
                      onClick={handleToggleFullscreen}
                    >
                      <div className="drawer-toggle-info">
                        <span className="drawer-toggle-icon">
                          {isFullscreen ? <FaCompress /> : <FaExpand />}
                        </span>
                        <div className="drawer-toggle-text">
                          <strong>To&apos;liq ekran</strong>
                          <span>
                            {isFullscreen
                              ? "Oddiy oynaga qaytish"
                              : "Proyektor uchun keng ekran"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`drawer-switch ${isFullscreen ? "on" : ""}`}
                      >
                        <span className="drawer-switch-knob" />
                      </span>
                    </button>
                  </div>
                </section>

                {/* 3. Quick Utilities */}
                {pin && (
                  <section className="drawer-section">
                    <div className="drawer-section-header">
                      <span>Tezkor amallar</span>
                    </div>
                    <div className="drawer-actions-grid">
                      <button
                        type="button"
                        className="drawer-quick-btn"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(pin)
                            .then(() =>
                              toast.success("PIN nusxalandi: " + pin),
                            )
                            .catch(() =>
                              toast.error("PIN nusxalab bo'lmadi"),
                            );
                        }}
                      >
                        <FaCopy /> PIN nusxalash
                      </button>

                      <button
                        type="button"
                        className="drawer-quick-btn"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(`${window.location.origin}/live/${pin}`)
                            .then(() =>
                              toast.success("Qo'shilish havolasi nusxalandi!"),
                            )
                            .catch(() =>
                              toast.error("Havolani nusxalab bo'lmadi"),
                            );
                        }}
                      >
                        <FaLink /> Havola nusxalash
                      </button>

                      {gameState === "answer" && (
                        <button
                          type="button"
                          className="drawer-quick-btn primary"
                          disabled={isAdvancing}
                          onClick={() => {
                            handleNextQuestion();
                            setIsMenuOpen(false);
                          }}
                        >
                          <FaForward />{" "}
                          {isAdvancing ? "Yuklanmoqda..." : "Keyingi savol"}
                        </button>
                      )}
                    </div>
                  </section>
                )}
              </div>

              {/* Drawer Footer: End Game or Return */}
              <div className="host-drawer-footer">
                {gameState !== "ended" && isCreator ? (
                  !confirmEndStep ? (
                    <button
                      type="button"
                      className="drawer-end-btn"
                      onClick={() => setConfirmEndStep(true)}
                    >
                      <FaPowerOff /> O&apos;yinni yakunlash
                    </button>
                  ) : (
                    <div className="drawer-end-confirm">
                      <p>O&apos;yinni hozir yakunlaysizmi?</p>
                      <div className="drawer-end-confirm-btns">
                        <button
                          type="button"
                          className="drawer-confirm-yes"
                          onClick={handleConfirmEndGame}
                        >
                          Ha, yakunlash
                        </button>
                        <button
                          type="button"
                          className="drawer-confirm-no"
                          onClick={() => setConfirmEndStep(false)}
                        >
                          Bekor qilish
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className="drawer-quick-btn"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => navigate("/oyinlar")}
                  >
                    <FaArrowLeft /> O&apos;yinlarga qaytish
                  </button>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {sessionId && socket && (
        <LiveReactions
          socket={socket}
          sessionId={sessionId}
          senderName="Boshlovchi"
          showTrigger={reactionsEnabled}
          enabled={reactionsEnabled}
        />
      )}
    </div>
  );
}
