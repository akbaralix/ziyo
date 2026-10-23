import { useState, useRef, useEffect, useMemo } from "react";
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
  IoClose,
  IoCheckmark,
} from "react-icons/io5";
import { MdAddAPhoto } from "react-icons/md";
import { GoTrophy } from "react-icons/go";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Post from "../../post/post";
import ModalOverlay from "../../components/ModalOverlay";
import "./profil.css";

import { getUserProfile, updateProfile } from "../../api/userApi.js";
import { logout } from "../../api/authApi.js";
import { fetchPosts } from "../../api/postApi.js";
import { getRatings } from "../../api/ratingApi.js";
import {
  getMyQuizGames,
  createGameSession,
  deleteQuizGame,
} from "../../api/quizApi.js";

import userPic from "../../assets/user.jpg";

const images = Object.values(
  import.meta.glob("../../assets/user/*.{png,jpg,jpeg,webp}", {
    eager: true,
    import: "default",
  }),
);

function Profil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'saved' | 'stats'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLastName, setEditLastName] = useState(""); // 👈 Familiya uchun alohida state qo'shildi
  const [editBio, setEditBio] = useState("");
  const [editProfilePic, setEditProfilePic] = useState("");

  // Profil rasmini tanlash modali (login.jsx kabi)
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const photoContainerRef = useRef(null);

  // TanStack Query orqali profil ma'lumotlarini keshdan olish
  const { data: profileResponse } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    staleTime: 1000 * 60 * 5,
  });

  // TanStack Query orqali barcha foydalanuvchilar reytingini olish (real rank uchun)
  const { data: ratingsResponse } = useQuery({
    queryKey: ["ratings", "all", "Barchasi"],
    queryFn: () => getRatings({ timeframe: "all", category: "Barchasi" }),
    staleTime: 1000 * 60 * 2,
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
      toast.error(err.message || "O'yinni boshlashda xatolik yuz berdi");
    } finally {
      setStartingQuizId(null);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (window.confirm("Rostdan ham ushbu viktorinani o'chirmoqchimisiz?")) {
      try {
        await deleteQuizGame(quizId);
        refetchQuizzes();
        toast.success("Viktorina muvaffaqiyatli o'chirildi!");
      } catch (err) {
        toast.error(err.message || "O'chirishda xatolik");
      }
    }
  };

  // Scroll qilinganda qoq markazdagi rasmni aniqlash
  const handlePhotoScroll = () => {
    if (!photoContainerRef.current) return;
    const container = photoContainerRef.current;

    const containerCenter = container.scrollLeft + container.offsetWidth / 2;
    const buttons = container.querySelectorAll(".profile-img-btn");
    let closestIndex = 0;
    let minDistance = Infinity;

    buttons.forEach((btn, index) => {
      const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
      const distance = Math.abs(containerCenter - btnCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    setActivePhotoIndex(closestIndex);
  };

  useEffect(() => {
    if (isPhotoModalOpen) {
      const idx = images.findIndex((img) => img === editProfilePic);
      if (idx !== -1) {
        setActivePhotoIndex(idx);
        requestAnimationFrame(() => {
          if (photoContainerRef.current) {
            const buttons =
              photoContainerRef.current.querySelectorAll(".profile-img-btn");
            if (buttons[idx]) {
              buttons[idx].scrollIntoView({
                behavior: "auto",
                inline: "center",
                block: "nearest",
              });
            }
          }
        });
      } else {
        requestAnimationFrame(() => {
          handlePhotoScroll();
        });
      }
    }
  }, [isPhotoModalOpen]);

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

  // Foydalanuvchining reytingdagi aniq o'rnini hisoblash
  const computedRank = useMemo(() => {
    const list = ratingsResponse?.ratings;
    const myId =
      u?._id?.toString() ||
      (() => {
        try {
          const zu = JSON.parse(localStorage.getItem("ziyo_user"));
          return zu?._id || zu?.id;
        } catch {
          return null;
        }
      })();

    const myUsername =
      u?.telegramUsername ||
      (() => {
        try {
          const zu = JSON.parse(localStorage.getItem("ziyo_user"));
          return zu?.telegramUsername;
        } catch {
          return null;
        }
      })();

    if (Array.isArray(list) && list.length > 0) {
      // 1. Ro'yxatdan ID yoki username bo'yicha qidiramiz
      const idx = list.findIndex(
        (r) =>
          (myId &&
            (String(r.id) === String(myId) ||
              String(r._id) === String(myId))) ||
          (myUsername && r.username === myUsername),
      );

      if (idx !== -1) {
        return idx + 1;
      }

      // 2. Agar topilmasa, foydalanuvchining XP siga qarab nechanchi o'rinda ekanini hisoblaymiz
      const myXp = u?.xp || 0;
      const higherCount = list.filter((r) => (r.xp || 0) > myXp).length;
      return higherCount + 1;
    }

    // 3. Agar backend hisoblab bergan bo'lsa
    if (u?.rank && typeof u.rank === "number" && u.rank > 0) {
      return u.rank;
    }

    return 1;
  }, [ratingsResponse, u]);

  const profileData = {
    name: fullName,
    username: u?.telegramUsername || "user",
    profilePic:
      u?.profilePic ||
      (() => {
        try {
          const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
          if (p && p.profilePic) return p.profilePic;
          const zu = JSON.parse(localStorage.getItem("ziyo_user"));
          if (zu && zu.profilePic) return zu.profilePic;
        } catch {}
        return "";
      })(),
    bio: u?.bio,
    studyPlace: u?.studyPlace || "institut",
    course: u?.course || "1-kurs",
    level: (u?.xp || 0) > 1000 ? "Usta 🌟" : "Bilimdon ⚡",
    levelNum: Math.floor((u?.xp || 0) / 100) + 1,
    rank: computedRank,
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

        try {
          const existingZiyoUser =
            JSON.parse(localStorage.getItem("ziyo_user")) || {};
          localStorage.setItem(
            "ziyo_user",
            JSON.stringify({
              ...existingZiyoUser,
              ...res.user,
            }),
          );
        } catch {}

        try {
          const existingProfile =
            JSON.parse(localStorage.getItem("ziyo_user_profile")) || {};
          localStorage.setItem(
            "ziyo_user_profile",
            JSON.stringify({
              ...existingProfile,
              name: `${res.user.firstName || ""} ${res.user.lastName || ""}`.trim(),
              username: res.user.telegramUsername,
              bio: res.user.bio,
              profilePic: res.user.profilePic,
            }),
          );
        } catch {}
      }
      setIsEditModalOpen(false);
      toast.success("Profil muvaffaqiyatli yangilandi!");
    },
    onError: (err) => {
      toast.error(err.message || "Profilni saqlashda xatolik yuz berdi.");
    },
  });

  const handleOpenEdit = () => {
    const parts = (profileData.name || "").split(" ");
    setEditName(parts[0] || "");
    setEditLastName(parts.slice(1).join(" ") || "");
    setEditBio(profileData.bio || "");
    setEditProfilePic(profileData.profilePic || images[0] || userPic);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.warning("Iltimos, ismingizni kiriting!");
      return;
    }

    updateProfileMutation.mutate({
      firstName: editName.trim(),
      lastName: editLastName.trim(),
      bio: editBio.trim(),
      profilePic: editProfilePic,
    });
  };

  const handleLogout = () => {
    logout();
    queryClient.clear();
    toast.info("Tizimdan chiqdingiz.");
    navigate("/login");
  };

  const profileStats = [
    {
      id: 1,
      title: "O'qilgan kitoblar",
      count: `${profileData.readBooks} ta`,
      icon: <FaBook />,
      color: "#ffffff",
      bgColor: "#5134e4",
    },
    {
      id: 2,
      title: "Yechilgan testlar",
      count: `${profileData.solvedQuizzes} ta`,
      icon: <IoExtensionPuzzleOutline />,
      color: "#ffffff",
      bgColor: "#23a8f5",
    },
    {
      id: 3,
      title: "To'plangan XP",
      count: `${profileData.xp.toLocaleString()} XP`,
      icon: <FaFire />,
      color: "#ffffff",
      bgColor: "#fdce12",
    },
    {
      id: 4,
      title: "Reyting o'rni",
      count: `#${profileData.rank} o'rin`,
      icon: <GoTrophy />,
      color: "#ffffff",
      bgColor: "#1ed044",
    },
  ];

  return (
    <div className="profile-page">
      {/* Profile Header Card */}
      <div className="profile-card">
        <div className="profile-cover-banner" />

        <div className="profile-header-body">
          <div className="profile-avatar-container">
            <div
              className="profile-avatar-wrapper"
              onClick={handleOpenEdit}
              style={{ cursor: "pointer" }}
              title="Profil rasmini almashtirish"
            >
              <img
                src={profileData.profilePic || userPic}
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
                  <span>Chiqish</span>
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
        </div>
      </div>

      {/* TAB CONTENTS */}
      {activeTab === "posts" && (
        <div className="profile-posts-section">
          <div className="profile-posts-header">
            <h3 className="profile-section-title">Postlar</h3>
            <button
              type="button"
              className="create-new-inline-btn"
              onClick={() => navigate("/yaratish")}
            >
              <FaPlus /> Yangi post
            </button>
          </div>

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

      {/* EDIT PROFILE MODAL */}
      <ModalOverlay
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        className="edit-profile-modal-overlay"
      >
        <div className="edit-modal">
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
            {/* Profil rasmini o'zgartirish bloki (login.jsx kabi) */}
            <div className="edit-avatar-section">
              <div
                className="profil-set-img"
                onClick={() => setIsPhotoModalOpen(true)}
                title="Profil rasmini almashtirish"
              >
                <img
                  src={editProfilePic || userPic}
                  alt="Profil rasmi"
                />
                <button
                  type="button"
                  className="profil-set-img-badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPhotoModalOpen(true);
                  }}
                  title="Rasmni tanlash"
                >
                  <MdAddAPhoto />
                </button>
              </div>
              <button
                type="button"
                className="edit-change-photo-btn"
                onClick={() => setIsPhotoModalOpen(true)}
              >
                <MdAddAPhoto /> Rasmni o'zgartirish
              </button>
            </div>

            <div className="form-field">
              <label>Ism</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ismingizni kiriting..."
                required
              />

              <label>Familiya</label>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Familiyangizni kiriting..."
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
                {updateProfileMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* PROFIL RASMINI TANLASH MODALI (login.jsx kabi) */}
      <ModalOverlay
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        className="photo-carousel-modal-overlay"
      >
        <div className="profile-carousel-container">
          <div className="profile-carousel-header">
            <h3>Profil rasmini tanlang</h3>
            <button
              type="button"
              className="close-modal-btn"
              onClick={() => setIsPhotoModalOpen(false)}
            >
              <IoClose />
            </button>
          </div>

          <div className="profile-carousel-wrapper">
            <div
              className="profile-all-img"
              ref={photoContainerRef}
              onScroll={handlePhotoScroll}
            >
              {images.map((image, index) => {
                const isActive = index === activePhotoIndex;
                const isSelected = editProfilePic === image;
                return (
                  <button
                    key={image}
                    type="button"
                    className={`profile-img-btn ${isActive ? "active-profile" : ""} ${isSelected ? "selected-profile" : ""}`}
                    onClick={() => {
                      setEditProfilePic(image);
                      setIsPhotoModalOpen(false);
                    }}
                  >
                    <img src={image} alt={`Profil rasmi ${index + 1}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}

export default Profil;
