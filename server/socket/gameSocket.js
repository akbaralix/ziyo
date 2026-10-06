import GameSession from "../db/Quiz/GameSession.js";
import QuizGame from "../db/Quiz/QuizGame.js";
import User from "../db/User/User.js";
import jwt from "jsonwebtoken";

// Har bir sessiya uchun timer IDlarni saqlash
const sessionTimers = {};

export function initSocketIO(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
      } catch {}
    }
    next();
  });

  io.on("connection", (socket) => {
    // ===================== HOST ULANISHI =====================
    socket.on("host:join", async ({ sessionId }) => {
      try {
        const session = await GameSession.findById(sessionId).populate("quiz");
        if (!session) return socket.emit("error", { msg: "Sessiya topilmadi" });

        socket.sessionId = sessionId;
        socket.role = "host";
        socket.join(`session:${sessionId}`);

        const baseData = {
          sessionId,
          pin: session.pin,
          quizTitle: session.quiz.title,
          questionsCount: session.quiz.questions.length,
          status: session.status,
          players: session.players.map((p) => ({
            id: p._id,
            name: p.name,
            avatar: p.avatar,
            score: p.score,
          })),
        };

        if (session.status === "question" && session.currentQuestion >= 0) {
          const currentQ = session.quiz.questions[session.currentQuestion];
          const elapsed = session.questionStartedAt
            ? Math.floor(
                (Date.now() - new Date(session.questionStartedAt).getTime()) /
                  1000
              )
            : 0;
          const timeLeft = Math.max(0, currentQ.timeLimit - elapsed);
          const answeredCount = session.players.filter((p) =>
            p.answers.some((a) => a.questionIndex === session.currentQuestion)
          ).length;

          baseData.currentQuestion = {
            questionIndex: session.currentQuestion,
            totalQuestions: session.quiz.questions.length,
            text: currentQ.text,
            options: currentQ.options,
            timeLimit: currentQ.timeLimit,
            points: currentQ.points,
          };
          baseData.timeLeft = timeLeft;
          baseData.answeredCount = answeredCount;
        } else if (
          session.status === "answer" &&
          session.currentQuestion >= 0
        ) {
          const currentQ = session.quiz.questions[session.currentQuestion];
          const leaderboard = [...session.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));

          baseData.currentQuestion = {
            questionIndex: session.currentQuestion,
            totalQuestions: session.quiz.questions.length,
            text: currentQ.text,
            options: currentQ.options,
            timeLimit: currentQ.timeLimit,
            points: currentQ.points,
          };
          baseData.correctIndex = currentQ.correctIndex;
          baseData.leaderboard = leaderboard;
        } else if (session.status === "ended") {
          const finalLeaderboard = [...session.players]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => ({
              rank: i + 1,
              id: p._id,
              name: p.name,
              score: p.score,
              avatar: p.avatar,
            }));
          baseData.leaderboard = finalLeaderboard;
        }

        socket.emit("host:joined", baseData);
      } catch (err) {
        socket.emit("error", { msg: "Server xatosi" });
      }
    });

    // ===================== O'YINCHI ULANISHI =====================
    socket.on("player:join", async ({ sessionId, playerId, name, avatar }) => {
      try {
        const session = await GameSession.findOne({
          _id: sessionId,
          status: { $ne: "ended" },
        }).populate("quiz");

        if (!session) {
          return socket.emit("player:join:error", {
            msg: "O'yin topilmadi yoki tugagan",
          });
        }

        // Qayta ulanayotgan o'yinchini aniqlash
        let player = null;
        if (playerId) {
          player = session.players.find(
            (p) => p._id.toString() === playerId.toString()
          );
        }
        if (!player && name) {
          player = session.players.find(
            (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
          );
        }

        if (player) {
          // O'yinchi qayta ulandi
          player.socketId = socket.id;
          await session.save();

          socket.playerId = player._id.toString();
          socket.sessionId = sessionId;
          socket.role = "player";
          socket.join(`session:${sessionId}`);

          const myAnswer =
            session.currentQuestion >= 0
              ? player.answers.find(
                  (a) => a.questionIndex === session.currentQuestion
                )
              : null;

          const responseData = {
            playerId: player._id,
            name: player.name,
            score: player.score,
            status: session.status,
            quizTitle: session.quiz?.title,
            myAnswerHistory: player.answers || [],
          };

          if (session.status === "question" && session.currentQuestion >= 0) {
            const currentQ = session.quiz.questions[session.currentQuestion];
            const elapsed = session.questionStartedAt
              ? Math.floor(
                  (Date.now() - new Date(session.questionStartedAt).getTime()) /
                    1000
                )
              : 0;
            const timeLeft = Math.max(0, currentQ.timeLimit - elapsed);

            responseData.currentQuestion = {
              questionIndex: session.currentQuestion,
              totalQuestions: session.quiz.questions.length,
              text: currentQ.text,
              options: currentQ.options,
              timeLimit: currentQ.timeLimit,
              points: currentQ.points,
            };
            responseData.timeLeft = timeLeft;
            responseData.hasAnswered = !!myAnswer;
            responseData.chosenIndex = myAnswer ? myAnswer.chosenIndex : null;
          } else if (
            session.status === "answer" &&
            session.currentQuestion >= 0
          ) {
            const currentQ = session.quiz.questions[session.currentQuestion];
            responseData.currentQuestion = {
              questionIndex: session.currentQuestion,
              totalQuestions: session.quiz.questions.length,
              text: currentQ.text,
              options: currentQ.options,
              timeLimit: currentQ.timeLimit,
              points: currentQ.points,
            };
            responseData.correctIndex = currentQ.correctIndex;
            responseData.myAnswer = myAnswer
              ? {
                  isCorrect: myAnswer.isCorrect,
                  pointsEarned: myAnswer.pointsEarned,
                }
              : null;
          }

          socket.emit("player:joined", responseData);
          return;
        }

        // Yangi o'yinchi - faqat kutilayotgan (waiting) holatda qabul qilinadi
        if (session.status !== "waiting") {
          return socket.emit("player:join:error", {
            msg: "O'yin allaqachon boshlangan!",
          });
        }

        const newPlayer = {
          socketId: socket.id,
          userId: socket.userId || null,
          name: name || "Noma'lum",
          avatar: avatar || "",
          score: 0,
          answers: [],
        };

        session.players.push(newPlayer);
        await session.save();

        const savedPlayer = session.players[session.players.length - 1];
        socket.playerId = savedPlayer._id.toString();
        socket.sessionId = sessionId;
        socket.role = "player";
        socket.join(`session:${sessionId}`);

        // O'yinchiga tasdiqlash
        socket.emit("player:joined", {
          playerId: savedPlayer._id,
          name: savedPlayer.name,
          score: 0,
          status: "lobby",
          quizTitle: session.quiz?.title,
          myAnswerHistory: [],
        });

        // Hamma (host)ga yangi o'yinchi haqida xabar
        io.to(`session:${sessionId}`).emit("player:new", {
          id: savedPlayer._id,
          name: savedPlayer.name,
          avatar: savedPlayer.avatar,
          totalPlayers: session.players.length,
        });
      } catch (err) {
        console.error("player:join error:", err);
        socket.emit("player:join:error", { msg: "Server xatosi" });
      }
    });

    // ===================== O'YINNI BOSHLASH (HOST) =====================
    socket.on("host:start", async ({ sessionId }) => {
      try {
        const session = await GameSession.findById(sessionId).populate("quiz");
        if (!session || session.status !== "waiting") return;

        session.status = "active";
        session.startedAt = new Date();
        session.currentQuestion = -1;
        await session.save();

        io.to(`session:${sessionId}`).emit("game:started", {
          totalQuestions: session.quiz.questions.length,
        });

        // Birinchi savolni 2 soniyadan keyin yuborish
        setTimeout(() => sendNextQuestion(io, sessionId, session.quiz), 2000);
      } catch (err) {
        console.error("host:start error:", err);
      }
    });

    // ===================== JAVOB YUBORISH (O'YINCHI) =====================
    socket.on(
      "player:answer",
      async ({ sessionId, playerId, questionIndex, chosenIndex }) => {
        try {
          const session =
            await GameSession.findById(sessionId).populate("quiz");
          if (!session || session.status !== "question") return;
          if (session.currentQuestion !== questionIndex) return;

          const question = session.quiz.questions[questionIndex];
          const timeMs = Date.now() - session.questionStartedAt.getTime();
          const timeLimit = question.timeLimit * 1000;

          // Vaqt o'tib ketganmi?
          if (timeMs > timeLimit + 2000) return; // 2s tolerance

          const isCorrect = chosenIndex === question.correctIndex;
          // Tezroq javob bergan ko'proq ball oladi
          const timeFactor = Math.max(0, 1 - timeMs / timeLimit);
          const pointsEarned = isCorrect
            ? Math.round(question.points * (0.5 + 0.5 * timeFactor))
            : 0;

          const player = session.players.find(
            (p) => p._id.toString() === playerId,
          );
          if (!player) return;

          // Bir marta javob berish
          const alreadyAnswered = player.answers.some(
            (a) => a.questionIndex === questionIndex,
          );
          if (alreadyAnswered) return;

          player.answers.push({
            questionIndex,
            chosenIndex,
            isCorrect,
            timeMs,
            pointsEarned,
          });
          player.score += pointsEarned;
          await session.save();

          // Faqat o'yinchiga javob tasdiqi
          socket.emit("player:answer:ok", { isCorrect, pointsEarned });

          // Barcha ishtirokchilar javob berganmi?
          const answeredCount = session.players.filter((p) =>
            p.answers.some((a) => a.questionIndex === questionIndex),
          ).length;

          io.to(`session:${sessionId}`).emit("answer:progress", {
            answered: answeredCount,
            total: session.players.length,
          });

          if (answeredCount >= session.players.length) {
            // Barcha javob berdi — javobni ko'rsatish
            clearTimeout(sessionTimers[`${sessionId}_q`]);
            showAnswer(io, sessionId, session, questionIndex);
          }
        } catch (err) {
          console.error("player:answer error:", err);
        }
      },
    );

    // ===================== KEYINGI SAVOL (HOST) =====================
    socket.on("host:next", async ({ sessionId }) => {
      try {
        const session = await GameSession.findById(sessionId).populate("quiz");
        if (!session) return;

        if (session.status === "answer") {
          // Keyingi savolga o'tish
          const nextIndex = session.currentQuestion + 1;
          if (nextIndex < session.quiz.questions.length) {
            await sendNextQuestion(io, sessionId, session.quiz, nextIndex);
          } else {
            // O'yin tugadi
            await endGame(io, sessionId);
          }
        }
      } catch (err) {
        console.error("host:next error:", err);
      }
    });

    // ===================== O'YINNI TUGATISH (HOST) =====================
    socket.on("host:end", async ({ sessionId }) => {
      await endGame(io, sessionId);
    });

    // ===================== ULANISH UZILDI =====================
    socket.on("disconnect", async () => {
      if (socket.role === "player" && socket.sessionId && socket.playerId) {
        try {
          const session = await GameSession.findById(socket.sessionId);
          if (session && session.status === "waiting") {
            io.to(`session:${socket.sessionId}`).emit("player:left", {
              playerId: socket.playerId,
            });
          }
        } catch {}
      }
    });
  });
}

// ===================== YORDAMCHI FUNKSIYALAR =====================

async function sendNextQuestion(io, sessionId, quiz, forceIndex) {
  const session = await GameSession.findById(sessionId);
  if (!session) return;

  const nextIndex =
    forceIndex !== undefined ? forceIndex : session.currentQuestion + 1;

  if (nextIndex >= quiz.questions.length) {
    return endGame(io, sessionId);
  }

  const question = quiz.questions[nextIndex];
  session.currentQuestion = nextIndex;
  session.status = "question";
  session.questionStartedAt = new Date();
  await session.save();

  // Faqat matn va variantlarni yuborish (to'g'ri javobsiz)
  io.to(`session:${sessionId}`).emit("question:start", {
    questionIndex: nextIndex,
    totalQuestions: quiz.questions.length,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    points: question.points,
  });

  // Vaqt tugaganda avtomatik javobni ko'rsatish
  const timerId = setTimeout(
    async () => {
      const freshSession =
        await GameSession.findById(sessionId).populate("quiz");
      if (freshSession && freshSession.status === "question") {
        showAnswer(io, sessionId, freshSession, nextIndex);
      }
    },
    question.timeLimit * 1000 + 500,
  );

  sessionTimers[`${sessionId}_q`] = timerId;
}

async function showAnswer(io, sessionId, session, questionIndex) {
  const freshSession =
    await GameSession.findById(sessionId).populate("quiz");
  if (!freshSession) return;
  const question = freshSession.quiz?.questions?.[questionIndex];
  if (!question) return;

  freshSession.status = "answer";
  await freshSession.save();

  // Leaderboard hisoblash
  const leaderboard = [...freshSession.players]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));

  io.to(`session:${sessionId}`).emit("question:ended", {
    correctIndex: question.correctIndex,
    explanation: question.explanation || "",
    leaderboard,
    questionIndex,
  });
}

async function endGame(io, sessionId) {
  const session = await GameSession.findByIdAndUpdate(
    sessionId,
    { status: "ended", endedAt: new Date() },
    { new: true },
  ).populate("quiz");
  if (!session) return;

  // Foydalanuvchilarga XP qo'shish va yechilgan testlar sonini oshirish
  for (const player of session.players) {
    if (player.userId && player.score > 0) {
      try {
        await User.findByIdAndUpdate(player.userId, {
          $inc: { xp: player.score, solvedQuizzes: 1 },
        });
      } catch (err) {
        console.error("XP qo'shishda xatolik:", err);
      }
    }
  }

  const finalLeaderboard = [...session.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      rank: i + 1,
      id: p._id,
      name: p.name,
      score: p.score,
      avatar: p.avatar,
      answers: p.answers,
    }));

  // Savollar tahlili (Xatolar ustida ishlash uchun)
  const questionsReview =
    session.quiz?.questions?.map((q, qIdx) => ({
      questionIndex: qIdx,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      points: q.points,
    })) || [];

  io.to(`session:${sessionId}`).emit("game:ended", {
    leaderboard: finalLeaderboard,
    quizTitle: session.quiz?.title || "Ziyo Live",
    questionsReview,
  });

  // Timerlarni tozalash
  clearTimeout(sessionTimers[`${sessionId}_q`]);
  delete sessionTimers[`${sessionId}_q`];
}
