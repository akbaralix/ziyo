import { useState, useMemo } from "react";
import {
  GoTrophy,
  GoSearch,
  GoFlame,
  GoArrowUp,
  GoArrowDown,
} from "react-icons/go";
import {
  IoSparklesOutline,
  IoMedalOutline,
  IoBookOutline,
  IoExtensionPuzzleOutline,
  IoRibbonOutline,
} from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import defaultAvatar from "../../assets/logo.jpg";
import initialLeaderboardData from "./reytingData.json";
import "./reytinglar.css";

const TIMEFRAMES = [
  { id: "all", label: "Barcha vaqtlar" },
  { id: "monthly", label: "Shu oy" },
  { id: "weekly", label: "Shu hafta" },
];

const CATEGORIES = [
  "Barchasi",
  "Dasturlash",
  "Fizika",
  "Matematika",
  "Kitobxonlik",
];

function Reytinglar() {
  const [timeframe, setTimeframe] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [searchQuery, setSearchQuery] = useState("");

  // Foydalanuvchilarni XP bo'yicha kamayish tartibida saralash
  const sortedUsers = useMemo(() => {
    // Vaqt filtri bo'yicha XP ni moslash (dinamik multiplikator bilan)
    const multiplier =
      timeframe === "weekly" ? 0.25 : timeframe === "monthly" ? 0.65 : 1;

    let users = initialLeaderboardData.map((u) => ({
      ...u,
      calculatedXp: Math.round(u.xp * multiplier),
    }));

    // XP bo'yicha eng kattasi yuqorida
    users.sort((a, b) => b.calculatedXp - a.calculatedXp);

    // Ranklarni belgilash
    users = users.map((u, index) => ({
      ...u,
      rank: index + 1,
    }));

    // Qidiruv bo'yicha filtrlash
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.level.toLowerCase().includes(q),
      );
    }

    return users;
  }, [timeframe, searchQuery]);

  // Top 3 foydalanuvchilar (podium uchun)
  const top1 = sortedUsers.find((u) => u.rank === 1);
  const top2 = sortedUsers.find((u) => u.rank === 2);
  const top3 = sortedUsers.find((u) => u.rank === 3);

  // 4-o'rindan keyingi foydalanuvchilar
  const remainingUsers = sortedUsers.filter((u) => u.rank > 3);

  // Hozirgi foydalanuvchi ma'lumotlari
  const currentUser = sortedUsers.find((u) => u.isCurrentUser);

  return (
    <div className="reyting-page">
      {/* Header Banner */}

      {/* Filter and Search Bar */}
      <div className="reyting-controls">
        <div className="timeframe-tabs">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`timeframe-btn ${timeframe === t.id ? "active" : ""}`}
              onClick={() => setTimeframe(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="search-and-cat">
          <div className="reyting-search">
            <GoSearch className="search-icon" />
            <input
              type="text"
              placeholder="Ism yoki username bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="category-scroll-bar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-pill ${
                  selectedCategory === cat ? "active" : ""
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM SECTION */}
      {!searchQuery && top1 && (
        <div className="podium-section">
          <div className="podium-container">
            {/* 2nd Place (Chapda) */}
            {top2 && (
              <div className="podium-item podium-second">
                <div className="podium-user-card">
                  <div className="podium-avatar-wrapper rank-2">
                    <img
                      src={top2.avatar || defaultAvatar}
                      alt={top2.name}
                      className="podium-avatar"
                    />
                    <div className="podium-rank-badge silver">2</div>
                  </div>
                  <h3 className="podium-user-name">{top2.name}</h3>
                  <span className="podium-user-handle">@{top2.username}</span>
                  <span className="podium-user-level">{top2.level}</span>
                  <div className="podium-xp-pill silver-pill">
                    <GoFlame />
                    <span>{top2.calculatedXp.toLocaleString()} XP</span>
                  </div>
                </div>
                <div className="podium-pedestal pedestal-2">
                  <span className="pedestal-number">2</span>
                  <span className="pedestal-label">Kumush</span>
                </div>
              </div>
            )}

            {/* 1st Place (O'rtada - Eng baland) */}
            {top1 && (
              <div className="podium-item podium-first">
                <div className="crown-icon">
                  <FaCrown />
                </div>
                <div className="podium-user-card first-card">
                  <div className="podium-avatar-wrapper rank-1">
                    <img
                      src={top1.avatar || defaultAvatar}
                      alt={top1.name}
                      className="podium-avatar"
                    />
                    <div className="podium-rank-badge gold">1</div>
                  </div>
                  <h3 className="podium-user-name">{top1.name}</h3>
                  <span className="podium-user-handle">@{top1.username}</span>
                  <span className="podium-user-level">{top1.level}</span>
                  <div className="podium-xp-pill gold-pill">
                    <GoTrophy />
                    <span>{top1.calculatedXp.toLocaleString()} XP</span>
                  </div>
                </div>
                <div className="podium-pedestal pedestal-1">
                  <span className="pedestal-number">1</span>
                  <span className="pedestal-label">G'olib 🏆</span>
                </div>
              </div>
            )}

            {/* 3rd Place (O'ngda) */}
            {top3 && (
              <div className="podium-item podium-third">
                <div className="podium-user-card">
                  <div className="podium-avatar-wrapper rank-3">
                    <img
                      src={top3.avatar || defaultAvatar}
                      alt={top3.name}
                      className="podium-avatar"
                    />
                    <div className="podium-rank-badge bronze">3</div>
                  </div>
                  <h3 className="podium-user-name">{top3.name}</h3>
                  <span className="podium-user-handle">@{top3.username}</span>
                  <span className="podium-user-level">{top3.level}</span>
                  <div className="podium-xp-pill bronze-pill">
                    <IoMedalOutline />
                    <span>{top3.calculatedXp.toLocaleString()} XP</span>
                  </div>
                </div>
                <div className="podium-pedestal pedestal-3">
                  <span className="pedestal-number">3</span>
                  <span className="pedestal-label">Bronza</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEADERBOARD LIST (4-o'rindan pastdagilar) */}
      <div className="leaderboard-table-card">
        <div className="leaderboard-header-row">
          <span className="col-rank">O'rin</span>
          <span className="col-user">Foydalanuvchi</span>
          <span className="col-stats hide-mobile">Faollik</span>
          <span className="col-trend hide-mobile">O'zgarish</span>
          <span className="col-xp">Ball (XP)</span>
        </div>

        <div className="leaderboard-list">
          {sortedUsers.length === 0 ? (
            <div className="empty-leaderboard">
              <IoRibbonOutline className="empty-icon" />
              <p>Foydalanuvchilar topilmadi</p>
            </div>
          ) : (
            (searchQuery ? sortedUsers : remainingUsers).map((user) => {
              const isMe = user.isCurrentUser;
              return (
                <div
                  key={user.id}
                  className={`leaderboard-row ${isMe ? "current-user-row" : ""}`}
                >
                  <div className="col-rank">
                    <span className="rank-circle">#{user.rank}</span>
                  </div>

                  <div className="col-user">
                    <div className="user-avatar-box">
                      <img
                        src={user.avatar || defaultAvatar}
                        alt={user.name}
                        className="user-list-avatar"
                      />
                      {isMe && <span className="you-indicator">Siz</span>}
                    </div>
                    <div className="user-text-info">
                      <div className="user-title-row">
                        <span className="user-realname">{user.name}</span>
                        {isMe && <span className="you-pill">Siz</span>}
                      </div>
                      <span className="user-subhandle">
                        @{user.username} • {user.level}
                      </span>
                    </div>
                  </div>

                  <div className="col-stats hide-mobile">
                    <div className="activity-badges">
                      <span className="act-pill" title="Yechilgan testlar">
                        <IoExtensionPuzzleOutline /> {user.solvedQuizzes} test
                      </span>
                      <span className="act-pill" title="O'qilgan kitoblar">
                        <IoBookOutline /> {user.readBooks} kitob
                      </span>
                    </div>
                  </div>

                  <div className="col-trend hide-mobile">
                    {user.trend?.startsWith("+") && (
                      <span className="trend-up">
                        <GoArrowUp /> {user.trend}
                      </span>
                    )}
                    {user.trend?.startsWith("-") && (
                      <span className="trend-down">
                        <GoArrowDown /> {user.trend}
                      </span>
                    )}
                    {user.trend === "0" && (
                      <span className="trend-same">—</span>
                    )}
                  </div>

                  <div className="col-xp">
                    <div className="xp-display-chip">
                      <GoFlame className="xp-flame" />
                      <span className="xp-bold">
                        {user.calculatedXp.toLocaleString()}
                      </span>
                      <span className="xp-unit">XP</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default Reytinglar;
