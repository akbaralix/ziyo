import GameSession from "../db/Quiz/GameSession.js";
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
        socket.userId = decoded.userId || decoded.id || decoded._id;
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
        socket.playerName = "Boshlovchi";
        socket.join(`session:${sessionId}`);

        const creatorId =
          session.host?.toString() || session.quiz?.host?.toString() || null;

        const baseData = {
          sessionId,
          pin: session.pin,
          quizTitle: session.quiz.title,
          questionsCount: session.quiz.questions.length,
          status: session.status,
          creatorId,
          hostId: creatorId,
          players: session.players.map((p) => ({
            id: p._id,
            name: p.name,
            profilePic: p.profilePic,
            score: p.score,
          })),
        };

        if (session.status === "question" && session.currentQuestion >= 0) {
          const currentQ = session.quiz.questions[session.currentQuestion];
          const elapsed = session.questionStartedAt
            ? Math.floor(
                (Date.now() - new Date(session.questionStartedAt).getTime()) /
                  1000,
              )
            : 0;
          const timeLeft = Math.max(0, currentQ.timeLimit - elapsed);

          // Agar vaqt tugab bo'lgan bo'lsa, avtomatik javob holatiga o'tkazish
          if (timeLeft <= 0) {
            clearTimeout(sessionTimers[`${sessionId}_q`]);
            await showAnswer(io, sessionId, session, session.currentQuestion);
            const freshSession =
              await GameSession.findById(sessionId).populate("quiz");
            const freshQ =
              freshSession.quiz.questions[freshSession.currentQuestion];
            const leaderboard = [...freshSession.players]
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map((p, i) => ({
                rank: i + 1,
                name: p.name,
                score: p.score,
                profilePic: p.profilePic,
              }));

            baseData.status = "answer";
            baseData.currentQuestion = {
              questionIndex: freshSession.currentQuestion,
              totalQuestions: freshSession.quiz.questions.length,
              text: freshQ.text,
              options: freshQ.options,
              timeLimit: freshQ.timeLimit,
              points: freshQ.points,
            };
            baseData.correctIndex = freshQ.correctIndex;
            baseData.leaderboard = leaderboard;
          } else {
            const answeredCount = session.players.filter((p) =>
              p.answers.some(
                (a) => a.questionIndex === session.currentQuestion,
              ),
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
          }
        } else if (
          session.status === "answer" &&
          session.currentQuestion >= 0
        ) {
          const currentQ = session.quiz.questions[session.currentQuestion];
          const leaderboard = [...session.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((p, i) => ({
              rank: i + 1,
              name: p.name,
              score: p.score,
              profilePic: p.profilePic,
            }));

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
              profilePic: p.profilePic,
            }));
          baseData.leaderboard = finalLeaderboard;
        }

        socket.emit("host:joined", baseData);
      } catch (err) {
        console.error("host:join error:", err);
        socket.emit("error", { msg: "Server xatosi" });
      }
    });

    // ===================== O'YINCHI ULANISHI =====================
    socket.on(
      "player:join",
      async ({ sessionId, playerId, name, profilePic }) => {
        try {
          const session =
            await GameSession.findById(sessionId).populate("quiz");

          if (!session) {
            return socket.emit("player:join:error", {
              msg: "O'yin topilmadi yoki tugagan",
            });
          }

          // Qayta ulanayotgan o'yinchini aniqlash (ID, name yoki userId orqali)
          let player = null;
          if (playerId) {
            player = session.players.find(
              (p) => p._id.toString() === playerId.toString(),
            );
          }
          if (!player && name) {
            player = session.players.find(
              (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
            );
          }
          if (!player && socket.userId) {
            player = session.players.find(
              (p) =>
                p.userId && p.userId.toString() === socket.userId.toString(),
            );
          }

          if (player) {
            // O'yinchi qayta ulandi
            player.socketId = socket.id;
            if (profilePic) {
              player.profilePic = profilePic;
            }
            await session.save();

            socket.playerId = player._id.toString();
            socket.sessionId = sessionId;
            socket.playerName = player.name;
            socket.role = "player";
            socket.join(`session:${sessionId}`);

            // Hostga o'yinchi ro'yxatini yangilash uchun xabar beramiz
            io.to(`session:${sessionId}`).emit("player:new", {
              id: player._id,
              name: player.name,
              profilePic: player.profilePic,
              score: player.score,
            });

            const myAnswer =
              session.currentQuestion >= 0
                ? player.answers.find(
                    (a) => a.questionIndex === session.currentQuestion,
                  )
                : null;

            const responseData = {
              playerId: player._id,
              name: player.name,
              score: player.score,
              profilePic: player.profilePic,
              status: session.status,
              quizTitle: session.quiz?.title,
              myAnswerHistory: player.answers || [],
            };

            if (session.status === "question" && session.currentQuestion >= 0) {
              const currentQ = session.quiz.questions[session.currentQuestion];
              const elapsed = session.questionStartedAt
                ? Math.floor(
                    (Date.now() -
                      new Date(session.questionStartedAt).getTime()) /
                      1000,
                  )
                : 0;
              const timeLeft = Math.max(0, currentQ.timeLimit - elapsed);

              // Agar internet uzilgan paytda savol vaqti tugab bo'lgan bo'lsa
              if (timeLeft <= 0) {
                clearTimeout(sessionTimers[`${sessionId}_q`]);
                await showAnswer(
                  io,
                  sessionId,
                  session,
                  session.currentQuestion,
                );
                const freshSession =
                  await GameSession.findById(sessionId).populate("quiz");
                const freshQ =
                  freshSession.quiz.questions[freshSession.currentQuestion];
                const allLeaderboard = [...freshSession.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => ({
                    rank: i + 1,
                    id: p._id.toString(),
                    name: p.name,
                    score: p.score,
                    profilePic: p.profilePic,
                  }));
                const myRank =
                  allLeaderboard.findIndex(
                    (p) => p.id === player._id.toString(),
                  ) + 1;

                responseData.status = "answer";
                responseData.currentQuestion = {
                  questionIndex: freshSession.currentQuestion,
                  totalQuestions: freshSession.quiz.questions.length,
                  text: freshQ.text,
                  options: freshQ.options,
                  timeLimit: freshQ.timeLimit,
                  points: freshQ.points,
                };
                responseData.correctIndex = freshQ.correctIndex;
                responseData.myAnswer = myAnswer
                  ? {
                      isCorrect: myAnswer.isCorrect,
                      pointsEarned: myAnswer.pointsEarned,
                    }
                  : null;
                responseData.leaderboard = allLeaderboard.slice(0, 5);
                responseData.allLeaderboard = allLeaderboard;
                responseData.myRank = myRank;
                responseData.totalPlayers = freshSession.players.length;
              } else {
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
                responseData.chosenIndex = myAnswer
                  ? myAnswer.chosenIndex
                  : null;
              }
            } else if (
              session.status === "answer" &&
              session.currentQuestion >= 0
            ) {
              const currentQ = session.quiz.questions[session.currentQuestion];
              const allLeaderboard = [...session.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => ({
                  rank: i + 1,
                  id: p._id.toString(),
                  name: p.name,
                  score: p.score,
                  profilePic: p.profilePic,
                }));
              const myRank =
                allLeaderboard.findIndex(
                  (p) => p.id === player._id.toString(),
                ) + 1;

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
              responseData.leaderboard = allLeaderboard.slice(0, 5);
              responseData.allLeaderboard = allLeaderboard;
              responseData.myRank = myRank;
              responseData.totalPlayers = session.players.length;
            } else if (session.status === "ended") {
              const finalLeaderboard = [...session.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => ({
                  rank: i + 1,
                  id: p._id.toString(),
                  name: p.name,
                  score: p.score,
                  profilePic: p.profilePic,
                }));
              const myRank =
                finalLeaderboard.findIndex(
                  (p) => p.id === player._id.toString(),
                ) + 1;
              const questionsReview = (session.quiz?.questions || []).map(
                (q) => ({
                  text: q.text,
                  correctIndex: q.correctIndex,
                  explanation: q.explanation || "",
                }),
              );

              responseData.status = "ended";
              responseData.leaderboard = finalLeaderboard;
              responseData.allLeaderboard = finalLeaderboard;
              responseData.myRank = myRank;
              responseData.questionsReview = questionsReview;
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
            profilePic: profilePic || "",
            score: 0,
            answers: [],
          };

          session.players.push(newPlayer);
          await session.save();

          const savedPlayer = session.players[session.players.length - 1];
          socket.playerId = savedPlayer._id.toString();
          socket.sessionId = sessionId;
          socket.playerName = savedPlayer.name;
          socket.role = "player";
          socket.join(`session:${sessionId}`);

          // O'yinchiga tasdiqlash
          socket.emit("player:joined", {
            playerId: savedPlayer._id,
            name: savedPlayer.name,
            score: 0,
            profilePic: savedPlayer.profilePic,
            status: "lobby",
            quizTitle: session.quiz?.title,
            myAnswerHistory: [],
          });

          // Hamma (host)ga yangi o'yinchi haqida xabar
          io.to(`session:${sessionId}`).emit("player:new", {
            id: savedPlayer._id,
            name: savedPlayer.name,
            profilePic: savedPlayer.profilePic,
            totalPlayers: session.players.length,
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
      async ({ sessionId, playerId, profilePic }) => {
        try {
          const session = await GameSession.findById(sessionId);
          if (!session) return;

          const player = session.players.find(
            (p) => p._id.toString() === playerId,
          );
          if (player) {
            player.profilePic = profilePic;
            await session.save();

            io.to(`session:${sessionId}`).emit("player:avatar:updated", {
              playerId,
              profilePic,
            });
          }
        } catch (err) {
          console.error("player:update-avatar error:", err);
        }
      },
    );

    // ===================== ISMNI YANGILASH =====================
    socket.on("player:update-name", async ({ sessionId, playerId, name }) => {
      try {
        const newName = (name || "").trim();
        if (!newName) return;
        const session = await GameSession.findById(sessionId);
        if (!session) return;

        const player = session.players.find(
          (p) => p._id.toString() === playerId,
        );
        if (player) {
          player.name = newName;
          await session.save();

          socket.playerName = newName;

          io.to(`session:${sessionId}`).emit("player:name:updated", {
            playerId,
            name: newName,
          });
        }
      } catch (err) {
        console.error("player:update-name error:", err);
      }
    });

    socket.on("send_reaction", ({ emoji, sessionId, user, name }) => {
      try {
        const sId = sessionId || socket.sessionId;
        if (!sId || !emoji) return;

        const senderName =
          name ||
          user?.name ||
          socket.playerName ||
          (socket.role === "host" ? "Boshlovchi" : "O'yinchi");

        const reactionData = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          emoji,
          sessionId: sId,
          name: senderName,
          playerId: socket.playerId || null,
          role: socket.role || "player",
          timestamp: Date.now(),
        };

        io.to(`session:${sId}`).emit("receive_reaction", reactionData);
        io.to(`session:${sId}`).emit("recive_reaction", reactionData);
      } catch (err) {
        console.error("send_reaction error:", err);
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
            ? Math.round(question.points * (1 + 5 * timeFactor))
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

          // Saralangan o'yinchilar bo'yicha joriy o'rinni hisoblash
          const sortedPlayers = [...session.players].sort(
            (a, b) => b.score - a.score,
          );
          const currentRank =
            sortedPlayers.findIndex(
              (p) => p._id.toString() === playerId.toString(),
            ) + 1;

          // Faqat o'yinchiga javob tasdiqi (joriy o'rni bilan birga)
          socket.emit("player:answer:ok", {
            isCorrect,
            pointsEarned,
            rank: currentRank,
            totalPlayers: session.players.length,
            score: player.score,
          });

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
    socket.on("host:end", async ({ sessionId, userId }) => {
      try {
        const session = await GameSession.findById(sessionId).populate("quiz");
        if (!session || session.status === "ended") return;

        const currentUserId = userId || socket.userId;
        const creatorId =
          session.host?.toString() || session.quiz?.host?.toString();

        if (
          currentUserId &&
          creatorId &&
          currentUserId.toString() === creatorId.toString()
        ) {
          await endGame(io, sessionId);
        } else {
          socket.emit("error", {
            msg: "Faqat o'yinni yaratgan foydalanuvchi uni yakunlashi mumkin!",
          });
        }
      } catch (err) {
        console.error("host:end error:", err);
      }
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
  const freshSession = await GameSession.findById(sessionId).populate("quiz");
  if (!freshSession) return;
  const question = freshSession.quiz?.questions?.[questionIndex];
  if (!question) return;

  freshSession.status = "answer";
  await freshSession.save();

  // Leaderboard hisoblash
  const allLeaderboard = [...freshSession.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      rank: i + 1,
      id: p._id.toString(),
      name: p.name,
      score: p.score,
      profilePic: p.profilePic,
    }));
  const leaderboard = allLeaderboard.slice(0, 5);

  io.to(`session:${sessionId}`).emit("question:ended", {
    correctIndex: question.correctIndex,
    explanation: question.explanation || "",
    leaderboard,
    allLeaderboard,
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
      profilePic: p.profilePic,
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
    quizTitle: session.quiz?.title || "Hatif Live",
    questionsReview,
  });

  // Timerlarni tozalash
  clearTimeout(sessionTimers[`${sessionId}_q`]);
  delete sessionTimers[`${sessionId}_q`];
}
