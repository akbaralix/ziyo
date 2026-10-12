import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { FaTelegram, FaSpinner } from "react-icons/fa";
import { MdAddAPhoto } from "react-icons/md";
import { FcGoogle } from "react-icons/fc";
import { IoIosArrowBack } from "react-icons/io";
import { toast } from "react-toastify";
import {
  initTelegramSession,
  checkTelegramSession,
  registerTelegramUser,
} from "../../api/authApi.js";
import logo from "../../assets/logo.png";
import telegramImg from "../../assets/telegram.png";
import "./login.css";
import ModalOverlay from "../../components/ModalOverlay/ModalOverlay.jsx";

const images = Object.values(
  import.meta.glob("../../assets/user/*.{png,jpg,jpeg,webp}", {
    eager: true,
    import: "default",
  }),
);

// Telegram'dan kelgan stilsizlantirilgan Unicode harflarni (masalan: 𝕬𝖐𝖇𝖆𝖗𝖆𝖑𝖎) oddiy matnga aylantirish
const normalizeTelegramText = (text) => {
  if (!text) return "";
  return text
    .normalize("NFKC")
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (char) => {
      // Fancy/Mathematical Unicode harflarini oddiy harflarga aylantirish
      const codePoint = char.codePointAt(0);

      // Katta harflar (Mathematical Bold, Italic, Fraktur va h.k.)
      if (codePoint >= 0x1d400 && codePoint <= 0x1d7ca) {
        const offset = (codePoint - 0x1d400) % 52;
        if (offset < 26) return String.fromCharCode(65 + offset);
        return String.fromCharCode(97 + offset - 26);
      }
      return char;
    })
    .trim();
};

function Login() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Step holatlari: 0 = tanlov, 1 = ism/familiya, 2 = maktab/institut, 3 = kurs/sinf
  const [stepTelegram, setStepTelegram] = useState(false);
  const [loginStep, setLoginStep] = useState(0);

  // Sessiya va Telegram ma'lumotlari
  const [sessionToken, setSessionToken] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [isWaitingTg, setIsWaitingTg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const [telegramInfo, setTelegramInfo] = useState({
    telegramId: "",
    username: "",
  });

  const [userData, setUserData] = useState({
    firstName: "",
    lastName: "",
    profilePic: "",
    studyPlace: "", // "institut" | "maktab"
    course: "", // "1-kurs", "9-sinf" va h.k.
  });

  const pollingRef = useRef(null);

  // Agar allaqachon login qilingan bo'lsa, home sahifasiga o'tkazish
  if (token) {
    return <Navigate to="/" replace />;
  }

  // Pollingni tozalash
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsWaitingTg(false);
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Telegram login jarayonini boshlash
  const handleStartTelegramAuth = async () => {
    setStepTelegram(true);
    setLoading(true);

    try {
      const res = await initTelegramSession();
      if (res.success && res.token) {
        setSessionToken(res.token);
        setBotUrl(res.botUrl);
        startPolling(res.token);
      }
    } catch (err) {
      toast.error(
        err.message || "Server bilan bog'lanishda xatolik yuz berdi.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Botga o'tish tugmasi
  const handleOpenBot = () => {
    if (botUrl) {
      window.open(botUrl, "_blank");
    }
  };

  // Backenddan Telegram tasdiqlanganini tekshirib turish
  const startPolling = (currentToken) => {
    stopPolling();
    setIsWaitingTg(true);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await checkTelegramSession(currentToken);

        if (res.expired) {
          stopPolling();
          setIsWaitingTg(false);
          toast.error(
            "Login havolasining muddati tugadi. Iltimos, qaytadan urinib ko'ring.",
          );
          return;
        }

        if (res.verified) {
          stopPolling();

          if (!res.isNewUser && res.token) {
            // 1. Foydalanuvchi allaqachon ro'yxatdan o'tgan -> To'g'ridan-to'g'ri tizimga kiradi
            localStorage.setItem("token", res.token);
            if (res.user) {
              localStorage.setItem("ziyo_user", JSON.stringify(res.user));
              localStorage.setItem(
                "ziyo_user_profile",
                JSON.stringify({
                  name: `${res.user.firstName} ${res.user.lastName}`,
                  username: res.user.telegramUsername || "user",
                  profilePic: res.user.profilePic || "",
                  bio: res.user.bio || "",
                  studyPlace: res.user.studyPlace,
                  course: res.user.course,
                  xp: res.user.xp || 0,
                  readBooks: res.user.readBooks || 0,
                  solvedQuizzes: res.user.solvedQuizzes || 0,
                }),
              );
            }
            toast.success("Xush kelibsiz! Tizimga muvaffaqiyatli kirdingiz.");
            setTimeout(() => {
              navigate("/");
            }, 800);
          } else if (res.isNewUser && res.telegramData) {
            // 2. Foydalanuvchi yangi -> Bosqichlarga (step) o'tadi
            setTelegramInfo({
              telegramId: res.telegramData.telegramId,
              username: res.telegramData.username || "",
            });
            setUserData((prev) => ({
              ...prev,
              firstName: normalizeTelegramText(
                res.telegramData.firstName || "",
              ),
              lastName: normalizeTelegramText(res.telegramData.lastName || ""),
            }));
            setStepTelegram(false);
            setLoginStep(1); // Ism-familiya to'ldirish bosqichiga o'tish
          }
        }
      } catch (error) {
        console.error("Polling xatosi:", error);
      }
    }, 2000);
  };

  // Step 1: Ism va Familiyani tasdiqlash
  const handleStep1Next = (e) => {
    e.preventDefault();

    const firstName = userData.firstName.trim();
    const lastName = userData.lastName.trim();

    if (!firstName || !lastName) {
      toast.warning("Iltimos, ism va familiyangizni kiriting.");
      return;
    }

    if (firstName.length > 30 || lastName.length > 30) {
      toast.warning("Ism yoki familiya 30 ta belgidan oshmasligi kerak.");
      return;
    }

    if (firstName.length < 3 || lastName.length < 3) {
      toast.warning("Ism va familiya 3 ta belgidan kam bo'lmasligi kerak.");
      return;
    }

    setLoginStep(2);
  };

  // Step 2: Maktab / Institut tanlash
  const handleStep2Next = () => {
    if (!userData.studyPlace) {
      toast.warning("Iltimos, ta'lim maskanini tanlang.");
      return;
    }
    setLoginStep(3);
  };

  // Step 3: Yakuniy ro'yxatdan o'tish
  const handleCompleteRegistration = async (selectedCourse) => {
    const finalCourse = selectedCourse || userData.course;
    if (!finalCourse) {
      toast.warning("Iltimos, o'quv bosqichingizni tanlang.");
      return;
    }

    setLoading(true);

    try {
      const res = await registerTelegramUser({
        token: sessionToken,
        telegramId: telegramInfo.telegramId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profilePic: userData.profilePic,
        studyPlace: userData.studyPlace,
        course: finalCourse,
      });

      if (res.success && res.token) {
        localStorage.setItem("token", res.token);
        if (res.user) {
          localStorage.setItem("ziyo_user", JSON.stringify(res.user));
          localStorage.setItem(
            "ziyo_user_profile",
            JSON.stringify({
              name: `${res.user.firstName} ${res.user.lastName}`,
              username: res.user.telegramUsername || "user",
              profilePic: res.user.profilePic || userData.profilePic,
              bio: res.user.bio || "",
              studyPlace: res.user.studyPlace,
              course: res.user.course,
              xp: res.user.xp || 0,
              readBooks: res.user.readBooks || 0,
              solvedQuizzes: res.user.solvedQuizzes || 0,
            }),
          );
        }
        toast.success("Ro'yxatdan o'tish muvaffaqiyatli yakunlandi! 🎉");
        setTimeout(() => {
          navigate("/");
        }, 800);
      }
    } catch (err) {
      toast.error(err.message || "Ro'yxatdan o'tishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  // Scroll qilinganda qoq markazdagi rasmni aniqlash
  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Konteynerning o'rtasini topamiz
    const containerCenter = container.scrollLeft + container.offsetWidth / 2;

    const buttons = container.querySelectorAll(".profile-img-btn");
    let closestIndex = 0;
    let minDistance = Infinity;

    buttons.forEach((btn, index) => {
      // Har bir tugmaning markaziy nuqtasi
      const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
      const distance = Math.abs(containerCenter - btnCenter);

      // Qaysi biri konteyner markaziga yaqinroq ekanini topamiz
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  // Modal ochilganda birinchi marta o'rtadagi elementni aniqlab olish
  useEffect(() => {
    if (showSuccessModal) {
      requestAnimationFrame(() => {
        handleScroll();
      });
    }
  }, [showSuccessModal]);

  return (
    <div className="login-card">
      {/* DASTLABKI EKRAN (Kirish usuli tanlovi) */}
      {!stepTelegram && loginStep === 0 && (
        <div className="login-action">
          <div className="login-header">
            <div className="login-logo-img">
              <img src={logo} alt="Logo" draggable="false" />
            </div>
            <h2>Xush kelibsiz!</h2>
            <p>Davom etish uchun kirish usulini tanlang.</p>
          </div>

          <button
            type="button"
            onClick={handleStartTelegramAuth}
            className="btn-telegram"
            disabled={loading}
          >
            <FaTelegram />
            {loading ? "Yuklanmoqda..." : "Telegram orqali kirish"}
          </button>

          <button
            type="button"
            className="btn-google"
            onClick={() =>
              toast.info("Google orqali kirish tez kunda ishga tushiriladi.")
            }
          >
            <FcGoogle />
            Google orqali kirish
          </button>
        </div>
      )}

      {/* TELEGRAM BILAN KIRISH OYNASI (BOT LINK + KUTILMOQDA) */}
      {stepTelegram && loginStep === 0 && (
        <div className="telegram-login">
          <img src={telegramImg} alt="Telegram" />

          <h2>Telegram orqali kirish</h2>

          <p>
            Quyidagi tugmani bosing va Telegram botimizda <b>Start</b> tugmasini
            bosing. Shunda akkauntingiz avtomatik tarzda tizimga ulanadi.
          </p>

          <button
            type="button"
            className="login-tg-btn"
            onClick={handleOpenBot}
            disabled={!botUrl || loading}
          >
            <FaTelegram />
            Telegram botga o'tish
          </button>

          {isWaitingTg && (
            <div className="waiting-status-box">
              <FaSpinner className="spinner-icon" />
              <span>Botda /start bosilishi kutilmoqda...</span>
            </div>
          )}

          <button
            type="button"
            className="back-login-btn"
            onClick={() => {
              stopPolling();
              setStepTelegram(false);
            }}
          >
            <IoIosArrowBack />
            Orqaga
          </button>
        </div>
      )}

      {/* STEP 1: ISM VA FAMILIYA (Yangi foydalanuvchilar uchun) */}
      {loginStep === 1 && (
        <form className="user-login-info" onSubmit={handleStep1Next}>
          <div className="step-badge">1 / 3 - Bosqich</div>
          <h2>Ma'lumotlaringizni kiriting</h2>
          <p className="step-subtitle">
            Platformada sizni qanday atashimizni xohlaysiz?
          </p>

          <div className="profil-set-img">
            {userData.profilePic ? (
              <img src={userData.profilePic} alt="Profil rasmi" />
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowSuccessModal(true);
              }}
            >
              <MdAddAPhoto />
            </button>
          </div>

          <div className="login-form">
            <input
              value={userData.firstName}
              onChange={(e) =>
                setUserData({
                  ...userData,
                  firstName: e.target.value,
                })
              }
              type="text"
              placeholder=" "
              required
            />
            <label>Ismingiz</label>
          </div>

          <div className="login-form">
            <input
              value={userData.lastName}
              onChange={(e) =>
                setUserData({
                  ...userData,
                  lastName: e.target.value,
                })
              }
              type="text"
              placeholder=" "
              required
            />
            <label>Familiyangiz</label>
          </div>

          <button type="submit" className="next-stemp-btn">
            Davom etish
          </button>
        </form>
      )}

      {/* STEP 2: MAKTAB YOKI INSTITUT */}
      {loginStep === 2 && (
        <div className="user-study">
          <div className="step-badge">2 / 3 - Bosqich</div>
          <h2>Hozir qayerda o‘qimoqdasiz?</h2>
          <p className="step-subtitle">
            O'zingizga mos darslik va viktorinalarni saralash uchun kerak.
          </p>

          <div
            onClick={() =>
              setUserData({
                ...userData,
                studyPlace: "institut",
                course: "",
              })
            }
            className={`study-option ${
              userData.studyPlace === "institut" ? "active-study" : ""
            }`}
          >
            <span className="study-emoji">🎓</span>
            <div className="study-info">
              <h4>Institut / Universitet</h4>
              <p>Oliy ta'lim talabalari uchun</p>
            </div>
          </div>

          <div
            onClick={() =>
              setUserData({
                ...userData,
                studyPlace: "maktab",
                course: "",
              })
            }
            className={`study-option ${
              userData.studyPlace === "maktab" ? "active-study" : ""
            }`}
          >
            <span className="study-emoji">🏫</span>
            <div className="study-info">
              <h4>Maktab</h4>
              <p>Umumta'lim maktabi o'quvchilari uchun</p>
            </div>
          </div>

          <button
            type="button"
            className="next-stemp-btn"
            disabled={!userData.studyPlace}
            onClick={handleStep2Next}
          >
            Davom etish
          </button>

          <button
            type="button"
            className="back-login-btn"
            onClick={() => setLoginStep(1)}
          >
            <IoIosArrowBack />
            Orqaga
          </button>
        </div>
      )}

      {/* STEP 3: KURS YOKI SINF */}
      {loginStep === 3 && (
        <div className="study-curses">
          <div className="step-badge">3 / 3 - Bosqich</div>

          {/* INSTITUT KURSLARI */}
          {userData.studyPlace === "institut" && (
            <div className="study-curses-grid">
              <h3>Nechinchi kursda o‘qiysiz?</h3>
              {["1-kurs", "2-kurs", "3-kurs", "4-kurs", "5-kurs", "6-kurs"].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    className={userData.course === c ? "active-course" : ""}
                    onClick={() => {
                      setUserData({ ...userData, course: c });
                      handleCompleteRegistration(c);
                    }}
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
          )}

          {/* MAKTAB SINFLARI */}
          {userData.studyPlace === "maktab" && (
            <div className="study-curses-grid">
              <h3>Nechinchi sinfda o‘qiysiz?</h3>
              {["9-sinf", "10-sinf", "11-sinf"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={userData.course === c ? "active-course" : ""}
                  onClick={() => {
                    setUserData({ ...userData, course: c });
                    handleCompleteRegistration(c);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="waiting-status-box">
              <FaSpinner className="spinner-icon" />
              <span>Ro'yxatdan o'tilmoqda...</span>
            </div>
          )}

          <button
            type="button"
            className="back-login-btn"
            disabled={loading}
            onClick={() => setLoginStep(2)}
          >
            <IoIosArrowBack />
            Orqaga
          </button>
        </div>
      )}

      <ModalOverlay
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      >
        <div className="profile-carousel-container">
          <h3>Profil rasmini tanlang</h3>

          <div className="profile-carousel-wrapper">
            <div
              className="profile-all-img"
              ref={containerRef}
              onScroll={handleScroll}
            >
              {images.map((image, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={image}
                    type="button"
                    className={`profile-img-btn ${isActive ? "active-profile" : ""}`}
                    onClick={() => {
                      setUserData({
                        ...userData,
                        profilePic: image,
                      });
                      setShowSuccessModal(false);
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

export default Login;
