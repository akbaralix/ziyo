import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import confetti from "canvas-confetti";
import { toast } from "react-toastify";
import {
  IoArrowBack,
  IoPlay,
  IoRefresh,
  IoPeople,
  IoSparkles,
  IoCheckmark,
  IoShareSocialOutline,
  IoVolumeHighOutline,
  IoVolumeMuteOutline,
  IoTrophyOutline,
  IoClose,
} from "react-icons/io5";
import {
  FaDice,
  FaDiceOne,
  FaDiceTwo,
  FaDiceThree,
  FaDiceFour,
  FaDiceFive,
  FaDiceSix,
} from "react-icons/fa6";
import JumanjiBoard from "./JumanjiBoard.jsx";
import { sfx } from "../../../utils/soundEffects.js";
import "./JumanjiPlay.css";

const DICE_ICONS = {
  1: FaDiceOne,
  2: FaDiceTwo,
  3: FaDiceThree,
  4: FaDiceFour,
  5: FaDiceFive,
  6: FaDiceSix,
};

export default function JumanjiPlay() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const currentUser = (() => {
    try {
      const u =
        JSON.parse(localStorage.getItem("hatify_user")) ||
        JSON.parse(localStorage.getItem("ziyo_user"));
      if (u) return u;
      const p =
        JSON.parse(localStorage.getItem("hatify_user_profile")) ||
        JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p) return p;
    } catch {}
    return null;
  })();

  const savedName = localStorage.getItem("jumanji_player_name") || "";
  const initialName =
    savedName ||
    (currentUser?.firstName
      ? `${currentUser.firstName} ${currentUser.lastName || ""}`.trim()
      : currentUser?.name || currentUser?.username || "");

  const [playerName, setPlayerName] = useState(initialName);
  const playerNameRef = useRef(initialName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);
  const [isNameModalOpen, setIsNameModalOpen] = useState(!initialName);

  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [displayDice, setDisplayDice] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // KATTA G'OLIB MODALI
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState(null);
  const pendingWinnerRef = useRef(null);

  const [animatedPositions, setAnimatedPositions] = useState({});
  const animatedPositionsRef = useRef({});
  useEffect(() => {
    animatedPositionsRef.current = animatedPositions;
  }, [animatedPositions]);

  // Marraga yetgandan so'ng g'alaba ekranini ochish
  const triggerVictory = (winner) => {
    setWinnerData(winner);
    setShowWinnerModal(true);
    sfx.playVictory();

    // Kattaroq va quvonchli konfeti portlashi
    confetti({
      particleCount: 220,
      spread: 120,
      origin: { y: 0.5 },
    });
    setTimeout(() => {
      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.6 },
      });
    }, 450);
  };

  useEffect(() => {
    if (!roomId) return;

    const socketUrl =
      import.meta.env.VITE_API_URL || window.location.origin;

    const s = io(`${socketUrl}/jumanji`, {
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    s.on("connect", () => {
      const activeName = (playerNameRef.current || "").trim();
      if (activeName) {
        s.emit("join_room", {
          roomId,
          playerName: activeName,
          userId: currentUser?._id || currentUser?.id || null,
        });
      }
    });

    s.on("room_joined", (data) => {
      setRoom(data.room);
      setTiles(data.tiles);
      setMyPlayerId(data.playerId);
      setDisplayDice(data.room?.diceValue);
      const initialPos = {};
      data.room?.players?.forEach((p) => {
        initialPos[p.id] = p.position || 0;
      });
      setAnimatedPositions(initialPos);
      sfx.playJoin();
    });

    s.on("room_updated", (data) => {
      setRoom(data.room);
      setDisplayDice(data.room?.diceValue);
      setAnimatedPositions((prev) => {
        const next = { ...prev };
        data.room?.players?.forEach((p) => {
          if (next[p.id] === undefined) {
            next[p.id] = p.position || 0;
          }
        });
        return next;
      });
    });

    s.on("game_started", (data) => {
      setRoom(data.room);
      setShowWinnerModal(false);
      sfx.playCorrect();
      toast.info("🎲 Jumanji boshlandi! Birinchi o'yinchi navbati!");
    });

    s.on("dice_rolled", (data) => {
      setIsRolling(true);

      let rollInterval = setInterval(() => {
        const randomNum = Math.floor(Math.random() * 6) + 1;
        setDisplayDice(randomNum);
        if (sfx.playSpinWheelTick) sfx.playSpinWheelTick();
      }, 90);

      setTimeout(() => {
        clearInterval(rollInterval);
        setIsRolling(false);
        setIsMoving(true); // O'yinchi yurishni boshladi
        setDisplayDice(data.dice);

        const startPos = animatedPositionsRef.current[data.playerId] || 0;
        const landedPos = data.landedPos !== undefined ? data.landedPos : data.newPosition;
        const finalPos = data.finalPos !== undefined ? data.finalPos : (data.lastEvent?.extraAction?.targetPos ?? landedPos);

        // 1-bosqich: Zar raqami bo'yicha tushgan katakka sakrab borish
        animateStepByStep(data.playerId, startPos, landedPos, () => {
          // Agar katakda bomba, orqaga chekinish yoki olg'a sakrash kabi hodisa bo'lsa:
          if (finalPos !== landedPos) {
            // Hodisa ovozi va xabari
            if (data.lastEvent?.extraAction?.type === "bomb") {
              sfx.playWrong();
              toast.error(data.lastEvent.message);
            } else if (data.lastEvent?.extraAction?.type === "backward" || data.lastEvent?.extraAction?.type === "danger") {
              sfx.playWrong();
              toast.warn(data.lastEvent.message);
            } else if (data.lastEvent?.extraAction?.type === "forward") {
              sfx.playCorrect();
              toast.success(data.lastEvent.message);
            }

            // Kichik tanaffus (0.4s) va darhol orqaga/oldinga ikkinchi sakrash harakati!
            setTimeout(() => {
              animateStepByStep(data.playerId, landedPos, finalPos, () => {
                finishTurnProcess();
              });
            }, 400);
          } else {
            if (data.lastEvent?.extraAction?.type === "trap") {
              sfx.playWrong();
              toast.warn(data.lastEvent.message);
            }
            finishTurnProcess();
          }
        });

        function finishTurnProcess() {
          setIsMoving(false); // Harakat butunlay tugadi
          setRoom(data.room); // Navbat keyingi o'yinchiga o'tdi

          if (pendingWinnerRef.current) {
            triggerVictory(pendingWinnerRef.current);
            pendingWinnerRef.current = null;
          }
        }
      }, 900);
    });

    s.on("game_finished", (data) => {
      setRoom(data.room);
      // Agar o'yinchi hali qadamma-qadam sakrab marraga bormoqda bo'lsa,
      // animatsiya tugaguncha kutamiz (pendingWinnerRef ga saqlaymiz)
      pendingWinnerRef.current = data.winner;
    });

    s.on("game_restarted", (data) => {
      setRoom(data.room);
      setShowWinnerModal(false);
      const resetPos = {};
      data.room?.players?.forEach((p) => {
        resetPos[p.id] = 0;
      });
      setAnimatedPositions(resetPos);
      toast.info("🔄 O'yin qaytadan boshlandi!");
    });

    s.on("error_msg", (err) => {
      toast.error(err.message);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [roomId]);

  function animateStepByStep(playerId, fromPos, toPos, onComplete) {
    if (fromPos === toPos) {
      if (onComplete) onComplete();
      return;
    }

    const direction = toPos > fromPos ? 1 : -1;
    let current = fromPos;

    const hopNext = () => {
      if (
        (direction > 0 && current >= toPos) ||
        (direction < 0 && current <= toPos)
      ) {
        setAnimatedPositions((prev) => ({ ...prev, [playerId]: toPos }));
        if (onComplete) onComplete();
        return;
      }

      const nextTarget =
        direction > 0
          ? Math.min(toPos, current + 1)
          : Math.max(toPos, current - 1);
      const stepStart = current;
      const stepDist = nextTarget - stepStart;
      const startTime = performance.now();
      const stepDuration = 240;

      const stepFrame = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / stepDuration);
        const currentFloat = stepStart + stepDist * progress;

        setAnimatedPositions((prev) => ({
          ...prev,
          [playerId]: currentFloat,
        }));

        if (progress < 1) {
          requestAnimationFrame(stepFrame);
        } else {
          current = nextTarget;
          sfx.playJoin();
          setTimeout(hopNext, 35);
        }
      };

      requestAnimationFrame(stepFrame);
    };

    hopNext();
  }

  const handleJoinWithName = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      toast.warn("Iltimos, ismingizni kiriting!");
      return;
    }

    localStorage.setItem("jumanji_player_name", playerName.trim());
    setIsNameModalOpen(false);

    if (socket) {
      socket.emit("join_room", {
        roomId,
        playerName: playerName.trim(),
        userId: currentUser?._id || currentUser?.id || null,
      });
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/jumanji/${roomId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        toast.success("O'yin havolasi nusxalandi!");
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        toast.info("Havolani nusxalab bo'lmadi.");
      });
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit("start_game");
  };

  const handleRollDice = () => {
    if (!socket || isRolling || isMoving) return;
    socket.emit("roll_dice");
  };

  const handleRestartGame = () => {
    if (!socket) return;
    socket.emit("restart_game");
  };

  const toggleMute = () => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
  };

  const activePlayer = room?.players?.[room?.turnIndex];
  const isMyTurn =
    activePlayer?.id === myPlayerId && room?.status === "PLAYING";
  const amIHost =
    room?.hostSocketId === myPlayerId ||
    room?.players?.find((p) => p.id === myPlayerId)?.isHost;

  const DiceComponent =
    displayDice && DICE_ICONS[displayDice] ? DICE_ICONS[displayDice] : FaDice;

  return (
    <div className="jumanji-play-page light-mode">
      {/* 🏆 BARCHANING EKRANIDA KATTA G'OLIB MODALI (POPUP) */}
      {showWinnerModal && (
        <div className="jumanji-winner-fullscreen-backdrop">
          <div className="jumanji-winner-fullscreen-card">
            <button
              className="jumanji-winner-close-btn"
              onClick={() => setShowWinnerModal(false)}
              title="Yopish"
            >
              <IoClose />
            </button>
            <div className="jumanji-winner-trophy-box">
              <IoTrophyOutline className="jumanji-huge-trophy" />
            </div>
            <div className="jumanji-winner-title-badge">
              JUMANJI G'OLIBI! 🏆
            </div>
            <h1 className="jumanji-winner-big-name">
              {winnerData?.name || "G'olib"}
            </h1>
            <p className="jumanji-winner-text">
              Barcha qiyinchiliklar, tuzoqlar va minalarni yengib o'tib, Jumanji
              o'yinida birinchi bo'lib marraga yetib keldi! 🌿✨
            </p>

            <div className="jumanji-winner-actions">
              {amIHost ? (
                <button
                  className="jumanji-winner-restart-btn"
                  onClick={handleRestartGame}
                >
                  <IoRefresh size={22} /> Yangi O'yinni Boshlash
                </button>
              ) : (
                <div className="jumanji-winner-wait-notice">
                  O'yin egasi yangi o'yin boshlashini kuting...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ISM SO'RASH MODALI */}
      {isNameModalOpen && (
        <div className="jumanji-name-modal-backdrop">
          <div className="jumanji-name-modal">
            <div className="jumanji-modal-icon">🎲🌿</div>
            <h2>Jumanji O'yiniga Xush Kelibsiz!</h2>
            <p>
              Xona kodi: <b className="gold-text">{roomId}</b>
            </p>
            <p className="jumanji-modal-desc">
              O'yinga kirish uchun ismingizni kiriting:
            </p>
            <form onSubmit={handleJoinWithName}>
              <input
                type="text"
                autoFocus
                placeholder="Ismingizni kiriting..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
              <button type="submit" className="jumanji-modal-submit-btn">
                O'yinga Kirish 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TEPADAGI HEADER */}
      <header className="jumanji-play-header">
        <div className="jumanji-header-left">
          <button
            className="jumanji-header-btn"
            onClick={() => navigate("/oyinlar")}
            title="Chiqish"
          >
            <IoArrowBack /> <span className="hide-on-mobile">O'yinlar</span>
          </button>
        </div>

        <div className="jumanji-title-info">
          <h2>{room?.title || "Jumanji Sarguzashti"}</h2>
        </div>

        <div className="jumanji-header-right">
          <button
            className="jumanji-share-btn"
            onClick={handleCopyLink}
            title="Ulanish havolasini nusxalash"
          >
            {copied ? (
              <IoCheckmark color="#16a34a" />
            ) : (
              <IoShareSocialOutline />
            )}
            <span className="hide-on-mobile">
              {copied ? "Nusxalandi!" : "Havolani Ulashish"}
            </span>
          </button>
          <button
            className="jumanji-sound-btn"
            onClick={toggleMute}
            title={isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
          >
            {isMuted ? <IoVolumeMuteOutline /> : <IoVolumeHighOutline />}
          </button>
        </div>
      </header>

      {/* ASOSIY O'YIN MAYDONI */}
      <div className="jumanji-main-layout">
        <div className="jumanji-board-panel">
          <div className="jumanji-canvas-container">
            <JumanjiBoard
              tiles={tiles}
              players={room?.players || []}
              activePlayerId={activePlayer?.id}
              diceValue={room?.diceValue}
              isRolling={isRolling}
              lastEvent={room?.lastEvent}
              animatedPositions={animatedPositions}
            />
          </div>

          {/* PASTKI ZAR VA HOLAT PANELI */}
          <div className="jumanji-action-dock">
            {room?.status === "LOBBY" && (
              <div className="jumanji-lobby-dock">
                <div className="jumanji-lobby-waiting">
                  <IoPeople size={22} />
                  <span>
                    Kutilmoqda ({room?.players?.length || 0} kishi tayyor)
                  </span>
                </div>
                {amIHost ? (
                  <button
                    className="jumanji-btn-primary"
                    onClick={handleStartGame}
                  >
                    <IoPlay size={20} /> O'yinni Boshlash
                  </button>
                ) : (
                  <div className="jumanji-waiting-host">
                    Boshlanishi kutilmoqda...
                  </div>
                )}
              </div>
            )}

            {room?.status === "PLAYING" && (
              <div className="jumanji-playing-dock">
                <div className="jumanji-turn-indicator">
                  <div
                    className="jumanji-player-avatar-circle"
                    style={{
                      backgroundColor: activePlayer?.color || "#3b82f6",
                    }}
                  >
                    {activePlayer?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="jumanji-turn-label">Hozirgi navbat:</span>
                    <strong className="jumanji-turn-name">
                      {isMyTurn
                        ? "Sizning navbatingiz! 🎯"
                        : activePlayer?.name}
                    </strong>
                  </div>
                </div>

                <div className="jumanji-dice-controls">
                  <div
                    className={`jumanji-dice-box ${isRolling ? "rolling" : ""}`}
                  >
                    <DiceComponent size={36} className="dice-react-icon" />
                  </div>

                  <button
                    className={`jumanji-roll-btn ${isMyTurn && !isMoving ? "active-glow" : ""}`}
                    onClick={handleRollDice}
                    disabled={!isMyTurn || isRolling || isMoving}
                  >
                    <FaDice size={20} />
                    <span>
                      {isRolling
                        ? "Tashlanmoqda..."
                        : isMoving
                          ? "Harakatlanmoqda..."
                          : "Zarni Tashlash"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {room?.status === "FINISHED" && (
              <div className="jumanji-finished-dock">
                <div className="jumanji-winner-card">
                  <IoSparkles className="sparkle-gold" size={26} />
                  <div>
                    <span>G'olib:</span>
                    <strong>🏆 {room?.winner?.name} (JUMANJI!)</strong>
                  </div>
                </div>
                {amIHost && (
                  <button
                    className="jumanji-btn-primary"
                    onClick={handleRestartGame}
                  >
                    <IoRefresh size={20} /> Qayta O'ynash
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* O'NG / MOBILDA PASTKI PANEL: O'YINCHILAR RO'YXATI */}
        <aside className="jumanji-sidebar-panel">
          <div className="jumanji-sidebar-box">
            <div className="jumanji-box-header">
              <IoPeople />
              <h3>Qatnashuvchilar ({room?.players?.length || 0})</h3>
            </div>
            <div className="jumanji-players-list">
              {room?.players?.map((p, idx) => {
                const isCurrent = p.id === activePlayer?.id;
                const isMe = p.id === myPlayerId;
                const currentPos = Math.round(
                  animatedPositions[p.id] !== undefined
                    ? animatedPositions[p.id]
                    : p.position || 0,
                );
                return (
                  <div
                    key={p.id || idx}
                    className={`jumanji-player-item ${isCurrent ? "active-player-item" : ""}`}
                  >
                    <div
                      className="jumanji-player-dot"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="jumanji-player-info">
                      <div className="jumanji-player-name">
                        <span>{p.name}</span>
                        {isMe && <span className="jumanji-me-tag">Siz</span>}
                        {p.isHost && (
                          <span className="jumanji-host-tag">Host</span>
                        )}
                      </div>
                      <div className="jumanji-player-status">
                        Katak: <b>{currentPos}</b> / 39
                        {p.skipTurn && (
                          <span className="trap-tag">🕸️ Tuzoqda</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
