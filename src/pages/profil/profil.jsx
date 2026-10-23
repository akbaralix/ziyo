import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaBook,
  FaEdit,
  FaSignOutAlt,
  FaPlus,
  FaAward,
  FaFire,
  FaCheckCircle,
} from "react-icons/fa";
import {
  IoExtensionPuzzleOutline,
  IoBookmarkOutline,
  IoGridOutline,
  IoClose,
  IoCheckmark,
  IoShareSocialOutline,
  IoArrowBackOutline,
} from "react-icons/io5";
import { MdAddAPhoto, MdOutlineAutoStories, MdSchool } from "react-icons/md";
import { GoTrophy } from "react-icons/go";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Post from "../../post/post";
import ModalOverlay from "../../components/ModalOverlay";
import "./profil.css";

import {
  getUserProfile,
  getUserProfileById,
  updateProfile,
} from "../../api/userApi.js";
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
  const { username: rawUsername } = useParams();

  // URL dagi username ni tozalash (masalan "/@akbar" -> "akbar")
  const cleanUsername = useMemo(() => {
    return rawUsername ? rawUsername.replace(/^@/, "").trim() : "";
  }, [rawUsername]);

  // Joriy login qilgan foydalanuvchi
  const currentLoggedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("ziyo_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Profil egasi menmanmi yoki boshqa foydalanuvchimi?
  const isMe = useMemo(() => {
    if (!cleanUsername || cleanUsername === "me") return true;
    const myTg = currentLoggedUser?.telegramUsername;
    const myId = currentLoggedUser?._id || currentLoggedUser?.id;
    return Boolean(
      (myTg && myTg.toLowerCase() === cleanUsername.toLowerCase()) ||
      (myId && String(myId) === cleanUsername)
    );
  }, [cleanUsername, currentLoggedUser]);

  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'quizzes' | 'saved'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editProfilePic, setEditProfilePic] = useState("");

  // Profil rasmini tanlash modali
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const photoContainerRef = useRef(null);

  // 1. TanStack Query: O'zining profilini olish (agar isMe bo'lsa)
  const { data: myProfileResponse, isLoading: isMyProfileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    enabled: isMe,
    staleTime: 1000 * 60 * 5,
  });

  // 2. TanStack Query: Boshqa foydalanuvchi profilini olish (agar !isMe bo'lsa)
  const { data: otherProfileResponse, isLoading: isOtherProfileLoading } = useQuery({
    queryKey: ["otherUserProfile", cleanUsername],
    queryFn: () => getUserProfileById(cleanUsername),
    enabled: !isMe && Boolean(cleanUsername),
    staleTime: 1000 * 60 * 2,
  });

  const isLoadingProfile = isMe ? isMyProfileLoading : isOtherProfileLoading;

  // Faol foydalanuvchi ob'ekti
  const u = isMe ? myProfileResponse?.user : otherProfileResponse?.user;

  // TanStack Query orqali barcha foydalanuvchilar reytingini olish (real rank uchun)
  const { data: ratingsResponse } = useQuery({
    queryKey: ["ratings", "all", "Barchasi"],
    queryFn: () => getRatings({ timeframe: "all", category: "Barchasi" }),
    staleTime: 1000 * 60 * 2,
  });

  // TanStack Query orqali faqat shu foydalanuvchining postlar sonini hisoblash
  const targetUserIdentifier = isMe
    ? null
    : u?._id
    ? String(u._id)
    : cleanUsername;

  const { data: postsCountResponse } = useQuery({
    queryKey: ["postsCount", isMe ? "my" : targetUserIdentifier],
    queryFn: () =>
      fetchPosts(
        isMe
          ? { onlyMyPosts: true }
          : { userId: targetUserIdentifier, authorId: targetUserIdentifier }
      ),
    enabled: Boolean(isMe || targetUserIdentifier),
    staleTime: 1000 * 60 * 3,
  });

  const postCount = postsCountResponse?.posts?.length ?? u?.postCount ?? 0;

  // TanStack Query orqali foydalanuvchining viktorinalari (faqat o'ziniki bo'lsa)
  const { data: myQuizzesResponse, refetch: refetchQuizzes } = useQuery({
    queryKey: ["myQuizGames"],
    queryFn: getMyQuizGames,
    enabled: isMe,
    staleTime: 1000 * 60 * 2,
  });

  const myQuizzes = isMe ? myQuizzesResponse?.games || [] : [];
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

  // Scroll qilinganda markazdagi rasmni aniqlash
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

  // Foydalanuvchi to'liq ismi (Faqat shu ochilgan foydalanuvchiniki!)
  const fullName = useMemo(() => {
    if (!isMe) {
      if (u && (u.firstName || u.lastName)) {
        return `${u.firstName || ""} ${u.lastName || ""}`.trim();
      }
      if (u?.telegramUsername) {
        return `@${u.telegramUsername}`;
      }
      return cleanUsername ? `@${cleanUsername}` : "Foydalanuvchi";
    }

    // Faqat o'zimizning profilimiz bo'lsa
    if (u && (u.firstName || u.lastName)) {
      return `${u.firstName || ""} ${u.lastName || ""}`.trim();
    }
    try {
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p && p.name) return p.name;
    } catch {}
    return u?.telegramUsername || "Foydalanuvchi";
  }, [u, isMe, cleanUsername]);

  // Reytingdagi aniq o'rni
  const computedRank = useMemo(() => {
    if (u?.rank && typeof u.rank === "number" && u.rank > 0) {
      return u.rank;
    }

    const list = ratingsResponse?.ratings;
    const targetUserId = u?._id?.toString() || (isMe ? currentLoggedUser?._id : null);
    const targetUsername = u?.telegramUsername || cleanUsername;

    if (Array.isArray(list) && list.length > 0) {
      const idx = list.findIndex(
        (r) =>
          (targetUserId &&
            (String(r.id) === String(targetUserId) ||
              String(r._id) === String(targetUserId))) ||
          (targetUsername && r.username === targetUsername)
      );

      if (idx !== -1) return idx + 1;

      const myXp = u?.xp || 0;
      const higherCount = list.filter((r) => (r.xp || 0) > myXp).length;
      return higherCount + 1;
    }

    return 1;
  }, [ratingsResponse, u, isMe, currentLoggedUser, cleanUsername]);

  // Ta'lim muassasasi: Maktab yoki Institut
  const studyPlaceType = (u?.studyPlace || "institut").toLowerCase();
  const isSchool = studyPlaceType === "maktab";
  const studyLabel = isSchool ? "Maktab o'quvchisi" : "Institut talabasi";
  const studyCourseText = u?.course ? `(${u.course})` : "";

  const profileData = {
    name: fullName,
    username: u?.telegramUsername || cleanUsername || "user",
    profilePic: u?.profilePic || userPic,
    bio:
      u?.bio ||
      (isMe
        ? "Kitob mutolaasi va bilimlarni oshirish yo'lidaman."
        : "Ziyo platformasi foydalanuvchisi."),
    studyPlace: studyPlaceType,
    studyLabel: `${studyLabel} ${studyCourseText}`.trim(),
    course: u?.course || (isSchool ? "Maktab" : "1-kurs"),
    level: (u?.xp || 0) > 1000 ? "Usta 🌟" : "Bilimdon ⚡",
    rank: computedRank,
    xp: u?.xp || 0,
    readBooks: u?.readBooks || 0,
    solvedQuizzes: u?.solvedQuizzes || 0,
  };

  // O'qiyotgan kitobi ma'lumotlari
  const readingBook = useMemo(() => {
    if (isMe) {
      try {
        const localReading = localStorage.getItem("ziyo_current_reading_book");
        if (localReading) {
          const parsed = JSON.parse(localReading);
          if (parsed && parsed.title) return parsed;
        }
      } catch {}
    }

    if (u?.readingBook && u.readingBook.bookId) {
      return u.readingBook;
    }

    return null;
  }, [u, isMe]);

  // O'qib bo'lingan kitoblar ("agar o'qib bo'lgan bo'lsa")
  const finishedBooks = useMemo(() => {
    let list = [];
    if (isMe) {
      try {
        const localFin = localStorage.getItem("ziyo_finished_books");
        if (localFin) list = JSON.parse(localFin) || [];
      } catch {}
    }

    if (Array.isArray(u?.finishedBooks) && u.finishedBooks.length > 0) {
      u.finishedBooks.forEach((fb) => {
        if (!list.some((item) => item.bookId === fb.bookId)) {
          list.push(fb);
        }
      });
    }

    return list;
  }, [u, isMe]);

  const readingPercent = useMemo(() => {
    if (!readingBook || !readingBook.pages) return 0;
    const p = Math.round((readingBook.currentPage / readingBook.pages) * 100);
    return Math.min(Math.max(p, 1), 100);
  }, [readingBook]);

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
            JSON.stringify({ ...existingZiyoUser, ...res.user })
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
    if (!isMe) return;
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
              onClick={isMe ? handleOpenEdit : undefined}
              style={{ cursor: isMe ? "pointer" : "default" }}
              title={isMe ? "Profil rasmini almashtirish" : profileData.name}
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

                {/* DARAJA VA MAKTAB/INSTITUT NISHONLARI */}
                <div className="profile-badges-row">
                  <span className="profile-level-chip">
                    <FaAward /> {profileData.level}
                  </span>

                  <span
                    className={`profile-education-badge ${
                      isSchool ? "school-badge" : "institute-badge"
                    }`}
                  >
                    <MdSchool className="edu-icon" />
                    <span>{profileData.studyLabel}</span>
                  </span>
                </div>
              </div>

              {/* HARAKAT TUGMALARI */}
              <div className="profile-action-buttons">
                {isMe ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="profile-btn btn-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Profil havolasi nusxalandi!");
                      }}
                      title="Profil havolasini nusxalash"
                    >
                      <IoShareSocialOutline />
                      <span>Ulashish</span>
                    </button>
                    <button
                      type="button"
                      className="profile-btn btn-logout"
                      onClick={() => navigate(-1)}
                      title="Ortga qaytish"
                    >
                      <IoArrowBackOutline />
                      <span>Ortga</span>
                    </button>
                  </>
                )}
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

      {/* HOZIR O'QIYOTGAN KITOBI */}
      {readingBook && (
        <div className="profile-reading-card-wrapper">
          <div className="profile-reading-card">
            <div className="profile-reading-header">
              <div className="profile-reading-badge">
                <span className="reading-pulse-dot" />
                <span>Hozir mutolaa qilinmoqda</span>
              </div>
              <span className="profile-reading-percent">{readingPercent}%</span>
            </div>

            <div className="profile-reading-content">
              <div className="profile-book-cover-wrap">
                <img
                  src={readingBook.img || "/booksimg/O'tgan-kunlar.jpg"}
                  alt={readingBook.title}
                  className="profile-book-cover"
                  onError={(e) => {
                    e.target.src = "/booksimg/O'tgan-kunlar.jpg";
                  }}
                />
              </div>

              <div className="profile-book-details">
                <h4 className="profile-book-title">{readingBook.title}</h4>
                <p className="profile-book-author">{readingBook.author}</p>

                <div className="profile-page-progress-info">
                  <MdOutlineAutoStories className="profile-book-icon" />
                  <span>
                    <strong>{readingBook.currentPage}</strong> /{" "}
                    {readingBook.pages}-sahifaga kelgan
                  </span>
                </div>

                <div className="profile-progress-bar-track">
                  <div
                    className="profile-progress-bar-fill"
                    style={{ width: `${readingPercent}%` }}
                  />
                </div>

                <div className="profile-reading-actions">
                  <span className="profile-progress-subtext">
                    {readingBook.pages - readingBook.currentPage > 0
                      ? `Yana ${readingBook.pages - readingBook.currentPage} bet qoldi`
                      : "Kitob tugatilish arafasida! 🎉"}
                  </span>
                  {isMe && (
                    <button
                      type="button"
                      className="profile-continue-read-btn"
                      onClick={() => navigate("/kutubxona")}
                    >
                      Davom ettirish 📖
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* O'QIB BO'LINGAN KITOBLAR ("agar o'qib bo'lgan bo'lsa") */}
      {finishedBooks && finishedBooks.length > 0 && (
        <div className="profile-finished-section">
          <div className="profile-section-title-row">
            <div className="profile-title-with-icon">
              <FaBook className="profile-sec-icon" />
              <h3>O'qib bo'lingan kitoblar</h3>
            </div>
            <span className="profile-count-chip">
              {finishedBooks.length} ta kitob
            </span>
          </div>

          <div className="profile-finished-slider">
            {finishedBooks.map((book, idx) => (
              <div
                key={book.bookId || idx}
                className="profile-finished-book-card"
              >
                <div className="profile-finished-cover-box">
                  <img
                    src={book.img || "/booksimg/O'tgan-kunlar.jpg"}
                    alt={book.title}
                    className="profile-finished-img"
                    onError={(e) => {
                      e.target.src = "/booksimg/O'tgan-kunlar.jpg";
                    }}
                  />
                  <span className="profile-completed-badge">
                    <FaCheckCircle /> O'qib bo'lingan
                  </span>
                </div>
                <h5 className="profile-finished-title">{book.title}</h5>
                <p className="profile-finished-author">{book.author}</p>
                <span className="profile-finished-pages">
                  {book.pages
                    ? `${book.pages} sahifa to'liq`
                    : "Muvaffaqiyatli mutolaa"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Navigation Tabs */}
      <div className="profile-tabs-wrapper">
        <div className="profile-nav-tabs">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            <IoGridOutline />
            <span>{isMe ? "Mening postlarim" : "Postlar"}</span>
            <span className="tab-count-badge">{postCount}</span>
          </button>

          {isMe && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* TAB CONTENTS: POSTLAR (Faqat shu foydalanuvchiniki!) */}
      {activeTab === "posts" && (
        <div className="profile-posts-section">
          <div className="profile-posts-header">
            <h3 className="profile-section-title">
              {isMe ? "Postlar" : `${profileData.name}ning postlari`}
            </h3>
            {isMe && (
              <button
                type="button"
                className="create-new-inline-btn"
                onClick={() => navigate("/yaratish")}
              >
                <FaPlus /> Yangi post
              </button>
            )}
          </div>

          {!isMe && isLoadingProfile ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              Postlar yuklanmoqda...
            </div>
          ) : (
            <Post
              key={isMe ? "my-posts" : `user-posts-${targetUserIdentifier || "none"}`}
              onlyMyPosts={isMe}
              userId={isMe ? null : targetUserIdentifier}
            />
          )}
        </div>
      )}

      {/* TAB CONTENTS: QUIZZES */}
      {isMe && activeTab === "quizzes" && (
        <div className="profile-quizzes-section">
          <div className="profile-posts-header">
            <h3 className="profile-section-title">Live Viktorinalar</h3>
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
                O'quvchilaringiz yoki do'stlaringiz uchun qiziqarli jonli
                viktorina yarating!
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

      {/* TAB CONTENTS: SAVED */}
      {isMe && activeTab === "saved" && (
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

      {/* EDIT PROFILE MODAL (Faqat o'z profili uchun) */}
      {isMe && (
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
              <div className="edit-avatar-section">
                <div
                  className="profil-set-img"
                  onClick={() => setIsPhotoModalOpen(true)}
                  title="Profil rasmini almashtirish"
                >
                  <img src={editProfilePic || userPic} alt="Profil rasmi" />
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
                  {updateProfileMutation.isPending
                    ? "Saqlanmoqda..."
                    : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* PROFIL RASMINI TANLASH MODALI */}
      {isMe && (
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
      )}
    </div>
  );
}

export default Profil;
