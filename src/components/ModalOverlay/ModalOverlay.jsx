import { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "./ModalOverlay.css";

// Ochiq modallar sonini kuzatish (Nested modallarda scroll buzilmasligi uchun)
let activeModalsCount = 0;
let preservedScrollY = 0;

const lockBodyScroll = () => {
  if (activeModalsCount === 0) {
    preservedScrollY = window.scrollY || window.pageYOffset || 0;

    // Scrollbar enini hisoblab olish (sahifa sakrab ketmasligi uchun)
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  activeModalsCount++;
};

const unlockBodyScroll = () => {
  activeModalsCount = Math.max(0, activeModalsCount - 1);

  if (activeModalsCount === 0) {
    // Barcha inline stillarni to'liq tozalash
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("position");
    document.body.style.removeProperty("top");
    document.body.style.removeProperty("width");
    document.body.style.removeProperty("padding-right");

    // Kafolatli fallback tozalash (ba'zi brauzerlarda removeProperty inline stillarni darhol tozalab ulgurmasligi mumkin)
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";

    // Oldingi scroll pozitsiyasini tiklash
    if (preservedScrollY !== undefined && preservedScrollY !== null) {
      window.scrollTo(0, preservedScrollY);
    }
  }
};

function ModalOverlay({
  isOpen = true,
  onClose,
  children,
  className = "",
  style = {},
  closeOnClickOutside = true,
  ...props
}) {
  const onCloseRef = useRef(onClose);

  // onClose o'zgarganda refni yangilab boramiz (useEffectni keraksiz ishga tushirmaslik uchun)
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onCloseRef.current) {
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnClickOutside && onCloseRef.current) {
      onCloseRef.current();
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
