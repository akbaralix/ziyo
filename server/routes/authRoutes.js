import { Router } from "express";
import {
  initTelegramSession,
  checkTelegramSession,
  registerTelegramUser,
  getMe,
  updateProfile,
  getUserProfileById,
  updateReadingProgress,
} from "../controllers/authController.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

// Ochiq yo'llar (Public)
router.post("/telegram/init", initTelegramSession);
router.get("/telegram/check/:token", checkTelegramSession);
router.post("/telegram/register", registerTelegramUser);
router.get("/user/:idOrUsername", optionalAuthMiddleware, getUserProfileById);

// Himoyalangan yo'llar (JWT orqali)
router.get("/me", authMiddleware, getMe);
router.put("/profile", authMiddleware, updateProfile);
router.post("/reading-progress", authMiddleware, updateReadingProgress);

export default router;
