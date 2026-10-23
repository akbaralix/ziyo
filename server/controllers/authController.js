import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import OTP from "../db/OTP/otp.js";
import User from "../db/User/User.js";
import Post from "../db/Post/Post.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "ziyo_secret_jwt_key_super_secure_2026_ziyo_app";

const generateJwtToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      telegramId: user.telegramId,
    },
    JWT_SECRET,
    { expiresIn: "30d" },
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
      const rank = await calculateUserRank(user);
      const userObj = user.toObject ? user.toObject() : { ...user };
      userObj.rank = rank;

      return res.json({
        success: true,
        verified: true,
        isNewUser: false,
        token: jwtToken,
        user: userObj,
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
    const {
      token,
      telegramId,
      firstName,
      lastName,
      profilePic,
      studyPlace,
      course,
    } = req.body;

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
        profilePic,
        studyPlace,
        course,
      });
    } else {
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.profilePic = profilePic;
      user.studyPlace = studyPlace;
      user.course = course;
    }

    await user.save();

    const jwtToken = generateJwtToken(user);
    const rank = await calculateUserRank(user);
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.rank = rank;

    return res.status(201).json({
      success: true,
      message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
      token: jwtToken,
      user: userObj,
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

// Foydalanuvchining real reytingdagi o'rnini (rank) hisoblash
export const calculateUserRank = async (user) => {
  if (!user) return 1;
  try {
    const higherCount = await User.countDocuments({
      $or: [
        { xp: { $gt: user.xp || 0 } },
        {
          xp: user.xp || 0,
          solvedQuizzes: { $gt: user.solvedQuizzes || 0 },
        },
        {
          xp: user.xp || 0,
          solvedQuizzes: user.solvedQuizzes || 0,
          readBooks: { $gt: user.readBooks || 0 },
        },
        {
          xp: user.xp || 0,
          solvedQuizzes: user.solvedQuizzes || 0,
          readBooks: user.readBooks || 0,
          createdAt: { $lt: user.createdAt },
        },
      ],
    });
    return higherCount + 1;
  } catch (err) {
    console.error("calculateUserRank xatosi:", err);
    return 1;
  }
};

// 4. Joriy tizimga kirgan foydalanuvchi ma'lumotlarini olish (JWT orqali)
export const getMe = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Avtorizatsiyadan o'tilmagan.",
      });
    }

    const rank = await calculateUserRank(user);
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.rank = rank;

    return res.json({
      success: true,
      user: userObj,
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
    const { firstName, lastName, profilePic, bio, studyPlace, course } =
      req.body;
    const user = req.user;

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (profilePic) user.profilePic = profilePic;

    if (bio !== undefined) user.bio = bio.trim();
    if (studyPlace) user.studyPlace = studyPlace;
    if (course) user.course = course;

    await user.save();

    const rank = await calculateUserRank(user);
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.rank = rank;

    return res.json({
      success: true,
      message: "Profil muvaffaqiyatli yangilandi",
      user: userObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Profilni yangilashda xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 6. Boshqa foydalanuvchi profilini olish (ID yoki username orqali)
export const getUserProfileById = async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    if (!idOrUsername) {
      return res.status(400).json({
        success: false,
        message: "Foydalanuvchi identifikatori ko'rsatilmadi.",
      });
    }

    let user = null;
    const cleanUsername = idOrUsername.replace(/^@/, "").trim();

    if (mongoose.Types.ObjectId.isValid(cleanUsername) && cleanUsername.length === 24) {
      user = await User.findById(cleanUsername);
    }

    if (!user) {
      const usernameRegex = new RegExp(`^${cleanUsername}$`, "i");
      user = await User.findOne({
        $or: [
          { telegramUsername: usernameRegex },
          { telegramId: cleanUsername },
        ],
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi.",
      });
    }

    const rank = await calculateUserRank(user);
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.rank = rank;

    // Ushbu foydalanuvchining postlar sonini hisoblash
    const postCount = await Post.countDocuments({
      $or: [
        { author: user._id },
        { "user.id": user._id.toString() },
        { "user.username": user.telegramUsername },
      ],
    });
    userObj.postCount = postCount;

    return res.json({
      success: true,
      user: userObj,
    });
  } catch (error) {
    console.error("getUserProfileById xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Foydalanuvchi ma'lumotlarini olishda xatolik yuz berdi.",
      error: error.message,
    });
  }
};

// 7. Kitob o'qish sahifasi / progressini yangilash
export const updateReadingProgress = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Avtorizatsiyadan o'tilmagan.",
      });
    }

    const { bookId, title, author, img, pages, currentPage } = req.body;
    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: "Kitob ma'lumoti to'liq emas.",
      });
    }

    const totalPages = Number(pages) || 100;
    const curPage = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);

    user.readingBook = {
      bookId,
      title: title || user.readingBook?.title || "Kitob",
      author: author || user.readingBook?.author || "",
      img: img || user.readingBook?.img || "",
      pages: totalPages,
      currentPage: curPage,
      updatedAt: new Date(),
    };

    // Agar oxirgi betga yetsa yoki tugatilgan bo'lsa
    if (curPage >= totalPages) {
      if (!Array.isArray(user.finishedBooks)) {
        user.finishedBooks = [];
      }
      const alreadyFinished = user.finishedBooks.some((b) => b.bookId === bookId);
      if (!alreadyFinished) {
        user.finishedBooks.push({
          bookId,
          title: title || "Kitob",
          author: author || "",
          img: img || "",
          pages: totalPages,
          finishedAt: new Date(),
        });
        user.readBooks = (user.readBooks || 0) + 1;
        user.xp = (user.xp || 0) + 50; // Kitob tugatgani uchun +50 XP!
      }
    }

    await user.save();

    return res.json({
      success: true,
      message: "Kitob mutolaasi saqlandi",
      readingBook: user.readingBook,
      finishedBooks: user.finishedBooks,
      readBooks: user.readBooks,
      xp: user.xp,
    });
  } catch (error) {
    console.error("updateReadingProgress xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Kitob progressini yangilashda xatolik yuz berdi.",
      error: error.message,
    });
  }
};
