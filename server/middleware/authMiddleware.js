import jwt from "jsonwebtoken";
import User from "../db/User/User.js";
import { isDbConnected } from "../db/db.js";
import { findMemoryUserById, saveMemoryUser } from "../db/memoryStore.js";
import { JWT_SECRET } from "../utils/jwtSecret.js";

async function resolveUserFromToken(decoded) {
  if (!decoded?.userId) return null;

  if (isDbConnected()) {
    return await User.findById(decoded.userId);
  }

  let memUser = findMemoryUserById(decoded.userId);
  if (!memUser) {
    memUser = saveMemoryUser({
      _id: String(decoded.userId),
      telegramId: String(decoded.telegramId || ""),
      firstName: "Foydalanuvchi",
      lastName: "",
      studyPlace: "maktab",
      course: "10-sinf",
    });
  }
  return memUser;
}

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Avtorizatsiyadan o'tilmagan. Token topilmadi.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await resolveUserFromToken(decoded);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Foydalanuvchi topilmadi yoki token eskirgan.",
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Yaroqsiz yoki muddati o'tgan token.",
    });
  }
};

export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await resolveUserFromToken(decoded);
      if (user) {
        req.user = user;
      }
    }
  } catch {
    // optional, so continue without req.user
  }
  next();
};
