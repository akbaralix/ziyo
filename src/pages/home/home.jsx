import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdNotificationsNone } from "react-icons/md";
import Post from "../../post/post";
import {
  IoGridOutline,
  IoCalculatorOutline,
  IoExtensionPuzzleOutline,
  IoBulbOutline,
  IoSearchSharp,
} from "react-icons/io5";
import { getUserProfile } from "../../api/userApi";
import { GoTrophy } from "react-icons/go";
import { LuAtom } from "react-icons/lu";
import { FaPlay, FaGamepad } from "react-icons/fa";

import "./home.css";

function Home() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickPin, setQuickPin] = useState("");

  const getStoredXp = () => {
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user") || "{}");
      if (u?.xp !== undefined && u?.xp !== null) return u.xp;
      if (u?.points !== undefined && u?.points !== null) return u.points;
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile") || "{}");
      if (p?.xp !== undefined && p?.xp !== null) return p.xp;
      if (p?.points !== undefined && p?.points !== null) return p.points;
    } catch {}
    return 0;
  };

  const [xp, setXp] = useState(getStoredXp);

  useEffect(() => {
    let isMounted = true;

    const fetchRealXp = async () => {
      try {
        const data = await getUserProfile();
        const realXp =
          data?.user?.xp ??
          data?.xp ??
          data?.user?.points ??
          data?.points;

        if (realXp !== undefined && realXp !== null && isMounted) {
          setXp(realXp);

          try {
            const currentU = JSON.parse(localStorage.getItem("ziyo_user") || "{}");
            localStorage.setItem(
              "ziyo_user",
              JSON.stringify({ ...currentU, ...(data?.user || {}), xp: realXp })
            );
          } catch {}
        }
      } catch (err) {
        console.error("Foydalanuvchi ballini yuklashda xatolik:", err);
        if (isMounted) {
          setXp(getStoredXp());
        }
      }
    };

    fetchRealXp();

    const handleStorageChange = () => {
      if (isMounted) {
        setXp(getStoredXp());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", fetchRealXp);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", fetchRealXp);
    };
  }, []);

  const handleQuickJoin = (e) => {
    e.preventDefault();
    if (quickPin.trim()) {
      navigate(`/live/${quickPin.trim()}`);
    } else {
      navigate("/live");
    }
  };

  const categories = [
    {
      name: "Barchasi",
      icon: <IoGridOutline />,
      iconBG: "#16A34A",
      bg: "#F0FDF4",
    },
    {
      name: "Fizika",
      icon: <LuAtom />,
      iconBG: "#0284C7",
      bg: "#F0F9FF",
    },
    {
      name: "Matematika",
      icon: <IoCalculatorOutline />,
      iconBG: "#4F46E5",
      bg: "#EEF2FF",
    },
    {
      name: "Mantiqiy savollar",
      icon: <IoExtensionPuzzleOutline />,
      iconBG: "#D97706",
      bg: "#FFFBEB",
    },
    {
      name: "Qiziqarli faktlar",
      icon: <IoBulbOutline />,
      iconBG: "#9333EA",
      bg: "#FAF5FF",
    },
  ];
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="searchbar">
          <input
            type="text"
            placeholder="Qidiruv..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="button" aria-label="Qidirish">
            <IoSearchSharp />
          </button>
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
            <span>{Number(xp || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="post-sorts">
        {categories.map((item) => (
          <div className="post-sort" key={item.name}>
            <button
              type="button"
              className={`post-sort-btn ${
                selectedCategory === item.name ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(item.name)}
            >
              <span style={{ background: item.iconBG }}>{item.icon}</span>
              <p>{item.name}</p>
            </button>
          </div>
        ))}
      </div>

      <Post selectedCategory={selectedCategory} searchQuery={searchQuery} />
    </div>
  );
}

export default Home;
