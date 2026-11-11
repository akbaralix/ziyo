import React, { useRef, useEffect } from "react";

// 40 ta katakni ilon (snaking) ko'rinishida taqsimlash
// 8 ustun x 5 qator (jami 40 katak: 0 dan 39 gacha)
const COLS = 8;
const ROWS = 5;

export default function JumanjiCanvas({
  tiles = [],
  players = [],
  activePlayerId = null,
  diceValue = null,
  isRolling = false,
  lastEvent = null,
  animatedPositions = {}, // { [playerId]: currentFloatPosition }
}) {
  const canvasRef = useRef(null);

  // Har bir katakning markaziy koordinatasini topish
  const getTileGridPos = (index) => {
    const row = Math.floor(index / COLS);
    const colInRow = index % COLS;
    const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
    return { col, row };
  };

  const getExactCoords = (floatPos, paddingX, paddingY, cellW, cellH) => {
    const baseIndex = Math.floor(floatPos);
    const nextIndex = Math.min(tiles.length - 1, baseIndex + 1);
    const t = floatPos - baseIndex;

    const p1 = getTileGridPos(baseIndex);
    const p2 = getTileGridPos(nextIndex);

    const x1 = paddingX + p1.col * cellW + cellW / 2;
    const y1 = paddingY + p1.row * cellH + cellH / 2;
    const x2 = paddingX + p2.col * cellW + cellW / 2;
    const y2 = paddingY + p2.row * cellH + cellH / 2;

    // Silliq sakrash effekti (Jump arc / parabola)
    const jumpOffset = Math.sin(t * Math.PI) * (cellH * 0.35);

    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t - jumpOffset;

    return { x, y, jumping: jumpOffset > 2 };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const isMobile = width < 600;

      // Qadimiy o'rmon doskasi uchun chuqur yashil fon
      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#36543a");
      bgGrad.addColorStop(0.5, "#243d2b");
      bgGrad.addColorStop(1, "#172a20");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Nozik o'rmon naqshlari / chiziqlari (Light pattern)
      ctx.strokeStyle = "rgba(207, 177, 105, 0.09)";
      ctx.lineWidth = 1.5;
      for (let r = 30; r < Math.max(width, height); r += (isMobile ? 50 : 70)) {
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Doska o'lchamlari (Mobil moslashuvchan)
      const paddingX = isMobile ? 12 : 28;
      const paddingY = isMobile ? 12 : 28;
      const boardW = width - paddingX * 2;
      const boardH = height - paddingY * 2;
      const cellW = boardW / COLS;
      const cellH = boardH / ROWS;

      // 2. Kataklar orasidagi bog'lovchi yo'l chizig'i
      ctx.beginPath();
      ctx.strokeStyle = "rgba(225, 190, 113, 0.48)";
      ctx.lineWidth = isMobile ? 4 : 7;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(isMobile ? [6, 5] : [10, 8]);

      for (let i = 0; i < tiles.length; i++) {
        const { col, row } = getTileGridPos(i);
        const x = paddingX + col * cellW + cellW / 2;
        const y = paddingY + row * cellH + cellH / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Katakchalarni chizish
      tiles.forEach((tile, idx) => {
        const { col, row } = getTileGridPos(idx);
        const cx = paddingX + col * cellW + cellW / 2;
        const cy = paddingY + row * cellH + cellH / 2;
        const tileSize = Math.min(cellW, cellH) * (isMobile ? 0.88 : 0.84);
        const x = cx - tileSize / 2;
        const y = cy - tileSize / 2;
        const radius = isMobile ? 6 : 10;

        let fill = "#d8c797";
        let stroke = "#927648";
        let textColor = "#3c3424";
        let shadowColor = "rgba(0, 0, 0, 0.38)";

        if (tile.type === "start") {
          fill = "#426342";
          stroke = "#c8aa63";
          textColor = "#fff0bd";
        } else if (tile.type === "finish") {
          fill = "#8c642c";
          stroke = "#f5d681";
          textColor = "#fff0bd";
          shadowColor = "rgba(234, 179, 8, 0.42)";
        } else if (tile.type === "bomb") {
          fill = "#733f32";
          stroke = "#d47b57";
          textColor = "#ffe2bd";
        } else if (tile.type === "backward") {
          fill = "#80502e";
          stroke = "#d6a15d";
          textColor = "#ffebc2";
        } else if (tile.type === "forward") {
          fill = "#49663b";
          stroke = "#a8bd69";
          textColor = "#f3e9bd";
        } else if (tile.type === "trap") {
          fill = "#756039";
          stroke = "#d9bd69";
          textColor = "#fff0bd";
        } else if (tile.type === "mystery") {
          fill = "#55425c";
          stroke = "#b895c7";
          textColor = "#f4dfff";
        }

        ctx.save();
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = isMobile ? 3 : 6;
        ctx.shadowOffsetY = isMobile ? 1 : 2;

        ctx.beginPath();
        ctx.roundRect(x, y, tileSize, tileSize, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = isMobile ? 1.5 : 2.5;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        ctx.restore();

        // Katak ichidagi yozuvlar
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (tile.type === "finish") {
          ctx.font = `bold ${isMobile ? 8 : 12}px system-ui`;
          ctx.fillStyle = "#b45309";
          ctx.fillText("JUMANJI", cx, cy - (isMobile ? 5 : 8));
          ctx.font = `${isMobile ? 12 : 18}px system-ui`;
          ctx.fillText("🏆", cx, cy + (isMobile ? 7 : 12));
        } else if (tile.type === "start") {
          ctx.font = `bold ${isMobile ? 8 : 11}px system-ui`;
          ctx.fillStyle = "#047857";
          ctx.fillText("START", cx, cy - (isMobile ? 5 : 6));
          ctx.font = `${isMobile ? 11 : 16}px system-ui`;
          ctx.fillText("🏕️", cx, cy + (isMobile ? 6 : 10));
        } else if (tile.type === "bomb") {
          ctx.font = `bold ${isMobile ? 9 : 11}px system-ui`;
          ctx.fillStyle = "#dc2626";
          ctx.fillText(isMobile ? "💣" : `${idx} | 💣`, cx, cy - (isMobile ? 4 : 7));
          ctx.font = `bold ${isMobile ? 8 : 12}px system-ui`;
          ctx.fillStyle = "#ef4444";
          ctx.fillText(`${tile.steps}`, cx, cy + (isMobile ? 6 : 9));
        } else if (tile.type === "forward") {
          ctx.font = `bold ${isMobile ? 8 : 11}px system-ui`;
          ctx.fillStyle = "#16a34a";
          ctx.fillText(`${idx}`, cx, cy - (isMobile ? 4 : 7));
          ctx.font = `bold ${isMobile ? 9 : 13}px system-ui`;
          ctx.fillText(`+${tile.steps}`, cx, cy + (isMobile ? 6 : 9));
        } else if (tile.type === "backward") {
          ctx.font = `bold ${isMobile ? 8 : 11}px system-ui`;
          ctx.fillStyle = "#ea580c";
          ctx.fillText(`${idx}`, cx, cy - (isMobile ? 4 : 7));
          ctx.font = `bold ${isMobile ? 9 : 13}px system-ui`;
          ctx.fillText(`${tile.steps}`, cx, cy + (isMobile ? 6 : 9));
        } else if (tile.type === "trap") {
          ctx.font = `bold ${isMobile ? 8 : 11}px system-ui`;
          ctx.fillStyle = "#ca8a04";
          ctx.fillText(`${idx}`, cx, cy - (isMobile ? 4 : 7));
          ctx.font = `${isMobile ? 11 : 16}px system-ui`;
          ctx.fillText(tile.label, cx, cy + (isMobile ? 6 : 9));
        } else if (tile.type === "mystery") {
          ctx.font = `bold ${isMobile ? 8 : 11}px system-ui`;
          ctx.fillStyle = "#9333ea";
          ctx.fillText(`${idx}`, cx, cy - (isMobile ? 4 : 7));
          ctx.font = `${isMobile ? 11 : 16}px system-ui`;
          ctx.fillText("🎁", cx, cy + (isMobile ? 6 : 9));
        } else {
          ctx.font = `bold ${isMobile ? 10 : 13}px system-ui`;
          ctx.fillStyle = "#64748b";
          ctx.fillText(`${idx}`, cx, cy);
        }
      });

      // 4. O'yinchilarni chizish
      const occupantsMap = {};
      players.forEach((p) => {
        const floatPos = animatedPositions[p.id] !== undefined ? animatedPositions[p.id] : p.position || 0;
        const currentIntPos = Math.round(floatPos);
        if (!occupantsMap[currentIntPos]) occupantsMap[currentIntPos] = [];
        occupantsMap[currentIntPos].push(p);
      });

      players.forEach((player) => {
        const floatPos = animatedPositions[player.id] !== undefined ? animatedPositions[player.id] : player.position || 0;
        const { x: cx, y: cy, jumping } = getExactCoords(floatPos, paddingX, paddingY, cellW, cellH);

        const currentIntPos = Math.round(floatPos);
        const group = occupantsMap[currentIntPos] || [player];
        const pIdx = group.findIndex((g) => g.id === player.id);
        const count = group.length;

        let offsetX = 0;
        let offsetY = 0;
        const spreadRadius = isMobile ? 8 : 14;
        if (count > 1 && !jumping) {
          const angle = (pIdx / count) * Math.PI * 2;
          offsetX = Math.cos(angle) * spreadRadius;
          offsetY = Math.sin(angle) * spreadRadius;
        }

        const px = cx + offsetX;
        const py = cy + offsetY;

        const isTurn = player.id === activePlayerId;
        const pRadius = isMobile ? 9 : 14;

        // O'yinchi soyasi
        ctx.save();
        ctx.beginPath();
        const shadowScale = jumping ? 0.7 : 1;
        ctx.ellipse(cx + offsetX, cy + offsetY + (jumping ? (isMobile ? 12 : 18) : (isMobile ? 6 : 9)), (isMobile ? 7 : 11) * shadowScale, (isMobile ? 3 : 5) * shadowScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
        ctx.fill();
        ctx.restore();

        // O'yinchi doirasi
        ctx.save();
        if (isTurn) {
          ctx.shadowColor = "rgba(234, 179, 8, 0.75)";
          ctx.shadowBlur = isMobile ? 8 : 14;
        } else {
          ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
          ctx.shadowBlur = 4;
        }

        ctx.beginPath();
        ctx.arc(px, py, pRadius, 0, Math.PI * 2);
        ctx.fillStyle = player.color || "#3b82f6";
        ctx.fill();
        ctx.lineWidth = isTurn ? (isMobile ? 2 : 3) : 1.5;
        ctx.strokeStyle = isTurn ? "#f5d681" : "#e7d7aa";
        ctx.stroke();

        // Bosh harf
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${isMobile ? 8 : 11}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const initial = (player.name || "P").charAt(0).toUpperCase();
        ctx.fillText(initial, px, py);

        if (player.skipTurn) {
          ctx.font = `${isMobile ? 8 : 10}px system-ui`;
          ctx.fillText("🕸️", px + (isMobile ? 7 : 10), py - (isMobile ? 7 : 10));
        }

        ctx.restore();

        // O'yinchi ismi yorlig'i (Mobil ekranda juda ixcham yoki faqat faol bo'lsa)
        if (!isMobile || isTurn) {
          ctx.save();
          ctx.fillStyle = "#f1e5c4";
          ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
          ctx.shadowBlur = 3;
          const maxLetters = isMobile ? 6 : 8;
          const nameText = player.name.length > maxLetters ? player.name.slice(0, maxLetters - 1) + ".." : player.name;
          ctx.font = `bold ${isMobile ? 7 : 9}px system-ui`;
          const textW = ctx.measureText(nameText).width;
          const labelH = isMobile ? 12 : 15;
          const labelY = py + pRadius + 2;

          ctx.beginPath();
          ctx.roundRect(px - textW / 2 - 3, labelY, textW + 6, labelH, 4);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#a68b54";
          ctx.stroke();

          ctx.fillStyle = isTurn ? "#b45309" : "#1e293b";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(nameText, px, labelY + labelH / 2);
          ctx.restore();
        }
      });
    };

    render();

    const handleResize = () => {
      if (canvas.parentElement) {
        const parentW = canvas.parentElement.clientWidth;
        const parentH = canvas.parentElement.clientHeight || 450;
        canvas.width = Math.max(300, parentW);
        canvas.height = Math.max(350, Math.min(600, parentH));
        render();
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [tiles, players, activePlayerId, diceValue, isRolling, lastEvent, animatedPositions]);

  return (
    <div className="jumanji-canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={900}
        height={540}
        className="jumanji-game-canvas"
      />
    </div>
  );
}
