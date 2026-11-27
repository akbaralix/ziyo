import jwt from "jsonwebtoken";
import { recordVisit } from "../services/analyticsService.js";
import { JWT_SECRET } from "../utils/jwtSecret.js";

export function visitorTracker(req, res, next) {
  // Agar auth header bo'lsa, foydalanuvchi ID sini aniqlash
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.userId) {
        req.user = { _id: decoded.userId };
      }
    }
  } catch {}

  // Tashrifni asinxron hisoblash (foydalanuvchi javobini kechiktirmaydi)
  recordVisit(req).catch(() => {});

  next();
}

export default visitorTracker;
