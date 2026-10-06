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

function Router() {
  const token = localStorage.getItem("token");

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

      {/* Boshqa sahifalar */}
      <Route
        path="*"
        element={<Navigate to={token ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}

export default Router;

