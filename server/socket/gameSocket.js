import GameSession from "../db/Quiz/GameSession.js";
import User from "../db/User/User.js";
import jwt from "jsonwebtoken";
import { isDbConnected } from "../db/db.js";
import {
  findMemoryQuizById,
  findMemorySessionById,
  findMemoryUserById,
  generateMemoryId,
} from "../db/memoryStore.js";
import { JWT_SECRET } from "../utils/jwtSecret.js";

const COUNTDOWN_MS = 3500;
const LOBBY_DISCONNECT_GRACE_MS = 3000;
const QUESTION_TIMER_BUFFER_MS = 250;

// Har bir sessiya uchun timerlar va async qulf (race-condition oldini olish uchun)
const sessionTimers = new Map();
const sessionLocks = new Map();
const sessionReactionsDisabled = new Set();

function syncReactionGate(sessionId, reactionsEnabled) {
  const key = String(sessionId || "");
  if (!key) return;
  if (reactionsEnabled === false) {
    sessionReactionsDisabled.add(key);
  } else {
    sessionReactionsDisabled.delete(key);
  }
}

function getTimerBucket(sessionId) {
  const key = String(sessionId);
  if (!sessionTimers.has(key)) {
    sessionTimers.set(key, {
      startTimer: null,
      questionTimer: null,
      disconnectTimers: new Map(),
    });
  }
  return sessionTimers.get(key);
}

export function clearSessionTimers(sessionId) {
  const key = String(sessionId || "");
  if (!key) return;
  const bucket = sessionTimers.get(key);
  if (!bucket) return;
  if (bucket.startTimer) clearTimeout(bucket.startTimer);
  if (bucket.questionTimer) clearTimeout(bucket.questionTimer);
  for (const t of bucket.disconnectTimers.values()) {
    clearTimeout(t);
  }
  bucket.disconnectTimers.clear();
  sessionTimers.delete(key);
}

function clearRoundTimers(sessionId) {
  const bucket = sessionTimers.get(String(sessionId));
  if (!bucket) return;
  if (bucket.startTimer) {
    clearTimeout(bucket.startTimer);
    bucket.startTimer = null;
  }
  if (bucket.questionTimer) {
    clearTimeout(bucket.questionTimer);
    bucket.questionTimer = null;
  }
}

function withSessionLock(sessionId, fn) {
  const key = String(sessionId || "");
  if (!key) return Promise.resolve().then(fn);
  const prev = sessionLocks.get(key) || Promise.resolve();
  const next = prev.then(
    () => fn(),
    () => fn(),
  );
  sessionLocks.set(key, next);
  next.finally(() => {
    if (sessionLocks.get(key) === next) {
      sessionLocks.delete(key);
    }
  });
  return next;
}

function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function getCreatorId(session) {
  return (
    session?.host?.toString() || session?.quiz?.host?.toString() || null
  );
}

function isAuthorizedHost(session, socket) {
  const creatorId = getCreatorId(session);
  if (!socket?.userId || !creatorId) return false;
  return String(socket.userId) === String(creatorId);
}

async function loadSessionWithQuiz(sessionId) {
  if (!sessionId) return null;
  if (isDbConnected()) {
    try {
      return await GameSession.findById(sessionId).populate("quiz");
    } catch {
      return null;
    }
  }
  const memSession = findMemorySessionById(sessionId);
  if (!memSession) return null;
  const quizObj =
    typeof memSession.quiz === "object"
      ? memSession.quiz
      : findMemoryQuizById(memSession.quiz);
  if (!quizObj) return null;
  return {
    ...memSession,
    quiz: quizObj,
    _isMemory: true,
    _rawSession: memSession,
  };
}

async function loadSessionRaw(sessionId) {
  if (!sessionId) return null;
  if (isDbConnected()) {
    try {
      return await GameSession.findById(sessionId);
    } catch {
      return null;
    }
  }
  return findMemorySessionById(sessionId);
}

async function persistSession(session) {
  if (!session) return;
  if (session._isMemory && session._rawSession) {
    Object.assign(session._rawSession, {
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      currentQuestion: session.currentQuestion,
      countdownEndsAt: session.countdownEndsAt,
      questionStartedAt: session.questionStartedAt,
      questionEndsAt: session.questionEndsAt,
      reactionsEnabled: session.reactionsEnabled,
      isLocked: session.isLocked,
      backgroundTheme: session.backgroundTheme,
      players: session.players,
    });
    return;
  }
  if (typeof session.save === "function") {
    await session.save();
  }
}

function buildLeaderboard(players, includeAnswers = false) {
  return [...(players || [])]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((p, i) => {
      const entry = {
        rank: i + 1,
        id: p._id?.toString(),
        name: p.name,
        score: p.score || 0,
        profilePic: p.profilePic || "",
        connected: p.connected !== false,
      };
      if (includeAnswers) {
        entry.answers = p.answers || [];
      }
      return entry;
    });
}

function resolveQuestionType(question) {
  if (question?.type === "true_false") return "true_false";
  if (question?.type === "quiz") return "quiz";
  if (Array.isArray(question?.options) && question.options.length === 2) {
    return "true_false";
  }
  return "quiz";
}

function buildQuestionsReview(quiz) {
  return (quiz?.questions || []).map((q, qIdx) => ({
    questionIndex: qIdx,
    type: resolveQuestionType(q),
    text: q.text,
    options: q.options || [],
    correctIndex: q.correctIndex,
    explanation: q.explanation || "",
    points: q.points || 100,
  }));
}

function computeOptionCounts(players, questionIndex, optionsLength) {
  const counts = Array.from({ length: optionsLength }, () => 0);
  for (const p of players || []) {
    const ans = (p.answers || []).find(
      (a) => a.questionIndex === questionIndex,
    );
    if (
      ans &&
      Number.isInteger(ans.chosenIndex) &&
      ans.chosenIndex >= 0 &&
      ans.chosenIndex < optionsLength
    ) {
      counts[ans.chosenIndex] += 1;
    }
  }
  return counts;
}

export function initSocketIO(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId || decoded.id || decoded._id;
      } catch {
        socket.userId = null;
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    // ===================== HOST ULANISHI =====================
    socket.on("host:join", async ({ sessionId } = {}) => {
      if (!sessionId) {
        socket.emit("host:error", {
          msg: "Sessiya identifikatori topilmadi",
          fatal: true,
        });
        return socket.emit("error", { msg: "Sessiya topilmadi" });
      }

      try {
        await withSessionLock(sessionId, async () => {
          let session = await loadSessionWithQuiz(sessionId);
          if (!session || !session.quiz) {
            socket.emit("host:error", {
              msg: "O'yin sessiyasi topilmadi yoki o'chirilgan",
              fatal: true,
            });
            return socket.emit("error", { msg: "Sessiya topilmadi" });
          }

          if (!isAuthorizedHost(session, socket)) {
            socket.emit("host:error", {
              msg: "Siz ushbu o'yinning boshlovchisi emassiz!",
              fatal: true,
            });
            return socket.emit("error", {
              msg: "Siz ushbu o'yinning boshlovchisi emassiz!",
            });
          }

          socket.sessionId = String(sessionId);
          socket.role = "host";
          socket.playerName = "Boshlovchi";
          socket.join(`session:${sessionId}`);

          // Agar savol vaqti tugagan bo'lsa, darhol javob bosqichiga o'tkazamiz
          if (session.status === "question" && session.currentQuestion >= 0) {
            const currentQ = session.quiz.questions[session.currentQuestion];
            const endsAtMs = session.questionEndsAt
              ? new Date(session.questionEndsAt).getTime()
              : (session.questionStartedAt
                  ? new Date(session.questionStartedAt).getTime()
                  : Date.now()) +
                (currentQ?.timeLimit || 20) * 1000;

            if (Date.now() >= endsAtMs) {
              clearRoundTimers(sessionId);
              await showAnswerLocked(io, sessionId, session.currentQuestion);
              session = await loadSessionWithQuiz(sessionId);
            }
          }

          const now = Date.now();
          const creatorId = getCreatorId(session);
          const reactionsEnabled = session.reactionsEnabled !== false;
          syncReactionGate(sessionId, reactionsEnabled);

          const baseData = {
            sessionId: String(sessionId),
            pin: session.pin,
            quizTitle: session.quiz.title,
            questionsCount: session.quiz.questions.length,
            status: session.status,
            creatorId,
            hostId: creatorId,
            reactionsEnabled,
            isLocked: Boolean(session.isLocked),
            backgroundTheme: session.backgroundTheme || "default",
            serverTime: now,
            players: (session.players || []).map((p) => ({
              id: p._id?.toString(),
              name: p.name,
              profilePic: p.profilePic || "",
              score: p.score || 0,
              connected: p.connected !== false,
            })),
          };

          if (session.status === "active") {
            const startsAt = session.countdownEndsAt
              ? new Date(session.countdownEndsAt).getTime()
              : now + 1500;
            baseData.startsAt = startsAt;
            baseData.countdownMs = Math.max(0, startsAt - now);
            baseData.totalQuestions = session.quiz.questions.length;
          } else if (
            session.status === "question" &&
            session.currentQuestion >= 0
          ) {
            const currentQ = session.quiz.questions[session.currentQuestion];
            const startedAtMs = session.questionStartedAt
              ? new Date(session.questionStartedAt).getTime()
              : now;
            const timeLimit = clampNumber(currentQ?.timeLimit, 5, 120, 20);
            const endsAtMs = session.questionEndsAt
              ? new Date(session.questionEndsAt).getTime()
              : startedAtMs + timeLimit * 1000;
            const timeLeft = Math.max(
              0,
              Math.ceil((endsAtMs - now) / 1000),
            );
            const answeredCount = (session.players || []).filter((p) =>
              (p.answers || []).some(
                (a) => a.questionIndex === session.currentQuestion,
              ),
            ).length;

            baseData.currentQuestion = {
              questionIndex: session.currentQuestion,
              totalQuestions: session.quiz.questions.length,
              type: resolveQuestionType(currentQ),
              text: currentQ.text,
              options: currentQ.options,
              timeLimit,
              points: currentQ.points || 100,
              questionStartedAt: startedAtMs,
              questionEndsAt: endsAtMs,
              serverTime: now,
            };
            baseData.questionStartedAt = startedAtMs;
            baseData.questionEndsAt = endsAtMs;
            baseData.timeLeft = timeLeft;
            baseData.answeredCount = answeredCount;
          } else if (
            session.status === "answer" &&
            session.currentQuestion >= 0
          ) {
            const currentQ = session.quiz.questions[session.currentQuestion];
            const allLeaderboard = buildLeaderboard(session.players);

            baseData.currentQuestion = {
              questionIndex: session.currentQuestion,
              totalQuestions: session.quiz.questions.length,
              type: resolveQuestionType(currentQ),
              text: currentQ.text,
              options: currentQ.options,
              timeLimit: currentQ.timeLimit || 20,
              points: currentQ.points || 100,
            };
            baseData.correctIndex = currentQ.correctIndex;
            baseData.explanation = currentQ.explanation || "";
            baseData.leaderboard = allLeaderboard.slice(0, 5);
            baseData.allLeaderboard = allLeaderboard;
            baseData.optionCounts = computeOptionCounts(
              session.players,
              session.currentQuestion,
              currentQ.options.length,
            );
          } else if (session.status === "ended") {
            baseData.leaderboard = buildLeaderboard(session.players);
          }

          socket.emit("host:joined", baseData);
        });
      } catch (err) {
        console.error("host:join error:", err);
        socket.emit("host:error", { msg: "Server xatosi", fatal: true });
        socket.emit("error", { msg: "Server xatosi" });
      }
    });

    // ===================== O'YINCHI ULANISHI =====================
    socket.on(
      "player:join",
      async ({ sessionId, playerId, name, profilePic } = {}) => {
        if (!sessionId) {
          return socket.emit("player:join:error", {
            msg: "O'yin topilmadi yoki tugagan",
          });
        }

        try {
          await withSessionLock(sessionId, async () => {
            let session = await loadSessionWithQuiz(sessionId);

            if (!session || !session.quiz) {
              return socket.emit("player:join:error", {
                msg: "O'yin topilmadi yoki tugagan",
              });
            }

            // Mavjud o'yinchini aniqlash: faqat playerId yoki autentifikatsiya qilingan userId orqali
            let player = null;
            if (playerId) {
              const candidate = (session.players || []).find(
                (p) => p._id?.toString() === String(playerId),
              );
              if (candidate) {
                const sameAccountOrGuest =
                  !candidate.userId ||
                  !socket.userId ||
                  String(candidate.userId) === String(socket.userId);
                if (sameAccountOrGuest) {
                  player = candidate;
                }
              }
            }
            if (!player && socket.userId) {
              player = (session.players || []).find(
                (p) =>
                  p.userId &&
                  String(p.userId) === String(socket.userId),
              );
            }

            if (player) {
              // Kutilayotgan lobby disconnect taymerini bekor qilish
              const pidStr = player._id.toString();
              const bucket = sessionTimers.get(String(sessionId));
              if (bucket?.disconnectTimers.has(pidStr)) {
                clearTimeout(bucket.disconnectTimers.get(pidStr));
                bucket.disconnectTimers.delete(pidStr);
              }

              player.socketId = socket.id;
              player.connected = true;
              player.lastSeenAt = new Date();
              if (profilePic && typeof profilePic === "string") {
                player.profilePic = profilePic;
              }
              await persistSession(session);

              socket.playerId = pidStr;
              socket.sessionId = String(sessionId);
              socket.playerName = player.name;
              socket.role = "player";
              socket.join(`session:${sessionId}`);

              io.to(`session:${sessionId}`).emit("player:new", {
                id: pidStr,
                name: player.name,
                profilePic: player.profilePic || "",
                score: player.score || 0,
                connected: true,
                totalPlayers: session.players.length,
              });

              // Agar savol vaqti tugagan bo'lsa, avtomatik javob holatiga o'tkazish
              if (
                session.status === "question" &&
                session.currentQuestion >= 0
              ) {
                const currentQ =
                  session.quiz.questions[session.currentQuestion];
                const endsAtMs = session.questionEndsAt
                  ? new Date(session.questionEndsAt).getTime()
                  : (session.questionStartedAt
                      ? new Date(session.questionStartedAt).getTime()
                      : Date.now()) +
                    (currentQ?.timeLimit || 20) * 1000;
                if (Date.now() >= endsAtMs) {
                  clearRoundTimers(sessionId);
                  await showAnswerLocked(
                    io,
                    sessionId,
                    session.currentQuestion,
                  );
                  session = await loadSessionWithQuiz(sessionId);
                  player = (session.players || []).find(
                    (p) => p._id?.toString() === pidStr,
                  );
                }
              }

              const now = Date.now();
              const myAnswer =
                session.currentQuestion >= 0
                  ? (player?.answers || []).find(
                      (a) => a.questionIndex === session.currentQuestion,
                    )
                  : null;

              const reactionsEnabled = session.reactionsEnabled !== false;
              syncReactionGate(sessionId, reactionsEnabled);

              const responseData = {
                playerId: pidStr,
                name: player.name,
                score: player.score || 0,
                profilePic: player.profilePic || "",
                status: session.status,
                quizTitle: session.quiz?.title,
                reactionsEnabled,
                isLocked: Boolean(session.isLocked),
                myAnswerHistory: player.answers || [],
                serverTime: now,
              };

              if (session.status === "active") {
                const startsAt = session.countdownEndsAt
                  ? new Date(session.countdownEndsAt).getTime()
                  : now + 1500;
                responseData.startsAt = startsAt;
                responseData.countdownMs = Math.max(0, startsAt - now);
                responseData.totalQuestions = session.quiz.questions.length;
              } else if (
                session.status === "question" &&
                session.currentQuestion >= 0
              ) {
                const currentQ =
                  session.quiz.questions[session.currentQuestion];
                const startedAtMs = session.questionStartedAt
                  ? new Date(session.questionStartedAt).getTime()
                  : now;
                const timeLimit = clampNumber(currentQ?.timeLimit, 5, 120, 20);
                const endsAtMs = session.questionEndsAt
                  ? new Date(session.questionEndsAt).getTime()
                  : startedAtMs + timeLimit * 1000;
                const timeLeft = Math.max(
                  0,
                  Math.ceil((endsAtMs - now) / 1000),
                );

                responseData.currentQuestion = {
                  questionIndex: session.currentQuestion,
                  totalQuestions: session.quiz.questions.length,
                  type: resolveQuestionType(currentQ),
                  text: currentQ.text,
                  options: currentQ.options,
                  timeLimit,
                  points: currentQ.points || 100,
                  questionStartedAt: startedAtMs,
                  questionEndsAt: endsAtMs,
                  serverTime: now,
                };
                responseData.timeLeft = timeLeft;
                responseData.questionStartedAt = startedAtMs;
                responseData.questionEndsAt = endsAtMs;
                responseData.hasAnswered = !!myAnswer;
                responseData.chosenIndex = myAnswer
                  ? myAnswer.chosenIndex
                  : null;
                responseData.myAnswer = myAnswer
                  ? {
                      questionIndex: session.currentQuestion,
                      isCorrect: myAnswer.isCorrect,
                      pointsEarned: myAnswer.pointsEarned,
                      score: player.score || 0,
                    }
                  : null;
              } else if (
                session.status === "answer" &&
                session.currentQuestion >= 0
              ) {
                const currentQ =
                  session.quiz.questions[session.currentQuestion];
                const allLeaderboard = buildLeaderboard(session.players);
                const myRank =
                  allLeaderboard.findIndex((p) => p.id === pidStr) + 1;

                responseData.currentQuestion = {
                  questionIndex: session.currentQuestion,
                  totalQuestions: session.quiz.questions.length,
                  type: resolveQuestionType(currentQ),
                  text: currentQ.text,
                  options: currentQ.options,
                  timeLimit: currentQ.timeLimit || 20,
                  points: currentQ.points || 100,
                };
                responseData.correctIndex = currentQ.correctIndex;
                responseData.myAnswer = myAnswer
                  ? {
                      isCorrect: myAnswer.isCorrect,
                      pointsEarned: myAnswer.pointsEarned,
                      score: player.score || 0,
                    }
                  : { isCorrect: false, pointsEarned: 0, noAnswer: true };
                responseData.leaderboard = allLeaderboard.slice(0, 5);
                responseData.allLeaderboard = allLeaderboard;
                responseData.myRank = myRank;
                responseData.totalPlayers = session.players.length;
              } else if (session.status === "ended") {
                const finalLeaderboard = buildLeaderboard(session.players);
                const myRank =
                  finalLeaderboard.findIndex((p) => p.id === pidStr) + 1;

                responseData.status = "ended";
                responseData.leaderboard = finalLeaderboard;
                responseData.allLeaderboard = finalLeaderboard;
                responseData.myRank = myRank;
                responseData.questionsReview = buildQuestionsReview(
                  session.quiz,
                );
              }

              socket.emit("player:joined", responseData);
              return;
            }

            // Yangi o'yinchi: faqat waiting holatida qo'shiladi
            if (session.status === "ended") {
              return socket.emit("player:join:error", {
                msg: "Bu o'yin allaqachon yakunlangan!",
              });
            }
            if (session.status !== "waiting") {
              return socket.emit("player:join:error", {
                msg: "O'yin allaqachon boshlangan!",
              });
            }
            if (session.isLocked) {
              return socket.emit("player:join:error", {
                msg: "Xona boshlovchi tomonidan qulflangan!",
              });
            }

            const cleanName =
              typeof name === "string" ? name.trim().slice(0, 30) : "";
            if (!cleanName) {
              return socket.emit("player:join:error", {
                msg: "Iltimos, ismingizni kiriting!",
              });
            }

            const duplicateName = (session.players || []).some(
              (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase(),
            );
            if (duplicateName) {
              return socket.emit("player:join:error", {
                msg: "Bu ism allaqachon band! Boshqa ism tanlang.",
              });
            }

            const newPlayer = {
              _id: session._isMemory ? generateMemoryId() : undefined,
              socketId: socket.id,
              userId: socket.userId || null,
              name: cleanName,
              profilePic: typeof profilePic === "string" ? profilePic : "",
              score: 0,
              connected: true,
              lastSeenAt: new Date(),
              answers: [],
            };

            session.players.push(newPlayer);
            await persistSession(session);

            const savedPlayer = session.players[session.players.length - 1];
            const savedPid = savedPlayer._id.toString();

            socket.playerId = savedPid;
            socket.sessionId = String(sessionId);
            socket.playerName = savedPlayer.name;
            socket.role = "player";
            socket.join(`session:${sessionId}`);

            const reactionsEnabled = session.reactionsEnabled !== false;
            syncReactionGate(sessionId, reactionsEnabled);

            socket.emit("player:joined", {
              playerId: savedPid,
              name: savedPlayer.name,
              score: 0,
              profilePic: savedPlayer.profilePic,
              status: "lobby",
              quizTitle: session.quiz?.title,
              reactionsEnabled,
              isLocked: Boolean(session.isLocked),
              myAnswerHistory: [],
              serverTime: Date.now(),
            });

            io.to(`session:${sessionId}`).emit("player:new", {
              id: savedPid,
              name: savedPlayer.name,
              profilePic: savedPlayer.profilePic,
              score: 0,
              connected: true,
              totalPlayers: session.players.length,
            });
          });
        } catch (err) {
          console.error("player:join error:", err);
          socket.emit("player:join:error", { msg: "Server xatosi" });
        }
      },
    );

    // ===================== AVATARNI YANGILASH =====================
    socket.on(
      "player:update-avatar",
      async ({ sessionId, playerId, profilePic } = {}) => {
        const sId = sessionId || socket.sessionId;
        const pId = socket.playerId || playerId;
        if (!sId || !pId || typeof profilePic !== "string") return;

        try {
          await withSessionLock(sId, async () => {
            const session = await loadSessionRaw(sId);
            if (!session || session.status === "ended") return;

            const player = (session.players || []).find(
              (p) => p._id?.toString() === String(pId),
            );
            if (!player) return;
            if (socket.playerId && String(socket.playerId) !== String(pId)) {
              return;
            }

            player.profilePic = profilePic;
            await persistSession(session);

            io.to(`session:${sId}`).emit("player:avatar:updated", {
              playerId: String(pId),
              profilePic,
            });
          });
        } catch (err) {
          console.error("player:update-avatar error:", err);
        }
      },
    );

    // ===================== ISMNI YANGILASH =====================
    socket.on("player:update-name", async ({ sessionId, playerId, name } = {}) => {
      const sId = sessionId || socket.sessionId;
      const pId = socket.playerId || playerId;
      const newName = typeof name === "string" ? name.trim().slice(0, 30) : "";
      if (!sId || !pId || !newName) return;

      try {
        await withSessionLock(sId, async () => {
          const session = await loadSessionRaw(sId);
          if (!session || session.status === "ended") return;

          const player = (session.players || []).find(
            (p) => p._id?.toString() === String(pId),
          );
          if (!player) return;
          if (socket.playerId && String(socket.playerId) !== String(pId)) {
            return;
          }

          const duplicate = (session.players || []).some(
            (p) =>
              p._id?.toString() !== String(pId) &&
              p.name.trim().toLowerCase() === newName.toLowerCase(),
          );
          if (duplicate) {
            return socket.emit("player:name:error", {
              msg: "Bu ism allaqachon band!",
            });
          }

          player.name = newName;
          await persistSession(session);
          socket.playerName = newName;

          io.to(`session:${sId}`).emit("player:name:updated", {
            playerId: String(pId),
            name: newName,
          });
        });
      } catch (err) {
        console.error("player:update-name error:", err);
      }
    });

    // ===================== REAKSIYA YUBORISH =====================
    socket.on("send_reaction", ({ emoji, sessionId, user, name } = {}) => {
      try {
        const sId = sessionId || socket.sessionId;
        if (!sId || typeof emoji !== "string" || !emoji.trim()) return;
        if (emoji.length > 16) return;
        if (sessionReactionsDisabled.has(String(sId))) return;

        // Har bir socket uchun oddiy spam cheklovi
        const now = Date.now();
        socket._reactionTimestamps = (socket._reactionTimestamps || []).filter(
          (t) => now - t < 4000,
        );
        if (socket._reactionTimestamps.length >= 6) return;
        socket._reactionTimestamps.push(now);

        const senderName =
          socket.playerName ||
          name ||
          user?.name ||
          (socket.role === "host" ? "Boshlovchi" : "O'yinchi");

        const reactionData = {
          id: `${now}_${Math.random().toString(36).substring(2, 9)}`,
          emoji: emoji.trim(),
          sessionId: String(sId),
          name: String(senderName).slice(0, 30),
          playerId: socket.playerId || null,
          role: socket.role || "player",
          timestamp: now,
        };

        io.to(`session:${sId}`).emit("receive_reaction", reactionData);
      } catch (err) {
        console.error("send_reaction error:", err);
      }
    });

    // ===================== O'YINNI BOSHLASH (HOST) =====================
    socket.on("host:start", async ({ sessionId } = {}) => {
      if (!sessionId) return;
      try {
        await withSessionLock(sessionId, async () => {
          const session = await loadSessionWithQuiz(sessionId);
          if (!session || !session.quiz) return;
          if (!isAuthorizedHost(session, socket)) {
            return socket.emit("error", {
              msg: "Faqat o'yinni yaratgan boshlovchi o'yinni boshlashi mumkin!",
            });
          }
          if (session.status !== "waiting") return;
          if (!session.players || session.players.length === 0) {
            return socket.emit("error", {
              msg: "O'yinni boshlash uchun kamida 1 ta o'yinchi kerak!",
            });
          }

          clearRoundTimers(sessionId);

          session.status = "active";
          session.startedAt = new Date();
          session.currentQuestion = -1;
          const emitNow = Date.now();
          const countdownEndsAt = emitNow + COUNTDOWN_MS;
          session.countdownEndsAt = new Date(countdownEndsAt);
          await persistSession(session);

          const postSaveNow = Date.now();
          const finalStartsAt = Math.max(countdownEndsAt, postSaveNow + COUNTDOWN_MS - 300);

          io.to(`session:${sessionId}`).emit("game:started", {
            totalQuestions: session.quiz.questions.length,
            countdownMs: Math.max(500, finalStartsAt - postSaveNow),
            startsAt: finalStartsAt,
            serverTime: postSaveNow,
          });

          const triggerDelayMs = Math.max(200, finalStartsAt - Date.now() - 250);
          const bucket = getTimerBucket(sessionId);
          bucket.startTimer = setTimeout(() => {
            withSessionLock(sessionId, () =>
              sendNextQuestionLocked(io, sessionId, 0),
            ).catch((err) => {
              console.error("startTimer error:", err);
              io.to(`session:${sessionId}`).emit("error", {
                msg: "Savolni yuklashda xatolik yuz berdi",
              });
            });
          }, triggerDelayMs);
        });
      } catch (err) {
        console.error("host:start error:", err);
      }
    });

    // ===================== JAVOB YUBORISH (O'YINCHI) =====================
    socket.on(
      "player:answer",
      async ({ sessionId, playerId, questionIndex, chosenIndex } = {}) => {
        const sId = sessionId || socket.sessionId;
        const pId = socket.playerId || playerId;
        if (!sId || !pId) return;

        try {
          await withSessionLock(sId, async () => {
            const session = await loadSessionWithQuiz(sId);
            if (!session || !session.quiz) {
              return socket.emit("player:answer:error", {
                questionIndex,
                msg: "O'yin sessiyasi topilmadi",
              });
            }

            if (
              session.status !== "question" ||
              session.currentQuestion !== questionIndex
            ) {
              return socket.emit("player:answer:error", {
                questionIndex,
                msg: "Savol vaqti tugagan",
              });
            }

            const question = session.quiz.questions?.[questionIndex];
            if (!question) return;

            if (
              !Number.isInteger(chosenIndex) ||
              chosenIndex < 0 ||
              chosenIndex >= (question.options?.length || 0)
            ) {
              return socket.emit("player:answer:error", {
                questionIndex,
                msg: "Noto'g'ri javob varianti",
              });
            }

            const player = (session.players || []).find(
              (p) => p._id?.toString() === String(pId),
            );
            if (!player) {
              return socket.emit("player:answer:error", {
                questionIndex,
                msg: "O'yinchi topilmadi",
              });
            }

            // Agar shu savolga allaqachon javob berilgan bo'lsa — idempotent javob qaytaramiz
            const existingAns = (player.answers || []).find(
              (a) => a.questionIndex === questionIndex,
            );
            if (existingAns) {
              const sortedPlayers = [...session.players].sort(
                (a, b) => (b.score || 0) - (a.score || 0),
              );
              const currentRank =
                sortedPlayers.findIndex(
                  (p) => p._id?.toString() === String(pId),
                ) + 1;
              return socket.emit("player:answer:ok", {
                questionIndex,
                isCorrect: existingAns.isCorrect,
                pointsEarned: existingAns.pointsEarned,
                rank: currentRank,
                totalPlayers: session.players.length,
                score: player.score || 0,
              });
            }

            const now = Date.now();
            const startedAtMs = session.questionStartedAt
              ? new Date(session.questionStartedAt).getTime()
              : now;
            const timeLimitSec = clampNumber(question.timeLimit, 5, 120, 20);
            const timeLimitMs = timeLimitSec * 1000;
            const timeMs = Math.max(0, now - startedAtMs);

            if (timeMs > timeLimitMs + 2000) {
              socket.emit("player:answer:error", {
                questionIndex,
                msg: "Vaqt tugadi!",
              });
              clearRoundTimers(sId);
              await showAnswerLocked(io, sId, questionIndex);
              return;
            }

            const isCorrect = chosenIndex === question.correctIndex;
            const basePoints = clampNumber(question.points, 50, 1000, 100);
            const timeFactor = Math.max(0, 1 - timeMs / timeLimitMs);
            const pointsEarned = isCorrect
              ? Math.round(basePoints * (1 + 5 * timeFactor))
              : 0;

            player.connected = true;
            player.lastSeenAt = new Date(now);
            player.answers.push({
              questionIndex,
              chosenIndex,
              isCorrect,
              timeMs,
              pointsEarned,
            });
            player.score = (player.score || 0) + pointsEarned;
            await persistSession(session);

            const sortedPlayers = [...session.players].sort(
              (a, b) => (b.score || 0) - (a.score || 0),
            );
            const currentRank =
              sortedPlayers.findIndex(
                (p) => p._id?.toString() === String(pId),
              ) + 1;

            socket.emit("player:answer:ok", {
              questionIndex,
              isCorrect,
              pointsEarned,
              rank: currentRank,
              totalPlayers: session.players.length,
              score: player.score,
            });

            const answeredCount = session.players.filter((p) =>
              (p.answers || []).some((a) => a.questionIndex === questionIndex),
            ).length;
            const connectedPlayers = session.players.filter(
              (p) => p.connected !== false,
            );
            const allConnectedAnswered =
              connectedPlayers.length > 0 &&
              connectedPlayers.every((p) =>
                (p.answers || []).some(
                  (a) => a.questionIndex === questionIndex,
                ),
              );

            io.to(`session:${sId}`).emit("answer:progress", {
              questionIndex,
              answered: answeredCount,
              total: session.players.length,
              connectedTotal: connectedPlayers.length,
            });

            if (
              allConnectedAnswered ||
              answeredCount >= session.players.length
            ) {
              clearRoundTimers(sId);
              await showAnswerLocked(io, sId, questionIndex);
            }
          });
        } catch (err) {
          console.error("player:answer error:", err);
        }
      },
    );

    // ===================== KEYINGI SAVOL (HOST) =====================
    socket.on("host:next", async ({ sessionId } = {}) => {
      if (!sessionId) return;
      try {
        await withSessionLock(sessionId, async () => {
          const session = await loadSessionWithQuiz(sessionId);
          if (!session || !session.quiz) return;
          if (!isAuthorizedHost(session, socket)) {
            return socket.emit("error", {
              msg: "Faqat boshlovchi keyingi savolga o'tishi mumkin!",
            });
          }

          if (session.status === "answer") {
            const nextIndex = session.currentQuestion + 1;
            if (nextIndex < session.quiz.questions.length) {
              await sendNextQuestionLocked(io, sessionId, nextIndex);
            } else {
              await endGameLocked(io, sessionId);
            }
          }
        });
      } catch (err) {
        console.error("host:next error:", err);
      }
    });

    // ===================== O'YINNI TUGATISH (HOST) =====================
    socket.on("host:end", async ({ sessionId } = {}) => {
      if (!sessionId) return;
      try {
        await withSessionLock(sessionId, async () => {
          const session = await loadSessionWithQuiz(sessionId);
          if (!session || session.status === "ended") return;

          if (isAuthorizedHost(session, socket)) {
            await endGameLocked(io, sessionId);
          } else {
            socket.emit("error", {
              msg: "Faqat o'yinni yaratgan foydalanuvchi uni yakunlashi mumkin!",
            });
          }
        });
      } catch (err) {
        console.error("host:end error:", err);
      }
    });

    // ===================== REAKSIYALARNI YOQISH / O'CHIRISH (HOST) =====================
    socket.on("host:toggle-reactions", async ({ sessionId, enabled } = {}) => {
      const sId = sessionId || socket.sessionId;
      if (!sId) return;
      try {
        await withSessionLock(sId, async () => {
          const session = await loadSessionWithQuiz(sId);
          if (!session || session.status === "ended") return;
          if (!isAuthorizedHost(session, socket)) {
            return socket.emit("error", {
              msg: "Faqat boshlovchi reaksiyalarni boshqara oladi!",
            });
          }

          const nextValue =
            typeof enabled === "boolean"
              ? enabled
              : session.reactionsEnabled === false;
          session.reactionsEnabled = nextValue;
          syncReactionGate(sId, nextValue);
          await persistSession(session);

          io.to(`session:${sId}`).emit("session:reactions-toggled", {
            reactionsEnabled: nextValue,
          });
        });
      } catch (err) {
        console.error("host:toggle-reactions error:", err);
      }
    });

    // ===================== XONANI QULFLASH (HOST) =====================
    socket.on("host:toggle-lock", async ({ sessionId, locked } = {}) => {
      const sId = sessionId || socket.sessionId;
      if (!sId) return;
      try {
        await withSessionLock(sId, async () => {
          const session = await loadSessionWithQuiz(sId);
          if (!session || session.status === "ended") return;
          if (!isAuthorizedHost(session, socket)) {
            return socket.emit("error", {
              msg: "Faqat boshlovchi xonani qulflay oladi!",
            });
          }

          const nextLocked =
            typeof locked === "boolean" ? locked : !Boolean(session.isLocked);
          session.isLocked = nextLocked;
          await persistSession(session);

          io.to(`session:${sId}`).emit("session:lock-toggled", {
            isLocked: nextLocked,
          });
        });
      } catch (err) {
        console.error("host:toggle-lock error:", err);
      }
    });

    // ===================== ORQA FON MAVZUSINI SAQLASH (HOST) =====================
    socket.on("host:set-background", async ({ sessionId, backgroundTheme } = {}) => {
      const sId = sessionId || socket.sessionId;
      if (!sId || typeof backgroundTheme !== "string") return;
      try {
        await withSessionLock(sId, async () => {
          const session = await loadSessionWithQuiz(sId);
          if (!session || session.status === "ended") return;
          if (!isAuthorizedHost(session, socket)) return;

          session.backgroundTheme = backgroundTheme.trim().slice(0, 40) || "default";
          await persistSession(session);
        });
      } catch (err) {
        console.error("host:set-background error:", err);
      }
    });

    // ===================== ULANISH UZILDI =====================
    socket.on("disconnect", () => {
      if (socket.role !== "player" || !socket.sessionId || !socket.playerId) {
        return;
      }

      const sId = socket.sessionId;
      const pId = socket.playerId;
      const disconnectedSocketId = socket.id;

      const bucket = getTimerBucket(sId);
      if (bucket.disconnectTimers.has(pId)) {
        clearTimeout(bucket.disconnectTimers.get(pId));
      }

      const timer = setTimeout(() => {
        bucket.disconnectTimers.delete(pId);
        withSessionLock(sId, async () => {
          const session = await loadSessionWithQuiz(sId);
          if (!session || session.status === "ended") return;

          const idx = (session.players || []).findIndex(
            (p) => p._id?.toString() === pId,
          );
          if (idx === -1) return;

          const player = session.players[idx];
          // Agar o'yinchi allaqachon yangi socket bilan qaytgan bo'lsa, tegmaymiz
          if (player.socketId && player.socketId !== disconnectedSocketId) {
            return;
          }

          if (session.status === "waiting") {
            session.players.splice(idx, 1);
            await persistSession(session);
            io.to(`session:${sId}`).emit("player:left", {
              playerId: pId,
              totalPlayers: session.players.length,
            });
          } else {
            player.connected = false;
            await persistSession(session);

            if (
              session.status === "question" &&
              session.currentQuestion >= 0
            ) {
              const qIdx = session.currentQuestion;
              const answeredCount = session.players.filter((p) =>
                (p.answers || []).some((a) => a.questionIndex === qIdx),
              ).length;
              const connectedPlayers = session.players.filter(
                (p) => p.connected !== false,
              );
              const allConnectedAnswered =
                connectedPlayers.length > 0 &&
                connectedPlayers.every((p) =>
                  (p.answers || []).some((a) => a.questionIndex === qIdx),
                );

              io.to(`session:${sId}`).emit("answer:progress", {
                questionIndex: qIdx,
                answered: answeredCount,
                total: session.players.length,
                connectedTotal: connectedPlayers.length,
              });

              if (allConnectedAnswered) {
                clearRoundTimers(sId);
                await showAnswerLocked(io, sId, qIdx);
              }
            }
          }
        }).catch((err) => console.error("disconnect cleanup error:", err));
      }, LOBBY_DISCONNECT_GRACE_MS);

      bucket.disconnectTimers.set(pId, timer);
    });
  });
}

// ===================== QULFLANGAN YORDAMCHI FUNKSIYALAR =====================

async function sendNextQuestionLocked(io, sessionId, forceIndex) {
  const session = await loadSessionWithQuiz(sessionId);
  if (!session || !session.quiz || session.status === "ended") return;

  const quiz = session.quiz;
  const nextIndex =
    forceIndex !== undefined ? forceIndex : session.currentQuestion + 1;

  if (nextIndex >= quiz.questions.length) {
    return endGameLocked(io, sessionId);
  }

  clearRoundTimers(sessionId);

  const question = quiz.questions[nextIndex];
  const timeLimit = clampNumber(question?.timeLimit, 5, 120, 20);
  const points = clampNumber(question?.points, 50, 1000, 100);
  const now = Date.now();
  const questionEndsAt = now + timeLimit * 1000;

  session.currentQuestion = nextIndex;
  session.status = "question";
  session.questionStartedAt = new Date(now);
  session.questionEndsAt = new Date(questionEndsAt);
  await persistSession(session);

  io.to(`session:${sessionId}`).emit("question:start", {
    questionIndex: nextIndex,
    totalQuestions: quiz.questions.length,
    type: resolveQuestionType(question),
    text: question.text,
    options: question.options,
    timeLimit,
    points,
    questionStartedAt: now,
    questionEndsAt,
    serverTime: now,
  });

  const bucket = getTimerBucket(sessionId);
  bucket.questionTimer = setTimeout(() => {
    withSessionLock(sessionId, () =>
      showAnswerLocked(io, sessionId, nextIndex),
    ).catch((err) => console.error("questionTimer error:", err));
  }, timeLimit * 1000 + QUESTION_TIMER_BUFFER_MS);
}

async function showAnswerLocked(io, sessionId, questionIndex) {
  const session = await loadSessionWithQuiz(sessionId);
  if (!session || !session.quiz) return;
  if (
    session.status !== "question" ||
    session.currentQuestion !== questionIndex
  ) {
    return;
  }

  clearRoundTimers(sessionId);

  const question = session.quiz.questions?.[questionIndex];
  if (!question) return;

  session.status = "answer";
  await persistSession(session);

  const allLeaderboard = buildLeaderboard(session.players);
  const leaderboard = allLeaderboard.slice(0, 5);
  const optionCounts = computeOptionCounts(
    session.players,
    questionIndex,
    question.options?.length || 0,
  );

  io.to(`session:${sessionId}`).emit("question:ended", {
    questionIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation || "",
    leaderboard,
    allLeaderboard,
    totalPlayers: session.players.length,
    optionCounts,
    serverTime: Date.now(),
  });
}

async function endGameLocked(io, sessionId) {
  clearSessionTimers(sessionId);
  sessionReactionsDisabled.delete(String(sessionId));

  let session;
  if (isDbConnected()) {
    session = await GameSession.findOneAndUpdate(
      { _id: sessionId, status: { $ne: "ended" } },
      { status: "ended", endedAt: new Date() },
      { new: true },
    ).populate("quiz");
  } else {
    const loaded = await loadSessionWithQuiz(sessionId);
    if (loaded && loaded.status !== "ended") {
      loaded.status = "ended";
      loaded.endedAt = new Date();
      await persistSession(loaded);
      session = loaded;
    }
  }
  if (!session) return;

  // Foydalanuvchilarga XP qo'shish (faqat 1 marta, atomik o'tishdan keyin)
  for (const player of session.players || []) {
    if (player.userId && player.score > 0) {
      try {
        if (isDbConnected()) {
          await User.findByIdAndUpdate(player.userId, {
            $inc: { xp: player.score, solvedQuizzes: 1 },
          });
        } else {
          const memUser = findMemoryUserById(player.userId);
          if (memUser) {
            memUser.xp = (memUser.xp || 0) + player.score;
            memUser.solvedQuizzes = (memUser.solvedQuizzes || 0) + 1;
          }
        }
      } catch (err) {
        console.error("XP qo'shishda xatolik:", err);
      }
    }
  }

  const finalLeaderboard = buildLeaderboard(session.players, true);
  const questionsReview = buildQuestionsReview(session.quiz);

  io.to(`session:${sessionId}`).emit("game:ended", {
    leaderboard: finalLeaderboard,
    quizTitle: session.quiz?.title || "Hatif Live",
    questionsReview,
    serverTime: Date.now(),
  });
}
