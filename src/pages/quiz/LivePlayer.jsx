import { useState, useEffect, useRef, useCallback } from "react";
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
  FaPen,
  FaTimes,
} from "react-icons/fa";

import { FaDiamond } from "react-icons/fa6";
import { getAuthToken } from "../../utils/authSession.js";

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

import hatif from "../../assets/hatif.png";

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
  { id: 11, src: quizAvatar11, name: "Qahramon 11" },
  { id: 12, src: quizAvatar12, name: "Qahramon 12" },
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

const TRUE_FALSE_COLORS = [
  { bg: "rgb(38, 137, 12)", text: "#ffffff", shape: <FaCheck /> },
  { bg: "rgb(226, 27, 60)", text: "#ffffff", shape: <FaTimes /> },
];

export default function LivePlayer() {
  const { pin: urlPin } = useParams();
  const navigate = useNavigate();

  // Join form state
  const [pin, setPin] = useState(urlPin || "");
  const [name, setName] = useState(() => {
    try {
      const token = getAuthToken();
      if (token) {
        const u = JSON.parse(localStorage.getItem("ziyo_user"));
        if (u && (u.firstName || u.lastName))
          return `${u.firstName || ""}`.trim();
        const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
        if (p && p.name) return p.name;
      }
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

  const getLoggedInUser = useCallback(() => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u && (u.firstName || u.name)) return u;
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && (p.firstName || p.name)) return p;
    } catch {}
    return null;
  }, []);

  // 'pin' | 'name'
  const [joinStep, setJoinStep] = useState(() => (urlPin ? "name" : "pin"));
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Lobby ism tahrirlash
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameVal, setEditingNameVal] = useState("");
  const nameInputRef = useRef(null);

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
  const [countdownStartsAt, setCountdownStartsAt] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const isCountingDownRef = useRef(false);
  const countdownFinishedRef = useRef(false);
  const countdownFallbackTimerRef = useRef(null);
  const pendingQuestionRef = useRef(null);
  const pendingAnswerFeedbackRef = useRef(null);
  const currentQuestionRef = useRef(null);
  const serverOffsetRef = useRef(0);
  const lastTickSecRef = useRef(null);

  // Final Ended state & Review
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [questionsReview, setQuestionsReview] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [endViewTab, setEndViewTab] = useState("leaderboard");
  const [myAnswerHistory, setMyAnswerHistory] = useState([]);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);

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

        if (
          remainingSec > 0 &&
          remainingSec <= 5 &&
          lastTickSecRef.current !== remainingSec
        ) {
          lastTickSecRef.current = remainingSec;
          sfx.playTick(true);
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
      currentQuestionRef.current = qData;
      sfx.playStart();
      setPlayerState("question");
      setCurrentQuestion(qData);
      setSelectedOption(null);
      setAnswerFeedback(null);
      pendingAnswerFeedbackRef.current = null;
      setCorrectIndex(null);
      startSyncedTimer(qData.questionEndsAt, qData.timeLimit);
    } else if (currentQuestionRef.current) {
      countdownFinishedRef.current = false;
      setIsCountingDown(false);
      isCountingDownRef.current = false;
      const qData = currentQuestionRef.current;
      sfx.playStart();
      setPlayerState("question");
      startSyncedTimer(qData.questionEndsAt, qData.timeLimit);
    } else {
      // Savol hali yetib kelmagan bo'lsa, lobby'ga qaytmasdan kutamiz va kerak bo'lsa qayta sinxronlaymiz
      countdownFinishedRef.current = true;
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
      }
      countdownFallbackTimerRef.current = setTimeout(() => {
        if (countdownFinishedRef.current) {
          const s = sessionInfoRef.current;
          if (socketRef.current?.connected && s.sessionId) {
            socketRef.current.emit("player:join", {
              sessionId: s.sessionId,
              playerId: s.playerId,
              name: s.name,
              profilePic: s.profilePic,
            });
          }
        }
      }, 2000);
    }
  }, [startSyncedTimer]);

  // Internet uzilib qayta ulanganda yoki tab qayta ochilganda sinxronizatsiya
  useEffect(() => {
    const syncPlayerSession = () => {
      const currentSocket = socketRef.current;
      if (!currentSocket) return;
      const s = sessionInfoRef.current;
      if (!s.sessionId) return;

      if (!currentSocket.connected) {
        currentSocket.connect();
      } else {
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
    };

    const handleOnline = () => {
      toast.info("Internet aloqasi tiklandi. O'yin yangilanmoqda...", {
        autoClose: 2000,
      });
      syncPlayerSession();
    };

    const handleOffline = () => {
      toast.warning("Internet uzildi! Aloqa qayta tiklanishi kutilmoqda...", {
        autoClose: 3500,
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncPlayerSession();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const connectToGame = useCallback(
    ({
      pinToUse,
      sessionIdToUse,
      playerIdToUse,
      nameToUse,
      profilePicToUse,
    }) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const activePic = profilePicToUse || quizAvatar1;

      sessionInfoRef.current = {
        pin: pinToUse,
        sessionId: sessionIdToUse,
        playerId: playerIdToUse,
        name: nameToUse,
        profilePic: activePic,
      };

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

      newSocket.on("connect", () => {
        let savedLocal = {};
        try {
          savedLocal =
            JSON.parse(localStorage.getItem("ziyo_live_player")) || {};
        } catch {}

        const s = sessionInfoRef.current;
        const currentSid =
          s.sessionId || savedLocal.sessionId || sessionIdToUse;
        const currentPid =
          s.playerId ||
          (savedLocal.sessionId === currentSid ? savedLocal.playerId : null);
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
        syncServerClock(data.serverTime);
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
        if (typeof data.reactionsEnabled === "boolean") {
          setReactionsEnabled(data.reactionsEnabled);
        }
        if (Array.isArray(data.myAnswerHistory)) {
          setMyAnswerHistory(data.myAnswerHistory);
        }

        try {
          localStorage.setItem(
            "ziyo_live_player",
            JSON.stringify({
              pin: sessionInfoRef.current.pin || pinToUse,
              sessionId: sessionInfoRef.current.sessionId || sessionIdToUse,
              playerId: data.playerId,
              name: data.name || sessionInfoRef.current.name || nameToUse,
              profilePic:
                data.profilePic ||
                sessionInfoRef.current.profilePic ||
                activePic,
            }),
          );
        } catch {}

        setIsJoining(false);
        setErrorMsg("");

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
          setPlayerState("lobby");
          if (data.score !== undefined) setTotalScore(data.score);
        } else if (data.status === "question" && data.currentQuestion) {
          if (countdownFallbackTimerRef.current) {
            clearTimeout(countdownFallbackTimerRef.current);
            countdownFallbackTimerRef.current = null;
          }
          countdownFinishedRef.current = false;
          setIsCountingDown(false);
          isCountingDownRef.current = false;
          pendingQuestionRef.current = null;
          currentQuestionRef.current = data.currentQuestion;
          setCurrentQuestion(data.currentQuestion);
          setCorrectIndex(null);
          setAnswerFeedback(null);
          startSyncedTimer(
            data.questionEndsAt || data.currentQuestion.questionEndsAt,
            data.timeLeft ?? data.currentQuestion.timeLimit,
          );
          if (data.score !== undefined) {
            setTotalScore(data.score);
          }
          if (data.hasAnswered) {
            setSelectedOption(data.chosenIndex);
            setPlayerState("answered");
            if (data.myAnswer) {
              pendingAnswerFeedbackRef.current = {
                ...data.myAnswer,
                questionIndex: data.currentQuestion.questionIndex,
              };
            }
          } else {
            pendingAnswerFeedbackRef.current = null;
            setSelectedOption(null);
            setPlayerState("question");
          }
        } else if (data.status === "answer" && data.currentQuestion) {
          setIsCountingDown(false);
          isCountingDownRef.current = false;
          pendingQuestionRef.current = null;
          clearQuestionTimer();
          currentQuestionRef.current = data.currentQuestion;
          setCurrentQuestion(data.currentQuestion);
          setCorrectIndex(data.correctIndex);
          setAnswerFeedback(data.myAnswer);
          setPlayerState("answer_result");
          if (data.score !== undefined) setTotalScore(data.score);
          if (data.myRank) setCurrentRank(data.myRank);
          if (data.totalPlayers) setTotalPlayersCount(data.totalPlayers);
        } else if (data.status === "ended") {
          setIsCountingDown(false);
          isCountingDownRef.current = false;
          pendingQuestionRef.current = null;
          clearQuestionTimer();
          setPlayerState("ended");
          if (data.score !== undefined) setTotalScore(data.score);
          if (data.leaderboard) setFinalLeaderboard(data.leaderboard);
          if (data.questionsReview) setQuestionsReview(data.questionsReview);
          if (data.myRank) setMyRank(data.myRank);
        } else {
          setIsCountingDown(false);
          isCountingDownRef.current = false;
          pendingQuestionRef.current = null;
          clearQuestionTimer();
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

      newSocket.on("player:name:updated", (data) => {
        const currentPid = sessionInfoRef.current.playerId;
        if (data.playerId === currentPid) {
          setName(data.name);
          sessionInfoRef.current.name = data.name;
          try {
            const saved = JSON.parse(
              localStorage.getItem("ziyo_live_player") || "{}",
            );
            saved.name = data.name;
            localStorage.setItem("ziyo_live_player", JSON.stringify(saved));
          } catch {}
        }
      });

      newSocket.on("player:name:error", (data) => {
        if (data?.msg) toast.warning(data.msg);
      });

      newSocket.on("session:reactions-toggled", (data) => {
        setReactionsEnabled(data?.reactionsEnabled !== false);
      });

      newSocket.on("player:join:error", (data) => {
        const msg = data?.msg || "O'yinga qo'shilishda xatolik";
        setErrorMsg(msg);
        toast.error(msg);
        setIsJoining(false);
        if (
          msg.includes("topilmadi") ||
          msg.includes("yakunlangan") ||
          msg.includes("boshlangan") ||
          msg.includes("qulflangan") ||
          msg.includes("allaqachon band")
        ) {
          localStorage.removeItem("ziyo_live_player");
          sessionInfoRef.current.playerId = null;
          setPlayerState("join");
          setJoinStep("name");
        }
      });

      newSocket.on("game:started", (data) => {
        syncServerClock(data?.serverTime);
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
          currentQuestionRef.current = data;
          sfx.playStart();
          setPlayerState("question");
          setCurrentQuestion(data);
          setSelectedOption(null);
          setAnswerFeedback(null);
          pendingAnswerFeedbackRef.current = null;
          setCorrectIndex(null);
          startSyncedTimer(data.questionEndsAt, data.timeLimit);
        }
      });

      newSocket.on("player:answer:ok", (data) => {
        pendingAnswerFeedbackRef.current = data;
      });

      newSocket.on("player:answer:error", (data) => {
        const activeQIdx = currentQuestionRef.current?.questionIndex;
        if (
          data?.questionIndex !== undefined &&
          data.questionIndex !== activeQIdx
        ) {
          return;
        }
        if (data?.msg) {
          toast.warning(data.msg);
        }
        if (!data?.msg?.includes("tugagan") && !data?.msg?.includes("Vaqt")) {
          setSelectedOption(null);
          setPlayerState("question");
        }
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
        setCorrectIndex(data.correctIndex);

        const rawFeedback = pendingAnswerFeedbackRef.current;
        const feedback =
          rawFeedback &&
          (rawFeedback.questionIndex === undefined ||
            rawFeedback.questionIndex === data.questionIndex)
            ? rawFeedback
            : null;
        pendingAnswerFeedbackRef.current = null;

        const lb = data.allLeaderboard || data.leaderboard || [];
        const myPid = sessionInfoRef.current.playerId;
        const myName = (sessionInfoRef.current.name || "").trim().toLowerCase();
        const foundIdx = lb.findIndex(
          (p) =>
            (myPid && p.id && String(p.id) === String(myPid)) ||
            (myName && p.name && p.name.trim().toLowerCase() === myName),
        );
        const lbPlayer = foundIdx !== -1 ? lb[foundIdx] : null;

        if (feedback) {
          setAnswerFeedback(feedback);
          if (feedback.isCorrect) {
            sfx.playCorrect();
          } else {
            sfx.playWrong();
          }
          if (lbPlayer && typeof lbPlayer.score === "number") {
            setTotalScore(lbPlayer.score);
          } else if (typeof feedback.score === "number") {
            setTotalScore(feedback.score);
          }
          if (feedback.totalPlayers) {
            setTotalPlayersCount(feedback.totalPlayers);
          }
        } else {
          sfx.playWrong();
          setAnswerFeedback({
            isCorrect: false,
            pointsEarned: 0,
            noAnswer: true,
          });
          if (lbPlayer && typeof lbPlayer.score === "number") {
            setTotalScore(lbPlayer.score);
          }
        }

        if (foundIdx !== -1) {
          setCurrentRank(foundIdx + 1);
          setTotalPlayersCount(data.totalPlayers || lb.length);
        } else if (feedback?.rank) {
          setCurrentRank(feedback.rank);
        }

        setPlayerState("answer_result");
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
        pendingAnswerFeedbackRef.current = null;
        setPlayerState("ended");
        setFinalLeaderboard(data.leaderboard || []);
        if (data.questionsReview) {
          setQuestionsReview(data.questionsReview);
        }

        const myPid = sessionInfoRef.current.playerId;
        const currentPlayerName = (
          sessionInfoRef.current.name ||
          nameToUse ||
          ""
        )
          .trim()
          .toLowerCase();

        const found = data.leaderboard?.findIndex(
          (p) =>
            (myPid && p.id && String(p.id) === String(myPid)) ||
            (currentPlayerName &&
              p.name?.trim().toLowerCase() === currentPlayerName),
        );
        if (found !== -1 && found !== undefined) {
          const me = data.leaderboard[found];
          setMyRank(found + 1);
          if (typeof me?.score === "number") {
            setTotalScore(me.score);
          }
          if (Array.isArray(me?.answers)) {
            setMyAnswerHistory(me.answers);
          }
          if (found < 3) {
            sfx.playFanfare();
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          }
        }
      });
    },
    [syncServerClock, clearQuestionTimer, startSyncedTimer],
  );

  // Bosqich 1: O'yin kodini tekshirish
  const handlePinSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setErrorMsg("");

    const cleanPin = pin.trim();
    if (!cleanPin) {
      setErrorMsg("Iltimos, o'yin kodini kiriting!");
      return;
    }

    setIsVerifyingPin(true);
    try {
      const res = await joinByPin(cleanPin);
      if (!res || !res.sessionId) {
        const msg = "Bunday kodli faol o'yin topilmadi!";
        setErrorMsg(msg);
        toast.error(msg);
        setIsVerifyingPin(false);
        return;
      }

      setSessionId(res.sessionId);
      if (res.quizTitle || res.title) setQuizTitle(res.quizTitle || res.title);

      setJoinStep("name");
      setIsVerifyingPin(false);
    } catch (err) {
      const msg = err.message || "Bunday kodli faol o'yin topilmadi!";
      setErrorMsg(msg);
      toast.error(msg);
      setIsVerifyingPin(false);
    }
  };

  // Bosqich 2: Ism kiritilgandan so'ng o'yinga ulanish
  const handleNameSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setErrorMsg("");

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg("Iltimos, ismingizni kiriting!");
      return;
    }

    setIsJoining(true);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const res = await joinByPin(pin.trim());
        if (!res || !res.sessionId) {
          const msg = "Bunday o'yin topilmadi!";
          setErrorMsg(msg);
          toast.error(msg);
          setIsJoining(false);
          return;
        }
        targetSessionId = res.sessionId;
        setSessionId(res.sessionId);
        if (res.quizTitle || res.title) {
          setQuizTitle(res.quizTitle || res.title);
        }
      }

      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
      } catch {}

      const existingPlayerId =
        saved && saved.sessionId === targetSessionId ? saved.playerId : null;

      connectToGame({
        pinToUse: pin.trim(),
        sessionIdToUse: targetSessionId,
        playerIdToUse: existingPlayerId,
        nameToUse: cleanName,
        profilePicToUse: profilePic,
      });
    } catch (err) {
      const msg = err.message || "Ulanishda xatolik yuz berdi";
      setErrorMsg(msg);
      toast.error(msg);
      setIsJoining(false);
    }
  };

  // Lobbyda ismni ruchka orqali tahrirlash
  const handleSaveName = () => {
    const trimmed = (editingNameVal || "").trim();
    if (!trimmed) {
      toast.warning("Ism bo'sh bo'lishi mumkin emas!");
      setIsEditingName(false);
      return;
    }
    if (trimmed !== name) {
      setName(trimmed);
      sessionInfoRef.current.name = trimmed;

      try {
        const saved = JSON.parse(
          localStorage.getItem("ziyo_live_player") || "{}",
        );
        saved.name = trimmed;
        localStorage.setItem("ziyo_live_player", JSON.stringify(saved));
      } catch {}

      const activeSocket = socketRef.current || socket;
      if (activeSocket && sessionId && playerId) {
        activeSocket.emit("player:update-name", {
          sessionId,
          playerId,
          name: trimmed,
        });
      }
      toast.success("Ismingiz yangilandi! ✨");
    }
    setIsEditingName(false);
  };

  // URL orqali kirilganda va sessiyani qayta tiklash
  useEffect(() => {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("ziyo_live_player"));
    } catch {}

    if (
      saved &&
      saved.sessionId &&
      saved.pin &&
      urlPin &&
      urlPin.trim() === saved.pin
    ) {
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

      return () => {
        clearQuestionTimer();
        if (countdownFallbackTimerRef.current) {
          clearTimeout(countdownFallbackTimerRef.current);
          countdownFallbackTimerRef.current = null;
        }
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }

    if (urlPin) {
      const cleanPin = urlPin.trim();
      setPin(cleanPin);

      const loggedUser = getLoggedInUser();
      const accountName = loggedUser?.firstName
        ? `${loggedUser.firstName || ""}`.trim()
        : loggedUser?.name || "";

      if (loggedUser && accountName && !hasAutoJoinedUrlPinRef.current) {
        hasAutoJoinedUrlPinRef.current = true;
        setName(accountName);
        setIsJoining(true);

        joinByPin(cleanPin)
          .then((res) => {
            if (res && res.sessionId) {
              setSessionId(res.sessionId);
              if (res.quizTitle || res.title) {
                setQuizTitle(res.quizTitle || res.title);
              }
              connectToGame({
                pinToUse: cleanPin,
                sessionIdToUse: res.sessionId,
                playerIdToUse: null,
                nameToUse: accountName,
                profilePicToUse: loggedUser.profilePic || quizAvatar1,
              });
            } else {
              setErrorMsg("Bunday o'yin topilmadi!");
              setIsJoining(false);
              setJoinStep("name");
            }
          })
          .catch((err) => {
            setErrorMsg(err.message || "Ulanishda xatolik yuz berdi");
            setIsJoining(false);
            setJoinStep("name");
          });
      } else {
        setJoinStep("name");
      }
    } else {
      setJoinStep("pin");
    }

    return () => {
      clearQuestionTimer();
      if (countdownFallbackTimerRef.current) {
        clearTimeout(countdownFallbackTimerRef.current);
        countdownFallbackTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [urlPin, connectToGame, clearQuestionTimer, getLoggedInUser]);

  const handleSelectAvatar = (avatarSrc) => {
    setProfilePic(avatarSrc);
    sessionInfoRef.current.profilePic = avatarSrc;

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
    if (selectedOption !== null || timeLeft <= 0 || !currentQuestion) return;

    const activeSocket = socketRef.current || socket;
    if (!activeSocket || !activeSocket.connected) {
      toast.warning("Server bilan aloqa uzilgan, qayta ulanilmoqda...");
      activeSocket?.connect();
      return;
    }

    if (!sessionId || !playerId) return;

    setSelectedOption(index);
    setPlayerState("answered");

    const qIdx = currentQuestion.questionIndex;
    setMyAnswerHistory((prev) => {
      const filtered = prev.filter((item) => item.questionIndex !== qIdx);
      return [...filtered, { questionIndex: qIdx, chosenIndex: index }];
    });

    activeSocket.emit("player:answer", {
      sessionId,
      playerId,
      questionIndex: qIdx,
      chosenIndex: index,
    });
  };

  const handleExitGame = () => {
    localStorage.removeItem("ziyo_live_player");
    clearQuestionTimer();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    navigate("/");
  };

  return (
    <div className="live-player-layout">
      {/* ==================== KAHOOT COUNTDOWN OVERLAY ==================== */}
      {isCountingDown && (
        <KahootCountdown
          quizTitle={quizTitle || "Hatif Quiz"}
          startsAt={countdownStartsAt}
          serverOffsetMs={serverOffsetMs}
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
            <img src={hatif} alt="" />
            {joinStep === "pin" ? (
              <form onSubmit={handlePinSubmit} className="player-join-form">
                {errorMsg && <div className="join-error-text">{errorMsg}</div>}
                <div className="join-input-group">
                  <label>O'YIN KODI (PIN)</label>
                  <input
                    type="text"
                    placeholder="Kodni kiritish"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={10}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="player-enter-btn"
                  disabled={isVerifyingPin}
                >
                  {isVerifyingPin ? "Tekshirilmoqda..." : "Qo'shilish"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleNameSubmit} className="player-join-form">
                <div className="join-pin-preview-chip">
                  <span>
                    KOD: <strong>{pin}</strong>
                  </span>
                  {!urlPin && (
                    <button
                      type="button"
                      className="join-pin-change-btn"
                      onClick={() => {
                        setJoinStep("pin");
                        setErrorMsg("");
                      }}
                    >
                      O'zgartirish
                    </button>
                  )}
                </div>
                {errorMsg && <div className="join-error-text">{errorMsg}</div>}

                <div className="join-input-group">
                  <label>SIZNING ISMINGIZ</label>
                  <input
                    type="text"
                    placeholder="Ismingiz yoki taxallusingiz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="player-enter-btn"
                  disabled={isJoining}
                >
                  {isJoining ? "Ulanmoqda..." : "Qo'shilish"}
                </button>
              </form>
            )}
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

            <h2>
              Siz o'yindasiz,{" "}
              {isEditingName ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveName();
                  }}
                  className="lobby-name-inline-form"
                >
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="lobby-name-inline-input"
                    value={editingNameVal}
                    onChange={(e) => setEditingNameVal(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveName();
                      } else if (e.key === "Escape") {
                        setIsEditingName(false);
                      }
                    }}
                    maxLength={25}
                    autoFocus
                  />
                </form>
              ) : (
                <span className="lobby-name-inline-wrap">
                  <span
                    className="lobby-name-highlight"
                    onClick={() => {
                      setEditingNameVal(name);
                      setIsEditingName(true);
                    }}
                    title="Ismni tahrirlash uchun bosing"
                  >
                    {name}
                  </span>
                  <button
                    type="button"
                    className="lobby-name-edit-btn"
                    onClick={() => {
                      setEditingNameVal(name);
                      setIsEditingName(true);
                    }}
                    title="Ismni tahrirlash"
                  >
                    <FaPen className="lobby-pen-icon" />
                  </button>
                </span>
              )}
            </h2>
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
        currentQuestion && (() => {
          const isTrueFalseQ =
            currentQuestion.type === "true_false" ||
            (currentQuestion.options?.length === 2 && !currentQuestion.type);
          const palette = isTrueFalseQ ? TRUE_FALSE_COLORS : OPTION_COLORS;
          return (
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
                {isTrueFalseQ && (
                  <span className="player-tf-badge">To&apos;g&apos;ri / Noto&apos;g&apos;ri</span>
                )}
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

              <div
                className={`player-options-grid ${isTrueFalseQ ? "true-false-grid" : ""}`}
              >
                {currentQuestion.options.map((opt, idx) => {
                  const color = palette[idx % palette.length];
                  const isSelected = selectedOption === idx;

                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`player-option-btn ${
                        isTrueFalseQ ? "true-false-btn" : ""
                      } ${isSelected ? "selected" : ""}`}
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
          );
        })()}

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
                    (playerId && p.id && String(p.id) === String(playerId)) ||
                    (name &&
                      p.name?.trim().toLowerCase() ===
                        name?.trim().toLowerCase());
                  const pAvatar = isCurrent
                    ? profilePic || p.profilePic
                    : p.profilePic;

                  return (
                    <div
                      key={p.id || idx}
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

      {playerState !== "join" && sessionId && socket && (
        <LiveReactions
          socket={socket}
          sessionId={sessionId}
          senderName={name || "O'yinchi"}
          showTrigger={reactionsEnabled}
          enabled={reactionsEnabled}
        />
      )}
    </div>
  );
}
