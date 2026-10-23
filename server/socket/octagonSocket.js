import User from "../db/User/User.js";
import { getBattleQuestions } from "./octagonQuestions.js";

const queues = {
  "matematika:oson": [],
  "matematika:qiyin": [],
  "matematika:murakkab": [],
  tarix: [],
  "ingliz-tili": [],
};

const activeBattles = new Map();

function getXpChanges(difficulty = "oson") {
  switch (difficulty) {
    case "murakkab":
      return { win: 60, lose: -40, draw: 20 };
    case "qiyin":
      return { win: 40, lose: -25, draw: 15 };
    case "oson":
    default:
      return { win: 30, lose: -15, draw: 10 };
  }
}

const BOT_NAMES = [
  { name: "Jasur_Pro", pic: "https://api.dicebear.com/7.x/bottts/svg?seed=Jasur" },
  { name: "Madina_Smart", pic: "https://api.dicebear.com/7.x/bottts/svg?seed=Madina" },
  { name: "Bobur_Math", pic: "https://api.dicebear.com/7.x/bottts/svg?seed=Bobur" },
  { name: "Nilufar_Star", pic: "https://api.dicebear.com/7.x/bottts/svg?seed=Nilufar" },
  { name: "Temur_Master", pic: "https://api.dicebear.com/7.x/bottts/svg?seed=Temur" },
];

export function initOctagonSocket(io) {
  io.on("connection", (socket) => {
    // 1. Matchmaking Queuega qo'shilish
    socket.on("octagon:join_queue", async ({ category = "matematika", difficulty = "oson", user = {} }) => {
      const catKey = normalizeCategory(category);
      const diffKey = ["oson", "qiyin", "murakkab"].includes(difficulty) ? difficulty : "oson";
      const qKey = catKey === "matematika" ? `matematika:${diffKey}` : catKey;

      if (!queues[qKey]) queues[qKey] = [];

      // Foydalanuvchini mavjud bo'lsa tozalash
      removeFromQueue(socket.id);

      // FIX 1: "me" kabi fallback userId larni socket.id bilan almashtiramiz
      // Shunda anonim userlar ham bir-biri bilan match bo'ladi
      const rawUserId = user.id || user._id || "";
      const userId = (rawUserId && rawUserId !== "me" && rawUserId.length > 5)
        ? rawUserId
        : socket.id;

      const queueEntry = {
        socketId: socket.id,
        socket,
        userId,
        user: {
          id: userId,
          name: `${user.firstName || user.name || "O'yinchi"} ${user.lastName || ""}`.trim(),
          profilePic: user.profilePic || "",
          xp: Number(user.xp) || 0,
        },
        category: catKey,
        difficulty: diffKey,
        joinedAt: Date.now(),
      };

      // Navbatda boshqa o'yinchi bormi?
      let opponentEntry = null;
      while (queues[qKey].length > 0) {
        const candidate = queues[qKey].shift();
        clearTimeout(candidate.botTimeout);

        // Uzilgan socket ni o'tkazib yuborish
        const isDisconnected = !candidate.socket?.connected;
        // O'z-o'zi bilan match: faqat haqiqiy (real) userId larda tekshiriladi
        // socket.id farqli bo'lsa — ular turli odamlar
        const isSameSocket = candidate.socketId === socket.id;

        if (isDisconnected || isSameSocket) {
          continue;
        }

        opponentEntry = candidate;
        break;
      }

      if (opponentEntry) {
        // Real opponent topildi — jang boshlash
        startBattle(io, catKey, queueEntry, opponentEntry, false, diffKey);
      } else {
        // Navbatga qo'shish
        queues[qKey].push(queueEntry);
        socket.emit("octagon:queue_waiting", { category: catKey, difficulty: diffKey, queueTime: 0 });

        // FIX 2: Bot timeout 25 soniyaga oshirildi
        // (real player ulanishi uchun yetarli vaqt)
        queueEntry.botTimeout = setTimeout(() => {
          const idx = queues[qKey].indexOf(queueEntry);
          if (idx !== -1) {
            queues[qKey].splice(idx, 1);
            const botData = createBotOpponent();
            startBattle(io, catKey, queueEntry, botData, true, diffKey);
          }
        }, 25000);
      }
    });

    // 2. Navbatdan chiqish
    socket.on("octagon:leave_queue", () => {
      removeFromQueue(socket.id);
      socket.emit("octagon:queue_left");
    });

    // 3. Savolga javob yuborish
    socket.on("octagon:submit_answer", ({ roomId, questionIndex, answerIndex, timeRemaining = 0 }) => {
      const battle = activeBattles.get(roomId);
      if (!battle || battle.status !== "active") return;
      if (battle.currentQuestionIndex !== questionIndex) return;

      const playerKey = battle.player1.socketId === socket.id ? "player1" : "player2";
      const currentQ = battle.questions[questionIndex];
      const isCorrect = currentQ.correctIndex === answerIndex;

      // Ball hisoblash: to'g'ri bo'lsa 100 ball + tezlik bonusi (soniya * 10)
      const points = isCorrect ? 100 + Math.round(Number(timeRemaining) * 10) : 0;

      battle[playerKey].answers[questionIndex] = {
        questionIndex,
        answerIndex,
        isCorrect,
        points,
        timeRemaining,
      };
      battle[playerKey].score += points;
      battle[playerKey].currentAnswer = answerIndex;

      // Raqibga javob berilganini bildirish (real vaqt indikatori)
      const opponentKey = playerKey === "player1" ? "player2" : "player1";
      if (!battle[opponentKey].isBot) {
        io.to(battle[opponentKey].socketId).emit("octagon:opponent_answered", {
          questionIndex,
          hasAnswered: true,
        });
      }

      // Agar ikkala tomon ham javob bergan bo'lsa, raundni yakunlash
      checkRoundEnd(io, battle);
    });

    // 4. Uzilish holati (Disconnect)
    socket.on("disconnect", () => {
      removeFromQueue(socket.id);

      // Agar faol jangda bo'lsa, raqibga g'alaba berish
      for (const [roomId, battle] of activeBattles.entries()) {
        if (battle.status === "active") {
          if (battle.player1.socketId === socket.id || battle.player2.socketId === socket.id) {
            handlePlayerForfeit(io, battle, socket.id);
            break;
          }
        }
      }
    });
  });
}

function normalizeCategory(cat) {
  if (!cat) return "matematika";
  const lower = cat.toLowerCase();
  if (lower.includes("ingliz") || lower.includes("english")) return "ingliz-tili";
  if (lower.includes("tarix") || lower.includes("history")) return "tarix";
  return "matematika";
}

function removeFromQueue(socketId) {
  for (const cat of Object.keys(queues)) {
    const idx = queues[cat].findIndex((q) => q.socketId === socketId);
    if (idx !== -1) {
      clearTimeout(queues[cat][idx].botTimeout);
      queues[cat].splice(idx, 1);
    }
  }
}

function createBotOpponent() {
  const template = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  return {
    socketId: `bot_${Date.now()}`,
    isBot: true,
    user: {
      id: `bot_${Date.now()}`,
      name: template.name,
      profilePic: template.pic,
      xp: Math.floor(Math.random() * 400) + 150,
    },
  };
}

// Jangni boshlash
function startBattle(io, category, player1, player2, isBotBattle = false, difficulty = "oson") {
  const roomId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const questions = getBattleQuestions(category, 10, difficulty); // 10 ta savol

  const battle = {
    roomId,
    category,
    difficulty,
    questions,
    currentQuestionIndex: 0,
    status: "active",
    player1: {
      socketId: player1.socketId,
      userId: player1.userId,
      user: player1.user,
      score: 0,
      answers: [],
      currentAnswer: null,
      isBot: false,
    },
    player2: {
      socketId: player2.socketId,
      userId: player2.userId || player2.user?.id,
      user: player2.user,
      score: 0,
      answers: [],
      currentAnswer: null,
      isBot: Boolean(isBotBattle),
    },
    roundTimer: null,
  };

  activeBattles.set(roomId, battle);

  // O'yinchilarni xonaga ulash
  if (player1.socket) player1.socket.join(roomId);
  if (player2.socket) player2.socket.join(roomId);

  const matchData = {
    roomId,
    category,
    difficulty,
    totalQuestions: 10,
    player1: { ...battle.player1.user, score: 0 },
    player2: { ...battle.player2.user, score: 0 },
  };

  // Har bir o'yinchiga mos xabarnoma (o'zi va raqibi)
  io.to(battle.player1.socketId).emit("octagon:match_found", {
    ...matchData,
    youAre: "player1",
    opponent: battle.player2.user,
  });

  if (!battle.player2.isBot) {
    io.to(battle.player2.socketId).emit("octagon:match_found", {
      ...matchData,
      youAre: "player2",
      opponent: battle.player1.user,
    });
  }

  // 2 soniyadan so'ng 1-savol boshlanadi
  setTimeout(() => {
    sendQuestion(io, battle);
  }, 2200);
}

// Savolni yuborish
function sendQuestion(io, battle) {
  if (battle.status !== "active") return;
  const idx = battle.currentQuestionIndex;
  const q = battle.questions[idx];

  battle.player1.currentAnswer = null;
  battle.player2.currentAnswer = null;
  // FIX: Har yangi savol uchun roundEnded flagini reset qilish
  battle.roundEnded = false;

  const questionPayload = {
    roomId: battle.roomId,
    questionIndex: idx,
    totalQuestions: 10,
    text: q.text,
    options: q.options,
    timeLimit: q.timeLimit || 12,
    player1Score: battle.player1.score,
    player2Score: battle.player2.score,
  };

  io.to(battle.player1.socketId).emit("octagon:question", questionPayload);
  if (!battle.player2.isBot) {
    io.to(battle.player2.socketId).emit("octagon:question", questionPayload);
  } else {
    // Bot javobini rejalashtirish
    simulateBotAnswer(io, battle, idx);
  }

  // Vaqt tugaganda avtomatik raund tugashi
  clearTimeout(battle.roundTimer);
  battle.roundTimer = setTimeout(() => {
    checkRoundEnd(io, battle, true);
  }, (q.timeLimit || 12) * 1000 + 400);
}

// Bot javob berishi
function simulateBotAnswer(io, battle, questionIndex) {
  if (!battle.player2.isBot) return;
  const currentQ = battle.questions[questionIndex];

  // 3s - 7s orasida kechikish
  const delay = Math.floor(Math.random() * 4000) + 3000;
  setTimeout(() => {
    if (battle.status !== "active" || battle.currentQuestionIndex !== questionIndex) return;
    // FIX: Raund allaqachon tugagan bo'lsa bot javob bermaydi
    if (battle.roundEnded) return;

    // 72% ehtimollik bilan to'g'ri javob
    const isBotCorrect = Math.random() < 0.72;
    let chosenIndex = currentQ.correctIndex;
    if (!isBotCorrect) {
      const wrongIndices = [0, 1, 2, 3].filter((i) => i !== currentQ.correctIndex);
      chosenIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    }

    const timeRemaining = Math.max(0, 12 - Math.round(delay / 1000));
    const points = isBotCorrect ? 100 + timeRemaining * 10 : 0;

    battle.player2.answers[questionIndex] = {
      questionIndex,
      answerIndex: chosenIndex,
      isCorrect: isBotCorrect,
      points,
      timeRemaining,
    };
    battle.player2.score += points;
    battle.player2.currentAnswer = chosenIndex;

    // O'yinchiga bot javob berganini ko'rsatish
    io.to(battle.player1.socketId).emit("octagon:opponent_answered", {
      questionIndex,
      hasAnswered: true,
    });

    checkRoundEnd(io, battle);
  }, delay);
}

// Raund yakunini tekshirish
function checkRoundEnd(io, battle, isTimeout = false) {
  // FIX: Bir raundda faqat bir marta ishlaydi
  if (battle.roundEnded) return;

  const p1Answered = battle.player1.currentAnswer !== null;
  const p2Answered = battle.player2.currentAnswer !== null;

  if ((p1Answered && p2Answered) || isTimeout) {
    // Darhol flagni o'rnatish — parallel chaqiruvlarni bloklash uchun
    battle.roundEnded = true;
    clearTimeout(battle.roundTimer);

    const qIdx = battle.currentQuestionIndex;
    const currentQ = battle.questions[qIdx];

    const roundData = {
      questionIndex: qIdx,
      correctIndex: currentQ.correctIndex,
      player1: {
        score: battle.player1.score,
        lastAnswer: battle.player1.answers[qIdx] || null,
      },
      player2: {
        score: battle.player2.score,
        lastAnswer: battle.player2.answers[qIdx] || null,
      },
    };

    io.to(battle.player1.socketId).emit("octagon:round_result", roundData);
    if (!battle.player2.isBot) {
      io.to(battle.player2.socketId).emit("octagon:round_result", roundData);
    }

    // Keyingi savol yoki Jang yakuni
    setTimeout(() => {
      if (battle.currentQuestionIndex < 9) {
        battle.currentQuestionIndex += 1;
        sendQuestion(io, battle);
      } else {
        finishBattle(io, battle);
      }
    }, 2000);
  }
}

// Jang yakunlanishi va XP hisobi
async function finishBattle(io, battle) {
  battle.status = "finished";
  clearTimeout(battle.roundTimer);

  const p1Score = battle.player1.score;
  const p2Score = battle.player2.score;

  const xpConfig = getXpChanges(battle.difficulty);

  let p1Result = "draw";
  let p2Result = "draw";
  let p1XpChange = xpConfig.draw;
  let p2XpChange = xpConfig.draw;

  if (p1Score > p2Score) {
    p1Result = "victory";
    p2Result = "defeat";
    p1XpChange = xpConfig.win; // G'olibga win XP
    p2XpChange = xpConfig.lose; // Mag'lubga lose XP
  } else if (p2Score > p1Score) {
    p1Result = "defeat";
    p2Result = "victory";
    p1XpChange = xpConfig.lose;
    p2XpChange = xpConfig.win;
  }

  // Bazada XP yangilash
  let p1NewXp = battle.player1.user.xp + p1XpChange;
  if (p1NewXp < 0) p1NewXp = 0;

  if (battle.player1.userId) {
    try {
      await User.findByIdAndUpdate(battle.player1.userId, {
        $inc: { xp: p1XpChange, solvedQuizzes: 10 },
      });
    } catch {}
  }

  if (!battle.player2.isBot && battle.player2.userId) {
    try {
      await User.findByIdAndUpdate(battle.player2.userId, {
        $inc: { xp: p2XpChange, solvedQuizzes: 10 },
      });
    } catch {}
  }

  const p1FinalPayload = {
    result: p1Result,
    xpChange: p1XpChange,
    yourScore: p1Score,
    opponentScore: p2Score,
    opponent: battle.player2.user,
    answers: battle.player1.answers,
    questions: battle.questions,
    difficulty: battle.difficulty,
  };

  io.to(battle.player1.socketId).emit("octagon:battle_finished", p1FinalPayload);

  if (!battle.player2.isBot) {
    const p2FinalPayload = {
      result: p2Result,
      xpChange: p2XpChange,
      yourScore: p2Score,
      opponentScore: p1Score,
      opponent: battle.player1.user,
      answers: battle.player2.answers,
      questions: battle.questions,
      difficulty: battle.difficulty,
    };
    io.to(battle.player2.socketId).emit("octagon:battle_finished", p2FinalPayload);
  }

  activeBattles.delete(battle.roomId);
}

// Biri chiqib ketsa (Forfeit)
async function handlePlayerForfeit(io, battle, forfeitSocketId) {
  battle.status = "finished";
  clearTimeout(battle.roundTimer);

  const xpConfig = getXpChanges(battle.difficulty);
  const isPlayer1 = battle.player1.socketId === forfeitSocketId;
  const winner = isPlayer1 ? battle.player2 : battle.player1;
  const loser = isPlayer1 ? battle.player1 : battle.player2;

  // G'olibga avtomatik win XP
  if (!winner.isBot && winner.userId) {
    try {
      await User.findByIdAndUpdate(winner.userId, { $inc: { xp: xpConfig.win } });
    } catch {}
  }

  if (!loser.isBot && loser.userId) {
    try {
      await User.findByIdAndUpdate(loser.userId, { $inc: { xp: xpConfig.lose } });
    } catch {}
  }

  if (!winner.isBot) {
    io.to(winner.socketId).emit("octagon:battle_finished", {
      result: "victory",
      xpChange: xpConfig.win,
      yourScore: winner.score,
      opponentScore: 0,
      opponent: loser.user,
      forfeit: true,
      difficulty: battle.difficulty,
      message: "Raqib o'yindan chiqib ketdi. Siz g'olib bo'ldingiz! 🏆",
    });
  }

  activeBattles.delete(battle.roomId);
}
