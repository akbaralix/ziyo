import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  IoArrowBack,
  IoPlay,
  IoRefreshOutline,
  IoSettingsOutline,
  IoTrophyOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoHelpCircleOutline,
  IoSparkles,
  IoClose,
} from "react-icons/io5";
import { toast } from "react-toastify";
import SpinWheel from "./SpinWheel.jsx";
import { sfx } from "../../../utils/soundEffects.js";
import "./BarabanPlay.css";

export default function BarabanPlay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const wheelRef = useRef(null);

  const [game, setGame] = useState(null);
  const [activeNames, setActiveNames] = useState([]);
  const [removedNames, setRemovedNames] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);

  // Winner & Question Modal states
  const [winner, setWinner] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answeredQuestion, setAnsweredQuestion] = useState(false);
  const [askedQuestionIndexes, setAskedQuestionIndexes] = useState([]);

  // Load game from localStorage
  useEffect(() => {
    let saved = null;
    if (id) {
      saved = localStorage.getItem(`ziyo_baraban_${id}`);
    }
    if (!saved) {
      saved = localStorage.getItem("ziyo_active_baraban");
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGame(parsed);
        setActiveNames(Array.isArray(parsed.names) ? parsed.names : []);
      } catch (e) {
        console.error(e);
      }
    } else {
      // Default fallback
      const defaultGame = {
        id: "demo",
        title: "Aylanuvchi Baraban",
        names: [],
        removeWinner: true,
        questions: [],
      };
      setGame(defaultGame);
      setActiveNames([]);
    }
  }, [id]);

  const handleSpinStart = () => {
    setIsSpinning(true);
    setWinner(null);
  };

  const handleSpinEnd = (winningName, winnerIndex) => {
    setIsSpinning(false);
    setWinner(winningName);
    setShowWinnerModal(true);

    // Fanfare sound
    sfx.playFanfare();

    // Confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}

    // Prepare question if questions exist
    if (game?.questions && game.questions.length > 0) {
      // pick question not yet asked if possible
      const availableIndexes = game.questions
        .map((_, idx) => idx)
        .filter((idx) => !askedQuestionIndexes.includes(idx));

      const chosenIdx =
        availableIndexes.length > 0
          ? availableIndexes[Math.floor(Math.random() * availableIndexes.length)]
          : Math.floor(Math.random() * game.questions.length);

      setCurrentQuestion(game.questions[chosenIdx]);
      setAskedQuestionIndexes((prev) => [...prev, chosenIdx]);
      setSelectedAnswer(null);
      setAnsweredQuestion(false);
    } else {
      setCurrentQuestion(null);
    }
  };

  const handleCloseWinnerModal = () => {
    setShowWinnerModal(false);

    // Apply rule: if removeWinner is true, remove from active names
    if (game?.removeWinner && winner) {
      setActiveNames((prev) => prev.filter((n) => n !== winner));
      setRemovedNames((prev) => [...prev, winner]);
      toast.info(`"${winner}" keyingi aylanish uchun barabandan olib tashlandi.`);
    }
    setWinner(null);
    setCurrentQuestion(null);
  };

  const handleAnswerSelect = (optionIndex) => {
    if (answeredQuestion) return;
    setSelectedAnswer(optionIndex);
    setAnsweredQuestion(true);

    if (optionIndex === currentQuestion?.correctAnswer) {
      sfx.playCorrect();
      toast.success("To'g'ri javob! 🎉");
    } else {
      sfx.playWrong();
      toast.error("Noto'g'ri javob!");
    }
  };

  const handleResetAllNames = () => {
    if (game?.names) {
      setActiveNames([...game.names]);
      setRemovedNames([]);
      setAskedQuestionIndexes([]);
      toast.success("Barcha qatnashchilar barabanga qaytarildi!");
    }
  };

  const triggerSpin = () => {
    if (isSpinning || activeNames.length === 0) return;
    wheelRef.current?.spin();
  };

  return (
    <div className="baraban-play-page">
      {/* Play Header */}
      <div className="baraban-play-header">
        <div className="play-header-left">
          <button
            type="button"
            className="baraban-circle-btn"
            onClick={() => navigate("/oyinlar")}
            title="O'yinlarga qaytish"
          >
            <IoArrowBack />
          </button>
          <div>
            <h1 className="play-title">{game?.title || "Aylanuvchi Baraban"}</h1>
            <div className="play-meta-tags">
              <span className="play-badge">
                {activeNames.length} ta qatnashchi faol
              </span>
              <span className="play-badge secondary">
                {game?.removeWinner
                  ? "Tushgan ism olib tashlanadi"
                  : "Ism barabanda qoladi"}
              </span>
              {game?.questions?.length > 0 && (
                <span className="play-badge info">
                  {game.questions.length} ta test savoli
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="play-header-actions">
          <button
            type="button"
            className="baraban-secondary-btn"
            onClick={handleResetAllNames}
            title="Ismlarni qaytarish"
          >
            <IoRefreshOutline /> Qayta yuklash
          </button>

          <button
            type="button"
            className="baraban-secondary-btn"
            onClick={() =>
              navigate(`/oyinlar/baraban/create${game?.id ? `?id=${game.id}` : ""}`)
            }
          >
            <IoSettingsOutline /> Tahrirlash
          </button>
        </div>
      </div>

      {/* Main Play Arena */}
      <div className="baraban-play-arena">
        {/* Wheel Center */}
        <div className="play-wheel-box">
          <div className="wheel-stage">
            <SpinWheel
              ref={wheelRef}
              items={activeNames}
              size={420}
              onSpinStart={handleSpinStart}
              onSpinEnd={handleSpinEnd}
              disabled={isSpinning || activeNames.length === 0}
            />
          </div>

          <div className="play-controls-box">
            {activeNames.length === 0 ? (
              <div className="all-finished-notice">
                <p>
                  {game?.names?.length > 0
                    ? "Barcha qatnashchilar tanlandi! 🎉"
                    : "Barabanda hali qatnashchilar yo'q."}
                </p>
                {game?.names?.length > 0 ? (
                  <button
                    type="button"
                    className="baraban-primary-btn"
                    onClick={handleResetAllNames}
                  >
                    <IoRefreshOutline /> Ro'yxatni yangidan boshlash
                  </button>
                ) : (
                  <button
                    type="button"
                    className="baraban-primary-btn"
                    onClick={() =>
                      navigate(
                        `/oyinlar/baraban/create${game?.id ? `?id=${game.id}` : ""}`
                      )
                    }
                  >
                    <IoSettingsOutline /> Qatnashchi qo'shish
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="baraban-primary-btn big-spin-btn"
                disabled={isSpinning || activeNames.length === 0}
                onClick={triggerSpin}
              >
                <IoPlay /> {isSpinning ? "Aylanmoqda..." : "Barabanni aylantirish"}
              </button>
            )}
          </div>
        </div>

        {/* Side Panel: Active & Removed Participants */}
        <div className="play-sidebar-panel">
          <div className="baraban-card sidebar-card">
            <h3 className="sidebar-section-title">
              Barabandagi ismlar ({activeNames.length})
            </h3>
            <div className="play-names-list">
              {activeNames.map((name, i) => (
                <span key={i} className="play-name-pill">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {game?.removeWinner && removedNames.length > 0 && (
            <div className="baraban-card sidebar-card">
              <h3 className="sidebar-section-title text-muted">
                Tanlab bo'linganlar ({removedNames.length})
              </h3>
              <div className="play-names-list">
                {removedNames.map((name, i) => (
                  <span key={i} className="play-name-pill strike">
                    ✓ {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Winner / Question Modal */}
      {showWinnerModal && (
        <div className="baraban-modal-backdrop">
          <div className="baraban-modal-card winner-modal-card">
            <div className="winner-modal-top">
              <span className="winner-trophy-icon">
                <IoTrophyOutline />
              </span>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseWinnerModal}
              >
                <IoClose />
              </button>
            </div>

            <div className="winner-content">
              <span className="winner-announce-sub">G'olib tanlandi!</span>
              <h2 className="winner-name-highlight">{winner}</h2>

              {currentQuestion && (
                <div className="winner-question-card">
                  <div className="question-header-tag">
                    <IoHelpCircleOutline /> {winner} uchun test savoli:
                  </div>
                  <h3 className="question-main-text">{currentQuestion.question}</h3>

                  <div className="question-options-list">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = selectedAnswer === idx;
                      const isCorrect = idx === currentQuestion.correctAnswer;
                      let statusClass = "";
                      if (answeredQuestion) {
                        if (isCorrect) statusClass = "is-correct-answer";
                        else if (isSelected) statusClass = "is-wrong-answer";
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`play-opt-btn ${statusClass}`}
                          disabled={answeredQuestion}
                          onClick={() => handleAnswerSelect(idx)}
                        >
                          <span className="opt-char">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="opt-text">{opt}</span>
                          {answeredQuestion && isCorrect && (
                            <IoCheckmarkCircle className="opt-status-icon success" />
                          )}
                          {answeredQuestion && isSelected && !isCorrect && (
                            <IoCloseCircle className="opt-status-icon error" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer winner-footer">
              <button
                type="button"
                className="baraban-primary-btn winner-next-btn"
                onClick={handleCloseWinnerModal}
              >
                Davom etish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
