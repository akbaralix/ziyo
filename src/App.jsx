import { useState } from "react";
import { useLocation } from "react-router-dom";
import Router from "./router/router.jsx";
import Navbar from "./pages/navbar/navbar.jsx";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
const NO_NAVBAR_PAGES = ["/login"];

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const isQuizFullScreen =
    location.pathname.startsWith("/quiz/host") ||
    location.pathname.startsWith("/live") ||
    location.pathname.startsWith("/quiz/live") ||
    location.pathname.startsWith("/quiz/builder") ||
    location.pathname.startsWith("/oktagon/battle");

  const showNavbar = !NO_NAVBAR_PAGES.includes(location.pathname) && !isQuizFullScreen;

  return (
    <div className="app-layout">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      {showNavbar && (
        <Navbar
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed((prev) => !prev)}
        />
      )}
      <main className="app-content">
        <Router />
      </main>
    </div>
  );
}

export default App;
