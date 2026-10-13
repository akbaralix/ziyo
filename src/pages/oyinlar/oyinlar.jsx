import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import { toast } from "react-toastify";
import "./oyinlar.css";

const gamesList = [
  {
    id: "quiz",
    title: "Ziyo Quiz",
    href: "/quiz/builder",
    description:
      "O‘quvchilar uchun savol-javob o‘yinlarini yarating va bilimlarini sinovdan o‘tkazing.",
    icon: "💡",
    category: "Test va Baholash",
    isReady: true,
  },
  {
    id: "oktagon",
    title: "Oktagon (1v1 Duel)",
    href: "/oktagon",
    description:
      "Jonli 1v1 aql jangi! Matematika, Tarix va Ingliz tilida raqib bilan 10 ta savol bo‘yicha bellashing, XP to‘plang.",
    icon: "⚔️",
    category: "Jonli Duel",
    isReady: true,
  },
  {
    id: "baraban",
    title: "Aylanuvchi Baraban",
    href: "/oyinlar/baraban/create",
    description:
      "Qatnashchilarni aylana barabanda tasodifiy tanlash va ularga test savollarini berish o'yini.",
    icon: "🎡",
    category: "Interaktiv Bellashuv",
    isReady: true,
  },
  {
    id: "puzzle",
    title: "So‘z Topishmoq",
    href: null,
    description:
      "Harflardan so‘zlar yasash va lug‘at boyligini oshirish uchun topshiriqlar.",
    icon: "🔠",
    category: "Til o‘rganish",
    isReady: false,
  },
  {
    id: "matching",
    title: "Moslashtirish",
    href: null,
    description:
      "Tushunchalar va ularning ta’riflarini bir-biriga mos kelishini ta’minlang.",
    icon: "🔗",
    category: "Interaktiv",
    isReady: false,
  },
];

function Oyinlar() {
  const navigate = useNavigate();

  const handleGameClick = (game) => {
    if (game.isReady && game.href) {
      navigate(game.href);
    } else {
      toast.info("Ushbu o'yin tez kunda ishga tushiriladi! 🚀");
    }
  };

  return (
    <div className="ziyo-hub-container">
      <header className="ziyo-hub-header">
        <div className="ziyo-hub-top-bar">
          <button
            type="button"
            className="ziyo-hub-back-btn"
            onClick={() => navigate("/yaratish")}
            title="Yaratish sahifasiga qaytish"
          >
            <IoArrowBack />
          </button>
          <div>
            <h1 className="ziyo-hub-title">O‘yin yaratish markazi</h1>
            <p className="ziyo-hub-subtitle">
              Ta’lim jarayonini qiziqarli qilish uchun o‘zingizga mos o‘yin turini
              tanlang va uni osongina yarating.
            </p>
          </div>
        </div>
      </header>

      <div className="ziyo-games-grid">
        {gamesList.map((game) => (
          <div className="ziyo-game-card" key={game.id}>
            <div className="ziyo-game-top">
              <span className="ziyo-game-category">{game.category}</span>
              <span className="ziyo-game-icon">{game.icon}</span>
            </div>

            <div className="ziyo-game-content">
              <h3 className="ziyo-game-title">{game.title}</h3>
              <p className="ziyo-game-desc">{game.description}</p>
            </div>

            <button
              type="button"
              className={`ziyo-game-btn ${!game.isReady ? "disabled" : ""}`}
              onClick={() => handleGameClick(game)}
            >
              {game.isReady ? "Yaratishni boshlash" : "Tez kunda"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Oyinlar;
