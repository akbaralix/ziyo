import { HiDotsVertical } from "react-icons/hi";
import {
  FaRegHeart,
  FaHeart,
  FaRegComment,
  FaRegBookmark,
  FaBookmark,
} from "react-icons/fa";
import { LuShare2, LuSend, LuPencil, LuTrash2 } from "react-icons/lu";
import { IoMdClose } from "react-icons/io";
import { IoEyeOffOutline, IoAlertCircleOutline } from "react-icons/io5";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import user from "../assets/user.jpg";
import {
  fetchPosts,
  togglePostLike,
  fetchComments,
  addComment,
  submitQuizAnswer,
  deletePost,
  updatePost,
  reportPost,
} from "../api/postApi.js";
import ModalOverlay from "../components/ModalOverlay";
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

  // Saqlangan postlar (Bookmarks)
  const [savedPostIds, setSavedPostIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ziyo_saved_post_ids") || "[]");
    } catch {
      return [];
    }
  });

  // Yashirilgan postlar (Qiziq emas)
  const [hiddenPostIds, setHiddenPostIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ziyo_hidden_post_ids") || "[]");
    } catch {
      return [];
    }
  });

  // Shikoyat (Report) modal holati
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Spam yoki reklama");
  const [customReason, setCustomReason] = useState("");

  // Tahrirlash (Edit) modal holati
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: "",
    title: "",
    content: "",
    category: "Dasturlash",
    tags: "",
  });

  const getTimeAgo = (date) => {
    if (!date) return "";

    const timestamp = new Date(date).getTime();

    if (Number.isNaN(timestamp)) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

    if (seconds < 60) return "Hozirgina";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} daqiqa oldin`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} kun oldin`;

    return new Date(date).toLocaleDateString("uz-UZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
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
  const visiblePosts = posts.filter((p) => !hiddenPostIds.includes(p.id));

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
      toast.success("Izoh muvaffaqiyatli qo'shildi!");
    },
    onError: (err) => {
      toast.error(err.message || "Izoh yozishda xatolik yuz berdi.");
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
      toast.success("Post muvaffaqiyatli o'chirildi!");
    },
    onError: (err) => {
      toast.error(err.message || "Postni o'chirishda xatolik yuz berdi.");
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
      toast.success("Post muvaffaqiyatli yangilandi!");
    },
    onError: (err) => {
      toast.error(err.message || "Postni tahrirlashda xatolik yuz berdi.");
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
      toast.warning("Sarlavha bo'sh bo'lishi mumkin emas!");
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

        queryClient.setQueriesData({ queryKey: ["posts"] }, (old) => {
          if (!old || !old.posts) return old;
          return {
            ...old,
            posts: old.posts.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  userQuizAnswer: {
                    selected: selectOption,
                    isCorrect: res.isCorrect,
                    correctOption: res.correctOption,
                    explanation: res.explanation,
                  },
                };
              }
              return p;
            }),
          };
        });

        queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      }
    },
    onError: (err) => {
      toast.error(err.message || "Javobni yuborishda xatolik yuz berdi.");
    },
  });

  const handleChekQuiz = (postId, selectOption) => {
    if (quizAnswers[postId]) return;
    const post = posts.find((p) => p.id === postId);
    if (post?.userQuizAnswer) return;

    const token = localStorage.getItem("token");
    if (!token) {
      toast.warning("Viktorinada qatnashish uchun avval tizimga kiring!");
      return;
    }

    quizMutation.mutate({ postId, selectOption });
  };

  const handleOpenComments = (post) => {
    if (post.type === "quiz" && !post.userQuizAnswer && !quizAnswers[post.id]) {
      toast.warning("Avval  javob bering");
      return;
    }
    setActiveCommentPost(post);
  };

  // Shikoyat yuborish mutatsiyasi
  const reportMutation = useMutation({
    mutationFn: ({ postId, reason }) => reportPost(postId, reason),
    onSuccess: (res) => {
      setIsReportModalOpen(false);
      setShowPostAction(false);
      setSelectedPost(null);
      setCustomReason("");
      toast.success(res?.message || "Shikoyatingiz ma'muriyatga yetkazildi.");
    },
    onError: (err) => {
      toast.error(err.message || "Shikoyat yuborishda xatolik yuz berdi.");
    },
  });

  const handlePostAction = (post) => {
    setSelectedPost(post);
    setShowPostAction(true);
  };

  // 1. Ulashish (Share)
  const handleSharePost = async (post) => {
    if (!post) return;
    const shareUrl = `${window.location.origin}/#post-${post.id}`;
    const shareData = {
      title: post.title || "Ziyo post",
      text: post.content
        ? post.content.slice(0, 100)
        : "Ziyo platformasidagi qiziqarli post",
      url: shareUrl,
    };

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData);
        setShowPostAction(false);
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.log("Share xatosi:", err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Post havolasi nusxalandi! 📋");
    } catch {
      toast.info("Havola: " + shareUrl);
    }
    setShowPostAction(false);
  };

  // 2. Saqlash / Saqlanganlardan o'chirish (Bookmark)
  const handleToggleSavePost = (post) => {
    if (!post) return;
    const isSaved = savedPostIds.includes(post.id);
    let nextSaved = [];
    if (isSaved) {
      nextSaved = savedPostIds.filter((id) => id !== post.id);
      toast.info("Post saqlanganlardan olib tashlandi.");
    } else {
      nextSaved = [...savedPostIds, post.id];
      toast.success("Post saqlanganlar ro'yxatiga qo'shildi! 🔖");
    }
    setSavedPostIds(nextSaved);
    localStorage.setItem("ziyo_saved_post_ids", JSON.stringify(nextSaved));
    setShowPostAction(false);
  };

  // 3. Qiziq emas (Hide)
  const handleHidePost = (post) => {
    if (!post) return;
    const nextHidden = [...hiddenPostIds, post.id];
    setHiddenPostIds(nextHidden);
    localStorage.setItem("ziyo_hidden_post_ids", JSON.stringify(nextHidden));
    setShowPostAction(false);
    toast.info("Post yashirildi. Sizga boshqa ko'rsatilmaydi.");
  };

  // 4. Shikoyat modalini ochish
  const handleOpenReport = (post) => {
    setSelectedPost(post);
    setShowPostAction(false);
    setReportReason("Spam yoki reklama");
    setCustomReason("");
    setIsReportModalOpen(true);
  };

  // 5. Shikoyatni yuborish
  const handleSubmitReport = (e) => {
    e?.preventDefault();
    if (!selectedPost) return;
    const finalReason =
      reportReason === "Boshqa sabab..."
        ? customReason.trim() || "Boshqa qoidabuzarlik"
        : reportReason;

    reportMutation.mutate({
      postId: selectedPost.id,
      reason: finalReason,
    });
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
    })(),
  );

  return (
    <div className="post-container">
      {loading ? (
        <div className="posts-loader-container">
          {[1, 2, 3].map((n) => (
            <div key={n} className="post-skeleton-card">
              {/* Header */}
              <div className="post-skeleton-header">
                <div className="post-skeleton-avatar"></div>
                <div className="post-skeleton-user-info">
                  <div className="post-skeleton-line short"></div>
                  <div className="post-skeleton-line shortest"></div>
                </div>
              </div>

              {/* Content */}
              <div className="post-skeleton-content">
                <div className="post-skeleton-line medium"></div>
                <div className="post-skeleton-line long"></div>
                <div className="post-skeleton-line long"></div>
              </div>

              {/* Footer */}
              <div className="post-skeleton-footer">
                <div className="post-skeleton-actions-group">
                  <div className="post-skeleton-action-btn"></div>
                  <div className="post-skeleton-action-btn"></div>
                </div>
                <div className="post-skeleton-line shortest"></div>
              </div>
            </div>
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#212121",
            padding: "40px 20px",
          }}
        >
          <img src="/utyaduckicon12.png" alt="" />
          <p style={{ fontSize: "20px" }}>
            Hozircha hech qanday post mavjud emas
          </p>
        </div>
      ) : (
        visiblePosts.map((post) => {
          const quizState = quizAnswers[post.id] || post.userQuizAnswer;
          return (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-user-info">
                  <img
                    src={post.user?.profilePic || user}
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
                        const isCorrect =
                          quizState?.correctOption === option.id;

                        // Hozirgi tugma bosilganligini va mutation ketayotganini tekshiramiz
                        const isThisButtonLoading =
                          quizMutation.isPending &&
                          quizMutation.variables?.postId === post.id &&
                          quizMutation.variables?.selectOption === option.id;

                        let optionClass = `quiz-option ${quizState ? "disabled" : ""}`;
                        let letterStyle = {};
                        let cardStyle = {};

                        if (quizState) {
                          if (isCorrect) {
                            cardStyle = {
                              borderColor: "#3210b9",
                              background: "#f1ecfd",
                            };
                            letterStyle = {
                              background: "#3a10b9",
                              color: "#fff",
                              borderColor: "#7f5ed7",
                            };
                          } else if (isSelected && !quizState.isCorrect) {
                            cardStyle = {
                              borderColor: "#ef4444",
                              background: "#fef2f2",
                            };
                            letterStyle = {
                              background: "#ef4444",
                              color: "#fff",
                              borderColor: "#ef4444",
                            };
                          } else {
                            cardStyle = { opacity: 0.7 };
                          }
                        }

                        // Agar shu tugma bosilib, serverdan javob kutilayotgan bo'lsa
                        if (isThisButtonLoading) {
                          cardStyle = {
                            borderColor: "#3a10b9",
                            background: "#f9f8ff",
                          };
                          letterStyle = {
                            background: "#3a10b9",
                            borderColor: "#3a10b9",
                          };
                        }

                        return (
                          <button
                            key={option.id}
                            style={cardStyle}
                            disabled={!!quizState || quizMutation.isPending}
                            onClick={() => handleChekQuiz(post.id, option.id)}
                            className={optionClass}
                          >
                            <span
                              className="quiz-option-letter"
                              style={letterStyle}
                            >
                              {isThisButtonLoading ? (
                                <span className="quiz-mini-spinner"></span>
                              ) : (
                                option.id.toUpperCase()
                              )}
                            </span>
                            <span className="quiz-option-text">
                              {option.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {quizState && (
                      <div
                        style={{
                          marginTop: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {quizState.explanation && (
                          <div
                            style={{
                              padding: "10px 14px",
                              borderRadius: "10px",
                              background: "#f3efff",
                              color: "#311eaf",
                              fontSize: "13px",
                              border: "1px solid #dbeafe",
                            }}
                          >
                            💡 <strong>Tushuntirish:</strong>{" "}
                            {quizState.explanation}
                          </div>
                        )}
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
                          color: "#593edf",
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
                <span className="post-date">{getTimeAgo(post.createdAt)}</span>
                <span className="post-category">{post.category}</span>
              </div>
            </div>
          );
        })
      )}

      {/* ⁝ ACTION MENYU MODAL OVERLAY BILAN */}
      <ModalOverlay
        isOpen={showPostAction && !!selectedPost}
        onClose={() => {
          setShowPostAction(false);
          setSelectedPost(null);
        }}
      >
        <div className="post-action-modal">
          <div className="post-action-modal-header">
            <div className="post-action-modal-title">
              <h4>Post amallari</h4>
              <p className="post-action-post-snippet">
                {selectedPost?.title
                  ? `"${selectedPost.title.slice(0, 38)}${selectedPost.title.length > 38 ? "..." : ""}"`
                  : "Amalni tanlang"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPostAction(false);
                setSelectedPost(null);
              }}
              className="post-action-close-btn"
              aria-label="Yopish"
            >
              <IoMdClose />
            </button>
          </div>

          <div className="post-action-list">
            {/* AGAR O'Z POSTI BO'LSA: TAHRIRLASH VA O'CHIRISH */}
            {isSelectedPostOwner && (
              <>
                <button
                  type="button"
                  className="post-action-row edit-action"
                  onClick={() => handleOpenEdit(selectedPost)}
                >
                  <span className="post-action-icon edit">
                    <LuPencil />
                  </span>
                  <div className="post-action-text">
                    <strong>Tahrirlash</strong>
                    <span>Sarlavha, matn yoki teglarni o'zgartirish</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="post-action-row danger-action"
                  onClick={() => handleDeletePost(selectedPost)}
                  disabled={deleteMutation.isPending}
                >
                  <span className="post-action-icon delete">
                    <LuTrash2 />
                  </span>
                  <div className="post-action-text">
                    <strong>
                      {deleteMutation.isPending
                        ? "O'chirilmoqda..."
                        : "Postni o'chirish"}
                    </strong>
                    <span>Postni platformadan butunlay olib tashlash</span>
                  </div>
                </button>
              </>
            )}

            {/* UMUMIY AMALLAR */}
            <button
              type="button"
              className="post-action-row"
              onClick={() => handleSharePost(selectedPost)}
            >
              <span className="post-action-icon share">
                <LuShare2 />
              </span>
              <div className="post-action-text">
                <strong>Ulashish</strong>
                <span>Havolani nusxalash yoki ulashish</span>
              </div>
            </button>

            <button
              type="button"
              className="post-action-row"
              onClick={() => handleToggleSavePost(selectedPost)}
            >
              <span
                className={`post-action-icon bookmark ${
                  selectedPost && savedPostIds.includes(selectedPost.id)
                    ? "active"
                    : ""
                }`}
              >
                {selectedPost && savedPostIds.includes(selectedPost.id) ? (
                  <FaBookmark style={{ color: "#4f46e5" }} />
                ) : (
                  <FaRegBookmark />
                )}
              </span>
              <div className="post-action-text">
                <strong>
                  {selectedPost && savedPostIds.includes(selectedPost.id)
                    ? "Saqlanganlardan o'chirish"
                    : "Saqlash"}
                </strong>
                <span>Keyinroq o'qish uchun saqlab qo'yish</span>
              </div>
            </button>

            {!isSelectedPostOwner && (
              <>
                <button
                  type="button"
                  className="post-action-row"
                  onClick={() => handleHidePost(selectedPost)}
                >
                  <span className="post-action-icon hide">
                    <IoEyeOffOutline />
                  </span>
                  <div className="post-action-text">
                    <strong>Qiziq emas</strong>
                    <span>Ushbu postni lentangizdan yashirish</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="post-action-row report-action"
                  onClick={() => handleOpenReport(selectedPost)}
                >
                  <span className="post-action-icon report">
                    <IoAlertCircleOutline />
                  </span>
                  <div className="post-action-text">
                    <strong>Shikoyat qilish</strong>
                    <span>Qoidabuzarlik haqida ma'muriyatga xabar berish</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      </ModalOverlay>

      {/* SHIKOYAT YUBORISH MODALI (REPORT MODAL) */}
      <ModalOverlay
        isOpen={isReportModalOpen && !!selectedPost}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedPost(null);
        }}
      >
        <div className="report-post-modal">
          <div className="report-modal-header">
            <div className="report-modal-badge">
              <IoAlertCircleOutline />
            </div>
            <div>
              <h3>Shikoyat yuborish</h3>
              <p className="report-target-snippet">
                Post: <b>"{selectedPost?.title}"</b> (
                {selectedPost?.user?.name || "Muallif"})
              </p>
            </div>
            <button
              type="button"
              className="report-modal-close"
              onClick={() => {
                setIsReportModalOpen(false);
                setSelectedPost(null);
              }}
            >
              <IoMdClose />
            </button>
          </div>

          <form onSubmit={handleSubmitReport} className="report-modal-body">
            <label className="report-label">Shikoyat sababini tanlang:</label>

            <div className="report-reasons-grid">
              {[
                "Spam yoki reklama",
                "Haqorat yoki nomaqbul so'zlar",
                "Noto'g'ri / yolg'on ma'lumot",
                "Zo'ravonlik yoki tahdid",
                "Mualliflik huquqi buzilishi",
                "Boshqa sabab...",
              ].map((reasonItem) => (
                <label
                  key={reasonItem}
                  className={`report-reason-chip ${
                    reportReason === reasonItem ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reasonItem}
                    checked={reportReason === reasonItem}
                    onChange={() => setReportReason(reasonItem)}
                  />
                  <span>{reasonItem}</span>
                </label>
              ))}
            </div>

            {reportReason === "Boshqa sabab..." && (
              <div className="report-custom-field">
                <textarea
                  rows={3}
                  placeholder="Iltimos, sababni batafsilroq yozing..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="report-textarea"
                  required
                />
              </div>
            )}

            {/* QIZIL O'CHIRISH/YUBORISH VA BEKOR QILISH TUGMALARI */}
            <div className="report-modal-actions">
              <button
                type="button"
                className="report-btn-cancel"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setSelectedPost(null);
                }}
                disabled={reportMutation.isPending}
              >
                Bekor qilish
              </button>

              <button
                type="submit"
                className="report-btn-danger"
                disabled={reportMutation.isPending}
              >
                {reportMutation.isPending ? (
                  "Yuborilmoqda..."
                ) : (
                  <>
                    <IoAlertCircleOutline /> Shikoyat yuborish
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* EDIT POST MODAL */}
      <ModalOverlay
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      >
        <div className="edit-post-modal">
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
                  setEditFormData({
                    ...editFormData,
                    category: e.target.value,
                  })
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
                  setEditFormData({
                    ...editFormData,
                    content: e.target.value,
                  })
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
      </ModalOverlay>

      {/* IZOHLAR MODALI (Comments Drawer/Modal) */}
      <ModalOverlay
        isOpen={!!activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
      >
        <div className="comments-modal-box">
          <div className="comments-modal-header">
            <h3>
              Izohlar ({activeCommentPost?.commentsCount || commentsList.length}
              )
            </h3>
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
                Hozircha hech qanday izoh yo'q. Birinchi bo'lib fikringizni
                bildiring! 💬
              </div>
            ) : (
              <div className="comments-list">
                {commentsList.map((c) => (
                  <div key={c.id} className="comment-item">
                    <img
                      src={c.user?.profilePic || logo}
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
      </ModalOverlay>
    </div>
  );
}

export default Post;
