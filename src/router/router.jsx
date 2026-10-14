import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/login/login.jsx";
import Home from "../pages/home/home.jsx";
import Create from "../pages/create/create.jsx";
import Profil from "../pages/profil/profil.jsx";
import Reytinglar from "../pages/reytinglar/reytinglar.jsx";
import Kutubxona from "../pages/kutubxona/kutubxona.jsx";
import QuizBuilder from "../pages/quiz/QuizBuilder.jsx";
import LiveHost from "../pages/quiz/LiveHost.jsx";
import LivePlayer from "../pages/quiz/LivePlayer.jsx";
import Oyinlar from "../pages/oyinlar/oyinlar.jsx";
import BarabanCreate from "../pages/oyinlar/baraban/BarabanCreate.jsx";
import BarabanPlay from "../pages/oyinlar/baraban/BarabanPlay.jsx";
import OctagonHome from "../pages/oktagon/OctagonHome.jsx";
import OctagonBattle from "../pages/oktagon/OctagonBattle.jsx";

function Router() {
  // FIX: token ni useState bilan kuzatamiz.
  // Oldingi kod: const token = localStorage.getItem("token")
  // Bu faqat render paytida bir marta o'qilardi.
  // Login bo'lganda localStorage yangilansa ham Router qayta render bo'lmasdi
  // → sahifa oq ko'rinardi. Endi setToken orqali reaktiv bo'ldi.
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    // Har 200ms da localStorage ni tekshirish
    // navigate() chaqirilgandan keyin token'ni darhol ushlash uchun
    const interval = setInterval(() => {
      const current = localStorage.getItem("token");
      setToken((prev) => (prev !== current ? current : prev));
    }, 200);

    // Boshqa tabda login/logout bo'lsa ham ushlash
    const handleStorage = () => {
      setToken(localStorage.getItem("token"));
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <Routes>
      {/* Login sahifasi */}
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Bosh sahifa */}
      <Route
        path="/"
        element={token ? <Home /> : <Navigate to="/login" replace />}
      />

      {/* Kutubxona sahifasi */}
      <Route
        path="/kutubxona"
        element={token ? <Kutubxona /> : <Navigate to="/login" replace />}
      />

      {/* Yaratish sahifasi */}
      <Route
        path="/yaratish"
        element={token ? <Create /> : <Navigate to="/login" replace />}
      />

      {/* Reytinglar sahifasi */}
      <Route
        path="/reytinglar"
        element={token ? <Reytinglar /> : <Navigate to="/login" replace />}
      />

      {/* Profil sahifasi */}
      <Route
        path="/profil"
        element={token ? <Profil /> : <Navigate to="/login" replace />}
      />

      <Route path="/create" element={<Navigate to="/yaratish" replace />} />

      <Route
        path="/oyinlar"
        element={token ? <Oyinlar /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/yaratish/oyinlar"
        element={<Navigate to="/oyinlar" replace />}
      />

      <Route
        path="/oyinlar/baraban/create"
        element={token ? <BarabanCreate /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/oyinlar/baraban/play"
        element={token ? <BarabanPlay /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/oyinlar/baraban/play/:id"
        element={token ? <BarabanPlay /> : <Navigate to="/login" replace />}
      />

      {/* Oktagon routes */}
      <Route
        path="/oktagon"
        element={token ? <OctagonHome /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/oktagon/battle"
        element={token ? <OctagonBattle /> : <Navigate to="/login" replace />}
      />

      {/* Ziyo Live / Kahoot routes */}
      <Route
        path="/quiz/builder"
        element={token ? <QuizBuilder /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/quiz/builder/:id"
        element={token ? <QuizBuilder /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/quiz/host/:sessionId"
        element={token ? <LiveHost /> : <Navigate to="/login" replace />}
      />
      <Route path="/live" element={<LivePlayer />} />
      <Route path="/live/:pin" element={<LivePlayer />} />
      <Route path="/quiz/live" element={<LivePlayer />} />
      <Route path="/quiz/live/:pin" element={<LivePlayer />} />

      {/* 404 - Boshqa sahifalar */}
      <Route
        path="*"
        element={<Navigate to={token ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}

export default Router;
