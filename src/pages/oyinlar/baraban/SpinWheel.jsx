import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { sfx } from "../../../utils/soundEffects.js";

const WHEEL_COLORS = [
  "#4F46E5", // Indigo
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#3B82F6", // Blue
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#6366F1", // Violet
  "#84CC16", // Lime
];

const SpinWheel = forwardRef(function SpinWheel(
  {
    items = [],
    size = 380,
    onSpinStart,
    onSpinEnd,
    disabled = false,
  },
  ref,
) {
  const canvasRef = useRef(null);
  const rotationRef = useRef(0);
  const isSpinningRef = useRef(false);
  const animFrameRef = useRef(null);
  const lastTickSliceRef = useRef(-1);

  // Redraw whenever items or size changes
  useEffect(() => {
    drawWheel();
  }, [items, size]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = size;
    const height = size;
    const cx = width / 2;
    const cy = height / 2;
    const radius = width / 2 - 18; // margin for pointer and border

    ctx.clearRect(0, 0, width, height);

    const count = items.length;
    if (count === 0) {
      // Empty placeholder wheel
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "600 16px Poppins, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Qatnashchi qo'shing", cx, cy);
      return;
    }

    const sliceAngle = (2 * Math.PI) / count;
    const currentRotation = rotationRef.current;

    // Slices
    for (let i = 0; i < count; i++) {
      const startAngle = currentRotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();

      // Border between slices
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Radial text alignment
      const midAngle = startAngle + sliceAngle / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      // Dynamic font size depending on count and length
      const fontSize = count > 20 ? 11 : count > 12 ? 13 : count > 8 ? 14 : 16;
      ctx.font = `600 ${fontSize}px Poppins, sans-serif`;
      ctx.fillStyle = "#ffffff";

      // Text truncation
      const rawText = typeof items[i] === "object" ? items[i].name : String(items[i]);
      let text = rawText;
      const maxTextWidth = radius - 45;
      while (ctx.measureText(text).width > maxTextWidth && text.length > 3) {
        text = text.slice(0, -2) + "…";
      }

      ctx.fillText(text, radius - 22, 0);
      ctx.restore();
    }

    // Outer wheel ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = "#461fe2";
    ctx.fill();

    // Center star / symbol
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ZIYO", cx, cy);

    // Top Pointer Arrow
    drawPointer(ctx, cx, cy, radius);
  };

  const drawPointer = (ctx, cx, cy, radius) => {
    const pointerY = cy - radius - 2;
    const pointerSize = 18;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, pointerY + pointerSize + 8); // Tip pointing down into the wheel
    ctx.lineTo(cx - pointerSize / 2, pointerY);
    ctx.lineTo(cx + pointerSize / 2, pointerY);
    ctx.closePath();

    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.restore();
  };

  const getWinnerIndex = (rotation) => {
    const count = items.length;
    if (count === 0) return -1;
    const sliceAngle = (2 * Math.PI) / count;
    // Pointer is at top: 3 * Math.PI / 2
    const pointerAngle = (3 * Math.PI) / 2;
    let relative = (pointerAngle - rotation) % (2 * Math.PI);
    if (relative < 0) relative += 2 * Math.PI;
    return Math.floor(relative / sliceAngle) % count;
  };

  const spin = () => {
    if (disabled || isSpinningRef.current || items.length === 0) return;

    isSpinningRef.current = true;
    if (onSpinStart) onSpinStart();

    const startRotation = rotationRef.current;
    // Spin between 5 and 8 full turns + random angle
    const extraSpins = (5 + Math.random() * 3) * 2 * Math.PI;
    const randomOffset = Math.random() * 2 * Math.PI;
    const targetDelta = extraSpins + randomOffset;
    const duration = 4800; // 4.8 seconds
    const startTime = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      const currentRot = startRotation + targetDelta * eased;
      rotationRef.current = currentRot;

      // Sound tick on slice change
      const currentIdx = getWinnerIndex(currentRot);
      if (currentIdx !== lastTickSliceRef.current) {
        lastTickSliceRef.current = currentIdx;
        sfx.playTick(progress > 0.85);
      }

      drawWheel();

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        isSpinningRef.current = false;
        const winnerIndex = getWinnerIndex(currentRot);
        const winner = items[winnerIndex];
        if (onSpinEnd) {
          onSpinEnd(winner, winnerIndex);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useImperativeHandle(ref, () => ({
    spin,
    isSpinning: () => isSpinningRef.current,
    getCurrentWinnerIndex: () => getWinnerIndex(rotationRef.current),
  }));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        userSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          display: "block",
          maxWidth: "100%",
          height: "auto",
        }}
      />
    </div>
  );
});

export default SpinWheel;
