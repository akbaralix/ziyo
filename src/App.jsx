import { useState } from "react";
import { useLocation } from "react-router-dom";
import Router from "./router/router.jsx";
import Navbar from "./pages/navbar/navbar.jsx";
import "./App.css";
const NO_NAVBAR_PAGES = ["/login"];

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const isQuizFullScreen =
    location.pathname.startsWith("/quiz/host") ||
    location.pathname.startsWith("/live") ||
    location.pathname.startsWith("/quiz/live") ||
    location.pathname.startsWith("/quiz/builder");

  const showNavbar = !NO_NAVBAR_PAGES.includes(location.pathname) && !isQuizFullScreen;


  return (
    <div className="app-layout">
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
