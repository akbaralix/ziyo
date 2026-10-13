import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IoArrowBack,
  IoAdd,
  IoTrashOutline,
  IoCopyOutline,
  IoSparkles,
  IoClose,
  IoCheckmark,
  IoPlayOutline,
  IoPersonAddOutline,
  IoHelpCircleOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";
import SpinWheel from "./SpinWheel.jsx";
import "./BarabanCreate.css";

export default function BarabanCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const wheelRef = useRef(null);

  // Form State
  const [title, setTitle] = useState("Aylanuvchi Baraban");
  const [names, setNames] = useState([]);
  const [nameInput, setNameInput] = useState("");
  const [removeWinner, setRemoveWinner] = useState(true);

  // Questions State
  const [questions, setQuestions] = useState([]);
  const [showManualQuestionModal, setShowManualQuestionModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });

  // AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiJsonInput, setAiJsonInput] = useState("");

  // Load existing game if editId
  useEffect(() => {
    if (editId) {
      try {
        const saved = localStorage.getItem(`ziyo_baraban_${editId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setTitle(parsed.title || "Aylanuvchi Baraban");
          if (parsed.names) setNames(parsed.names);
          if (parsed.removeWinner !== undefined)
            setRemoveWinner(parsed.removeWinner);
          if (parsed.questions) setQuestions(parsed.questions);
        }
      } catch (err) {
        console.error("O'yinni yuklashda xatolik:", err);
      }
    }
  }, [editId]);

  // Names management
  const handleAddName = (e) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) return;

    if (names.includes(clean)) {
      toast.warning("Bu ism ro'yxatda mavjud!");
      return;
    }
    setNames((prev) => [...prev, clean]);
    setNameInput("");
  };

  const handleRemoveName = (indexToRemove) => {
    setNames((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearNames = () => {
    setNames([]);
  };

  // Manual Question management
  const handleAddManualQuestion = () => {
    if (!newQuestion.question.trim()) {
      toast.warning("Savol matnini kiriting!");
      return;
    }
    const validOptions = newQuestion.options.filter((o) => o.trim().length > 0);
    if (validOptions.length < 2) {
      toast.warning("Kamida 2 ta javob varianti kiriting!");
      return;
    }

    setQuestions((prev) => [...prev, { ...newQuestion }]);
    setNewQuestion({
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    });
    setShowManualQuestionModal(false);
    toast.success("Savol qo'shildi!");
  };

  const handleRemoveQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // AI Prompt copy
  const getAiPrompt = () => {
    const topic = aiTopic.trim() || "Umumiy bilimlar";
    const count = aiCount || 5;
    return `Siz ta'lim bo'yicha ekspert AI siz. Menga '${topic}' mavzusida ${count} ta test savolini aniq ushbu JSON formatda tuzib bering:
[
{
"question": "Savol matni",
"options": ["A variant", "B variant", "C variant", "D variant"],
"correctAnswer": 0
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

  // JSON Import
  const handleImportJson = () => {
    if (!aiJsonInput.trim()) {
      toast.warning("Iltimos, JSON ma'lumotni kiriting!");
      return;
    }

    try {
      let raw = aiJsonInput.trim();
      // Remove markdown code fences if present (e.g. ```json ... ```)
      raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```$/, "")
        .trim();

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("JSON ma'lumot testlar massivi bo'lishi kerak!");
      }

      const validated = parsed.map((item, idx) => {
        if (
          !item.question ||
          !Array.isArray(item.options) ||
          item.options.length < 2
        ) {
          throw new Error(
            `${idx + 1}-savol formati noto'g'ri (savol matni yoki variantlar yetishmaydi).`,
          );
        }
        let correct = Number(item.correctAnswer);
        if (isNaN(correct) || correct < 0 || correct >= item.options.length) {
          correct = 0;
        }
        return {
          question: String(item.question).trim(),
          options: item.options.map((o) => String(o).trim()),
          correctAnswer: correct,
        };
      });

      setQuestions((prev) => [...prev, ...validated]);
      setAiJsonInput("");
      setShowAiModal(false);
      toast.success(`${validated.length} ta test muvaffaqiyatli yuklandi! 🎉`);
    } catch (err) {
      console.error(err);
      toast.error(`JSON xatoligi: ${err.message || "Format noto'g'ri"}`);
    }
  };

  // Save game to localStorage
  const handleSaveGame = () => {
    if (names.length < 2) {
      toast.warning("Barabanda kamida 2 ta qatnashchi bo'lishi shart!");
      return;
    }

    const gameId = editId || `baraban_${Date.now()}`;
    const gameData = {
      id: gameId,
      title: title.trim() || "Aylanuvchi Baraban",
      names,
      removeWinner,
      questions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(`ziyo_baraban_${gameId}`, JSON.stringify(gameData));
      localStorage.setItem("ziyo_active_baraban", JSON.stringify(gameData));

      // Also append to games catalog
      const existingList = JSON.parse(
        localStorage.getItem("ziyo_baraban_list") || "[]",
      );
      const filtered = existingList.filter((g) => g.id !== gameId);
      filtered.unshift({
        id: gameId,
        title: gameData.title,
        namesCount: names.length,
        questionsCount: questions.length,
        updatedAt: gameData.updatedAt,
      });
      localStorage.setItem("ziyo_baraban_list", JSON.stringify(filtered));

      toast.success("O'yin saqlandi! O'yin sahifasiga o'tilmoqda... 🎮");
      navigate(`/oyinlar/baraban/play/${gameId}`);
    } catch (err) {
      console.error(err);
      toast.error("O'yinni saqlashda xatolik yuz berdi.");
    }
  };

  return (
    <div className="baraban-create-page">
      {/* Top Header */}
      <div className="baraban-create-header">
        <div className="baraban-header-left">
          <button
            type="button"
            className="baraban-circle-btn"
            onClick={() => navigate("/oyinlar")}
            title="O'yinlarga qaytish"
          >
            <IoArrowBack />
          </button>
          <div>
            <h1 className="baraban-page-title">Aylanuvchi Baraban Yaratish</h1>
            <p className="baraban-page-desc">
              Qatnashchilar va test savollarini kiriting, barabanni sozlang.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="baraban-primary-btn save-game-btn"
          onClick={handleSaveGame}
        >
          <IoCheckmark /> O'yinni saqlash
        </button>
      </div>

      <div className="baraban-create-layout">
        {/* Left Column: Live Spin Wheel Preview */}
        <div className="baraban-wheel-panel">
          <div className="baraban-card wheel-preview-card">
            <div className="wheel-card-header">
              <span className="wheel-badge">Jonli Baraban</span>
              <span className="wheel-participant-count">
                {names.length} ta qatnashchi
              </span>
            </div>

            <div className="wheel-canvas-wrapper">
              <SpinWheel ref={wheelRef} items={names} size={360} />
            </div>

            <div className="wheel-preview-footer">
              <button
                type="button"
                className="baraban-secondary-btn wheel-test-spin-btn"
                onClick={() => wheelRef.current?.spin()}
                disabled={names.length < 2}
              >
                <IoPlayOutline /> Sinov uchun aylantirish
              </button>
              <p className="wheel-tip">
                Har bir kiritilgan ism doira bo‘ylab avtomatik joylashadi.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Forms */}
        <div className="baraban-form-panel">
          {/* Game Title */}
          <div className="baraban-card">
            <h3 className="section-title">O'yin nomi</h3>
            <input
              type="text"
              className="baraban-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O'yin nomini kiriting (masalan: 9-A sinf viktorinasi)"
              maxLength={80}
            />
          </div>

          {/* Setting: Remove Winner rule */}
          <div className="baraban-card">
            <h3 className="section-title">Baraban qoidasi</h3>
            <p className="section-subtitle">
              Baraban aylanganda tushgan ism keyingi aylanishda nima qilinsin?
            </p>

            <div className="rule-options-container">
              <label
                className={`rule-radio-card ${removeWinner ? "active" : ""}`}
                onClick={() => setRemoveWinner(true)}
              >
                <input
                  type="radio"
                  name="removeWinner"
                  checked={removeWinner}
                  onChange={() => setRemoveWinner(true)}
                />
                <div className="rule-text">
                  <span className="rule-title">
                    Ism barabandan olib tashlansin
                  </span>
                  <span className="rule-desc">
                    Tushgan ism keyingi safar qayta tushmaydi (har bir o'quvchi
                    bir marta tanlanadi).
                  </span>
                </div>
              </label>

              <label
                className={`rule-radio-card ${!removeWinner ? "active" : ""}`}
                onClick={() => setRemoveWinner(false)}
              >
                <input
                  type="radio"
                  name="removeWinner"
                  checked={!removeWinner}
                  onChange={() => setRemoveWinner(false)}
                />
                <div className="rule-text">
                  <span className="rule-title">Ism barabanda qolsin</span>
                  <span className="rule-desc">
                    Tushgan ism barabanda saqlanib qoladi va keyingi safar ham
                    qayta tushishi mumkin.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Participants */}
          <div className="baraban-card">
            <div className="section-header-row">
              <div>
                <h3 className="section-title">
                  Qatnashchilar ({names.length})
                </h3>
                <p className="section-subtitle">
                  O'yinda qatnashadigan o'quvchilar yoki ishtirokchilar ismlari
                </p>
              </div>
              <div className="name-actions-row">
                {names.length > 0 && (
                  <button
                    type="button"
                    className="baraban-text-btn danger"
                    onClick={handleClearNames}
                  >
                    Tozalash
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleAddName} className="name-input-row">
              <input
                type="text"
                className="baraban-input flex-1"
                placeholder="Ism kiriting (masalan: Jasur) va Enter bosing..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <button
                type="submit"
                className="baraban-primary-btn add-btn"
                disabled={!nameInput.trim()}
              >
                <IoPersonAddOutline /> Qo'shish
              </button>
            </form>

            <div className="names-chips-list">
              {names.length === 0 ? (
                <div className="empty-notice">
                  Hozircha hech qanday ism qo'shilmagan. Yuqoridagi maydondan
                  ism qo'shing.
                </div>
              ) : (
                names.map((name, idx) => (
                  <span key={idx} className="name-chip">
                    <span className="chip-text">{name}</span>
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => handleRemoveName(idx)}
                      title="O'chirish"
                    >
                      <IoClose />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Questions Section */}
          <div className="baraban-card">
            <div className="section-header-row">
              <div>
                <h3 className="section-title">
                  Savollar / Testlar ({questions.length})
                </h3>
                <p className="section-subtitle">
                  Ism tanlanganda o'quvchiga beriladigan savollar to'plami
                </p>
              </div>

              <div className="question-tools-row">
                <button
                  type="button"
                  className="baraban-ai-btn"
                  onClick={() => setShowAiModal(true)}
                >
                  <IoSparkles /> AI bilan test tuzish
                </button>
                <button
                  type="button"
                  className="baraban-secondary-btn"
                  onClick={() => setShowManualQuestionModal(true)}
                >
                  <IoAdd /> Savol qo'shish
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="empty-notice questions-empty">
                <IoHelpCircleOutline className="empty-icon" />
                <p>
                  Hozircha testlar qo'shilmagan. "AI bilan test tuzish" orqali
                  soniyalar ichida testlar yarating yoki qo'lda qo'shing.
                </p>
              </div>
            ) : (
              <div className="questions-items-list">
                {questions.map((q, idx) => (
                  <div key={idx} className="question-item-card">
                    <div className="question-item-top">
                      <span className="q-badge">#{idx + 1}</span>
                      <h4 className="q-title-text">{q.question}</h4>
                      <button
                        type="button"
                        className="q-delete-btn"
                        onClick={() => handleRemoveQuestion(idx)}
                        title="O'chirish"
                      >
                        <IoTrashOutline />
                      </button>
                    </div>

                    <div className="q-options-grid">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`q-option-pill ${
                            q.correctAnswer === oIdx ? "correct" : ""
                          }`}
                        >
                          <span className="q-option-letter">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="q-option-val">{opt}</span>
                          {q.correctAnswer === oIdx && (
                            <span className="correct-tag">To'g'ri</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Question Modal */}
      {showManualQuestionModal && (
        <div className="baraban-modal-backdrop">
          <div className="baraban-modal-card">
            <div className="modal-header">
              <h3>Savol qo'shish</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowManualQuestionModal(false)}
              >
                <IoClose />
              </button>
            </div>

            <div className="modal-body">
              <label className="modal-label">Savol matni</label>
              <input
                type="text"
                className="baraban-input"
                placeholder="Savol matnini yozing..."
                value={newQuestion.question}
                onChange={(e) =>
                  setNewQuestion({ ...newQuestion, question: e.target.value })
                }
              />

              <label className="modal-label" style={{ marginTop: "16px" }}>
                Javob variantlari (To'g'ri javobni tanlang)
              </label>
              <div className="manual-options-list">
                {newQuestion.options.map((opt, oIdx) => (
                  <div key={oIdx} className="manual-opt-row">
                    <button
                      type="button"
                      className={`opt-radio-btn ${
                        newQuestion.correctAnswer === oIdx ? "selected" : ""
                      }`}
                      onClick={() =>
                        setNewQuestion({ ...newQuestion, correctAnswer: oIdx })
                      }
                      title="To'g'ri javob qilish"
                    >
                      {String.fromCharCode(65 + oIdx)}
                    </button>
                    <input
                      type="text"
                      className="baraban-input flex-1"
                      placeholder={`${String.fromCharCode(65 + oIdx)} variant...`}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newQuestion.options];
                        updated[oIdx] = e.target.value;
                        setNewQuestion({ ...newQuestion, options: updated });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="baraban-secondary-btn"
                onClick={() => setShowManualQuestionModal(false)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="baraban-primary-btn"
                onClick={handleAddManualQuestion}
              >
                Qo'shish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generator & JSON Import Modal */}
      {showAiModal && (
        <div className="baraban-modal-backdrop">
          <div className="baraban-modal-card ai-modal-card">
            <div className="modal-header">
              <div className="ai-modal-title-box">
                <span className="ai-icon-bubble">
                  <IoSparkles />
                </span>
                <div>
                  <h3>AI bilan test tuzish va JSON yuklash</h3>
                  <p className="ai-modal-desc">
                    Mavzuni kiriting, promptni nusxalang va ChatGPT/Gemini
                    qaytargan JSON kodni yuklang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAiModal(false)}
              >
                <IoClose />
              </button>
            </div>

            <div className="modal-body">
              {/* Step 1: Prompt Generation */}
              <div className="ai-step-box">
                <div className="step-badge">
                  1-Qadam: AI uchun prompt tayyorlash
                </div>
                <div className="ai-inputs-grid">
                  <div>
                    <label className="modal-label">Mavzu nomi</label>
                    <input
                      type="text"
                      className="baraban-input"
                      placeholder="Masalan: O'zbekiston tarixi, Fizika qonunlari..."
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="modal-label">Nechta savol kerak?</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="baraban-input"
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="prompt-preview-wrap">
                  <label className="modal-label">Tayyor prompt:</label>
                  <pre className="prompt-code-block">{getAiPrompt()}</pre>
                  <button
                    type="button"
                    className="baraban-primary-btn copy-prompt-btn"
                    onClick={handleCopyAiPrompt}
                  >
                    <IoCopyOutline /> Promptni nusxalash
                  </button>
                </div>
              </div>

              {/* Step 2: Paste JSON */}
              <div className="ai-step-box">
                <div className="step-badge">
                  2-Qadam: Olingan JSON natijasini joylash
                </div>
                <p className="step-instruction">
                  ChatGPT yoki Gemini qaytargan JSON matnini quyidagi maydonga
                  tashlang:
                </p>
                <textarea
                  className="baraban-textarea"
                  placeholder='[\n  {\n    "question": "Savol matni",\n    "options": ["A", "B", "C", "D"],\n    "correctAnswer": 0\n  }\n]'
                  rows={6}
                  value={aiJsonInput}
                  onChange={(e) => setAiJsonInput(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="baraban-secondary-btn"
                onClick={() => setShowAiModal(false)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="baraban-primary-btn"
                onClick={handleImportJson}
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
