import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import confetti from "canvas-confetti";
import {
  IoArrowBack,
  IoFlash,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoTrophyOutline,
  IoRefreshOutline,
  IoFlame,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { LuSword } from "react-icons/lu";
import { sfx } from "../../utils/soundEffects.js";
import "./OctagonBattle.css";

// Fallback questions if offline/standalone testing
import { getBattleQuestions } from "../../../server/socket/octagonQuestions.js";

const STAGES = {
  MATCHMAKING: "MATCHMAKING",
  COUNTDOWN: "COUNTDOWN",
  BATTLE: "BATTLE",
  ROUND_RESULT: "ROUND_RESULT",
  GAME_OVER: "GAME_OVER",
};

export default function OctagonBattle() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "matematika";
  const navigate = useNavigate();

  // Foydalanuvchi
  const token = localStorage.getItem("token") || "";
  const currentUser = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u) return u;
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p) return p;
    } catch {}
    return { firstName: "Siz", xp: 100 };
  })();

  // States
  const [stage, setStage] = useState(STAGES.MATCHMAKING);
  const [matchData, setMatchData] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [countdown, setCountdown] = useState(3);

  // Question & Round States
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(12);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [roundResult, setRoundResult] = useState(null);

  // Scores
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  // Final Results
  const [finalResult, setFinalResult] = useState(null);

  // Connection status for UI feedback
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // "connecting" | "connected" | "offline"

  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const localQuestionsRef = useRef([]);

  // --- FIX 1: Ref'lar bilan stale closure muammosini hal qilish ---
  // "youAre" — "player1" yoki "player2" (socket event'da keladi)
  const youAreRef = useRef("player1");
  // standalone mode allaqachon boshlangami?
  const standaloneModeStartedRef = useRef(false);
  // stage'ni ref'da ham saqlash (closure uchun)
  const stageRef = useRef(STAGES.MATCHMAKING);
  // matchData ref (submit_answer uchun)
  const matchDataRef = useRef(null);
  const currentQIndexRef = useRef(0);
  const timeLeftRef = useRef(12);
  const hasAnsweredRef = useRef(false);
  const myScoreRef = useRef(0);
  const opponentScoreRef = useRef(0);

  // Ref'larni state bilan sinxronlash
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { matchDataRef.current = matchData; }, [matchData]);
  useEffect(() => { currentQIndexRef.current = currentQIndex; }, [currentQIndex]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { hasAnsweredRef.current = hasAnswered; }, [hasAnswered]);
  useEffect(() => { myScoreRef.current = myScore; }, [myScore]);
  useEffect(() => { opponentScoreRef.current = opponentScore; }, [opponentScore]);

  // --- FIX 2: Standalone Bot Fallback ---
  const startStandaloneBotMode = useCallback(() => {
    // Bir martadan ko'p ishlamasligi uchun guard
    if (standaloneModeStartedRef.current) return;
    // Agar allaqachon match topilgan bo'lsa, bot mode kerak emas
    if (stageRef.current !== STAGES.MATCHMAKING) return;

    standaloneModeStartedRef.current = true;

    setTimeout(() => {
      // Oxirgi tekshiruv
      if (stageRef.current !== STAGES.MATCHMAKING) return;

      const bot = {
        name: "Temur_Pro",
        xp: Math.floor(Math.random() * 300) + 120,
        profilePic: "https://api.dicebear.com/7.x/bottts/svg?seed=Temur",
      };
      setOpponent(bot);
      setStage(STAGES.COUNTDOWN);
      stageRef.current = STAGES.COUNTDOWN;
      setConnectionStatus("offline");

      const qs = getBattleQuestions(category, 10);
      localQuestionsRef.current = qs;

      let c = 3;
      setCountdown(c);
      const cInt = setInterval(() => {
        c -= 1;
        if (c > 0) {
          setCountdown(c);
          sfx.playTick();
        } else {
          clearInterval(cInt);
          sfx.playStart();
          loadLocalQuestion(0);
        }
      }, 1000);
    }, 2500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const loadLocalQuestion = (idx) => {
    if (idx >= 10) {
      finishLocalBattle();
      return;
    }
    const q = localQuestionsRef.current[idx];
    setStage(STAGES.BATTLE);
    stageRef.current = STAGES.BATTLE;
    setCurrentQIndex(idx);
    currentQIndexRef.current = idx;
    setCurrentQuestion({
      questionIndex: idx,
      totalQuestions: 10,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      timeLimit: 12,
    });
    setTimeLeft(12);
    timeLeftRef.current = 12;
    setSelectedOption(null);
    setHasAnswered(false);
    hasAnsweredRef.current = false;
    setOpponentAnswered(false);
    setRoundResult(null);

    // Bot simulyatsiyasi
    const botDelay = Math.floor(Math.random() * 4000) + 3500;
    setTimeout(() => {
      setOpponentAnswered(true);
      const isCorrect = Math.random() < 0.7;
      if (isCorrect) {
        setOpponentScore((prev) => {
          const newVal = prev + 140;
          opponentScoreRef.current = newVal;
          return newVal;
        });
      }
    }, botDelay);
  };

  // Socket Connection
  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_API_URL || "https://ziyo.onrender.com";

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      // FIX: timeout va reconnect sozlamalari
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
      // Qayta ulanganda ham navbatga qo'shish
      if (stageRef.current === STAGES.MATCHMAKING) {
        socket.emit("octagon:join_queue", {
          category,
          user: {
            // "me" yubormaslik — server socket.id ni fallback sifatida ishlatadi
            id: currentUser._id || currentUser.id || "",
            firstName: currentUser.firstName || currentUser.name || "Siz",
            lastName: currentUser.lastName || "",
            profilePic: currentUser.profilePic || "",
            xp: currentUser.xp || 0,
          },
        });
      }
    });

    // Raqib topildi
    socket.on("octagon:match_found", (data) => {
      // FIX: youAre ni ref'da saqlash (player1 yoki player2)
      youAreRef.current = data.youAre || "player1";
      setMatchData(data);
      matchDataRef.current = data;
      setOpponent(data.opponent);
      setStage(STAGES.COUNTDOWN);
      stageRef.current = STAGES.COUNTDOWN;

      // 3 soniya countdown
      let count = 3;
      setCountdown(count);
      const cInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
          sfx.playTick();
        } else {
          clearInterval(cInterval);
          sfx.playStart();
        }
      }, 1000);
    });

    // Savol kelishi
    socket.on("octagon:question", (qData) => {
      setStage(STAGES.BATTLE);
      stageRef.current = STAGES.BATTLE;
      setCurrentQIndex(qData.questionIndex);
      currentQIndexRef.current = qData.questionIndex;
      setCurrentQuestion(qData);
      setTimeLeft(qData.timeLimit || 12);
      timeLeftRef.current = qData.timeLimit || 12;
      setSelectedOption(null);
      setHasAnswered(false);
      hasAnsweredRef.current = false;
      setOpponentAnswered(false);
      setRoundResult(null);
    });

    // Raqib javob bergani
    socket.on("octagon:opponent_answered", () => {
      setOpponentAnswered(true);
    });

    // --- FIX 3: Raund yakuni — youAre asosida to'g'ri score ---
    socket.on("octagon:round_result", (rData) => {
      setStage(STAGES.ROUND_RESULT);
      stageRef.current = STAGES.ROUND_RESULT;
      setRoundResult(rData);

      const isPlayer1 = youAreRef.current !== "player2";
      const myNewScore = isPlayer1 ? rData.player1.score : rData.player2.score;
      const oppNewScore = isPlayer1 ? rData.player2.score : rData.player1.score;

      setMyScore(myNewScore);
      myScoreRef.current = myNewScore;
      setOpponentScore(oppNewScore);
      opponentScoreRef.current = oppNewScore;
    });

    // Jang yakuni
    socket.on("octagon:battle_finished", (fData) => {
      setStage(STAGES.GAME_OVER);
      stageRef.current = STAGES.GAME_OVER;
      setFinalResult(fData);

      // LocalStorage XP ni yangilash
      try {
        const u = JSON.parse(localStorage.getItem("ziyo_user") || "{}");
        const newXp = Math.max(0, (u.xp || 0) + fData.xpChange);
        u.xp = newXp;
        localStorage.setItem("ziyo_user", JSON.stringify(u));
      } catch {}

      if (fData.result === "victory") {
        sfx.playFanfare();
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      } else {
        sfx.playWrong();
      }
    });

    // connect_error — bir necha marta urinib ko'rish, darhol bot mode emas
    let connectErrorCount = 0;
    socket.on("connect_error", () => {
      connectErrorCount += 1;
      setConnectionStatus("connecting");
      // Faqat 5 ta urinishdan so'ng standalone mode'ga o'tish
      // (server 25s da bot bilan o'zi match qiladi, shuning uchun
      //  connect_error faqat server butunlay ishlamasa ishga tushadi)
      if (connectErrorCount >= 5) {
        startStandaloneBotMode();
      }
    });

    // Fallback timer — server bot timeout (25s) dan KEYIN ishga tushadi
    // Agar server ulangan bo'lsa va real player topilmasa, server 25s da bot
    // bilan match qiladi va octagon:match_found keladi.
    // Bu timer faqat server javob bermagan holatda (server dead) kerak.
    const fallbackTimer = setTimeout(() => {
      if (stageRef.current === STAGES.MATCHMAKING) {
        startStandaloneBotMode();
      }
    }, 30000);

    return () => {
      clearTimeout(fallbackTimer);
      clearInterval(timerRef.current);
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Savol taymeri
  useEffect(() => {
    if (stage === STAGES.BATTLE && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeExpire();
            return 0;
          }
          if (prev <= 4) sfx.playTick(true);
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentQIndex]);

  const handleTimeExpire = () => {
    if (!hasAnsweredRef.current) {
      handleAnswerSelect(-1); // time expired
    }
  };

  // Javob tanlash
  const handleAnswerSelect = (optionIndex) => {
    if (hasAnsweredRef.current) return;
    setHasAnswered(true);
    hasAnsweredRef.current = true;
    setSelectedOption(optionIndex);

    const currentSocket = socketRef.current;
    const currentMatchData = matchDataRef.current;

    // Agar socket ulangan bo'lsa
    if (currentSocket?.connected && currentMatchData?.roomId) {
      currentSocket.emit("octagon:submit_answer", {
        roomId: currentMatchData.roomId,
        questionIndex: currentQIndexRef.current,
        answerIndex: optionIndex,
        timeRemaining: timeLeftRef.current,
      });
    } else {
      // Local bot mode
      setCurrentQuestion((cq) => {
        const isCorrect = optionIndex === cq?.correctIndex;
        const points = isCorrect ? 100 + timeLeftRef.current * 10 : 0;
        if (isCorrect) {
          sfx.playCorrect();
          setMyScore((prev) => {
            const newVal = prev + points;
            myScoreRef.current = newVal;
            return newVal;
          });
        } else {
          sfx.playWrong();
        }

        setRoundResult({ correctIndex: cq?.correctIndex });
        setStage(STAGES.ROUND_RESULT);
        stageRef.current = STAGES.ROUND_RESULT;

        setTimeout(() => {
          loadLocalQuestion(currentQIndexRef.current + 1);
        }, 2000);

        return cq;
      });
    }
  };

  // Local game over
  const finishLocalBattle = () => {
    setStage(STAGES.GAME_OVER);
    stageRef.current = STAGES.GAME_OVER;

    const finalMy = myScoreRef.current;
    const finalOpp = opponentScoreRef.current;

    const win = finalMy > finalOpp;
    const draw = finalMy === finalOpp;
    const xp = win ? 30 : draw ? 10 : -15;

    // XP update
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user") || "{}");
      u.xp = Math.max(0, (u.xp || 0) + xp);
      localStorage.setItem("ziyo_user", JSON.stringify(u));
    } catch {}

    const payload = {
      result: win ? "victory" : draw ? "draw" : "defeat",
      xpChange: xp,
      yourScore: finalMy,
      opponentScore: finalOpp,
      opponent: opponent || { name: "Raqib" },
    };
    setFinalResult(payload);

    if (win) {
      sfx.playFanfare();
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    } else {
      sfx.playWrong();
    }
  };

  // Navbatdan chiqish
  const handleLeaveQueue = () => {
    if (socketRef.current) {
      socketRef.current.emit("octagon:leave_queue");
    }
    navigate("/oktagon");
  };

  return (
    <div className="octagon-battle-page">
      {/* 1. MATCHMAKING SCREEN */}
      {stage === STAGES.MATCHMAKING && (
        <div className="battle-matchmaking-view">
          <div className="matchmaking-card">
            <div className="radar-circle-wrap">
              <div className="radar-ripple ripple-1"></div>
              <div className="radar-ripple ripple-2"></div>
              <div className="radar-center-icon">
                <LuSword />
              </div>
            </div>

            <span className="matchmaking-tag">
              <IoFlame /> {category.toUpperCase()} ARENASI
            </span>
            <h2 className="matchmaking-title">Raqib qidirilmoqda...</h2>
            <p className="matchmaking-desc">
              {connectionStatus === "connecting"
                ? "Serverga ulanilmoqda..."
                : "Tizim sizga munosib raqibni qidirmoqda. Bir necha soniya kuting."}
            </p>

            {/* Connection status indicator */}
            <div className={`connection-dot ${connectionStatus}`} style={{
              width: 10, height: 10, borderRadius: "50%", margin: "8px auto",
              background: connectionStatus === "connected" ? "#22c55e"
                : connectionStatus === "offline" ? "#ef4444" : "#f59e0b",
            }} />

            <button
              type="button"
              className="matchmaking-cancel-btn"
              onClick={handleLeaveQueue}
            >
              <IoArrowBack /> Qidiruvni bekor qilish
            </button>
          </div>
        </div>
      )}

      {/* 2. COUNTDOWN SCREEN */}
      {stage === STAGES.COUNTDOWN && (
        <div className="battle-countdown-view">
          <div className="vs-match-card">
            <div className="vs-players-row">
              {/* You */}
              <div className="vs-player-box you">
                <div className="vs-avatar-circle">
                  <span>{currentUser.firstName?.[0] || "S"}</span>
                </div>
                <h3 className="vs-name">{currentUser.firstName || "Siz"}</h3>
                <span className="vs-xp">{currentUser.xp || 0} XP</span>
              </div>

              {/* VS BADGE */}
              <div className="vs-center-badge">
                <span className="vs-text">VS</span>
                <span className="vs-count-num">{countdown}</span>
              </div>

              {/* Opponent */}
              <div className="vs-player-box rival">
                <div className="vs-avatar-circle rival">
                  <span>{opponent?.name?.[0] || "R"}</span>
                </div>
                <h3 className="vs-name">{opponent?.name || "Raqib"}</h3>
                <span className="vs-xp">{opponent?.xp || 0} XP</span>
              </div>
            </div>

            <div className="vs-ready-notice">Jang boshlanmoqda! Tayyorlaning!</div>
          </div>
        </div>
      )}

      {/* 3. BATTLE ARENA (10 QUESTIONS) */}
      {(stage === STAGES.BATTLE || stage === STAGES.ROUND_RESULT) && currentQuestion && (
        <div className="battle-arena-view">
          {/* Top Fighters Bar */}
          <header className="arena-top-header">
            <div className="fighter-badge you">
              <div className="fighter-avatar">
                {currentUser.firstName?.[0] || "S"}
              </div>
              <div className="fighter-info">
                <span className="fighter-name">{currentUser.firstName || "Siz"}</span>
                <span className="fighter-score">{myScore} ball</span>
              </div>
            </div>

            {/* Middle: Question counter & timer */}
            <div className="arena-center-status">
              <span className="question-step-badge">
                Savol {currentQIndex + 1} / 10
              </span>
              <div className={`arena-timer-pill ${timeLeft <= 4 ? "urgent" : ""}`}>
                ⏱ {timeLeft}s
              </div>
            </div>

            <div className="fighter-badge rival">
              <div className="fighter-info text-right">
                <span className="fighter-name">{opponent?.name || "Raqib"}</span>
                <span className="fighter-score">{opponentScore} ball</span>
              </div>
              <div className="fighter-avatar rival">
                {opponent?.name?.[0] || "R"}
              </div>
            </div>
          </header>

          {/* Opponent Answered Indicator */}
          <div className="opponent-status-strip">
            {opponentAnswered ? (
              <span className="opp-indicator ready">
                ⚡ {opponent?.name || "Raqib"} javob berdi!
              </span>
            ) : (
              <span className="opp-indicator waiting">
                💭 {opponent?.name || "Raqib"} o'ylamoqda...
              </span>
            )}
          </div>

          {/* Question Banner */}
          <div className="arena-question-card">
            <span className="q-category-tag">100 ball + Tezlik bonusi</span>
            <h2 className="arena-question-text">{currentQuestion.text}</h2>
          </div>

          {/* Options Grid */}
          <div className="arena-options-grid">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              let btnClass = "";

              if (stage === STAGES.ROUND_RESULT && roundResult) {
                if (idx === roundResult.correctIndex) {
                  btnClass = "is-correct";
                } else if (isSelected) {
                  btnClass = "is-wrong";
                } else {
                  btnClass = "is-dimmed";
                }
              } else if (isSelected) {
                btnClass = "is-selected";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  className={`arena-opt-btn ${btnClass}`}
                  disabled={hasAnswered}
                  onClick={() => handleAnswerSelect(idx)}
                >
                  <span className="opt-number-char">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="opt-text-val">{opt}</span>

                  {stage === STAGES.ROUND_RESULT && idx === roundResult?.correctIndex && (
                    <IoCheckmarkCircle className="opt-icon-status success" />
                  )}
                  {stage === STAGES.ROUND_RESULT && isSelected && idx !== roundResult?.correctIndex && (
                    <IoCloseCircle className="opt-icon-status error" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. GAME OVER / RESULT VIEW */}
      {stage === STAGES.GAME_OVER && finalResult && (
        <div className="battle-result-view">
          <div className="result-card">
            <div className={`result-icon-badge ${finalResult.result}`}>
              <IoTrophyOutline />
            </div>

            <span className="result-subtitle">Oktagon dueli yakunlandi</span>
            <h1 className="result-title">
              {finalResult.result === "victory"
                ? "G'alaba! Qoyilmaqom! 🏆"
                : finalResult.result === "defeat"
                ? "Mag'lubiyat! Keyingi safar yutasiz!"
                : "Durang! Teng kurash!"}
            </h1>

            {/* XP Badge */}
            <div
              className={`xp-change-pill ${
                finalResult.xpChange > 0 ? "positive" : "negative"
              }`}
            >
              {finalResult.xpChange > 0
                ? `+${finalResult.xpChange} XP qo'shildi`
                : `${finalResult.xpChange} XP yechildi`}
            </div>

            {/* Score Comparison Box */}
            <div className="result-score-comparison">
              <div className="comparison-box you">
                <span className="comp-label">{currentUser.firstName || "Siz"}</span>
                <span className="comp-points">{finalResult.yourScore} ball</span>
              </div>
              <div className="comp-vs">VS</div>
              <div className="comparison-box rival">
                <span className="comp-label">{finalResult.opponent?.name || "Raqib"}</span>
                <span className="comp-points">{finalResult.opponentScore} ball</span>
              </div>
            </div>

            {/* Actions */}
            <div className="result-actions-row">
              <button
                type="button"
                className="result-btn primary"
                onClick={() => window.location.reload()}
              >
                <IoRefreshOutline /> Yana jang qilish
              </button>
              <button
                type="button"
                className="result-btn secondary"
                onClick={() => navigate("/oktagon")}
              >
                <IoArrowBack /> Oktagonga qaytish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
