import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaPlus,
  FaTrash,
  FaCheck,
  FaTimes,
  FaClock,
  FaAward,
  FaArrowLeft,
  FaSave,
  FaCopy,
  FaInfoCircle,
  FaCaretUp,
  FaCircle,
  FaSquare,
  FaSpinner,
  FaEdit,
} from "react-icons/fa";
import {
  IoSparkles,
  IoClose,
  IoCopyOutline,
  IoCheckmark,
  IoFlash,
} from "react-icons/io5";

import { FaDiamond } from "react-icons/fa6";
import { toast } from "react-toastify";
import ModalOverlay from "../../components/ModalOverlay";
import {
  createQuizGame,
  generateAiQuizQuestions,
  getQuizGameById,
  updateQuizGame,
} from "../../api/quizApi.js";

import "./QuizBuilder.css";

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 25;

const DEFAULT_QUESTION = (qType = "quiz") =>
  qType === "true_false"
    ? {
        type: "true_false",
        text: "",
        options: ["To'g'ri", "Noto'g'ri"],
        correctIndex: 0,
        timeLimit: 20,
        points: 100,
        explanation: "",
      }
    : {
        type: "quiz",
        text: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        timeLimit: 20,
        points: 100,
        explanation: "",
      };

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

export default function QuizBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const initialModeParam =
    !isEditing && searchParams.get("mode") === "true_false"
      ? "true_false"
      : "quiz";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: initialModeParam === "true_false" ? 5 : 8 }, () =>
      DEFAULT_QUESTION(initialModeParam),
    ),
  );
  const [aiQuizOpen, setAiQuizOpen] = useState(false);
  const [aiMode, setAiMode] = useState("quick"); // 'quick' | 'manual'
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(
    initialModeParam === "true_false" ? 6 : 8,
  );
  const [aiDifficulty, setAiDifficulty] = useState("o'rtacha");
  const [aiTimeLimit, setAiTimeLimit] = useState(20);
  const [aiFormat, setAiFormat] = useState(initialModeParam); // 'quiz' | 'true_false' | 'mixed'
  const [aiJsonInput, setAiJsonInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getAiPrompt = () => {
    const topic = aiTopic.trim() || "Umumiy bilimlar";
    const count = Math.min(
      Math.max(Number(aiCount) || 8, MIN_QUESTIONS),
      MAX_QUESTIONS,
    );

    if (aiFormat === "true_false") {
      return `Siz ta'lim bo'yicha ekspert AI siz. Menga '${topic}' mavzusida ${count} ta Kahoot uslubidagi "To'g'ri / Noto'g'ri" (True/False) savollarini ushbu JSON formatda tuzib bering:
[
  {
    "type": "true_false",
    "text": "Fakt yoki bayon matni",
    "options": ["To'g'ri", "Noto'g'ri"],
    "correctIndex": 0,
    "explanation": "Qisqa izoh"
  }
]
Qoida: correctIndex faqat 0 ("To'g'ri") yoki 1 ("Noto'g'ri") bo'lsin va javoblar aralash bo'lsin. Javobda faqat valid JSON massivini qaytaring.`;
    }

    if (aiFormat === "mixed") {
      return `Siz ta'lim bo'yicha ekspert AI siz. Menga '${topic}' mavzusida ${count} ta aralash (ham 4 variantli test, ham "To'g'ri / Noto'g'ri") savollarini ushbu JSON formatda tuzib bering:
[
  {
    "type": "quiz",
    "text": "Test savol matni",
    "options": ["A variant", "B variant", "C variant", "D variant"],
    "correctIndex": 0,
    "explanation": "Qisqa izoh"
  },
  {
    "type": "true_false",
    "text": "To'g'ri yoki noto'g'ri bayon matni",
    "options": ["To'g'ri", "Noto'g'ri"],
    "correctIndex": 1,
    "explanation": "Qisqa izoh"
  }
]
Javobda faqat valid JSON massivini qaytaring, boshqa ortiqcha matn yozmang.`;
    }

    return `Siz ta'lim bo'yicha ekspert AI siz. Menga '${topic}' mavzusida ${count} ta test savolini aniq, variantlarni aralashtrib, qisqa variantli qilib ushbu JSON formatda tuzib bering:
[
  {
    "type": "quiz",
    "text": "Savol matni",
    "options": ["A variant", "B variant", "C variant", "D variant"],
    "correctIndex": 0,
    "explanation": "To'g'ri javob izohi"
  }
]
Javobda faqat valid JSON massivini qaytaring, boshqa ortiqcha matn yozmang.`;
  };

  const handleCopyAiPrompt = async () => {
    const promptText = getAiPrompt();
    try {
      await navigator.clipboard.writeText(promptText);
      toast.success("Prompt nusxalandi! Endi AI yordamchiga yuboring.");
    } catch {
      toast.info("Promptdan nusxa oling!");
    }
  };

  // JSON matnini yoki obyektini tekshirib, toza savollar massiviga aylantirish
  const parseAndValidateQuestions = (rawInput) => {
    let parsed = rawInput;

    if (typeof rawInput === "string") {
      let raw = rawInput.trim();
      raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(raw);
    }

    if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.questions)) parsed = parsed.questions;
      else if (Array.isArray(parsed.tests)) parsed = parsed.tests;
      else if (Array.isArray(parsed.savollar)) parsed = parsed.savollar;
      else if (Array.isArray(parsed.data)) parsed = parsed.data;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("JSON ma'lumot testlar massivi bo'lishi kerak!");
    }

    const validated = parsed.slice(0, MAX_QUESTIONS).map((item, idx) => {
      const questionText = item.text || item.question || item.savol;
      if (!questionText || !String(questionText).trim()) {
        throw new Error(`${idx + 1}-savol matni topilmadi.`);
      }

      const rawOpts =
        item.options || item.choices || item.variants || item.variantlar;

      const isTrueFalseItem =
        item.type === "true_false" ||
        aiFormat === "true_false" ||
        (Array.isArray(rawOpts) && rawOpts.length === 2) ||
        typeof item.isTrue === "boolean" ||
        typeof item.correct === "boolean";

      if (isTrueFalseItem) {
        let tfCorrect = 0;
        if (typeof item.isTrue === "boolean") {
          tfCorrect = item.isTrue ? 0 : 1;
        } else if (typeof item.correct === "boolean") {
          tfCorrect = item.correct ? 0 : 1;
        } else if (item.correctIndex !== undefined) {
          tfCorrect = Number(item.correctIndex) === 1 ? 1 : 0;
        } else if (item.correctAnswer !== undefined) {
          const val = String(item.correctAnswer).trim().toLowerCase();
          tfCorrect =
            val === "1" ||
            val === "false" ||
            val === "noto'g'ri" ||
            val === "notogri" ||
            val === "yo'q"
              ? 1
              : 0;
        }

        const opt0 =
          Array.isArray(rawOpts) && rawOpts[0]
            ? String(rawOpts[0]).trim()
            : "To'g'ri";
        const opt1 =
          Array.isArray(rawOpts) && rawOpts[1]
            ? String(rawOpts[1]).trim()
            : "Noto'g'ri";

        return {
          type: "true_false",
          text: String(questionText).trim(),
          options: [opt0, opt1],
          correctIndex: tfCorrect,
          timeLimit: Number(item.timeLimit) || aiTimeLimit || 20,
          points: Number(item.points) || 100,
          explanation: item.explanation ? String(item.explanation).trim() : "",
        };
      }

      if (!Array.isArray(rawOpts) || rawOpts.length < 2) {
        throw new Error(
          `${idx + 1}-savolda kamida 2 ta javob varianti bo'lishi kerak.`,
        );
      }

      const opts = rawOpts.map((o) => String(o).trim());
      while (opts.length < 4) {
        opts.push("");
      }
      const finalOptions = opts.slice(0, 4);

      let correct = 0;
      if (item.correctIndex !== undefined) correct = item.correctIndex;
      else if (item.correct_index !== undefined) correct = item.correct_index;
      else if (item.correctAnswer !== undefined) correct = item.correctAnswer;
      else if (item.correct !== undefined) correct = item.correct;

      if (typeof correct === "string") {
        const letterMap = { a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 };
        if (letterMap[correct.trim()] !== undefined) {
          correct = letterMap[correct.trim()];
        } else {
          correct = Number(correct);
        }
      } else {
        correct = Number(correct);
      }

      if (isNaN(correct) || correct < 0 || correct >= 4) {
        correct = 0;
      }

      return {
        type: "quiz",
        text: String(questionText).trim(),
        options: finalOptions,
        correctIndex: correct,
        timeLimit: Number(item.timeLimit) || aiTimeLimit || 20,
        points: Number(item.points) || 100,
        explanation: item.explanation ? String(item.explanation).trim() : "",
      };
    });

    return validated;
  };

  const handleImportAiJson = () => {
    if (!aiJsonInput.trim()) {
      toast.warning("Iltimos, AI qaytargan JSON matnini kiriting!");
      return;
    }

    try {
      const validated = parseAndValidateQuestions(aiJsonInput);

      if (!title.trim() && aiTopic.trim()) {
        setTitle(`${aiTopic.trim()} viktorinasi`);
      }

      setQuestions(validated);
      setCurrentIndex(0);
      setAiJsonInput("");
      setAiQuizOpen(false);
      toast.success(`${validated.length} ta savol muvaffaqiyatli yuklandi! 🎉`);
    } catch (err) {
      console.error(err);
      toast.error(`JSON xatoligi: ${err.message || "Format noto'g'ri"}`);
    }
  };

  // Server-side Gemini AI orqali test va True/False savollarni yaratish
  const handleGenerateWithGemini = async () => {
    const topic = aiTopic.trim();
    if (!topic) {
      toast.warning("Iltimos, test mavzusini kiriting!");
      return;
    }

    const count = Math.min(
      Math.max(Number(aiCount) || 8, MIN_QUESTIONS),
      MAX_QUESTIONS,
    );

    setIsGenerating(true);

    try {
      const res = await generateAiQuizQuestions({
        topic,
        count,
        difficulty: aiDifficulty,
        timeLimit: aiTimeLimit,
        questionFormat: aiFormat,
      });

      const generated = Array.isArray(res?.questions) ? res.questions : [];
      if (generated.length === 0) {
        throw new Error("AI savollar yaratmadi, qayta urinib ko'ring");
      }

      const validated = parseAndValidateQuestions(generated);

      if (!title.trim() && topic) {
        const suffix =
          aiFormat === "true_false" ? "To'g'ri / Noto'g'ri" : "viktorinasi";
        setTitle(`${topic} — ${suffix}`);
      }

      setQuestions(validated);
      setCurrentIndex(0);
      setAiQuizOpen(false);
      toast.success(
        `${validated.length} ta savol AI orqali muvaffaqiyatli yaratildi! 🎉`,
      );
    } catch (err) {
      console.error("AI quiz generation error:", err);
      toast.error(`Xatolik: ${err.message || "Savollarni yaratib bo'lmadi"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Tahrirlash rejimida yuklash
  useEffect(() => {
    if (isEditing) {
      setIsLoading(true);
      getQuizGameById(id)
        .then((res) => {
          if (res?.quiz) {
            setTitle(res.quiz.title || "");
            setDescription(res.quiz.description || "");
            if (res.quiz.questions?.length > 0) {
              setQuestions(
                res.quiz.questions.map((q) => {
                  const isTf = q.type === "true_false";
                  if (isTf) {
                    const opts = Array.isArray(q.options) ? q.options : [];
                    return {
                      ...DEFAULT_QUESTION("true_false"),
                      ...q,
                      type: "true_false",
                      options: [
                        String(opts[0] || "To'g'ri"),
                        String(opts[1] || "Noto'g'ri"),
                      ],
                      correctIndex: Number(q.correctIndex) === 1 ? 1 : 0,
                    };
                  }
                  const base = DEFAULT_QUESTION("quiz");
                  const opts = Array.isArray(q.options)
                    ? q.options.map((o) => String(o ?? ""))
                    : [];
                  while (opts.length < 4) opts.push("");
                  return {
                    ...base,
                    ...q,
                    type: "quiz",
                    options: opts.slice(0, 4),
                  };
                }),
              );
            }
          }
        })
        .catch(() => {
          setErrorMsg("Viktorinani yuklashda xatolik yuz berdi");
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, isEditing]);

  const currentQ = questions[currentIndex] || DEFAULT_QUESTION();
  const isCurrentTrueFalse = currentQ.type === "true_false";

  // Savol turini almashtirish ('quiz' <-> 'true_false')
  const handleQuestionTypeChange = (newType) => {
    const updated = [...questions];
    const curr = updated[currentIndex];
    if (!curr || curr.type === newType) return;

    if (newType === "true_false") {
      updated[currentIndex] = {
        ...curr,
        type: "true_false",
        options: ["To'g'ri", "Noto'g'ri"],
        correctIndex: curr.correctIndex === 1 ? 1 : 0,
      };
    } else {
      const oldOpts = Array.isArray(curr.options) ? [...curr.options] : [];
      const nextOpts =
        oldOpts.length >= 4
          ? oldOpts.slice(0, 4)
          : ["", "", "", ""].map((_, i) =>
              oldOpts[i] &&
              oldOpts[i] !== "To'g'ri" &&
              oldOpts[i] !== "Noto'g'ri"
                ? oldOpts[i]
                : "",
            );
      updated[currentIndex] = {
        ...curr,
        type: "quiz",
        options: nextOpts,
        correctIndex: Math.min(Math.max(Number(curr.correctIndex) || 0, 0), 3),
      };
    }
    setQuestions(updated);
  };

  // Savol matni o'zgarishi
  const handleQuestionTextChange = (text) => {
    const updated = [...questions];
    updated[currentIndex] = { ...updated[currentIndex], text };
    setQuestions(updated);
  };

  // Variant matni o'zgarishi
  const handleOptionChange = (optIdx, val) => {
    const updated = [...questions];
    const newOptions = [...updated[currentIndex].options];
    newOptions[optIdx] = val;
    updated[currentIndex] = { ...updated[currentIndex], options: newOptions };
    setQuestions(updated);
  };

  // To'g'ri javobni tanlash
  const handleSetCorrect = (optIdx) => {
    const updated = [...questions];
    updated[currentIndex] = { ...updated[currentIndex], correctIndex: optIdx };
    setQuestions(updated);
  };

  // Tushuntirish
  const handleExplanationChange = (explanation) => {
    const updated = [...questions];
    updated[currentIndex] = { ...updated[currentIndex], explanation };
    setQuestions(updated);
  };

  // Vaqt chegarasi
  const handleTimeLimitChange = (timeLimit) => {
    const updated = [...questions];
    updated[currentIndex] = {
      ...updated[currentIndex],
      timeLimit: Number(timeLimit),
    };
    setQuestions(updated);
  };

  // Ball
  const handlePointsChange = (points) => {
    const updated = [...questions];
    updated[currentIndex] = {
      ...updated[currentIndex],
      points: Number(points),
    };
    setQuestions(updated);
  };

  // Yangi savol qo'shish
  const handleAddQuestion = (qType) => {
    if (questions.length >= MAX_QUESTIONS) {
      toast.warning(`Maksimal ${MAX_QUESTIONS} ta savol qo'shish mumkin!`);
      return;
    }
    const resolvedType =
      qType || currentQ?.type || initialModeParam || "quiz";
    setQuestions([...questions, DEFAULT_QUESTION(resolvedType)]);
    setCurrentIndex(questions.length);
  };

  // Savolni nusxalash
  const handleDuplicateQuestion = (idx) => {
    if (questions.length >= MAX_QUESTIONS) {
      toast.warning(`Maksimal ${MAX_QUESTIONS} ta savol qo'shish mumkin!`);
      return;
    }
    const copy = JSON.parse(JSON.stringify(questions[idx]));
    const updated = [...questions];
    updated.splice(idx + 1, 0, copy);
    setQuestions(updated);
    setCurrentIndex(idx + 1);
  };

  // Savolni o'chirish
  const handleDeleteQuestion = (idx) => {
    if (questions.length <= MIN_QUESTIONS) {
      toast.warning(`Kamida ${MIN_QUESTIONS} ta savol bo'lishi shart!`);
      return;
    }
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    if (currentIndex >= updated.length) {
      setCurrentIndex(updated.length - 1);
    }
  };

  // Saqlash
  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title.trim()) {
      toast.warning("Iltimos, o'yin sarlavhasini kiriting!");
      setErrorMsg("Iltimos, o'yin sarlavhasini kiriting!");
      return;
    }

    if (
      questions.length < MIN_QUESTIONS ||
      questions.length > MAX_QUESTIONS
    ) {
      toast.warning(
        `Savollar soni ${MIN_QUESTIONS} tadan ${MAX_QUESTIONS} tagacha bo'lishi kerak!`,
      );
      setErrorMsg(
        `Savollar soni ${MIN_QUESTIONS} tadan ${MAX_QUESTIONS} tagacha bo'lishi kerak!`,
      );
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        toast.warning(`${i + 1}-savol matni bo'sh bo'lishi mumkin emas!`);
        setErrorMsg(`${i + 1}-savol matni bo'sh bo'lishi mumkin emas!`);
        setCurrentIndex(i);
        return;
      }

      if (q.type === "true_false") {
        if (q.correctIndex !== 0 && q.correctIndex !== 1) {
          toast.warning(
            `${i + 1}-savolda To'g'ri yoki Noto'g'ri tanlanmagan!`,
          );
          setErrorMsg(`${i + 1}-savolda To'g'ri yoki Noto'g'ri tanlanmagan!`);
          setCurrentIndex(i);
          return;
        }
        continue;
      }

      const filledOptions = q.options.filter((o) => o.trim() !== "");
      if (filledOptions.length < 2) {
        toast.warning(
          `${i + 1}-savolda kamida 2 ta to'ldirilgan variant bo'lishi kerak!`,
        );
        setErrorMsg(
          `${i + 1}-savolda kamida 2 ta to'ldirilgan variant bo'lishi kerak!`,
        );
        setCurrentIndex(i);
        return;
      }
      if (q.options[q.correctIndex]?.trim() === "") {
        toast.warning(`${i + 1}-savolning to'g'ri javobi bo'sh qolgan!`);
        setErrorMsg(`${i + 1}-savolning to'g'ri javobi bo'sh qolgan!`);
        setCurrentIndex(i);
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        questions: questions.map((q) => {
          if (q.type === "true_false") {
            const opt0 = String(q.options?.[0] || "To'g'ri").trim() || "To'g'ri";
            const opt1 =
              String(q.options?.[1] || "Noto'g'ri").trim() || "Noto'g'ri";
            return {
              type: "true_false",
              text: q.text.trim(),
              options: [opt0, opt1],
              correctIndex: Number(q.correctIndex) === 1 ? 1 : 0,
              timeLimit: Number(q.timeLimit) || 20,
              points: Number(q.points) || 100,
              explanation: q.explanation ? String(q.explanation).trim() : "",
            };
          }

          const indexedEntries = q.options
            .map((o, idx) => ({
              text: typeof o === "string" ? o.trim() : String(o ?? "").trim(),
              idx,
            }))
            .filter((entry) => entry.text !== "");

          const rawCorrect = Number(q.correctIndex);
          let safeCorrect = indexedEntries.findIndex(
            (entry) => entry.idx === rawCorrect,
          );
          if (
            safeCorrect === -1 &&
            !isNaN(rawCorrect) &&
            rawCorrect >= 0 &&
            rawCorrect < indexedEntries.length
          ) {
            safeCorrect = rawCorrect;
          }
          if (safeCorrect < 0) safeCorrect = 0;

          return {
            type: "quiz",
            text: q.text.trim(),
            options: indexedEntries.map((entry) => entry.text),
            correctIndex: safeCorrect,
            timeLimit: Number(q.timeLimit) || 20,
            points: Number(q.points) || 100,
            explanation: q.explanation ? String(q.explanation).trim() : "",
          };
        }),
      };

      if (isEditing) {
        await updateQuizGame(id, payload);
        toast.success("Viktorina muvaffaqiyatli yangilandi! 🎉");
      } else {
        await createQuizGame(payload);
        toast.success("Viktorina muvaffaqiyatli yaratildi! 🎉");
      }

      setSaveSuccess(true);
      setTimeout(() => {
        navigate("/profil");
      }, 1200);
    } catch (err) {
      toast.error(err.message || "Saqlashda xatolik yuz berdi");
      setErrorMsg(err.message || "Saqlashda xatolik yuz berdi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="quiz-builder-layout">
      {/* Header Bar */}
      <header className="builder-header">
        <div className="builder-header-left">
          <button
            type="button"
            className="builder-back-btn"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
          </button>
          <div className="builder-title-input-wrap">
            <input
              type="text"
              className="builder-title-input"
              placeholder="Viktorina nomini kiriting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        <div className="builder-header-right">
          <span className="question-count-badge">
            {questions.length} / {MAX_QUESTIONS} ta savol
          </span>

          <button
            type="button"
            className="builder-save-btn"
            onClick={handleSave}
            disabled={isLoading || saveSuccess}
          >
            <FaSave />{" "}
            {saveSuccess
              ? "Saqlandi! 🎉"
              : isLoading
                ? "Saqlanmoqda..."
                : "Saqlash"}
          </button>
        </div>
      </header>

      {errorMsg && <div className="builder-error-banner">{errorMsg}</div>}

      <div className="builder-body">
        {/* Left Sidebar: Questions list navigator */}
        <aside className="builder-sidebar">
          <div className="sidebar-header">
            <h4>Savollar ({questions.length})</h4>
            <button
              type="button"
              className="add-q-mini-btn"
              onClick={() => handleAddQuestion()}
              disabled={questions.length >= MAX_QUESTIONS}
              title="Yangi savol qo'shish"
            >
              <FaPlus />
            </button>
          </div>

          <div className="sidebar-questions-list">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className={`sidebar-q-card ${idx === currentIndex ? "active" : ""}`}
                onClick={() => setCurrentIndex(idx)}
              >
                <div className="q-card-number">{idx + 1}</div>
                <div className="q-card-preview">
                  <span className="q-preview-text">
                    {q.text ? q.text : "(Savol matni kiritilmagan)"}
                  </span>
                  <span className="q-preview-meta">
                    {q.type === "true_false" && (
                      <span className="q-type-chip">T/F</span>
                    )}
                    ⏱ {q.timeLimit}s • 🌟 {q.points}
                  </span>
                </div>
                <div className="q-card-actions">
                  <button
                    type="button"
                    className="q-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateQuestion(idx);
                    }}
                    title="Nusxalash"
                  >
                    <FaCopy />
                  </button>
                  {questions.length > MIN_QUESTIONS && (
                    <button
                      type="button"
                      className="q-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(idx);
                      }}
                      title="O'chirish"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="sidebar-add-group">
            <button
              type="button"
              className="sidebar-add-btn"
              onClick={() => handleAddQuestion("quiz")}
              disabled={questions.length >= MAX_QUESTIONS}
            >
              <FaPlus /> 4-variantli
            </button>
            <button
              type="button"
              className="sidebar-add-btn tf-add"
              onClick={() => handleAddQuestion("true_false")}
              disabled={questions.length >= MAX_QUESTIONS}
            >
              <FaCheck /> To&apos;g&apos;ri / Noto&apos;g&apos;ri
            </button>
          </div>
        </aside>

        {/* Main Content Area: Question Editor */}
        <main className="builder-main-content">
          {/* Question Text Box */}
          <div className="question-input-card">
            <div className="question-card-top-row">
              <label className="question-input-label">
                <IoSparkles /> {currentIndex + 1}-savol matnini kiriting:
              </label>

              <div className="q-type-switcher" role="group" aria-label="Savol turi">
                <button
                  type="button"
                  className={`q-type-btn ${!isCurrentTrueFalse ? "active" : ""}`}
                  onClick={() => handleQuestionTypeChange("quiz")}
                >
                  Test (4 variant)
                </button>
                <button
                  type="button"
                  className={`q-type-btn tf ${isCurrentTrueFalse ? "active" : ""}`}
                  onClick={() => handleQuestionTypeChange("true_false")}
                >
                  To&apos;g&apos;ri / Noto&apos;g&apos;ri
                </button>
              </div>
            </div>

            <textarea
              className="question-textarea"
              placeholder={
                isCurrentTrueFalse
                  ? "Bayon yoki faktni yozing (masalan: Yer Quyosh atrofida aylanadi)..."
                  : "Savolni shu yerga yozing..."
              }
              rows={3}
              value={currentQ.text}
              onChange={(e) => handleQuestionTextChange(e.target.value)}
            />
          </div>

          {/* Options Grid (Kahoot-Style Quiz or True/False) */}
          {isCurrentTrueFalse ? (
            <div className="options-editor-grid true-false-editor-grid">
              {[0, 1].map((optIdx) => {
                const color = TRUE_FALSE_COLORS[optIdx];
                const isCorrect = currentQ.correctIndex === optIdx;
                const labelVal =
                  currentQ.options?.[optIdx] ??
                  (optIdx === 0 ? "To'g'ri" : "Noto'g'ri");

                return (
                  <div
                    key={optIdx}
                    className={`option-edit-card true-false-edit-card ${isCorrect ? "is-correct" : ""}`}
                    style={{ background: color.bg }}
                    onClick={() => handleSetCorrect(optIdx)}
                  >
                    <div className="option-shape-badge">{color.shape}</div>

                    <input
                      type="text"
                      className="option-edit-input tf-edit-input"
                      value={labelVal}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                      maxLength={60}
                    />

                    <button
                      type="button"
                      className={`correct-toggle-btn ${isCorrect ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCorrect(optIdx);
                      }}
                      title={
                        isCorrect
                          ? "To'g'ri javob tanlangan"
                          : "To'g'ri javob sifatida belgilash"
                      }
                    >
                      <FaCheck />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="options-editor-grid">
              {currentQ.options.map((opt, optIdx) => {
                const color = OPTION_COLORS[optIdx % OPTION_COLORS.length];
                const isCorrect = currentQ.correctIndex === optIdx;

                return (
                  <div
                    key={optIdx}
                    className={`option-edit-card ${isCorrect ? "is-correct" : ""}`}
                    style={{
                      background: color.bg,
                    }}
                  >
                    <div className="option-shape-badge">{color.shape}</div>

                    <input
                      type="text"
                      className="option-edit-input"
                      placeholder={`${optIdx + 1}-variant matni...`}
                      value={opt}
                      onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                    />

                    <button
                      type="button"
                      className={`correct-toggle-btn ${isCorrect ? "active" : ""}`}
                      onClick={() => handleSetCorrect(optIdx)}
                      title={
                        isCorrect
                          ? "To'g'ri javob tanlangan"
                          : "To'g'ri javob sifatida belgilash"
                      }
                    >
                      <FaCheck />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="question-meta-bar">
            <div className="meta-item">
              <FaClock className="meta-icon" />
              <span>Vaqt:</span>
              <select
                value={currentQ.timeLimit}
                onChange={(e) => handleTimeLimitChange(e.target.value)}
                className="meta-select"
              >
                <option value={10}>10 soniya</option>
                <option value={20}>20 soniya</option>
                <option value={30}>30 soniya</option>
                <option value={60}>60 soniya</option>
              </select>
            </div>

            <div className="meta-item">
              <FaAward className="meta-icon award" />
              <span>Ball:</span>
              <select
                value={currentQ.points}
                onChange={(e) => handlePointsChange(e.target.value)}
                className="meta-select"
              >
                <option value={50}>50 ball</option>
                <option value={100}>100 ball </option>
                <option value={200}>200 ball (2x)</option>
              </select>
            </div>
          </div>

          {/* Question Explanation Box */}
          <div className="question-explanation-card">
            <label className="explanation-label">
              <FaInfoCircle /> To&apos;g&apos;ri javob tushuntirishi (ixtiyoriy):
            </label>
            <input
              type="text"
              className="explanation-input"
              placeholder="Nima uchun bu javob to'g'riligini tushuntirib bering..."
              value={currentQ.explanation || ""}
              onChange={(e) => handleExplanationChange(e.target.value)}
            />
          </div>

          <div className="builder-bottom-nav">
            <button
              type="button"
              className="nav-step-btn"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
            >
              ⬅ Oldingi savol
            </button>
            <span className="current-step-label">
              {currentIndex + 1} / {questions.length}
            </span>
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                className="nav-step-btn primary"
                onClick={() => setCurrentIndex((prev) => prev + 1)}
              >
                Keyingi savol ➡
              </button>
            ) : (
              <button
                type="button"
                className="nav-step-btn add"
                onClick={() => handleAddQuestion()}
                disabled={questions.length >= MAX_QUESTIONS}
              >
                <FaPlus /> Yangi savol qo&apos;shish
              </button>
            )}
          </div>
        </main>
      </div>

      <div className="ai-builder-btn">
        <button type="button" onClick={() => setAiQuizOpen(true)}>
          <IoSparkles /> AI Yordamchi
        </button>
      </div>

      <ModalOverlay
        isOpen={aiQuizOpen}
        onClose={() => {
          if (!isGenerating) setAiQuizOpen(false);
        }}
      >
        <div className="aiQuiz-container" onClick={(e) => e.stopPropagation()}>
          <div className="aiQuiz-header">
            <div className="aiQuiz-title-group">
              <span className="aiQuiz-spark-icon">
                <IoSparkles />
              </span>
              <div>
                <h2>AI yordamida viktorina yaratish</h2>
              </div>
            </div>
            <button
              type="button"
              className="aiQuiz-close-btn"
              onClick={() => {
                if (!isGenerating) setAiQuizOpen(false);
              }}
              title="Yopish"
            >
              <IoClose />
            </button>
          </div>

          {/* 2 ta tanlov: Tez va Qo'lda yaratish */}
          <div className="aiQuiz-tab-nav">
            <div className="aiQuiz-tab-pill-box">
              <button
                type="button"
                className={`aiQuiz-tab-btn ${aiMode === "quick" ? "active" : ""}`}
                onClick={() => setAiMode("quick")}
              >
                <IoFlash /> Tez
              </button>
              <button
                type="button"
                className={`aiQuiz-tab-btn ${aiMode === "manual" ? "active" : ""}`}
                onClick={() => setAiMode("manual")}
              >
                <FaEdit /> Qo&apos;lda yaratish
              </button>
            </div>
          </div>

          <div className="aiQuiz-body">
            {/* Savol formati tanlovi: Test / True-False / Aralash */}
            <div className="ai-format-picker">
              <label>O&apos;yin formati</label>
              <div className="ai-format-grid">
                <button
                  type="button"
                  className={`ai-format-btn ${aiFormat === "quiz" ? "active" : ""}`}
                  onClick={() => setAiFormat("quiz")}
                  disabled={isGenerating}
                >
                  4 variantli test
                </button>
                <button
                  type="button"
                  className={`ai-format-btn ${aiFormat === "true_false" ? "active" : ""}`}
                  onClick={() => setAiFormat("true_false")}
                  disabled={isGenerating}
                >
                  To&apos;g&apos;ri / Noto&apos;g&apos;ri
                </button>
                <button
                  type="button"
                  className={`ai-format-btn ${aiFormat === "mixed" ? "active" : ""}`}
                  onClick={() => setAiFormat("mixed")}
                  disabled={isGenerating}
                >
                  Aralash
                </button>
              </div>
            </div>

            {aiMode === "quick" ? (
              <div className="ai-step-card">
                <div className="ai-step-title">
                  <IoSparkles />
                  AI orqali avtomatik yaratish
                </div>

                <div className="ai-input-field">
                  <label>Mavzu yoki yo&apos;nalish nomi</label>
                  <input
                    type="text"
                    placeholder="Masalan: Quyosh sistemasi, Alisher Navoiy, Fizika..."
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isGenerating) {
                        e.preventDefault();
                        handleGenerateWithGemini();
                      }
                    }}
                  />
                </div>

                <div className="ai-inputs-row">
                  <div className="ai-input-field flex-1">
                    <label>Savollar soni</label>
                    <input
                      type="number"
                      min={MIN_QUESTIONS}
                      max={MAX_QUESTIONS}
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="ai-input-field flex-1">
                    <label>Qiyinlik darajasi</label>
                    <select
                      className="ai-select-field"
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      disabled={isGenerating}
                    >
                      <option value="o'rtacha">O&apos;rtacha</option>
                      <option value="oson">Oson</option>
                      <option value="qiyin">Qiyin</option>
                      <option value="aralash">Aralash</option>
                    </select>
                  </div>

                  <div className="ai-input-field flex-1">
                    <label>Vaqt (har bir savolga)</label>
                    <select
                      className="ai-select-field"
                      value={aiTimeLimit}
                      onChange={(e) => setAiTimeLimit(Number(e.target.value))}
                      disabled={isGenerating}
                    >
                      <option value={10}>10 soniya</option>
                      <option value={20}>20 soniya</option>
                      <option value={30}>30 soniya</option>
                      <option value={60}>60 soniya</option>
                    </select>
                  </div>
                </div>

                {isGenerating && (
                  <div className="ai-generating-indicator">
                    <div className="ai-spinner" />
                    <span>
                      AI savollarni tuzmoqda, iltimos kuting...
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 1-Qadam: Prompt */}
                <div className="ai-step-card">
                  <div className="ai-step-title">
                    1-Qadam: AI uchun prompt tayyorlash
                  </div>
                  <div className="ai-inputs-row">
                    <div className="ai-input-field flex-2">
                      <label>Mavzu nomi</label>
                      <input
                        type="text"
                        placeholder="Masalan: Fizika qonunlari, Tarix, Ingliz tili..."
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                      />
                    </div>
                    <div className="ai-input-field flex-1">
                      <label>Savollar soni</label>
                      <input
                        type="number"
                        min={MIN_QUESTIONS}
                        max={MAX_QUESTIONS}
                        value={aiCount}
                        onChange={(e) => setAiCount(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="prompt-display-box">
                    <label>Tayyor prompt (Nusxa oling):</label>
                    <pre className="prompt-pre">{getAiPrompt()}</pre>
                    <button
                      type="button"
                      className="copy-prompt-btn"
                      onClick={handleCopyAiPrompt}
                    >
                      <IoCopyOutline /> Promptni nusxalash
                    </button>
                  </div>
                </div>

                {/* 2-Qadam: JSON */}
                <div className="ai-step-card">
                  <div className="ai-step-title">
                    2-Qadam: Olingan JSON natijasini joylash
                  </div>
                  <p className="ai-step-desc">
                    AI qaytargan JSON kodini quyidagi maydonga tashlang:
                  </p>
                  <textarea
                    className="ai-json-textarea"
                    rows={6}
                    placeholder="AI javobini shu yerga tashlang"
                    value={aiJsonInput}
                    onChange={(e) => setAiJsonInput(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="aiQuiz-footer">
            <button
              type="button"
              className="aiQuiz-cancel-btn"
              onClick={() => {
                if (!isGenerating) setAiQuizOpen(false);
              }}
              disabled={isGenerating}
            >
              Bekor qilish
            </button>

            {aiMode === "quick" ? (
              <button
                type="button"
                className="aiQuiz-submit-btn"
                onClick={handleGenerateWithGemini}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <FaSpinner className="spin-icon" /> Yaratilmoqda...
                  </>
                ) : (
                  <>
                    <IoSparkles /> AI bilan yaratish
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="aiQuiz-submit-btn"
                onClick={handleImportAiJson}
              >
                <IoCheckmark /> JSON&apos;dan testlarni yuklash
              </button>
            )}
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
