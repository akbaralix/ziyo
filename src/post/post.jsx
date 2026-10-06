import { HiDotsVertical } from "react-icons/hi";
import { FaRegHeart, FaHeart, FaRegComment, FaRegBookmark } from "react-icons/fa";
import { LuShare2, LuSend, LuPencil, LuTrash2 } from "react-icons/lu";
import { IoMdClose } from "react-icons/io";
import { IoEyeOffOutline, IoAlertCircleOutline } from "react-icons/io5";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import logo from "../assets/logo.jpg";
import {
  fetchPosts,
  togglePostLike,
  fetchComments,
  addComment,
  submitQuizAnswer,
  deletePost,
  updatePost,
} from "../api/postApi.js";
import "./post.css";

function Post({
  selectedCategory = "Barchasi",
  searchQuery = "",
  onlyMyPosts = false,
}) {
  const queryClient = useQueryClient();
  const [showPostAction, setShowPostAction] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});

  // Izohlar (Comments) modal holati
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [newCommentText, setNewCommentText] = useState("");

  // Tahrirlash (Edit) modal holati
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: "",
    title: "",
    content: "",
    category: "Dasturlash",
    tags: "",
  });

  // TanStack Query orqali postlarni keshdan tezkor olish
  const { data, isLoading: loading } = useQuery({
    queryKey: ["posts", selectedCategory, searchQuery, onlyMyPosts],
    queryFn: () =>
      fetchPosts({
        category: selectedCategory,
        search: searchQuery,
        onlyMyPosts,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const posts = data?.posts || [];

  // TanStack Query orqali izohlarni olish
  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", activeCommentPost?.id],
    queryFn: () => fetchComments(activeCommentPost.id),
    enabled: !!activeCommentPost?.id,
    staleTime: 1000 * 60 * 2,
  });

  const commentsList = commentsData?.comments || [];

  // Like mutatsiyasi (optimistik yangilash)
  const likeMutation = useMutation({
    mutationFn: (postId) => togglePostLike(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });

      queryClient.setQueriesData({ queryKey: ["posts"] }, (old) => {
        if (!old || !old.posts) return old;
        return {
          ...old,
          posts: old.posts.map((p) => {
            if (p.id === postId) {
              const nextLiked = !p.isLiked;
              return {
                ...p,
                isLiked: nextLiked,
                likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
              };
            }
            return p;
          }),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const handleToggleLike = (postId) => {
    likeMutation.mutate(postId);
  };

  // Izoh qoldirish mutatsiyasi
  const commentMutation = useMutation({
    mutationFn: ({ postId, text }) => addComment(postId, text),
    onSuccess: (res, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setNewCommentText("");
    },
    onError: (err) => {
      alert(err.message || "Izoh yozishda xatolik yuz berdi.");
    },
  });

  const handleAddCommentSubmit = (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeCommentPost) return;
    commentMutation.mutate({
      postId: activeCommentPost.id,
      text: newCommentText.trim(),
    });
  };

  // Postni o'chirish mutatsiyasi
  const deleteMutation = useMutation({
    mutationFn: (postId) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setShowPostAction(false);
      setSelectedPost(null);
    },
    onError: (err) => {
      alert(err.message || "Postni o'chirishda xatolik yuz berdi.");
    },
  });

  const handleDeletePost = (post) => {
    if (window.confirm("Haqiqatan ham ushbu postni o'chirmoqchimisiz?")) {
      deleteMutation.mutate(post.id);
    }
  };

  // Postni tahrirlash mutatsiyasi
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setIsEditModalOpen(false);
      setShowPostAction(false);
      setSelectedPost(null);
    },
    onError: (err) => {
      alert(err.message || "Postni tahrirlashda xatolik yuz berdi.");
    },
  });

  const handleOpenEdit = (post) => {
    setEditFormData({
      id: post.id,
      title: post.title || "",
      content: post.content || "",
      category: post.category || "Dasturlash",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
    });
    setShowPostAction(false);
    setIsEditModalOpen(true);
  };

  const handleSaveEditSubmit = (e) => {
    e.preventDefault();
    if (!editFormData.title.trim()) {
      alert("Sarlavha bo'sh bo'lishi mumkin emas!");
      return;
    }

    const tagList = editFormData.tags
      ? editFormData.tags
          .split(",")
          .map((t) => t.trim().replace(/^#+/, ""))
          .filter(Boolean)
      : [];

    updateMutation.mutate({
      id: editFormData.id,
      data: {
        title: editFormData.title.trim(),
        content: editFormData.content.trim(),
        category: editFormData.category,
        tags: tagList,
      },
    });
  };

  // Quiz javobini tekshirish
  const quizMutation = useMutation({
    mutationFn: ({ postId, selectOption }) =>
      submitQuizAnswer(postId, selectOption),
    onSuccess: (res, { postId, selectOption }) => {
      if (res && res.success) {
        setQuizAnswers((prev) => ({
          ...prev,
          [postId]: {
            selected: selectOption,
            isCorrect: res.isCorrect,
            correctOption: res.correctOption,
            explanation: res.explanation,
          },
        }));
        queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      }
    },
  });

  const handleChekQuiz = (postId, selectOption) => {
    if (quizAnswers[postId]) return;
    quizMutation.mutate({ postId, selectOption });
  };

  const handleOpenComments = (post) => {
    setActiveCommentPost(post);
  };

  const handlePostAction = (post) => {
    setSelectedPost(post);
    setShowPostAction(true);
  };

  // Joriy foydalanuvchini aniqlash
  const isSelectedPostOwner = Boolean(
    selectedPost?.isAuthor ||
    onlyMyPosts ||
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem("ziyo_user"));
        if (!u || !selectedPost) return false;
        return (
          selectedPost.author === u._id ||
          selectedPost.user?.id === u._id ||
          selectedPost.user?.username === u.telegramUsername
        );
      } catch {
        return false;
      }
    })()
  );

  return (
    <div className="post-container">
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#6b7280",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ fontSize: "15px", fontWeight: "500", color: "#4b5563" }}>
            Postlar yuklanmoqda... ⏳
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#6b7280",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ fontSize: "16px", fontWeight: "600", color: "#374151" }}>
            Hozircha hech qanday post mavjud emas
          </p>
          <p style={{ fontSize: "14px", marginTop: "4px" }}>
            Birinchi bo'lib o'z bilimingiz yoki savolingizni ulashing! 🚀
          </p>
        </div>
      ) : (
        posts.map((post) => {
          const quizState = quizAnswers[post.id];
          return (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-user-info">
                  <img
                    src={post.user?.avatar || logo}
                    alt={post.user?.name || "User"}
                    className="post-user-avatar"
                  />

                  <div className="post-user-data">
                    <h4 className="post-user-name">{post.user?.name}</h4>
                    <span className="post-user-username">
                      @{post.user?.username || "user"}
                    </span>
                  </div>
                </div>

                <div className="post-action-btn">
                  <button onClick={() => handlePostAction(post)}>
                    <HiDotsVertical />
                  </button>
                </div>
              </div>

              {/* POST CONTENT */}
              <div className="post-content">
                <h3 className="post-title">{post.title}</h3>

                {post.content && <p className="post-text">{post.content}</p>}

                {post.type === "quiz" && post.options && (
                  <div className="post-quiz">
                    <div className="quiz-options">
                      {post.options.map((option) => {
                        const isSelected = quizState?.selected === option.id;
                        const isCorrect = quizState?.correctOption === option.id;
                        let optionClass = "quiz-option";
                        let letterStyle = {};
                        let cardStyle = {};

                        if (quizState) {
                          if (isCorrect) {
                            cardStyle = {
                              borderColor: "#1032b9",
                              background: "#ecfdf5",
                            };
                            letterStyle = {
                              background: "#1428d5",
                              color: "#fff",
                              borderColor: "#5e76e2",
                            };
                          } else if (isSelected && !quizState.isCorrect) {
                            cardStyle = {
                              borderColor: "#e31212",
                              background: "#fef2f2",
                            };
                            letterStyle = {
                              background: "#fd1313",
                              color: "#fff",
                              borderColor: "#ec1818",
                            };
                          }
                        }

                        return (
                          <button
                            key={option.id}
                            style={cardStyle}
                            onClick={() =>
                              handleChekQuiz(
                                post.id,
                                option.id
                              )
                            }
                            className={optionClass}
                          >
                            <span
                              className="quiz-option-letter"
                              style={letterStyle}
                            >
                              {option.id.toUpperCase()}
                            </span>
                            <span className="quiz-option-text">
                              {option.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {quizState && quizState.explanation && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: "#eff6ff",
                          color: "#1e40af",
                          fontSize: "13px",
                        }}
                      >
                        💡 <strong>Tushuntirish:</strong> {quizState.explanation}
                      </div>
                    )}
                  </div>
                )}

                {/* TAGS */}
                {post.tags && post.tags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                    }}
                  >
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "13px",
                          color: "#3e59df",
                          fontWeight: "500",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* POST FOOTER */}
              <div className="post-footer">
                <div className="post-actions">
                  <button
                    className="post-like-btn"
                    onClick={() => handleToggleLike(post.id)}
                  >
                    {post.isLiked ? (
                      <FaHeart style={{ color: "#ef4444" }} />
                    ) : (
                      <FaRegHeart />
                    )}
                    <span>{post.likes}</span>
                  </button>

                  <button
                    className="post-comment-btn"
                    onClick={() => handleOpenComments(post)}
                  >
                    <FaRegComment />
                    <span>{post.commentsCount || 0}</span>
                  </button>
                </div>

                <span className="post-category">{post.category}</span>
              </div>
            </div>
          );
        })
      )}

      {/* ⁝ ACTION MENYU */}
      {showPostAction && selectedPost && (
        <div className="post-action-menyu">
          <button
            onClick={() => {
              setShowPostAction(false);
            }}
            className="post-action-hide-btn"
          >
            <IoMdClose />
          </button>

          {/* AGAR O'Z POSTI BO'LSA: TAHRIRLASH VA O'CHIRISH */}
          {isSelectedPostOwner && (
            <>
              <div className="post-action-menyu-item edit-action">
                <button onClick={() => handleOpenEdit(selectedPost)}>
                  <span><LuPencil /></span>
                  <p>Tahrirlash</p>
                </button>
              </div>

              <div className="post-action-menyu-item danger-action">
                <button
                  onClick={() => handleDeletePost(selectedPost)}
                  disabled={deleteMutation.isPending}
                >
                  <span><LuTrash2 /></span>
                  <p>{deleteMutation.isPending ? "O'chirilmoqda..." : "Postni o'chirish"}</p>
                </button>
              </div>
            </>
          )}

          {/* UMUMIY AMALLAR */}
          <div className="post-action-menyu-item">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                alert("Post havolasi nusxalandi!");
                setShowPostAction(false);
              }}
            >
              <span><LuShare2 /></span>
              <p>Ulashish</p>
            </button>
          </div>

          <div className="post-action-menyu-item">
            <button
              onClick={() => {
                alert("Post saqlanganlar ro'yxatiga qo'shildi!");
                setShowPostAction(false);
              }}
            >
              <span><FaRegBookmark /></span>
              <p>Saqlash</p>
            </button>
          </div>

          {!isSelectedPostOwner && (
            <>
              <div className="post-action-menyu-item">
                <button
                  onClick={() => {
                    alert("Tavsiyalar yangilandi.");
                    setShowPostAction(false);
                  }}
                >
                  <span><IoEyeOffOutline /></span>
                  <p>Qiziq emas</p>
                </button>
              </div>

              <div className="post-action-menyu-item">
                <button
                  onClick={() => {
                    alert("Shikoyatingiz qabul qilindi.");
                    setShowPostAction(false);
                  }}
                >
                  <span><IoAlertCircleOutline /></span>
                  <p>Shikoyat qilish</p>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* EDIT POST MODAL */}
      {isEditModalOpen && (
        <div
          className="edit-post-modal-overlay"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="edit-post-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="edit-post-modal-header">
              <h3>Postni tahrirlash</h3>
              <button
                type="button"
                className="comments-modal-close"
                onClick={() => setIsEditModalOpen(false)}
              >
                <IoMdClose />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="edit-post-form">
              <div className="edit-post-field">
                <label>Sarlavha</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, title: e.target.value })
                  }
                  className="edit-post-input"
                  required
                />
              </div>

              <div className="edit-post-field">
                <label>Kategoriya</label>
                <select
                  value={editFormData.category}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, category: e.target.value })
                  }
                  className="edit-post-select"
                >
                  <option value="Dasturlash">Dasturlash</option>
                  <option value="Fizika">Fizika</option>
                  <option value="Matematika">Matematika</option>
                  <option value="Mantiqiy savollar">Mantiqiy savollar</option>
                  <option value="Qiziqarli faktlar">Qiziqarli faktlar</option>
                  <option value="Kitoblar">Kitoblar</option>
                  <option value="Savol-javob">Savol-javob</option>
                </select>
              </div>

              <div className="edit-post-field">
                <label>Matn</label>
                <textarea
                  rows={4}
                  value={editFormData.content}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, content: e.target.value })
                  }
                  className="edit-post-textarea"
                />
              </div>

              <div className="edit-post-field">
                <label>Teglar (vergul bilan ajrating)</label>
                <input
                  type="text"
                  placeholder="masalan: dasturlash, ilm"
                  value={editFormData.tags}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, tags: e.target.value })
                  }
                  className="edit-post-input"
                />
              </div>

              <div className="edit-post-actions">
                <button
                  type="button"
                  className="edit-post-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="edit-post-save-btn"
                >
                  {updateMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IZOHLAR MODALI (Comments Drawer/Modal) */}
      {activeCommentPost && (
        <div
          className="comments-modal-overlay"
          onClick={() => setActiveCommentPost(null)}
        >
          <div
            className="comments-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="comments-modal-header">
              <h3>Izohlar ({activeCommentPost.commentsCount || commentsList.length})</h3>
              <button
                type="button"
                className="comments-modal-close"
                onClick={() => setActiveCommentPost(null)}
              >
                <IoMdClose />
              </button>
            </div>

            <div className="comments-modal-body">
              {commentsLoading ? (
                <div className="comments-loading-state">
                  Izohlar yuklanmoqda...
                </div>
              ) : commentsList.length === 0 ? (
                <div className="comments-empty-state">
                  Hozircha hech qanday izoh yo'q. Birinchi bo'lib fikringizni bildiring! 💬
                </div>
              ) : (
                <div className="comments-list">
                  {commentsList.map((c) => (
                    <div key={c.id} className="comment-item">
                      <img
                        src={c.user?.avatar || logo}
                        alt="User"
                        className="comment-avatar"
                      />
                      <div className="comment-content-box">
                        <div className="comment-user-header">
                          <span className="comment-author-name">
                            {c.user?.name || "Foydalanuvchi"}
                          </span>
                          <span className="comment-date">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                        <p className="comment-text-body">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment input form */}
            <form
              onSubmit={handleAddCommentSubmit}
              className="comment-form-container"
            >
              <input
                type="text"
                placeholder="Fikringizni yozing..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="comment-input-field"
                required
              />
              <button
                type="submit"
                disabled={!newCommentText.trim() || commentMutation.isPending}
                className="comment-submit-btn"
              >
                <LuSend />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Post;
