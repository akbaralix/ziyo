import { GoogleGenAI, Type } from "@google/genai";
import QuizGame from "../db/Quiz/QuizGame.js";
import GameSession from "../db/Quiz/GameSession.js";
import { isDbConnected } from "../db/db.js";
import {
  createMemoryGameSession,
  createMemoryQuiz,
  deleteMemoryQuizByIdAndHost,
  endMemorySessionsForHost,
  findMemoryQuizById,
  findMemoryQuizByIdAndHost,
  findMemoryQuizzesByHost,
  findMemorySessionById,
  findMemorySessionByPin,
  findMemoryUserById,
  updateMemoryQuizByIdAndHost,
} from "../db/memoryStore.js";
import { clearSessionTimers } from "../socket/gameSocket.js";

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// 6 raqamli noyob PIN yaratish
function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function clampInt(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeAndValidateQuizPayload(body = {}) {
  const { title, description, questions } = body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    !Array.isArray(questions) ||
    questions.length < 5 ||
    questions.length > 25
  ) {
    return {
      error: "Sarlavha kiritilishi va 5-25 ta savol bo'lishi shart",
    };
  }

  const normalizedQuestions = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q.text !== "string" || !q.text.trim()) {
      return { error: `${i + 1}-savol matni bo'sh bo'lishi mumkin emas` };
    }

    const qType = q.type === "true_false" ? "true_false" : "quiz";

    if (qType === "true_false") {
      const rawOpts = Array.isArray(q.options) ? q.options : [];
      const optTrue =
        typeof rawOpts[0] === "string" && rawOpts[0].trim()
          ? rawOpts[0].trim().slice(0, 100)
          : "To'g'ri";
      const optFalse =
        typeof rawOpts[1] === "string" && rawOpts[1].trim()
          ? rawOpts[1].trim().slice(0, 100)
          : "Noto'g'ri";

      const rawCorrect = Number(q.correctIndex);
      if (rawCorrect !== 0 && rawCorrect !== 1) {
        return { error: `${i + 1}-savolda To'g'ri yoki Noto'g'ri tanlanmagan` };
      }

      normalizedQuestions.push({
        type: "true_false",
        text: q.text.trim().slice(0, 500),
        options: [optTrue, optFalse],
        correctIndex: rawCorrect,
        timeLimit: clampInt(q.timeLimit, 5, 120, 20),
        points: clampInt(q.points, 50, 1000, 100),
        explanation:
          typeof q.explanation === "string"
            ? q.explanation.trim().slice(0, 500)
            : "",
      });
      continue;
    }

    if (!Array.isArray(q.options)) {
      return { error: `${i + 1}-savol variantlari noto'g'ri formatda` };
    }

    const rawOptions = q.options.map((opt) =>
      typeof opt === "string" ? opt.trim() : String(opt ?? "").trim(),
    );
    const nonEmptyEntries = rawOptions
      .map((opt, idx) => ({ opt, idx }))
      .filter((entry) => entry.opt !== "");

    if (nonEmptyEntries.length < 2 || nonEmptyEntries.length > 4) {
      return {
        error: `${i + 1}-savolda 2 tadan 4 tagacha to'ldirilgan variant bo'lishi kerak`,
      };
    }

    const rawCorrect = Number(q.correctIndex);
    if (!Number.isInteger(rawCorrect)) {
      return { error: `${i + 1}-savolda to'g'ri javob tanlanmagan` };
    }

    let mappedCorrectIndex = nonEmptyEntries.findIndex(
      (entry) => entry.idx === rawCorrect,
    );
    if (mappedCorrectIndex === -1) {
      if (rawCorrect >= 0 && rawCorrect < nonEmptyEntries.length) {
        mappedCorrectIndex = rawCorrect;
      } else {
        return { error: `${i + 1}-savolning to'g'ri javobi noto'g'ri` };
      }
    }

    normalizedQuestions.push({
      type: "quiz",
      text: q.text.trim().slice(0, 500),
      options: nonEmptyEntries.map((entry) => entry.opt.slice(0, 200)),
      correctIndex: mappedCorrectIndex,
      timeLimit: clampInt(q.timeLimit, 5, 120, 20),
      points: clampInt(q.points, 50, 1000, 100),
      explanation:
        typeof q.explanation === "string"
          ? q.explanation.trim().slice(0, 500)
          : "",
    });
  }

  const allTrueFalse = normalizedQuestions.every(
    (item) => item.type === "true_false",
  );
  const someTrueFalse = normalizedQuestions.some(
    (item) => item.type === "true_false",
  );
  const gameMode = allTrueFalse
    ? "true_false"
    : someTrueFalse
      ? "mixed"
      : "quiz";

  return {
    data: {
      title: title.trim().slice(0, 100),
      description:
        typeof description === "string" ? description.trim().slice(0, 500) : "",
      gameMode,
      questionCount: normalizedQuestions.length,
      questions: normalizedQuestions,
    },
  };
}

// ===================== QUIZ GAME CRUD =====================

// Yangi viktorina yaratish
export async function createQuizGame(req, res) {
  try {
    const { error, data } = normalizeAndValidateQuizPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const quiz = isDbConnected()
      ? await QuizGame.create({
          host: req.user._id,
          ...data,
        })
      : createMemoryQuiz({
          host: req.user._id,
          ...data,
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
    const games = isDbConnected()
      ? await QuizGame.find({ host: req.user._id })
          .sort({ createdAt: -1 })
          .select("-questions")
      : findMemoryQuizzesByHost(req.user._id);
    res.json({ games });
  } catch (err) {
    console.error("getMyQuizGames error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Bitta viktorina (savollar bilan) - faqat host uchun
export async function getQuizGameById(req, res) {
  try {
    const quiz = isDbConnected()
      ? await QuizGame.findOne({
          _id: req.params.id,
          host: req.user._id,
        })
      : findMemoryQuizByIdAndHost(req.params.id, req.user._id);
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });
    res.json({ quiz });
  } catch (err) {
    console.error("getQuizGameById error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Viktorinani yangilash
export async function updateQuizGame(req, res) {
  try {
    const { error, data } = normalizeAndValidateQuizPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const quiz = isDbConnected()
      ? await QuizGame.findOneAndUpdate(
          { _id: req.params.id, host: req.user._id },
          data,
          { new: true, runValidators: true },
        )
      : updateMemoryQuizByIdAndHost(req.params.id, req.user._id, data);
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });
    res.json({ success: true, quiz });
  } catch (err) {
    console.error("updateQuizGame error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Viktorinani o'chirish
export async function deleteQuizGame(req, res) {
  try {
    const quiz = isDbConnected()
      ? await QuizGame.findOneAndDelete({
          _id: req.params.id,
          host: req.user._id,
        })
      : deleteMemoryQuizByIdAndHost(req.params.id, req.user._id);
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteQuizGame error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// ===================== AI QUIZ GENERATOR =====================

export async function generateAiQuiz(req, res) {
  try {
    const ai = createGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          "Serverda Gemini API kaliti sozlanmagan. Iltimos, Secrets bo'limidan GEMINI_API_KEY ni tekshiring.",
      });
    }

    const {
      topic,
      count = 8,
      difficulty = "o'rtacha",
      timeLimit = 20,
      questionFormat = "quiz",
    } = req.body || {};

    const cleanTopic = typeof topic === "string" ? topic.trim() : "";
    if (!cleanTopic) {
      return res.status(400).json({ error: "Iltimos, mavzu nomini kiriting" });
    }

    const safeCount = clampInt(count, 5, 25, 8);
    const safeTimeLimit = clampInt(timeLimit, 5, 120, 20);
    const safeFormat = ["quiz", "true_false", "mixed"].includes(questionFormat)
      ? questionFormat
      : "quiz";

    const difficultyText =
      difficulty === "oson"
        ? "oson darajadagi"
        : difficulty === "qiyin"
          ? "murakkab, chuqur fikrlash talab qiladigan"
          : difficulty === "aralash"
            ? "har xil qiyinlikdagi (osondan qiyingacha)"
            : "o'rtacha darajadagi";

    let formatRules = "";
    if (safeFormat === "true_false") {
      formatRules = `BARCHA ${safeCount} ta savol Kahoot uslubidagi "To'g'ri / Noto'g'ri" (True/False) formatida bo'lsin:
- "type": "true_false"
- "text": aniq fakt yoki fikr bayoni (masalan, "Yer Quyosh atrofida 365 kunda bir marta aylanadi" yoki chalg'ituvchi noto'g'ri bayon).
- "options": aniq ["To'g'ri", "Noto'g'ri"]
- "correctIndex": 0 (agar bayon to'g'ri bo'lsa) yoki 1 (agar bayon noto'g'ri bo'lsa). To'g'ri (0) va Noto'g'ri (1) javoblari taxminan teng va tasodifiy aralashtirilgan bo'lsin.`;
    } else if (safeFormat === "mixed") {
      formatRules = `Savollar ARALASH formatda bo'lsin (taxminan yarmi "quiz", yarmi "true_false"):
1) "quiz" turidagi savollar uchun: "type": "quiz", aniq 4 ta qisqa variantli "options", "correctIndex" 0..3 oralig'ida aralashtirilgan.
2) "true_false" turidagi savollar uchun: "type": "true_false", "options": ["To'g'ri", "Noto'g'ri"], "correctIndex": 0 ("To'g'ri") yoki 1 ("Noto'g'ri"), aniq fakt/bayon matni bilan.`;
    } else {
      formatRules = `BARCHA ${safeCount} ta savol 4 variantli test formatida bo'lsin:
- "type": "quiz"
- "options": aniq 4 ta qisqa va mantiqiy variant (1 ta to'g'ri va 3 ta chalg'ituvchi)
- "correctIndex": 0, 1, 2 yoki 3 (to'g'ri javob har safar turli o'rinda bo'lsin).`;
    }

    const prompt = `Siz professional ta'lim va viktorina tuzish ekspertisiz. '${cleanTopic.slice(0, 180)}' mavzusida (${difficultyText}) o'zbek tilida aniq ${safeCount} ta sifatli savol tuzing.

${formatRules}

Har bir savolda "explanation" maydonida nima uchun bu javob to'g'riligi o'zbek tilida 1-2 gap bilan qisqa tushuntirilsin.`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Savol turi: 'quiz' yoki 'true_false'",
              },
              text: {
                type: Type.STRING,
                description: "Savol yoki bayon matni",
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "Variantlar ro'yxati (quiz uchun 4 ta, true_false uchun ['To\\'g\\'ri', 'Noto\\'g\\'ri'])",
              },
              correctIndex: {
                type: Type.INTEGER,
                description: "To'g'ri javob indeksi (0 dan boshlanadi)",
              },
              explanation: {
                type: Type.STRING,
                description: "To'g'ri javob izohi",
              },
            },
            required: ["text", "options", "correctIndex"],
          },
        },
      },
    });

    const rawText = (response.text || "[]").trim();
    const cleanedJson = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();

    let parsed = JSON.parse(cleanedJson);
    if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
      parsed =
        parsed.questions || parsed.tests || parsed.savollar || parsed.data || [];
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return res.status(502).json({
        error: "AI javobidan savollar ro'yxatini ajratib bo'lmadi",
      });
    }

    const normalized = parsed.slice(0, 25).map((item) => {
      const detectedTrueFalse =
        safeFormat === "true_false" ||
        (safeFormat === "mixed" &&
          (item?.type === "true_false" ||
            (Array.isArray(item?.options) && item.options.length === 2)));

      if (detectedTrueFalse) {
        let idx = Number(item?.correctIndex);
        if (idx !== 0 && idx !== 1) idx = 0;
        return {
          type: "true_false",
          text: String(item?.text || "").trim(),
          options: ["To'g'ri", "Noto'g'ri"],
          correctIndex: idx,
          timeLimit: safeTimeLimit,
          points: 100,
          explanation: item?.explanation ? String(item.explanation).trim() : "",
        };
      }

      const rawOpts = Array.isArray(item?.options)
        ? item.options.map((o) => String(o ?? "").trim()).filter(Boolean)
        : [];
      while (rawOpts.length < 4) {
        rawOpts.push(`Variant ${rawOpts.length + 1}`);
      }
      const finalOpts = rawOpts.slice(0, 4);
      let idx = Number(item?.correctIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= finalOpts.length) {
        idx = 0;
      }

      return {
        type: "quiz",
        text: String(item?.text || "").trim(),
        options: finalOpts,
        correctIndex: idx,
        timeLimit: safeTimeLimit,
        points: 100,
        explanation: item?.explanation ? String(item.explanation).trim() : "",
      };
    });

    res.json({ success: true, questions: normalized });
  } catch (err) {
    console.error("generateAiQuiz error:", err);
    const status = Number(err?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: err?.message || "AI orqali savollarni yaratishda xatolik yuz berdi",
    });
  }
}

// ===================== GAME SESSION =====================

// Jonli o'yin sessiyasini yaratish
export async function createGameSession(req, res) {
  try {
    const dbOnline = isDbConnected();
    const quiz = dbOnline
      ? await QuizGame.findOne({
          _id: req.params.quizId,
          host: req.user._id,
        })
      : findMemoryQuizByIdAndHost(req.params.quizId, req.user._id);
    if (!quiz) return res.status(404).json({ error: "Viktorina topilmadi" });

    if (dbOnline) {
      // Avvalgi aktiv sessiyalarni topib, timerlarini va o'zlarini yakunlash
      const activeSessions = await GameSession.find({
        host: req.user._id,
        status: { $in: ["waiting", "active", "question", "answer"] },
      }).select("_id");

      for (const s of activeSessions) {
        clearSessionTimers(s._id.toString());
      }

      if (activeSessions.length > 0) {
        await GameSession.updateMany(
          {
            _id: { $in: activeSessions.map((s) => s._id) },
          },
          { status: "ended", endedAt: new Date() },
        );
      }

      // Noyob PIN bilan sessiya yaratish (E11000 race-condition'dan himoyalangan)
      let session = null;
      let pin = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        pin = generatePin();
        const exists = await GameSession.findOne({
          pin,
          status: { $ne: "ended" },
        }).select("_id");
        if (exists) continue;

        try {
          session = await GameSession.create({
            quiz: quiz._id,
            host: req.user._id,
            pin,
            status: "waiting",
          });
          break;
        } catch (createErr) {
          if (createErr?.code !== 11000) throw createErr;
        }
      }

      if (!session) {
        return res
          .status(500)
          .json({ error: "Noyob o'yin kodi yaratib bo'lmadi, qayta urining" });
      }

      await QuizGame.findByIdAndUpdate(quiz._id, { $inc: { playCount: 1 } });

      return res.status(201).json({
        success: true,
        sessionId: session._id,
        pin,
        quizTitle: quiz.title,
        questionsCount: quiz.questions.length,
      });
    }

    const endedIds = endMemorySessionsForHost(req.user._id);
    for (const id of endedIds) {
      clearSessionTimers(id);
    }

    let pin;
    let exists = true;
    while (exists) {
      pin = generatePin();
      exists = findMemorySessionByPin(pin);
    }

    const session = createMemoryGameSession({
      quiz: quiz._id,
      host: req.user._id,
      pin,
    });
    quiz.playCount = (quiz.playCount || 0) + 1;

    return res.status(201).json({
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
    const cleanPin = typeof req.params.pin === "string" ? req.params.pin.trim() : "";
    if (!cleanPin) {
      return res.status(400).json({ error: "PIN noto'g'ri" });
    }

    if (isDbConnected()) {
      const session = await GameSession.findOne({
        pin: cleanPin,
        status: { $ne: "ended" },
      }).populate("quiz", "title description questions");

      if (!session) {
        return res
          .status(404)
          .json({ error: "Bunday PIN topilmadi yoki o'yin tugagan" });
      }

      return res.json({
        sessionId: session._id,
        status: session.status,
        isLocked: Boolean(session.isLocked),
        quizTitle: session.quiz?.title || "",
        title: session.quiz?.title || "",
        questionsCount: session.quiz?.questions?.length || 0,
        playersCount: session.players.length,
      });
    }

    const memSession = findMemorySessionByPin(cleanPin);
    if (!memSession) {
      return res
        .status(404)
        .json({ error: "Bunday PIN topilmadi yoki o'yin tugagan" });
    }
    const memQuiz = findMemoryQuizById(memSession.quiz);
    return res.json({
      sessionId: memSession._id,
      status: memSession.status,
      isLocked: Boolean(memSession.isLocked),
      quizTitle: memQuiz?.title || "",
      title: memQuiz?.title || "",
      questionsCount: memQuiz?.questions?.length || 0,
      playersCount: memSession.players.length,
    });
  } catch (err) {
    console.error("joinByPin error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// O'yin natijalarini olish
export async function getSessionResults(req, res) {
  try {
    if (isDbConnected()) {
      const session = await GameSession.findById(req.params.sessionId)
        .populate("quiz", "title")
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

      return res.json({ leaderboard, quizTitle: session.quiz?.title });
    }

    const memSession = findMemorySessionById(req.params.sessionId);
    if (!memSession) return res.status(404).json({ error: "Sessiya topilmadi" });
    const memQuiz = findMemoryQuizById(memSession.quiz);

    const leaderboard = [...memSession.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => {
        const u = p.userId ? findMemoryUserById(p.userId) : null;
        return {
          rank: i + 1,
          name:
            p.name || (u ? `${u.firstName} ${u.lastName}`.trim() : "O'yinchi"),
          score: p.score,
          answers: p.answers,
        };
      });

    return res.json({ leaderboard, quizTitle: memQuiz?.title });
  } catch (err) {
    console.error("getSessionResults error:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
}
