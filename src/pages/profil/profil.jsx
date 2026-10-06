import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBook,
  FaEdit,
  FaSignOutAlt,
  FaPlus,
  FaAward,
  FaFire,
} from "react-icons/fa";
import {
  IoExtensionPuzzleOutline,
  IoBookmarkOutline,
  IoGridOutline,
  IoSparklesOutline,
  IoClose,
  IoCheckmark,
} from "react-icons/io5";
import { GoTrophy } from "react-icons/go";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import logo from "../../assets/logo.jpg";
import Post from "../../post/post";
import "./profil.css";

import { getUserProfile, updateProfile } from "../../api/userApi.js";
import { logout } from "../../api/authApi.js";
import { fetchPosts } from "../../api/postApi.js";
import {
  getMyQuizGames,
  createGameSession,
  deleteQuizGame,
} from "../../api/quizApi.js";

function Profil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'saved' | 'stats'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");

  // TanStack Query orqali profil ma'lumotlarini keshdan olish
  const { data: profileResponse } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    staleTime: 1000 * 60 * 5,
  });

  // TanStack Query orqali faqat o'zimning postlarim sonini hisoblash
  const { data: myPostsResponse } = useQuery({
    queryKey: ["posts", "Barchasi", "", true],
    queryFn: () => fetchPosts({ onlyMyPosts: true }),
    staleTime: 1000 * 60 * 5,
  });

  const myPostCount = myPostsResponse?.posts?.length || 0;

  // TanStack Query orqali foydalanuvchining viktorinalari
  const { data: myQuizzesResponse, refetch: refetchQuizzes } = useQuery({
    queryKey: ["myQuizGames"],
    queryFn: getMyQuizGames,
    staleTime: 1000 * 60 * 2,
  });

  const myQuizzes = myQuizzesResponse?.games || [];
  const [startingQuizId, setStartingQuizId] = useState(null);

  const handleStartLiveQuiz = async (quizId) => {
    setStartingQuizId(quizId);
    try {
      const res = await createGameSession(quizId);
      if (res?.sessionId) {
        navigate(`/quiz/host/${res.sessionId}`);
      }
    } catch (err) {
      alert(err.message || "O'yinni boshlashda xatolik yuz berdi");
    } finally {
      setStartingQuizId(null);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (window.confirm("Rostdan ham ushbu viktorinani o'chirmoqchimisiz?")) {
      try {
        await deleteQuizGame(quizId);
        refetchQuizzes();
      } catch (err) {
        alert(err.message || "O'chirishda xatolik");
      }
    }
  };

  // Foydalanuvchi ma'lumotlarini shakllantirish
  const u = profileResponse?.user;
  const fullName =
    u && (u.firstName || u.lastName)
      ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
      : (() => {
          try {
            const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
            if (p && p.name) return p.name;
          } catch {}
          return "Foydalanuvchi";
        })();

  const profileData = {
    name: fullName,
    username: u?.telegramUsername || "user",
    bio: u?.bio || "Ziyo platformasida bilim ulashmoqdaman! 🚀",
    studyPlace: u?.studyPlace || "institut",
    course: u?.course || "1-kurs",
    level: (u?.xp || 0) > 1000 ? "Usta 🌟" : "Bilimdon ⚡",
    levelNum: Math.floor((u?.xp || 0) / 100) + 1,
    rank: u?.rank || 1,
    xp: u?.xp || 0,
    readBooks: u?.readBooks || 0,
    solvedQuizzes: u?.solvedQuizzes || 0,
  };

  // Profilni tahrirlash mutatsiyasi
  const updateProfileMutation = useMutation({
    mutationFn: (data) => updateProfile(data),
    onSuccess: (res) => {
      if (res?.user) {
        queryClient.invalidateQueries({ queryKey: ["userProfile"] });
        localStorage.setItem(
          "ziyo_user_profile",
          JSON.stringify({
            name: `${res.user.firstName || ""} ${res.user.lastName || ""}`.trim(),
            username: res.user.telegramUsername,
            bio: res.user.bio,
          }),
        );
      }
      setIsEditModalOpen(false);
    },
    onError: (err) => {
      alert(err.message || "Profilni saqlashda xatolik yuz berdi.");
    },
  });

  const handleOpenEdit = () => {
    setEditName(profileData.name);
    setEditBio(profileData.bio);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const names = editName.trim().split(" ");
    const firstName = names[0] || "";
    const lastName = names.slice(1).join(" ") || "";

    updateProfileMutation.mutate({
      firstName,
      lastName,
      bio: editBio.trim(),
    });
  };

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login");
  };

  const profileStats = [
    {
      id: 1,
      title: "O'qilgan kitoblar",
      count: `${profileData.readBooks} ta`,
      icon: <FaBook />,
      color: "#3b82f6",
      bgColor: "#eff6ff",
    },
    {
      id: 2,
      title: "Yechilgan testlar",
      count: `${profileData.solvedQuizzes} ta`,
      icon: <IoExtensionPuzzleOutline />,
      color: "#10b981",
      bgColor: "#ecfdf5",
    },
    {
      id: 3,
      title: "To'plangan XP",
      count: `${profileData.xp.toLocaleString()} XP`,
      icon: <FaFire />,
      color: "#f59e0b",
      bgColor: "#fef3c7",
    },
    {
      id: 4,
      title: "Reyting o'rni",
      count: `#${profileData.rank} o'rin`,
      icon: <GoTrophy />,
      color: "#8b5cf6",
      bgColor: "#f5f3ff",
    },
  ];

  return (
    <div className="profile-page">
      {/* Profile Header Card */}
      <div className="profile-card">
        <div className="profile-cover-banner" />

        <div className="profile-header-body">
          <div className="profile-avatar-container">
            <div className="profile-avatar-wrapper">
              <img
                src={logo}
                alt="Profil rasmi"
                className="profile-avatar-img"
              />
              <span className="profile-online-badge" title="Onlayn" />
            </div>
          </div>

          <div className="profile-main-details">
            <div className="profile-user-headline">
              <div className="profile-name-group">
                <h1 className="profile-fullname">{profileData.name}</h1>
                <span className="profile-handle">@{profileData.username}</span>
                <span className="profile-level-chip">
                  <FaAward /> {profileData.level}
                </span>
              </div>

              <div className="profile-action-buttons">
                <button
                  type="button"
                  className="profile-btn btn-secondary"
                  onClick={handleOpenEdit}
                >
                  <FaEdit />
                  <span>Tahrirlash</span>
                </button>
                <button
                  type="button"
                  className="profile-btn btn-primary"
                  onClick={() => navigate("/yaratish")}
                >
                  <FaPlus />
                  <span>Post yaratish</span>
                </button>
                <button
                  type="button"
                  className="profile-btn btn-logout"
                  onClick={handleLogout}
                  title="Chiqish"
                >
                  <FaSignOutAlt />
                </button>
              </div>
            </div>

            <p className="profile-bio-text">{profileData.bio}</p>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="profile-statistics">
        {profileStats.map((item) => (
          <div className="profile-stat-card" key={item.id}>
            <div
              className="stat-icon-box"
              style={{ color: item.color, backgroundColor: item.bgColor }}
            >
              {item.icon}
            </div>
            <div className="stat-text-box">
              <p className="profile-stat-title">{item.title}</p>
              <h3 className="profile-stat-count">{item.count}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Profile Navigation Tabs */}
      <div className="profile-tabs-wrapper">
        <div className="profile-nav-tabs">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            <IoGridOutline />
            <span>Mening postlarim</span>
            <span className="tab-count-badge">{myPostCount}</span>
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "quizzes" ? "active" : ""}`}
            onClick={() => setActiveTab("quizzes")}
          >
            <IoExtensionPuzzleOutline />
            <span>Viktorinalar (Live)</span>
            <span className="tab-count-badge">{myQuizzes.length}</span>
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "saved" ? "active" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            <IoBookmarkOutline />
            <span>Saqlanganlar</span>
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            <IoSparklesOutline />
            <span>Yutuqlar</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === "posts" && (
        <div className="profile-posts-section">
          <div className="profile-posts-header">
            <h3 className="profile-section-title">Chop etilgan bilimlar</h3>
            <button
              type="button"
              className="create-new-inline-btn"
              onClick={() => navigate("/yaratish")}
            >
              <FaPlus /> Yangi post
            </button>
          </div>

          {/* Faqat o'z postlarimizni ko'rsatish */}
          <Post onlyMyPosts={true} />
        </div>
      )}

      {/* QUIZZES TAB */}
      {activeTab === "quizzes" && (
        <div className="profile-quizzes-section">
          <div className="profile-posts-header">
            <h3 className="profile-section-title"> Live</h3>
            <button
              type="button"
              className="create-new-inline-btn"
              onClick={() => navigate("/quiz/builder")}
            >
              <FaPlus /> Yangi viktorina tuzish
            </button>
          </div>

          {myQuizzes.length > 0 ? (
            <div className="profile-quizzes-grid">
              {myQuizzes.map((quiz) => (
                <div key={quiz._id} className="profile-quiz-card">
                  <div className="quiz-card-top">
                    <span className="quiz-game-badge">🎮 Ziyo Live</span>
                    <span className="quiz-play-count">
                      👁 {quiz.playCount || 0} marta o'ynalgan
                    </span>
                  </div>

                  <h4 className="profile-quiz-title">{quiz.title}</h4>
                  {quiz.description && (
                    <p className="profile-quiz-desc">{quiz.description}</p>
                  )}

                  <div className="profile-quiz-meta">
                    <span>
                      📅 {new Date(quiz.createdAt).toLocaleDateString("uz-UZ")}
                    </span>
                  </div>

                  <div className="profile-quiz-actions">
                    <button
                      type="button"
                      className="quiz-host-btn"
                      onClick={() => handleStartLiveQuiz(quiz._id)}
                      disabled={startingQuizId === quiz._id}
                    >
                      {startingQuizId === quiz._id
                        ? "Ochilmoqda..."
                        : "🚀 Boshlash"}
                    </button>
                    <button
                      type="button"
                      className="quiz-edit-btn"
                      onClick={() => navigate(`/quiz/builder/${quiz._id}`)}
                    >
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="quiz-delete-btn"
                      onClick={() => handleDeleteQuiz(quiz._id)}
                    >
                      <IoClose />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-tab">
              <div className="empty-tab-icon">🎮</div>
              <h4>Hali viktorinalar tuzmagansiz</h4>
              <p>
                O'quvchilaringiz yoki do'stlaringiz uchun Kahoot kabi qiziqarli
                jonli viktorina yarating!
              </p>
              <button
                type="button"
                className="create-quiz-cta-btn"
                onClick={() => navigate("/quiz/builder")}
              >
                <FaPlus /> Birinchi viktorinani tuzish
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "saved" && (
        <div className="profile-empty-tab">
          <div className="empty-tab-icon">
            <IoBookmarkOutline />
          </div>
          <h4>Saqlangan postlar yo'q</h4>
          <p>
            Sizga yoqqan maqola yoki viktorinalarni saqlab qo'ying, ular shu
            yerda ko'rinadi.
          </p>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="profile-achievements-tab">
          <div className="achievement-card unlocked">
            <span className="ach-badge">🥇</span>
            <div className="ach-info">
              <h4>Faol bilimdon</h4>
              <p>Platformada 200 dan ortiq testlarni muvaffaqiyatli yechdi.</p>
            </div>
          </div>
          <div className="achievement-card unlocked">
            <span className="ach-badge">📚</span>
            <div className="ach-info">
              <h4>Kitobxon</h4>
              <p>Kutubxonadagi 30 dan ortiq kitoblarni to'liq mutolaa qildi.</p>
            </div>
          </div>
          <div className="achievement-card locked">
            <span className="ach-badge">👑</span>
            <div className="ach-info">
              <h4>Top 3 yetakchi</h4>
              <p>Umumiy reytingda eng yaxshi 3 talikka kiring.</p>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Profilni tahrirlash</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setIsEditModalOpen(false)}
              >
                <IoClose />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="edit-profile-form">
              <div className="form-field">
                <label>To'liq ism</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ismingizni kiriting..."
                  required
                />{" "}
                <label>Familya</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ismingizni kiriting..."
                  required
                />
              </div>

              <div className="form-field">
                <label>Foydalanuvchi ma'lumoti (Bio)</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="O'zingiz haqingizda qisqacha ma'lumot..."
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="save-btn"
                  disabled={updateProfileMutation.isPending}
                >
                  <IoCheckmark />{" "}
                  {updateProfileMutation.isPending
                    ? "Saqlanmoqda..."
                    : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profil;
