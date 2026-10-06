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

  const [xp, setXp] = useState(0);

  useEffect(() => {
    const getXp = async () => {
      const data = await getUserProfile();
      setXp(data.xp);
    };

    getXp();
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
    { name: "Barchasi", icon: <IoGridOutline />, iconBG: "#03e2ff" },
    { name: "Fizika", icon: <LuAtom />, iconBG: "#85f308" },
    {
      name: "Matematika",
      icon: <IoCalculatorOutline />,
      iconBG: "#11ac1e",
    },
    {
      name: "Mantiqiy savollar",
      icon: <IoExtensionPuzzleOutline />,
      iconBG: "#e89612",
    },
    {
      name: "Qiziqarli faktlar",
      icon: <IoBulbOutline />,
      iconBG: "#4317c7",
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
          <div className="user-pointes">
            <GoTrophy />
            <span>{xp || 0}</span>
          </div>
        </div>
      </div>

      {/* Ziyo Live Quick Banner */}
      <div className="home-live-banner">
        <div className="live-banner-content">
          <div className="live-banner-tag">
            <FaGamepad /> Ziyo Live (Kahoot)
          </div>
          <h3>
            Jonli viktorinada qatnashing yoki o'z o'yiningizni boshlang! ⚡
          </h3>
          <p>
            Telefoningiz yoki kompyuteringiz orqali real-vaqtda bilimingizni
            sinab ko'ring.
          </p>
        </div>

        <div className="live-banner-actions">
          <form onSubmit={handleQuickJoin} className="live-quick-pin-form">
            <input
              type="text"
              placeholder="PIN kod..."
              value={quickPin}
              onChange={(e) => setQuickPin(e.target.value)}
              maxLength={10}
            />
            <button type="submit" className="quick-join-btn">
              <FaPlay /> Kirish
            </button>
          </form>

          <button
            type="button"
            className="create-live-btn"
            onClick={() => navigate("/quiz/builder")}
          >
            + Yangi viktorina tuzish
          </button>
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
