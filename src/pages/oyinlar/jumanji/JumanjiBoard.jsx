import React from "react";
import {
  FaBomb,
  FaTrophy,
  FaCampground,
  FaForwardFast,
  FaForward,
  FaBackwardFast,
  FaBackward,
  FaSpider,
  FaSkullCrossbones,
  FaGem,
  FaHourglassHalf,
  FaTree,
  FaShieldHalved,
  FaFire,
  FaTornado,
  FaWorm,
} from "react-icons/fa6";
import { GiCrocJaws } from "react-icons/gi";
import "./JumanjiBoard.css";

const COLS = 8;

// Har bir katak uchun mos React Icon
export function getTileIcon(tile, idx) {
  if (tile.type === "finish" || idx === 39) {
    return <FaTrophy className="tile-react-icon trophy-icon" />;
  }
  if (tile.type === "start" || idx === 0) {
    return <FaCampground className="tile-react-icon start-icon" />;
  }
  if (tile.type === "bomb") {
    return <FaBomb className="tile-react-icon bomb-icon" />;
  }
  if (tile.type === "danger") {
    return <FaSkullCrossbones className="tile-react-icon danger-icon" />;
  }
  if (tile.type === "mystery") {
    return <FaGem className="tile-react-icon mystery-icon" />;
  }
  if (tile.type === "forward") {
    return (tile.steps || 0) >= 3 ? (
      <FaForwardFast className="tile-react-icon fwd-icon" />
    ) : (
      <FaForward className="tile-react-icon fwd-icon" />
    );
  }
  if (tile.type === "backward") {
    return Math.abs(tile.steps || 0) >= 3 ? (
      <FaBackwardFast className="tile-react-icon back-icon" />
    ) : (
      <FaBackward className="tile-react-icon back-icon" />
    );
  }
  if (tile.type === "trap") {
    if (tile.label === "🐊") return <GiCrocJaws className="tile-react-icon trap-icon croc" />;
    if (tile.label === "🐍") return <FaWorm className="tile-react-icon trap-icon snake" />;
    if (tile.label === "🌪️") return <FaTornado className="tile-react-icon trap-icon tornado" />;
    if (tile.label === "⏳") return <FaHourglassHalf className="tile-react-icon trap-icon" />;
    return <FaSpider className="tile-react-icon trap-icon spider" />;
  }
  // Oddiy o'rmon so'qmog'i kataklari
  if (idx % 3 === 0) return <FaTree className="tile-react-icon normal-tree" />;
  if (idx % 3 === 1) return <FaShieldHalved className="tile-react-icon normal-shield" />;
  return <FaFire className="tile-react-icon normal-fire" />;
}

export default function JumanjiBoard({
  tiles = [],
  players = [],
  activePlayerId = null,
  animatedPositions = {},
}) {
  // Snaking koordinatalari
  const getGridPosition = (index) => {
    const row = Math.floor(index / COLS);
    const colInRow = index % COLS;
    const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
    return { col, row };
  };

  // Bir xil katakdagi o'yinchilar
  const occupants = {};
  players.forEach((p) => {
    const floatPos = animatedPositions[p.id] !== undefined ? animatedPositions[p.id] : p.position || 0;
    const intPos = Math.round(floatPos);
    if (!occupants[intPos]) occupants[intPos] = [];
    occupants[intPos].push(p);
  });

  return (
    <div className="jumanji-board-wrapper">
      <div className="jumanji-grid-board">
        {tiles.map((tile, idx) => {
          const { col, row } = getGridPosition(idx);
          const icon = getTileIcon(tile, idx);

          return (
            <div
              key={tile.id || idx}
              className={`jumanji-tile-card tile-type-${tile.type}`}
              style={{
                gridColumn: col + 1,
                gridRow: row + 1,
              }}
              title={tile.desc}
            >
              {/* Yuqori chapda katak raqami */}
              <div className="tile-index-badge">{idx}</div>

              {/* Katak markazidagi chiroyli React Icon */}
              <div className="tile-icon-container">{icon}</div>

              {/* Pastdagi harakat/qadam ko'rsatkichi */}
              <div className="tile-bottom-badge">
                {tile.type === "finish" && <span className="text-finish">MARRA</span>}
                {tile.type === "start" && <span className="text-start">START</span>}
                {tile.type === "bomb" && <span className="text-bomb">{tile.steps}</span>}
                {tile.type === "forward" && <span className="text-fwd">+{tile.steps}</span>}
                {tile.type === "backward" && <span className="text-back">{tile.steps}</span>}
                {tile.type === "danger" && <span className="text-danger">{tile.steps}</span>}
                {tile.type === "mystery" && <span className="text-mystery">OMAD</span>}
                {tile.type === "trap" && <span className="text-trap">KUTISH</span>}
                {tile.type === "normal" && <span className="text-normal">SO'QMOQ</span>}
              </div>

              {/* Katak ichidagi o'yinchilar */}
              {occupants[idx] && (
                <div className="tile-players-box">
                  {occupants[idx].map((player) => {
                    const isTurn = player.id === activePlayerId;
                    return (
                      <div
                        key={player.id}
                        className={`player-pawn ${isTurn ? "active-turn-pawn" : ""}`}
                        style={{ backgroundColor: player.color || "#3b82f6" }}
                        title={`${player.name} (${idx}-katak)`}
                      >
                        <span className="player-pawn-letter">
                          {(player.name || "P").charAt(0).toUpperCase()}
                        </span>
                        {isTurn && <div className="pawn-pulse-ring" />}
                        {player.skipTurn && <span className="pawn-trap-indicator">🕸️</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
