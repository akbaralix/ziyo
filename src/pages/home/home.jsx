import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { MdNotificationsNone } from "react-icons/md";
import { GoTrophy, GoBook } from "react-icons/go";
import { IoGameControllerOutline } from "react-icons/io5";
import { getUserProfile } from "../../api/userApi";

import hatif from "../../assets/hatif.png";
import liveJoin from "../../assets/rasmlar/live-join.svg";
import liveGame from "../../assets/rasmlar/livi-game.svg";
import slaydCreate from "../../assets/rasmlar/slayd-create.svg";

import "./home.css";

const TOOLBAR_ITEMS = [
  {
    id: 1,
    href: "/quiz/builder",
    img: liveGame,
    title: "Hatif yarating",
    description: "Qiziqarli viktorina va savol-javob o'yinlarini tuzing",
  },
  {
    id: 2,
    href: "/live",
    img: liveJoin,
    title: "Hatif qo'shiling",
    description: "Maxsus kod orqali jonli o'yinlarda ishtirok eting",
  },
  {
    id: 3,
    href: "/slayd",
    img: slaydCreate,
    title: "Slaydlar yarating",
    description: "Professional taqdimotlaringizni tez va oson tayyorlang",
  },
];

function Home() {
  const getStoredUser = useCallback(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("ziyo_user")) ||
        JSON.parse(localStorage.getItem("ziyo_user_profile")) ||
        {}
      );
    } catch {
      return {};
    }
  }, []);

  const [userName, setUserName] = useState(() => {
    const u = getStoredUser();
    return u?.firstName || (u?.name ? u.name.split(" ")[0] : "Foydalanuvchi");
  });

  const [xp, setXp] = useState(() => {
    const u = getStoredUser();
    return u?.xp ?? u?.points ?? 0;
  });

  useEffect(() => {
    let isMounted = true;

    const fetchRealXp = async () => {
      try {
        const data = await getUserProfile();
        const realXp =
          data?.user?.xp ?? data?.xp ?? data?.user?.points ?? data?.points;

        if (isMounted) {
          if (realXp !== undefined && realXp !== null) setXp(realXp);
          if (data?.user?.firstName) setUserName(data.user.firstName);
        }

        const currentU = getStoredUser();
        localStorage.setItem(
          "ziyo_user",
          JSON.stringify({
            ...currentU,
            ...(data?.user || {}),
            xp: realXp ?? currentU.xp,
          }),
        );
      } catch (err) {
        console.error("Foydalanuvchi ma'lumotlarini yuklashda xatolik:", err);
      }
    };

    fetchRealXp();

    const handleStorageChange = () => {
      if (isMounted) {
        const u = getStoredUser();
        setXp(u?.xp ?? u?.points ?? 0);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", fetchRealXp);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", fetchRealXp);
    };
  }, [getStoredUser]);

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-logo">
          <img src={hatif} alt="Hatif logotipi" />
        </div>

        <div className="header-action">
          <div className="notification">
            <button type="button" aria-label="Bildirishnomalar">
              <MdNotificationsNone />
            </button>
          </div>
          <span className="header-divider" />
          <div className="user-pointes" title="To'plangan ballar">
            <GoTrophy />
            <span>{Number(xp || 0).toLocaleString()} XP</span>
          </div>
        </div>
      </header>

      <div className="toolbar-for-business">
        <h2 className="toolbar-section-title">Yaratish va boshlash </h2>
        <div className="tolbar-div">
          {TOOLBAR_ITEMS.map((item) => (
            <Link
              to={item.href}
              className="toolbar-for-business-item"
              key={item.id}
            >
              <div className="toolbar-for-business-img">
                <img src={item.img} alt={item.title} />
              </div>
              <div className="toolbar-for-business-text">
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <div className="toolbar-btn">→</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="home-sections-grid">
        <Link to="/kutubxona" className="home-nav-card card-library">
          <div className="home-card-icon">
            <GoBook />
          </div>
          <div className="home-card-info">
            <h3>Elektron Kutubxona</h3>
            <p>Eng sara kitoblar va badiiy asarlarni onlayn mutolaa qiling.</p>
          </div>
        </Link>

        <Link to="/oyinlar" className="home-nav-card card-games">
          <div className="home-card-icon">
            <IoGameControllerOutline />
          </div>
          <div className="home-card-info">
            <h3>Intellektual O'yinlar</h3>
            <p>Oktagon, Jumanji, Sehrli Baraban va Hatif Quiz o'yinlari.</p>
          </div>
        </Link>

        <Link to="/reytinglar" className="home-nav-card card-ratings">
          <div className="home-card-icon">
            <GoTrophy />
          </div>
          <div className="home-card-info">
            <h3>Peshqadamlar Jadvali</h3>
            <p>
              Eng yuqori ball to'plagan bilimdonlar reytingi bilan tanishing.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Home;
