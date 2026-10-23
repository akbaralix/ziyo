import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoArrowBack,
  IoFlash,
  IoShieldCheckmark,
  IoTrophy,
  IoFlame,
  IoTrendingUp,
  IoSettingsOutline,
  IoClose,
} from "react-icons/io5";
import { LuSword, LuBrain } from "react-icons/lu";
import ModalOverlay from "../../components/ModalOverlay";
import "./OctagonHome.css";

const MATH_DIFFICULTIES = [
  {
    id: "oson",
    name: "Oson",
    tag: "🟢 Oson",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    desc: "1000 gacha bo'lgan qo'shish, ayirish, ko'paytirish va bo'lish amallari.",
    winXp: 30,
    loseXp: 15,
  },
  {
    id: "qiyin",
    name: "Qiyin",
    tag: "🟡 Qiyin",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    desc: "Qavsli ifodalar, amallar ketma-ketligi, foizlar, kvadratlar va chiziqli tenglamalar.",
    winXp: 40,
    loseXp: 25,
  },
  {
    id: "murakkab",
    name: "Murakkab",
    tag: "🔴 Murakkab",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    desc: "Kvadrat ildizlar, kublar, 3-bosqichli ifodalar, manfiy sonlar va murakkab algebra.",
    winXp: 60,
    loseXp: 40,
  },
];

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

  // Matematika darajasi: "oson" | "qiyin" | "murakkab"
  const [mathDifficulty, setMathDifficulty] = useState(() => {
    return localStorage.getItem("octagon_math_difficulty") || "oson";
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempDifficulty, setTempDifficulty] = useState(mathDifficulty);

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

  const handleOpenSettings = (e) => {
    e.stopPropagation();
    setTempDifficulty(mathDifficulty);
    setIsSettingsOpen(true);
  };

  const handleSaveDifficulty = () => {
    setMathDifficulty(tempDifficulty);
    localStorage.setItem("octagon_math_difficulty", tempDifficulty);
    setIsSettingsOpen(false);
  };

  const handleStartBattle = () => {
    const diffParam =
      selectedDiscipline === "matematika"
        ? `&difficulty=${mathDifficulty}`
        : "";
    navigate(`/oktagon/battle?category=${selectedDiscipline}${diffParam}`);
  };

  const currentDiffObj =
    MATH_DIFFICULTIES.find((d) => d.id === mathDifficulty) ||
    MATH_DIFFICULTIES[0];

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
                  <div className="discipline-card-badges">
                    {d.id === "matematika" && (
                      <span
                        className="discipline-diff-chip"
                        style={{
                          color: currentDiffObj.color,
                          background: currentDiffObj.bg,
                          border: `1px solid ${currentDiffObj.border}`,
                        }}
                      >
                        {currentDiffObj.tag}
                      </span>
                    )}
                    <span
                      className="discipline-badge"
                      style={{ color: d.color, background: d.bgSoft }}
                    >
                      {d.badge}
                    </span>
                    {d.id === "matematika" && (
                      <button
                        type="button"
                        className="discipline-settings-btn"
                        onClick={handleOpenSettings}
                        title="Matematika darajasini sozlash"
                      >
                        <IoSettingsOutline />
                      </button>
                    )}
                  </div>
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

      {/* Rules Card */}
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
              <strong>XP Stavkalari:</strong> Matematikada Oson{" "}
              <strong>(+30 / -15 XP)</strong>, Qiyin{" "}
              <strong>(+40 / -25 XP)</strong>, Murakkab{" "}
              <strong>(+60 / -40 XP)</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal (Matematika darajasini sozlash) */}
      <ModalOverlay
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        className="octagon-settings-modal-overlay"
      >
        <div className="octagon-settings-modal">
          <div className="settings-modal-header">
            <div className="settings-header-title">
              <IoSettingsOutline className="settings-title-icon" />
              <h3>Matematika darajasini sozlash</h3>
            </div>
            <button
              type="button"
              className="close-modal-btn"
              onClick={() => setIsSettingsOpen(false)}
            >
              <IoClose />
            </button>
          </div>

          <p className="settings-modal-desc">
            O'zingizga mos murakkablikni tanlang. Jang aynan shu darajani
            tanlagan munosib raqib bilan boshlanadi.
          </p>

          <div className="difficulty-options-list">
            {MATH_DIFFICULTIES.map((item) => {
              const isItemActive = tempDifficulty === item.id;
              return (
                <div
                  key={item.id}
                  className={`diff-option-card ${isItemActive ? "active" : ""}`}
                  onClick={() => setTempDifficulty(item.id)}
                  style={{
                    borderColor: isItemActive ? item.color : undefined,
                  }}
                >
                  <div className="diff-option-top">
                    <div className="diff-option-name-wrap">
                      <span
                        className="diff-badge-pill"
                        style={{ color: item.color, background: item.bg }}
                      >
                        {item.tag}
                      </span>
                      <h4 className="diff-option-name">{item.name}</h4>
                    </div>
                    <div
                      className={`diff-radio-circle ${isItemActive ? "checked" : ""}`}
                      style={{
                        borderColor: isItemActive ? item.color : undefined,
                        background: isItemActive ? item.color : undefined,
                      }}
                    >
                      {isItemActive && <span className="diff-radio-dot" />}
                    </div>
                  </div>

                  <p className="diff-option-desc">{item.desc}</p>

                  <div className="diff-xp-stakes">
                    <span className="diff-xp-win">
                      🏆 Yutsa: <strong>+{item.winXp} XP</strong>
                    </span>
                    <span className="diff-xp-lose">
                      💔 Yutqazsa: <strong>-{item.loseXp} XP</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="settings-modal-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setIsSettingsOpen(false)}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="save-diff-btn"
              onClick={handleSaveDifficulty}
            >
              Saqlash
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
