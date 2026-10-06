import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoArrowBack,
  IoClose,
  IoCheckmarkCircle,
  IoAdd,
  IoEyeOutline,
  IoCreateOutline,
  IoBulbOutline,
  IoGridOutline,
  IoExtensionPuzzleOutline,
  IoCalculatorOutline,
  IoSparklesOutline,
  IoCheckmark,
  IoCodeSlashOutline,
} from "react-icons/io5";
import { LuAtom, LuBrain, LuBookOpen } from "react-icons/lu";
import { FiSend, FiBookmark } from "react-icons/fi";
import { HiOutlineLightBulb } from "react-icons/hi";
import { FaHeart, FaRegComment } from "react-icons/fa";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { createPost } from "../../api/postApi.js";
import logo from "../../assets/logo.jpg";
import "./create.css";

const CATEGORIES = [
  { name: "Barchasi", icon: <IoGridOutline /> },
  { name: "Dasturlash", icon: <IoCodeSlashOutline /> },
  { name: "Fizika", icon: <LuAtom /> },
  { name: "Matematika", icon: <IoCalculatorOutline /> },
  { name: "Mantiqiy savollar", icon: <IoExtensionPuzzleOutline /> },
  { name: "Qiziqarli faktlar", icon: <IoBulbOutline /> },
  { name: "Kitoblar", icon: <LuBookOpen /> },
  { name: "Savol-javob", icon: <LuBrain /> },
];

const SUGGESTED_TAGS = [
  "#dasturlash",
  "#matematika",
  "#fizika",
  "#ziyo",
  "#ilm",
  "#viktorina",
  "#kitob",
  "#suniy_intellekt",
];

const QUICK_EMOJIS = ["💡", "🧠", "💻", "📚", "✨", "🎯", "🔥", "🚀"];

function Create() {
  const navigate = useNavigate();

  // Post form state
  const [postType, setPostType] = useState("post"); // 'post' | 'quiz' | 'fact'
  const [category, setCategory] = useState("Dasturlash");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Quiz state
  const [quizOptions, setQuizOptions] = useState([
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ]);
  const [correctOption, setCorrectOption] = useState("a");
  const [quizExplanation, setQuizExplanation] = useState("");

  // Tags state
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  // UI state
  const [viewMode, setViewMode] = useState("edit"); // 'edit' | 'preview'
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Load draft if available
  useEffect(() => {
    const savedDraft = localStorage.getItem("ziyo_post_draft");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title || draft.content) {
          setTitle(draft.title || "");
          setContent(draft.content || "");
          setCategory(draft.category || "Dasturlash");
          setPostType(draft.postType || "post");
          if (draft.quizOptions) setQuizOptions(draft.quizOptions);
          if (draft.correctOption) setCorrectOption(draft.correctOption);
          if (draft.tags) setTags(draft.tags);
        }
      } catch {
        // ignore parse error
      }
    }
  }, []);

  const handleOptionTextChange = (id, newText) => {
    setQuizOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, text: newText } : opt))
    );
  };

  const handleAddOption = () => {
    if (quizOptions.length >= 6) {
      showToast("Maksimal 6 ta variant qo'shish mumkin!");
      return;
    }
    const nextLetter = String.fromCharCode(97 + quizOptions.length); // 'e', 'f'...
    setQuizOptions((prev) => [...prev, { id: nextLetter, text: "" }]);
  };

  const handleRemoveOption = (id) => {
    if (quizOptions.length <= 2) {
      showToast("Kamida 2 ta variant bo'lishi kerak!");
      return;
    }
    const filtered = quizOptions.filter((opt) => opt.id !== id);
    // re-letter
    const relettered = filtered.map((opt, index) => ({
      ...opt,
      id: String.fromCharCode(97 + index),
    }));
    setQuizOptions(relettered);
    if (correctOption === id || !relettered.some((o) => o.id === correctOption)) {
      setCorrectOption(relettered[0].id);
    }
  };

  const handleAddTag = (tagToAdd) => {
    const cleanTag = tagToAdd.trim().replace(/^#+/, "");
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags((prev) => [...prev, cleanTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleInsertEmoji = (emoji) => {
    setContent((prev) => prev + emoji);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  const handleSaveDraft = () => {
    const draftData = {
      postType,
      category,
      title,
      content,
      quizOptions,
      correctOption,
      tags,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("ziyo_post_draft", JSON.stringify(draftData));
    showToast("Qoralama saqlandi! 💾");
  };

  const validateForm = () => {
    if (!title.trim()) {
      showToast("Iltimos, sarlavha yoki mavzuni kiriting!");
      return false;
    }
    if (postType === "quiz") {
      const filledOptions = quizOptions.filter((o) => o.text.trim().length > 0);
      if (filledOptions.length < 2) {
        showToast("Viktorina uchun kamida 2 ta variantni to'ldiring!");
        return false;
      }
    } else {
      if (!content.trim()) {
        showToast("Iltimos, post matnini yozing!");
        return false;
      }
    }
    return true;
  };

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload) => createPost(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      localStorage.removeItem("ziyo_post_draft");
      setShowSuccessModal(true);
    },
    onError: (err) => {
      console.error("Post yaratish xatosi:", err);
      showToast(err.message || "Server bilan bog'lanishda xatolik yuz berdi.");
    },
  });

  const handlePublish = () => {
    if (!validateForm()) return;

    const postPayload = {
      type: postType,
      title: title.trim(),
      content: content.trim(),
      category,
      tags,
      ...(postType === "quiz" && {
        options: quizOptions.filter((o) => o.text.trim().length > 0),
        correctOption,
        explanation: quizExplanation.trim(),
      }),
    };

    createMutation.mutate(postPayload);
  };

  const isSubmitting = createMutation.isPending;

  const resetForm = () => {
    setTitle("");
    setContent("");
    setTags([]);
    setQuizOptions([
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ]);
    setCorrectOption("a");
    setQuizExplanation("");
    setShowSuccessModal(false);
    setViewMode("edit");
  };

  return (
    <div className="create-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="preview-notice" style={{ marginBottom: "16px" }}>
          <IoSparklesOutline />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="create-header">
        <div className="create-top-bar">
          <div className="create-title-box">
            <button
              className="create-back-btn"
              onClick={() => navigate(-1)}
              title="Orqaga"
            >
              <IoArrowBack />
            </button>
            <h2 className="create-title">Yangi bilim ulashish</h2>
          </div>

          <div className="create-view-mode">
            <button
              className={`mode-btn ${viewMode === "edit" ? "active" : ""}`}
              onClick={() => setViewMode("edit")}
            >
              <IoCreateOutline />
              Tahrirlash
            </button>
            <button
              className={`mode-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
            >
              <IoEyeOutline />
              Ko'rish
            </button>
          </div>
        </div>

        {/* Post Type Selector */}
        <div className="create-type-selector">
          <button
            type="button"
            className={`type-btn ${postType === "post" ? "active" : ""}`}
            onClick={() => setPostType("post")}
          >
            <span className="type-icon">📝</span>
            <span>Maqola / Post</span>
          </button>

          <button
            type="button"
            className={`type-btn ${postType === "quiz" ? "active" : ""}`}
            onClick={() => setPostType("quiz")}
          >
            <span className="type-icon">🧠</span>
            <span>Viktorina / Test</span>
          </button>

          <button
            type="button"
            className={`type-btn ${postType === "fact" ? "active" : ""}`}
            onClick={() => setPostType("fact")}
          >
            <span className="type-icon">💡</span>
            <span>Qiziqarli fakt</span>
          </button>

          <button
            type="button"
            className="type-btn"
            style={{
              background: "linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1))",
              borderColor: "#8b5cf6",
              color: "#8b5cf6",
              fontWeight: "700",
            }}
            onClick={() => navigate("/quiz/builder")}
          >
            <span className="type-icon">🎮</span>
            <span>Ziyo Live (Kahoot)</span>
          </button>
        </div>
      </div>


      {viewMode === "edit" ? (
        /* Edit Form Card */
        <div className="create-form-card">
          {/* Category Selector */}
          <div className="form-group">
            <label className="form-label">
              <span>Kategoriya tanlang</span>
              <span className="form-label-hint">Post qaysi fanga oid?</span>
            </label>
            <div className="categories-list">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  className={`category-chip ${
                    category === cat.name ? "selected" : ""
                  }`}
                  onClick={() => setCategory(cat.name)}
                >
                  <span className="category-chip-icon">{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title / Question */}
          <div className="form-group">
            <label className="form-label">
              <span>
                {postType === "quiz" ? "Savol sarlavhasi" : "Mavzu yoki sarlavha"}
              </span>
              <span className="form-label-hint">{title.length}/100</span>
            </label>
            <input
              type="text"
              maxLength={100}
              className="create-input"
              placeholder={
                postType === "quiz"
                  ? "Masalan: Geografiya viktorinasi yoki Kvant fizikasi savoli..."
                  : "Mavzu nomini qisqa va qiziqarli yozing..."
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Main Content */}
          <div className="form-group">
            <label className="form-label">
              <span>
                {postType === "quiz"
                  ? "Savolning to'liq matni"
                  : "Asosiy matn / Maqola"}
              </span>
              <span className="form-label-hint">
                {content.length} ta belgi
              </span>
            </label>
            <textarea
              className="create-textarea"
              placeholder={
                postType === "quiz"
                  ? "Savolni to'liq va tushunarli qilib yozing..."
                  : "Bilimingiz, tajribangiz yoki qiziqarli fikringizni yozing..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="textarea-toolbar">
              <div className="quick-emoji-bar">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="emoji-btn"
                    onClick={() => handleInsertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <span className="char-counter">Formatlash: Oddiy matn</span>
            </div>
          </div>

          {/* Quiz Specific Builder */}
          {postType === "quiz" && (
            <div className="form-group">
              <label className="form-label">
                <span>Javob variantlari</span>
                <span className="form-label-hint">
                  To'g'ri javobni belgilab qo'ying
                </span>
              </label>

              <div className="quiz-options-builder">
                {quizOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className={`quiz-option-input-row ${
                      correctOption === opt.id ? "correct" : ""
                    }`}
                  >
                    <div className="quiz-option-badge">
                      {opt.id.toUpperCase()}
                    </div>
                    <input
                      type="text"
                      className="create-input"
                      placeholder={`${opt.id.toUpperCase()} javob variantini yozing...`}
                      value={opt.text}
                      onChange={(e) =>
                        handleOptionTextChange(opt.id, e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className={`correct-check-btn ${
                        correctOption === opt.id ? "is-correct" : ""
                      }`}
                      onClick={() => setCorrectOption(opt.id)}
                    >
                      <IoCheckmark />
                      {correctOption === opt.id ? "To'g'ri javob" : "To'g'ri qilish"}
                    </button>
                    {quizOptions.length > 2 && (
                      <button
                        type="button"
                        className="delete-option-btn"
                        onClick={() => handleRemoveOption(opt.id)}
                        title="O'chirish"
                      >
                        <IoClose />
                      </button>
                    )}
                  </div>
                ))}

                {quizOptions.length < 6 && (
                  <button
                    type="button"
                    className="add-option-btn"
                    onClick={handleAddOption}
                  >
                    <IoAdd />
                    Yana variant qo'shish
                  </button>
                )}
              </div>

              {/* Optional Explanation */}
              <div style={{ marginTop: "14px" }}>
                <label className="form-label">
                  <span>Javob tushuntirishi (ixtiyoriy)</span>
                </label>
                <input
                  type="text"
                  className="create-input"
                  placeholder="Nima uchun bu javob to'g'ri ekanligini tushuntiring..."
                  value={quizExplanation}
                  onChange={(e) => setQuizExplanation(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">
              <span>Mavzuga oid teglar</span>
              <span className="form-label-hint">Enter yoki vergul bosing</span>
            </label>
            <div className="tags-container">
              {tags.map((tag) => (
                <span key={tag} className="tag-badge">
                  #{tag}
                  <button
                    type="button"
                    className="tag-remove-btn"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    <IoClose />
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="tag-input"
                placeholder="Teg yozing (masalan: ziyo)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>

            {/* Suggested Tags */}
            <div className="suggested-tags">
              {SUGGESTED_TAGS.map((stag) => (
                <button
                  key={stag}
                  type="button"
                  className="suggested-tag-btn"
                  onClick={() => handleAddTag(stag)}
                >
                  {stag}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="create-actions">
            <button
              type="button"
              className="draft-btn"
              onClick={handleSaveDraft}
            >
              <FiBookmark />
              Qoralama saqlash
            </button>

            <button
              type="button"
              className="publish-btn"
              disabled={isSubmitting}
              onClick={handlePublish}
            >
              <FiSend />
              {isSubmitting ? "Chop etilmoqda..." : "Chop etish"}
            </button>
          </div>
        </div>
      ) : (
        /* Live Preview Card */
        <div className="preview-container">
          <div className="preview-notice">
            <HiOutlineLightBulb />
            <span>
              Bu sizning postingiz bosh sahifada qanday ko'rinishini aks ettiradi.
            </span>
          </div>

          <div className="post-card">
            {/* Header */}
            <div className="post-header">
              <div className="post-user-info">
                <img src={logo} alt="User" className="post-user-avatar" />
                <div className="post-user-data">
                  <h4 className="post-user-name">
                    {(() => {
                      try {
                        const u = JSON.parse(localStorage.getItem("ziyo_user"));
                        if (u && (u.firstName || u.lastName)) return `${u.firstName || ""} ${u.lastName || ""}`.trim();
                        const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
                        if (p && p.name) return p.name;
                      } catch {}
                      return "Foydalanuvchi";
                    })()}
                  </h4>
                  <span className="post-user-username">
                    @{(() => {
                      try {
                        const u = JSON.parse(localStorage.getItem("ziyo_user"));
                        if (u && u.telegramUsername) return u.telegramUsername;
                        const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
                        if (p && p.username) return p.username;
                      } catch {}
                      return "foydalanuvchi";
                    })()}
                  </span>
                </div>
              </div>
              <span className="post-category">{category}</span>
            </div>

            {/* Content */}
            <div className="post-content">
              <h3 className="post-title">
                {title || "Sarlavha kiritilmagan"}
              </h3>

              {content && <p className="post-text">{content}</p>}

              {/* Quiz Preview */}
              {postType === "quiz" && (
                <div className="post-quiz">
                  <div className="quiz-options">
                    {quizOptions
                      .filter((o) => o.text.trim())
                      .map((opt) => (
                        <div
                          key={opt.id}
                          className={`quiz-option ${
                            correctOption === opt.id ? "preview-correct" : ""
                          }`}
                          style={
                            correctOption === opt.id
                              ? { borderColor: "#10b981", background: "#f0fdf4" }
                              : {}
                          }
                        >
                          <span
                            className="quiz-option-letter"
                            style={
                              correctOption === opt.id
                                ? { background: "#10b981", color: "#fff" }
                                : {}
                            }
                          >
                            {opt.id.toUpperCase()}
                          </span>
                          <span className="quiz-option-text">{opt.text}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  {tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: "13px",
                        color: "#3e59df",
                        fontWeight: "500",
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="post-footer">
              <div className="post-actions">
                <button className="post-like-btn">
                  <FaHeart style={{ color: "#ef4444" }} />
                  <span>0</span>
                </button>
                <button className="post-comment-btn">
                  <FaRegComment />
                  <span>0</span>
                </button>
              </div>
              <span className="post-category">{category}</span>
            </div>
          </div>

          <div className="create-actions">
            <button
              type="button"
              className="draft-btn"
              onClick={() => setViewMode("edit")}
            >
              <IoCreateOutline />
              Tahrirlashga qaytish
            </button>

            <button
              type="button"
              className="publish-btn"
              disabled={isSubmitting}
              onClick={handlePublish}
            >
              <FiSend />
              Chop etish
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="success-icon-box">
              <IoCheckmarkCircle />
            </div>
            <h3>Muvaffaqiyatli chop etildi! 🎉</h3>
            <p>
              Sizning yangi postingiz Ziyo platformasida barcha foydalanuvchilarga
              ko'rsatiladi.
            </p>
            <div className="success-actions">
              <button
                className="modal-home-btn"
                onClick={() => navigate("/")}
              >
                Bosh sahifaga o'tish
              </button>
              <button className="modal-another-btn" onClick={resetForm}>
                Yana yangi post yaratish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Create;
