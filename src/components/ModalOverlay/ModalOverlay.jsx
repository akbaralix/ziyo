import { useEffect } from "react";
import ReactDOM from "react-dom"; // 👈 Mana shu qator yetishmayotgan edi
import "./ModalOverlay.css";

function ModalOverlay({
  isOpen = true,
  onClose,
  children,
  className = "",
  style = {},
  closeOnClickOutside = true,
  ...props
}) {
  useEffect(() => {
    if (!isOpen) return;

    // Oldingi scroll stillarini saqlash
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;

    // Sahifaning hozirgi scroll holatini saqlash
    const scrollY = window.scrollY;

    // Orqa sahifa scrollini bloklash
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // Mobil brauzerlarda orqa sahifa siljishini oldini olish
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    // ESC tugmasi bilan modalni yopish
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      // Oldingi stillarni tiklash
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;

      // Modal ochilishidan oldingi scroll joyiga qaytish
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnClickOutside && onClose) {
      onClose();
    }
  };

  return ReactDOM.createPortal(
    <div
      className={`modal-overlay-container ${className}`.trim()}
      style={style}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export default ModalOverlay;
