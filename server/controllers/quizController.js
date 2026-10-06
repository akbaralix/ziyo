import QuizGame from "../db/Quiz/QuizGame.js";
import GameSession from "../db/Quiz/GameSession.js";

// 6 raqamli noyob PIN yaratish
function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===================== QUIZ GAME CRUD =====================

// Yangi viktorina yaratish
export async function createQuizGame(req, res) {
  try {
    const { title, description, questions } = req.body;

    if (!title || !questions || questions.length < 8 || questions.length > 25) {
      return res.status(400).json({
        error: "Sarlavha kiritilishi va 8-25 ta savol bo'lishi shart",
      });
    }

    // Har bir savol validatsiyasi
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.options || q.options.length < 2 || q.correctIndex == null) {
        return res.status(400).json({ error: `${i + 1}-savol noto'g'ri formatda` });
      }
    }

    const quiz = await QuizGame.create({
      host: req.user._id,
      title,
      description: description || "",
      questions,
    });

    res.status(201).json({ success: true, quiz });
  } catch (err) {
    console.error("createQuizGame error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Foydalanuvchining barcha viktorinalari
export async function getMyQuizGames(req, res) {
  try {
    const games = await QuizGame.find({ host: req.user._id })
      .sort({ createdAt: -1 })
      .select("-questions"); // Ko'p ma'lumot uchun savolsiz
    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Bitta viktorina (savollar bilan) - faqat host uchun
export async function getQuizGameById(req, res) {
  try {
    const quiz = await QuizGame.findOne({
      _id: req.params.id,
      host: req.user._id,
    });
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });
    res.json({ quiz });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Viktorinani yangilash
export async function updateQuizGame(req, res) {
  try {
    const { title, description, questions } = req.body;
    const quiz = await QuizGame.findOneAndUpdate(
      { _id: req.params.id, host: req.user._id },
      { title, description, questions },
      { new: true }
    );
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });
    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Viktorinani o'chirish
export async function deleteQuizGame(req, res) {
  try {
    const quiz = await QuizGame.findOneAndDelete({
      _id: req.params.id,
      host: req.user._id,
    });
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
}

// ===================== GAME SESSION =====================

// Jonli o'yin sessiyasini yaratish
export async function createGameSession(req, res) {
  try {
    const quiz = await QuizGame.findOne({
      _id: req.params.quizId,
      host: req.user._id,
    });
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });

    // Avvalgi aktiv sessiyalarni yakunlash
    await GameSession.updateMany(
      { host: req.user._id, status: { $in: ["waiting", "active", "question", "answer"] } },
      { status: "ended", endedAt: new Date() }
    );

    // Noyob PIN yaratish
    let pin;
    let exists = true;
    while (exists) {
      pin = generatePin();
      exists = await GameSession.findOne({ pin, status: { $ne: "ended" } });
    }

    const session = await GameSession.create({
      quiz: quiz._id,
      host: req.user._id,
      pin,
      status: "waiting",
    });

    // playCount ni oshirish
    await QuizGame.findByIdAndUpdate(quiz._id, { $inc: { playCount: 1 } });

    res.status(201).json({
      success: true,
      sessionId: session._id,
      pin,
      quizTitle: quiz.title,
      questionsCount: quiz.questions.length,
    });
  } catch (err) {
    console.error("createGameSession error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// PIN orqali sessiyaga qo'shilish (REST - dastlabki tekshiruv)
export async function joinByPin(req, res) {
  try {
    const { pin } = req.params;
    const session = await GameSession.findOne({
      pin,
      status: { $in: ["waiting", "active"] },
    }).populate("quiz", "title questionsCount description");

    if (!session) {
      return res.status(404).json({ error: "Bunday PIN topilmadi yoki o'yin tugagan" });
    }

    res.json({
      sessionId: session._id,
      status: session.status,
      quizTitle: session.quiz?.title,
      playersCount: session.players.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
}



// O'yin natijalarini olish
export async function getSessionResults(req, res) {
  try {
    const session = await GameSession.findById(req.params.sessionId)
      .populate("quiz", "title questions")
      .populate("players.userId", "firstName lastName");

    if (!session) return res.status(404).json({ error: "Sessiya topilmadi" });

    const leaderboard = [...session.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        rank: i + 1,
        name: p.name,
        score: p.score,
        answers: p.answers,
      }));

    res.json({ leaderboard, quizTitle: session.quiz?.title });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
}


