import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createQuizGame,
  getMyQuizGames,
  getQuizGameById,
  updateQuizGame,
  deleteQuizGame,
  createGameSession,
  joinByPin,
  getSessionResults,
} from "../controllers/quizController.js";

const router = express.Router();

// Viktorina CRUD (himoyalangan)
router.post("/", authMiddleware, createQuizGame);


router.get("/my", authMiddleware, getMyQuizGames);
router.get("/:id", authMiddleware, getQuizGameById);
router.put("/:id", authMiddleware, updateQuizGame);
router.delete("/:id", authMiddleware, deleteQuizGame);

// Sessiya
router.post("/:quizId/session", authMiddleware, createGameSession);
router.get("/join/:pin", joinByPin);
router.get("/session/:sessionId/results", getSessionResults);

export default router;
