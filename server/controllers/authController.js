import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import OTP from "../db/OTP/otp.js";
import User from "../db/User/User.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "ziyo_secret_jwt_key_super_secure_2026_ziyo_app";

const generateJwtToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      telegramId: user.telegramId,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// 1. Telegram login sessiyasini boshlash
export const initTelegramSession = async (req, res) => {
  try {
    const rawToken = crypto.randomBytes(20).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 daqiqa

    const session = new OTP({
      token: rawToken,
      expiresAt,
    });

    await session.save();

    const botUsername = process.env.BOT_USERNAME || "avtosavdo1bot";
    const botUrl = `https://t.me/${botUsername}?start=${rawToken}`;

    return res.status(201).json({
      success: true,
      token: rawToken,
      botUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("Init Telegram session xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Telegram sessiyasini yaratishda xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 2. Telegram sessiyasini tekshirish (Polling)
export const checkTelegramSession = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Sessiya tokeni ko'rsatilmadi.",
      });
    }

    const session = await OTP.findOne({ token });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Login sessiyasi topilmadi.",
      });
    }

    if (session.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        message: "Login havolasining muddati tugagan.",
        expired: true,
      });
    }

    // Hali botda start bosilmagan
    if (!session.verified || !session.telegramId) {
      return res.json({
        success: true,
        verified: false,
        status: "waiting",
      });
    }

    // Botda tasdiqlangan: Foydalanuvchini bazadan qidiramiz
    const user = await User.findOne({ telegramId: session.telegramId });

    if (user) {
      // Mavjud foydalanuvchi -> To'g'ridan-to'g'ri JWT beramiz
      session.isClaimed = true;
      await session.save();

      const jwtToken = generateJwtToken(user);

      return res.json({
        success: true,
        verified: true,
        isNewUser: false,
        token: jwtToken,
        user,
      });
    }

    // Yangi foydalanuvchi -> Steplardan o'tishi kerak
    return res.json({
      success: true,
      verified: true,
      isNewUser: true,
      telegramData: {
        telegramId: session.telegramId,
        firstName: session.telegramFirstName,
        lastName: session.telegramLastName,
        username: session.telegramUsername,
      },
    });
  } catch (error) {
    console.error("Check Telegram session xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Sessiyani tekshirishda xatolik.",
      error: error.message,
    });
  }
};

// 3. Yangi foydalanuvchi ma'lumotlarini to'ldirib ro'yxatdan o'tishi
export const registerTelegramUser = async (req, res) => {
  try {
    const { token, telegramId, firstName, lastName, studyPlace, course } =
      req.body;

    if (!telegramId || !firstName || !lastName || !studyPlace || !course) {
      return res.status(400).json({
        success: false,
        message: "Barcha maydonlarni to'ldirish shart!",
      });
    }

    // Sessiya mavjudligi va tasdiqlanganligini tekshiramiz
    if (token) {
      const session = await OTP.findOne({
        token,
        telegramId: String(telegramId),
        verified: true,
      });

      if (!session) {
        return res.status(400).json({
          success: false,
          message: "Tasdiqlangan Telegram sessiyasi topilmadi.",
        });
      }
      session.isClaimed = true;
      await session.save();
    }

    let user = await User.findOne({ telegramId: String(telegramId) });

    if (!user) {
      user = new User({
        telegramId: String(telegramId),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studyPlace,
        course,
      });
    } else {
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.studyPlace = studyPlace;
      user.course = course;
    }

    await user.save();

    const jwtToken = generateJwtToken(user);

    return res.status(201).json({
      success: true,
      message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
      token: jwtToken,
      user,
    });
  } catch (error) {
    console.error("Register telegram user xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Foydalanuvchini ro'yxatdan o'tkazishda xatolik.",
      error: error.message,
    });
  }
};

// 4. Joriy tizimga kirgan foydalanuvchi ma'lumotlarini olish (JWT orqali)
export const getMe = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Profil ma'lumotlarini olishda xatolik.",
    });
  }
};

// 5. Profilni tahrirlash
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, studyPlace, course } = req.body;
    const user = req.user;

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (studyPlace) user.studyPlace = studyPlace;
    if (course) user.course = course;

    await user.save();

    return res.json({
      success: true,
      message: "Profil muvaffaqiyatli yangilandi",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Profilni yangilashda xatolik yuz berdi.",
      error: error.message,
    });
  }
};
