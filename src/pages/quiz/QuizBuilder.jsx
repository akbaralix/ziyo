import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaPlus,
  FaTrash,
  FaCheck,
  FaClock,
  FaAward,
  FaArrowLeft,
  FaSave,
  FaCopy,
  FaInfoCircle,
  FaCaretUp,
  FaCircle,
  FaSquare,
} from "react-icons/fa";
import {
  IoSparkles,
  IoClose,
  IoCopyOutline,
  IoCheckmark,
} from "react-icons/io5";

import { FaDiamond } from "react-icons/fa6";
import { toast } from "react-toastify";
import {
  createQuizGame,
  getQuizGameById,
  updateQuizGame,
} from "../../api/quizApi.js";
import "./QuizBuilder.css";

const DEFAULT_QUESTION = () => ({
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  timeLimit: 20,
  points: 100,
  explanation: "",
});

export default function QuizBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
    DEFAULT_QUESTION(),
  ]);
  const [aiQuizOpen, setAiQuizOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(8);
  const [aiJsonInput, setAiJsonInput] = useState("");

  const getAiPrompt = () => {
    const topic = aiTopic.trim() || "Umumiy bilimlar";
    const count = Math.min(Math.max(Number(aiCount) || 8, 8), 25);
    return `Siz ta'lim bo'yicha ekspert AI siz. Menga '${topic}' mavzusida ${count} ta test savolini aniq ushbu JSON formatda tuzib bering:
[
  {
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
      toast.success("Prompt nusxalandi! Endi ChatGPT yoki Gemini-ga yuboring.");
    } catch {
      toast.info("Promptdan nusxa oling!");
    }
  };

  const handleImportAiJson = () => {
    if (!aiJsonInput.trim()) {
      toast.warning("Iltimos, AI qaytargan JSON matnini kiriting!");
      return;
    }

    try {
      let raw = aiJsonInput.trim();
      raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```$/, "")
        .trim();

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("JSON ma'lumot testlar massivi bo'lishi kerak!");
      }

      const validated = parsed.slice(0, 25).map((item, idx) => {
        const questionText = item.text || item.question;
        if (!questionText || !String(questionText).trim()) {
          throw new Error(`${idx + 1}-savol matni topilmadi.`);
        }
        if (!Array.isArray(item.options) || item.options.length < 2) {
          throw new Error(
            `${idx + 1}-savolda kamida 2 ta javob varianti bo'lishi kerak.`,
          );
        }

        const opts = item.options.map((o) => String(o).trim());
        while (opts.length < 4) {
          opts.push("");
        }
        const finalOptions = opts.slice(0, 4);

        let correct =
          item.correctIndex !== undefined
            ? Number(item.correctIndex)
            : item.correctAnswer !== undefined
              ? Number(item.correctAnswer)
              : 0;

        if (isNaN(correct) || correct < 0 || correct >= 4) {
          correct = 0;
        }

        return {
          text: String(questionText).trim(),
          options: finalOptions,
          correctIndex: correct,
          timeLimit: Number(item.timeLimit) || 20,
          points: Number(item.points) || 100,
          explanation: item.explanation ? String(item.explanation).trim() : "",
        };
      });

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

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
                res.quiz.questions.map((q) => ({
                  ...DEFAULT_QUESTION(),
                  ...q,
                })),
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
  const handleAddQuestion = () => {
    if (questions.length >= 25) {
      toast.warning("Maksimal 25 ta savol qo'shish mumkin!");
      return;
    }
    setQuestions([...questions, DEFAULT_QUESTION()]);
    setCurrentIndex(questions.length);
  };

  // Savolni nusxalash
  const handleDuplicateQuestion = (idx) => {
    if (questions.length >= 25) {
      toast.warning("Maksimal 25 ta savol qo'shish mumkin!");
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
    if (questions.length <= 8) {
      toast.warning("Kamida 8 ta savol bo'lishi shart!");
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

    if (questions.length < 8 || questions.length > 25) {
      toast.warning("Savollar soni 8 tadan 25 tagacha bo'lishi kerak!");
      setErrorMsg("Savollar soni 8 tadan 25 tagacha bo'lishi kerak!");
      return;
    }

    // Har bir savolni tekshirish
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        toast.warning(`${i + 1}-savol matni bo'sh bo'lishi mumkin emas!`);
        setErrorMsg(`${i + 1}-savol matni bo'sh bo'lishi mumkin emas!`);
        setCurrentIndex(i);
        return;
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
        questions: questions.map((q) => ({
          text: q.text.trim(),
          options: q.options.filter((o) => o.trim() !== ""),
          correctIndex:
            q.correctIndex >= q.options.filter((o) => o.trim() !== "").length
              ? 0
              : q.correctIndex,
          timeLimit: q.timeLimit || 20,
          points: q.points || 100,
          explanation: q.explanation?.trim() || "",
        })),
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

  const optionColors = [
    { name: "Qizil", bg: "#ef4444", shape: <FaCaretUp /> },
    { name: "Ko'k", bg: "#3b82f6", shape: <FaDiamond /> },
    { name: "Sariq", bg: "#eab308", shape: <FaCircle /> },
    { name: "Yashil", bg: "#10b981", shape: <FaSquare /> },
  ];

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
            {questions.length} / 25 ta savol
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
              onClick={handleAddQuestion}
              disabled={questions.length >= 25}
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
                    ⏱ {q.timeLimit}s • 🌟 {q.points} ball
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
                  {questions.length > 8 && (
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

          <button
            type="button"
            className="sidebar-add-btn"
            onClick={handleAddQuestion}
            disabled={questions.length >= 25}
          >
            <FaPlus /> Savol qo'shish ({questions.length}/25)
          </button>
        </aside>

        {/* Main Content Area: Question Editor */}
        <main className="builder-main-content">
          {/* Top Options: Timer & Points */}
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
                <option value={100}>100 ball (Standart)</option>
                <option value={200}>200 ball (2x)</option>
              </select>
            </div>
          </div>

          {/* Question Text Box */}
          <div className="question-input-card">
            <label className="question-input-label">
              <IoSparkles /> {currentIndex + 1}-savol matnini kiriting:
            </label>
            <textarea
              className="question-textarea"
              placeholder="Savolni shu yerga yozing..."
              rows={3}
              value={currentQ.text}
              onChange={(e) => handleQuestionTextChange(e.target.value)}
            />
          </div>

          {/* Options Grid (Kahoot-Style) */}
          <div className="options-editor-grid">
            {currentQ.options.map((opt, optIdx) => {
              const color = optionColors[optIdx % optionColors.length];
              const isCorrect = currentQ.correctIndex === optIdx;

              return (
                <div
                  key={optIdx}
                  className={`option-edit-card ${isCorrect ? "is-correct" : ""}`}
                  style={{
                    borderLeftColor: color.bg,
                  }}
                >
                  <div
                    className="option-shape-badge"
                    style={{ backgroundColor: color.bg }}
                  >
                    {color.shape}
                  </div>

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

          {/* Question Explanation Box */}
          <div className="question-explanation-card">
            <label className="explanation-label">
              <FaInfoCircle /> To'g'ri javob tushuntirishi (ixtiyoriy):
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
                onClick={handleAddQuestion}
                disabled={questions.length >= 25}
              >
                <FaPlus /> Yangi savol qo'shish
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

      {aiQuizOpen && (
        <div className="aiQuiz-backdrop" onClick={() => setAiQuizOpen(false)}>
          <div
            className="aiQuiz-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aiQuiz-header">
              <div className="aiQuiz-title-group">
                <span className="aiQuiz-spark-icon">
                  <IoSparkles />
                </span>
                <div>
                  <h2>AI yordamida test yaratish</h2>
                  <p className="aiQuiz-subtitle">
                    Mavzu va savollar sonini kiriting, promptni nusxalang va olingan JSON natijasini yuklang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="aiQuiz-close-btn"
                onClick={() => setAiQuizOpen(false)}
              >
                <IoClose />
              </button>
            </div>

            <div className="aiQuiz-body">
              {/* 1-Qadam: Prompt */}
              <div className="ai-step-card">
                <div className="ai-step-title">1-Qadam: AI uchun prompt tayyorlash</div>
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
                      min={8}
                      max={25}
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
                <div className="ai-step-title">2-Qadam: Olingan JSON natijasini joylash</div>
                <p className="ai-step-desc">
                  ChatGPT yoki Gemini qaytargan JSON kodini quyidagi maydonga tashlang:
                </p>
                <textarea
                  className="ai-json-textarea"
                  rows={6}
                  placeholder={`[
  {
    "text": "Savol matni",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "To'g'ri javob izohi"
  }
]`}
                  value={aiJsonInput}
                  onChange={(e) => setAiJsonInput(e.target.value)}
                />
              </div>
            </div>

            <div className="aiQuiz-footer">
              <button
                type="button"
                className="aiQuiz-cancel-btn"
                onClick={() => setAiQuizOpen(false)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="aiQuiz-submit-btn"
                onClick={handleImportAiJson}
              >
                <IoCheckmark /> JSON’dan testlarni yuklash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
