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
import { IoSparkles } from "react-icons/io5";

import { FaDiamond } from "react-icons/fa6";
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
  const [aipromptText, setAipromptText] = useState("");
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
      alert("Maksimal 25 ta savol qo'shish mumkin!");
      return;
    }
    setQuestions([...questions, DEFAULT_QUESTION()]);
    setCurrentIndex(questions.length);
  };

  // Savolni nusxalash
  const handleDuplicateQuestion = (idx) => {
    if (questions.length >= 25) {
      alert("Maksimal 25 ta savol qo'shish mumkin!");
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
      alert("Kamida 8 ta savol bo'lishi shart!");
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
      setErrorMsg("Iltimos, o'yin sarlavhasini kiriting!");
      return;
    }

    if (questions.length < 8 || questions.length > 25) {
      setErrorMsg("Savollar soni 8 tadan 25 tagacha bo'lishi kerak!");
      return;
    }

    // Har bir savolni tekshirish
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setErrorMsg(`${i + 1}-savol matni bo'sh bo'lishi mumkin emas!`);
        setCurrentIndex(i);
        return;
      }
      const filledOptions = q.options.filter((o) => o.trim() !== "");
      if (filledOptions.length < 2) {
        setErrorMsg(
          `${i + 1}-savolda kamida 2 ta to'ldirilgan variant bo'lishi kerak!`,
        );
        setCurrentIndex(i);
        return;
      }
      if (q.options[q.correctIndex]?.trim() === "") {
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
      } else {
        await createQuizGame(payload);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        navigate("/profil");
      }, 1200);
    } catch (err) {
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
            onClick={() => navigate("/profil")}
          >
            <FaArrowLeft /> Orqaga
          </button>
          <div className="builder-title-input-wrap">
            <input
              type="text"
              className="builder-title-input"
              placeholder="Viktorina nomi (masalan: Informatika va Dasturlash)..."
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
        <button onClick={() => setAiQuizOpen(true)}>ai</button>
      </div>

      {aiQuizOpen && (
        <div className="aiQuiz-container">
          <div className="aiQuiz-header">
            <button onClick={() => setAiQuizOpen(false)}>X</button>
            <h2>AI orqalik yaratish</h2>
          </div>
          <div className="aiquiz-action">
            <label>Mavzuni kiriting</label>
            <input
              type="text"
              value={aipromptText}
              onChange={(e) => setAipromptText(e.target.value)}
            />

            <button>Yaratish</button>
          </div>
        </div>
      )}
    </div>
  );
}
