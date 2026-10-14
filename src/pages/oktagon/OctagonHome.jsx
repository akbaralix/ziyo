import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoArrowBack,
  IoFlash,
  IoShieldCheckmark,
  IoTrophy,
  IoFlame,
  IoTrendingUp,
} from "react-icons/io5";
import { LuSword, LuBrain } from "react-icons/lu";
import "./OctagonHome.css";

const DISCIPLINES = [
  {
    id: "matematika",
    title: "Matematika",
    icon: "🔢",
    subtitle: "Dinamik sonlar & Aql charxi",
    description:
      "Parametrik formulalar, tenglamalar, foizlar va mantiq. Har safar mutlaqo yangi va takrorlanmas misollar!",
    badge: "Cheksiz savollar",
    color: "#461fe2",
    bgSoft: "#f5f3ff",
  },
  {
    id: "tarix",
    title: "Tarix",
    icon: "🏛️",
    subtitle: "Buyuk ajdodlar & Sanalar",
    description:
      "O‘zbekiston va jahon tarixi, muhim voqealar, xonliklar va qadimgi sivilizatsiyalar sirlari.",
    badge: "Keng qamrovli baza",
    color: "#b45309",
    bgSoft: "#fffbeb",
  },
  {
    id: "ingliz-tili",
    title: "Ingliz tili",
    icon: "🇬🇧",
    subtitle: "Grammar & Vocabulary",
    description:
      "Tenses, sinonimlar, iboralar va bo‘shliqlarni to‘ldirish. B1-B2 darajadagi tezkor leksik bellashuv.",
    badge: "B1-B2 daraja",
    color: "#059669",
    bgSoft: "#ecfdf5",
  },
];

export default function OctagonHome() {
  const navigate = useNavigate();
  const [selectedDiscipline, setSelectedDiscipline] = useState("matematika");

  // Foydalanuvchi ma'lumotlari
  const currentUser = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("ziyo_user"));
      if (u) return u;
      const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p) return p;
    } catch {}
    return { firstName: "Jangchi", xp: 120, rank: 1 };
  })();

  const handleStartBattle = () => {
    navigate(`/oktagon/battle?category=${selectedDiscipline}`);
  };

  return (
    <div className="octagon-home-page">
      {/* Top Header */}
      <header className="octagon-home-header">
        <div className="octagon-header-left">
          <button
            type="button"
            className="octagon-circle-btn"
            onClick={() => navigate("/oyinlar")}
            title="O'yinlarga qaytish"
          >
            <IoArrowBack />
          </button>
          <div>
            <div className="octagon-brand-tag">
              <LuSword /> JONLI 1V1 DUEL
            </div>
          </div>
        </div>

        <div className="octagon-user-stat-badge">
          <IoTrophy className="stat-icon-gold" />
          <span className="stat-xp-val">{currentUser.xp || 0} XP</span>
        </div>
      </header>

      {/* Discipline Selector */}
      <div className="octagon-section">
        <div className="section-title-wrap">
          <h3 className="section-title">
            <LuBrain /> Jang yo‘nalishini tanlang
          </h3>
          <span className="section-sub">
            O‘zingiz kuchli bo‘lgan fanni tanlang
          </span>
        </div>

        <div className="disciplines-grid">
          {DISCIPLINES.map((d) => {
            const isSelected = selectedDiscipline === d.id;
            return (
              <div
                key={d.id}
                className={`discipline-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedDiscipline(d.id)}
              >
                <div className="discipline-card-top">
                  <span className="discipline-icon-box">{d.icon}</span>
                  <span
                    className="discipline-badge"
                    style={{ color: d.color, background: d.bgSoft }}
                  >
                    {d.badge}
                  </span>
                </div>

                <div className="discipline-info">
                  <h4 className="discipline-name">{d.title}</h4>
                  <span className="discipline-subtitle">{d.subtitle}</span>
                  <p className="discipline-desc">{d.description}</p>
                </div>

                <div className="discipline-card-action">
                  <button
                    type="button"
                    className={`select-btn ${isSelected ? "active" : ""}`}
                  >
                    {isSelected ? "Tanlangan ✓" : "Tanlash"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Launch Action */}
      <div className="octagon-launch-bar">
        <button
          type="button"
          className="octagon-start-btn"
          onClick={handleStartBattle}
        >
          <IoFlash /> Jangga kirish (1v1)
        </button>
      </div>
      <div className="octagon-rules-card">
        <h4 className="rules-title">
          <IoShieldCheckmark /> Oktagon qoidalari:
        </h4>
        <div className="rules-grid">
          <div className="rule-item">
            <span className="rule-num">1</span>
            <div>
              <strong>10 ta teng savol:</strong> Ikkala tomon bir vaqtning
              o‘zida xuddi shu savollarni oladi.
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-num">2</span>
            <div>
              <strong>12 soniya & Tezlik:</strong> Qancha tez javob bersangiz,
              shuncha ko‘p ball yoziladi.
            </div>
          </div>
          <div className="rule-item">
            <span className="rule-num">3</span>
            <div>
              <strong>XP Stavkalari:</strong> G‘olibga <strong>+30 XP</strong>,
              mag‘lubiyatda esa <strong>-15 XP</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
