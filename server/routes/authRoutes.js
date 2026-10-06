import { Router } from "express";
import {
  initTelegramSession,
  checkTelegramSession,
  registerTelegramUser,
  getMe,
  updateProfile,
} from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

// Ochiq yo'llar (Public)
router.post("/telegram/init", initTelegramSession);
router.get("/telegram/check/:token", checkTelegramSession);
router.post("/telegram/register", registerTelegramUser);

// Himoyalangan yo'llar (JWT orqali)
router.get("/me", authMiddleware, getMe);
router.put("/profile", authMiddleware, updateProfile);

export default router;
