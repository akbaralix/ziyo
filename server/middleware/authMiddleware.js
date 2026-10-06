import jwt from "jsonwebtoken";
import User from "../db/User/User.js";

const getSecret = () =>
  process.env.JWT_SECRET || "ziyo_secret_jwt_key_super_secure_2026_ziyo_app";

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
    const decoded = jwt.verify(token, getSecret());

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Foydalanuvchi topilmadi yoki token eskirgan.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Yaroqsiz yoki muddati o'tgan token.",
      error: error.message,
    });
  }
};

export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, getSecret());
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
  } catch {
    // optional, so continue without req.user
  }
  next();
};
