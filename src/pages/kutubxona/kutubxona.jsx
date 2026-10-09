import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  IoSearchOutline,
  IoBookmarkOutline,
  IoBookmark,
  IoMoonOutline,
  IoSunnyOutline,
  IoExpandOutline,
  IoContractOutline,
  IoCloseOutline,
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoAddOutline,
  IoRemoveOutline,
  IoSparklesOutline,
  IoTimeOutline,
  IoBookOutline,
  IoStar,
  IoDownloadOutline,
  IoAlertCircleOutline,
} from "react-icons/io5";
import { FaBookOpen, FaGlasses } from "react-icons/fa";
import { BOOKS_DATA } from "./booksData";
import "./kutubxona.css";

// PDF.js worker sozlamalari (Local bundle worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CATEGORIES = [
  "Barchasi",
  "Badiiy adabiyot",
  "Tarixiy",
  "Sarguzasht",
  "Rivojlanish",
  "Dasturlash",
];

function Kutubxona() {
  // Kutubxona holatlari
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookProgress, setBookProgress] = useState({});

  // PDF Reader holatlari
  const [activeBook, setActiveBook] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomScale, setZoomScale] = useState(1.2);
  const [theme, setTheme] = useState("light"); // 'light' | 'dark' | 'sepia'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [pageInputValue, setPageInputValue] = useState("1");

  const canvasRef = useRef(null);
  const readerContainerRef = useRef(null);
  const renderTaskRef = useRef(null);

  // LocalStorage dan progressni olish
  useEffect(() => {
    const progressMap = {};
    BOOKS_DATA.forEach((book) => {
      const savedPage = localStorage.getItem(`ziyo_last_page_${book.id}`);
      if (savedPage) {
        progressMap[book.id] = parseInt(savedPage, 10);
      }
    });
    setBookProgress(progressMap);
  }, []);

  // Sahifani render qilish funksiyasi
  const renderPage = useCallback(async (pageNum, pdf, scale) => {
    if (!pdf || !canvasRef.current) return;

    setIsRenderingPage(true);
    setRenderError(null);

    try {
      // Oldingi render vazifasini bekor qilish
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      // Ekran kengligiga moslash
      const isMobile = window.innerWidth <= 768;
      const adjustedScale = isMobile ? Math.min(scale, 0.85) : scale;

      const viewport = page.getViewport({ scale: adjustedScale });

      // HiDPI (Retina) aniqligi
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";

      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      setIsRenderingPage(false);
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Sahifa chizishda xatolik:", err);
        setRenderError("Sahifani ko'rsatishda xatolik yuz berdi");
      }
      setIsRenderingPage(false);
    }
  }, []);

  // Kitobni ochish
  const handleOpenBook = async (book) => {
    setActiveBook(book);
    setIsLoadingPdf(true);
    setRenderError(null);

    const savedLastPage = localStorage.getItem(`ziyo_last_page_${book.id}`);
    const initialPage = savedLastPage ? parseInt(savedLastPage, 10) : 1;
    setCurrentPage(initialPage);
    setPageInputValue(String(initialPage));

    const savedBookmarks = localStorage.getItem(`ziyo_bookmarks_${book.id}`);
    setBookmarks(savedBookmarks ? JSON.parse(savedBookmarks) : []);

    try {
      const loadingTask = pdfjsLib.getDocument({
        url: book.pdfUrl,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
      });

      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setIsLoadingPdf(false);

      // DOM da canvas tayyor bo'lishi uchun qisqa vaqt kutib render qilamiz
      setTimeout(() => {
        renderPage(initialPage, pdf, zoomScale);
      }, 50);
    } catch (error) {
      console.error("PDF yuklashda xatolik:", error);
      setRenderError("PDF faylni yuklab bo'lmadi");
      setIsLoadingPdf(false);
    }
  };

  // Kitobni yopish
  const handleCloseBook = () => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
    }
    setActiveBook(null);
    setPdfDoc(null);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
  };

  // Sahifa yoki zoom o'zgarganda qayta chizish
  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage, pdfDoc, zoomScale);

      // Oxirgi sahifani saqlash
      if (activeBook) {
        localStorage.setItem(
          `ziyo_last_page_${activeBook.id}`,
          String(currentPage),
        );
        setBookProgress((prev) => ({
          ...prev,
          [activeBook.id]: currentPage,
        }));
      }
    }
  }, [pdfDoc, currentPage, zoomScale, renderPage, activeBook]);

  // Sahifa navigatsiyasi
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInputValue(String(newPage));
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInputValue(String(newPage));
    }
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(pageInputValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  // Zoom boshqaruvi
  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.2, 2.4));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(prev - 0.2, 0.6));
  };

  const handleResetZoom = () => {
    setZoomScale(1.2);
  };

  // Fullscreen boshqaruvi
  const handleToggleFullscreen = () => {
    if (!readerContainerRef.current) return;

    if (!document.fullscreenElement) {
      readerContainerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch(() => {});
    }
  };

  // Bookmark qo'shish / o'chirish
  const handleToggleBookmark = () => {
    if (!activeBook) return;

    let updated;
    if (bookmarks.includes(currentPage)) {
      updated = bookmarks.filter((p) => p !== currentPage);
    } else {
      updated = [...bookmarks, currentPage].sort((a, b) => a - b);
    }

    setBookmarks(updated);
    localStorage.setItem(
      `ziyo_bookmarks_${activeBook.id}`,
      JSON.stringify(updated),
    );
  };

  // Klaviatura hodisalarini tinglash
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeBook) return;
      if (e.key === "ArrowLeft") handlePrevPage();
      if (e.key === "ArrowRight") handleNextPage();
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeBook, currentPage, totalPages, isFullscreen]);

  // Kitoblarni filtrlash
  const filteredBooks = BOOKS_DATA.filter((book) => {
    const matchCategory =
      selectedCategory === "Barchasi" || book.category === selectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="kutubxona-page">
      {!activeBook && (
        <>
          <div className="kutubxona-controls">
            <div className="kutubxona-search-bar">
              <IoSearchOutline className="search-icon" />
              <input
                type="text"
                placeholder="Kitob nomi yoki muallifni qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="kutubxona-categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-pill ${
                    selectedCategory === cat ? "active" : ""
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ---------------- BOOKS GRID ---------------- */}
          <div className="books-grid-section">
            <h2 className="section-heading">
              {selectedCategory === "Barchasi"
                ? "Barcha kitoblar"
                : `${selectedCategory} kitoblari`}{" "}
              <span className="count-tag">({filteredBooks.length})</span>
            </h2>

            <div className="books-grid">
              {filteredBooks.map((book) => {
                const lastPage = bookProgress[book.id];
                const progressPercent = lastPage
                  ? Math.min(Math.round((lastPage / book.pages) * 100), 100)
                  : 0;

                return (
                  <div className="book-card" key={book.id}>
                    {/* 3D Kitob Muqovasi */}
                    <div
                      className="book-cover"
                      onClick={() => handleOpenBook(book)}
                    >
                      <img src={book.img} alt="" />
                      <div className="book-spine" />
                      <div className="book-cover-content">
                        <span className="book-badge">{book.badge}</span>
                        <h3 className="book-cover-title">{book.title}</h3>
                        <p className="book-cover-author">{book.author}</p>
                        <div className="book-cover-meta">
                          <span>{book.pages} bet</span>
                          <span>•</span>
                          <span>{book.year}</span>
                        </div>
                      </div>
                      <div className="book-cover-overlay">
                        <FaBookOpen className="read-icon" />
                        <span>Mutolaa qilish</span>
                      </div>
                    </div>

                    {/* Kitob ma'lumotlari */}
                    <div className="book-details">
                      <div className="book-header-row">
                        <span className="book-genre">{book.category}</span>
                        <div className="book-rating">
                          <IoStar className="star-icon" />
                          <span>{book.rating}</span>
                        </div>
                      </div>

                      <h3
                        className="book-title"
                        onClick={() => handleOpenBook(book)}
                      >
                        {book.title}
                      </h3>
                      <p className="book-author">{book.author}</p>
                      <p className="book-desc-short">{book.description}</p>

                      {/* O'qish progressi */}
                      {lastPage && (
                        <div className="reading-progress-box">
                          <div className="progress-info">
                            <span className="last-page-text">
                              <IoTimeOutline /> {lastPage}-sahifagacha o'qilgan
                            </span>
                            <span className="percent-text">
                              {progressPercent}%
                            </span>
                          </div>
                          <div className="progress-bar-bg">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Amallar */}
                      <div className="book-actions">
                        <button
                          type="button"
                          className="read-book-btn"
                          onClick={() => handleOpenBook(book)}
                        >
                          <FaBookOpen />
                          <span>
                            {lastPage ? "Davom ettirish" : "O'qishni boshlash"}
                          </span>
                        </button>
                        <a
                          href={book.pdfUrl}
                          download={`${book.title}.pdf`}
                          className="download-book-btn"
                          title="Yuklab olish"
                        >
                          <IoDownloadOutline />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ---------------- ONLAYN KITOB O'QISH (PDF READER) ---------------- */}
      {activeBook && (
        <div
          className={`book-reader-view ${theme} ${
            isFullscreen ? "is-fullscreen" : ""
          }`}
          ref={readerContainerRef}
        >
          {/* Top Reader Toolbar */}
          <div className="reader-toolbar">
            <div className="toolbar-left">
              <button
                type="button"
                className="toolbar-btn close-btn"
                onClick={handleCloseBook}
                title="Chiqish"
              >
                <IoCloseOutline />
                <span className="hide-mobile">Kutubxonaga qaytish</span>
              </button>

              <div className="reader-book-info">
                <h3 className="reader-book-title">{activeBook.title}</h3>
                <span className="reader-book-author hide-mobile">
                  {activeBook.author}
                </span>
              </div>
            </div>

            {/* Sahifa boshqaruvi */}
            <div className="toolbar-center hide-mobile">
              <button
                type="button"
                className="page-nav-btn"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                title="Oldingi sahifa"
              >
                <IoArrowBackOutline />
              </button>

              <form
                onSubmit={handlePageInputSubmit}
                className="page-number-form"
              >
                <input
                  type="text"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  className="page-num-input"
                  title="Sahifaga o'tish uchun yozing va Enter bosing"
                />
                <span className="page-total">/ {totalPages || "..."}</span>
              </form>

              <button
                type="button"
                className="page-nav-btn"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                title="Keyingi sahifa"
              >
                <IoArrowForwardOutline />
              </button>
            </div>

            {/* O'ng tomon: Zoom, Theme, Bookmark, Fullscreen */}
            <div className="toolbar-right">
              {/* Zoom Controls */}
              <div className="zoom-controls ">
                <button
                  type="button"
                  className="toolbar-icon-btn"
                  onClick={handleZoomOut}
                  title="Kichraytirish"
                >
                  <IoRemoveOutline />
                </button>
                <span
                  className="zoom-level-text"
                  onClick={handleResetZoom}
                  title="100% ga qaytarish"
                >
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  className="toolbar-icon-btn"
                  onClick={handleZoomIn}
                  title="Kattalashtirish"
                >
                  <IoAddOutline />
                </button>
              </div>

              {/* Theme Toggle (Light / Dark / Sepia) */}
              <div className="theme-toggle-group">
                <button
                  type="button"
                  className={`theme-btn light ${
                    theme === "light" ? "active" : ""
                  }`}
                  onClick={() => setTheme("light")}
                  title="Yorug' rejim"
                >
                  <IoSunnyOutline />
                </button>
                <button
                  type="button"
                  className={`theme-btn sepia ${
                    theme === "sepia" ? "active" : ""
                  }`}
                  onClick={() => setTheme("sepia")}
                  title="Sepiya rejim"
                >
                  📜
                </button>
                <button
                  type="button"
                  className={`theme-btn dark ${
                    theme === "dark" ? "active" : ""
                  }`}
                  onClick={() => setTheme("dark")}
                  title="Tungi rejim"
                >
                  <IoMoonOutline />
                </button>
              </div>

              {/* Bookmark Button */}
              <button
                type="button"
                className={`toolbar-icon-btn ${
                  bookmarks.includes(currentPage) ? "bookmarked" : ""
                }`}
                onClick={handleToggleBookmark}
                title={
                  bookmarks.includes(currentPage)
                    ? "Xatcho'pni olib tashlash"
                    : "Xatcho'p qo'yish"
                }
              >
                {bookmarks.includes(currentPage) ? (
                  <IoBookmark />
                ) : (
                  <IoBookmarkOutline />
                )}
              </button>

              <button
                type="button"
                className="toolbar-icon-btn hide-mobile"
                onClick={() => setShowBookmarksPanel(!showBookmarksPanel)}
                title="Barcha xatcho'plar"
              >
                <span className="bookmark-count-badge">{bookmarks.length}</span>
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                className="toolbar-icon-btn hide-mobile"
                onClick={handleToggleFullscreen}
                title={
                  isFullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"
                }
              >
                {isFullscreen ? <IoContractOutline /> : <IoExpandOutline />}
              </button>
            </div>
          </div>

          {/* Bookmarks Drawer Modal */}
          {showBookmarksPanel && (
            <div className="bookmarks-drawer">
              <div className="drawer-header">
                <h4>Xatcho'plar ({bookmarks.length})</h4>
                <button
                  type="button"
                  onClick={() => setShowBookmarksPanel(false)}
                >
                  <IoCloseOutline />
                </button>
              </div>
              <div className="drawer-content">
                {bookmarks.length === 0 ? (
                  <p className="no-bookmarks">Hali xatcho'p qo'yilmagan.</p>
                ) : (
                  bookmarks.map((bm) => (
                    <button
                      key={bm}
                      type="button"
                      className={`bookmark-item-btn ${
                        bm === currentPage ? "current" : ""
                      }`}
                      onClick={() => {
                        setCurrentPage(bm);
                        setPageInputValue(String(bm));
                        setShowBookmarksPanel(false);
                      }}
                    >
                      <IoBookmark />
                      <span>{bm}-sahifa</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Reading Canvas Viewport */}
          <div className="reader-canvas-container">
            {isLoadingPdf && (
              <div className="pdf-loading-state">
                <div className="spinner" />
                <p>Kitob ochilmoqda...</p>
              </div>
            )}

            {renderError && (
              <div className="pdf-error-state">
                <IoAlertCircleOutline className="error-icon" />
                <p>{renderError}</p>
                <a
                  href={activeBook.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="fallback-open-btn"
                >
                  Brauzer oynasida ochish
                </a>
              </div>
            )}

            <div
              className={`canvas-wrapper ${
                isLoadingPdf || renderError ? "hidden" : ""
              }`}
            >
              <canvas ref={canvasRef} className="pdf-canvas" />
            </div>

            {/* Chap va o'ng bosish zonalari (Quick Click Navigation) */}
            {!isLoadingPdf && !renderError && (
              <>
                <div
                  className="page-click-zone left"
                  onClick={handlePrevPage}
                  title="Oldingi sahifaga o'tish"
                />
                <div
                  className="page-click-zone right"
                  onClick={handleNextPage}
                  title="Keyingi sahifaga o'tish"
                />
              </>
            )}
          </div>

          {/* Bottom Mobile Floating Navigation */}
          <div className="reader-mobile-bottom-bar">
            <button
              type="button"
              className="mobile-nav-action-btn"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <IoArrowBackOutline />
              <span>Oldingi</span>
            </button>

            <span className="mobile-page-indicator">
              {currentPage} / {totalPages || "..."}
            </span>

            <button
              type="button"
              className="mobile-nav-action-btn"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              <span>Keyingi</span>
              <IoArrowForwardOutline />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Kutubxona;
