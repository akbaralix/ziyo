import { Router } from "express";
import {
  createPost,
  getPosts,
  toggleLike,
  addComment,
  getComments,
  deletePost,
  updatePost,
  checkQuizAnswer,
} from "../controllers/postController.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../middleware/authMiddleware.js";

const router = Router();

// Postlarni olish (umumiy / qidiruv / filtr)
router.get("/", optionalAuthMiddleware, getPosts);

// Yangi post yaratish (JWT talab qilinadi)
router.post("/", authMiddleware, createPost);

// Postni tahrirlash (Faqat egasi)
router.put("/:id", authMiddleware, updatePost);

// Like bosish / olib tashlash (JWT talab qilinadi)
router.post("/:id/like", authMiddleware, toggleLike);

// Izohlar (Comments)
router.get("/:id/comments", getComments);
router.post("/:id/comments", authMiddleware, addComment);

// Viktorina javobini tekshirish (Xavfsiz server tekshiruvi)
router.post("/:id/answer", optionalAuthMiddleware, checkQuizAnswer);

// Postni o'chirish (Faqat egasi)
router.delete("/:id", authMiddleware, deletePost);

export default router;
