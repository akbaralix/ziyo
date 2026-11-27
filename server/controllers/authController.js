import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import OTP from "../db/OTP/otp.js";
import User from "../db/User/User.js";
import { isDbConnected } from "../db/db.js";
import {
  calculateMemoryUserRank,
  createMemoryOtpSession,
  findMemoryOtpByToken,
  findMemoryUserByIdentifier,
  findMemoryUserByTelegramId,
  findMemoryUsernameConflict,
  saveMemoryUser,
} from "../db/memoryStore.js";
import { JWT_SECRET } from "../utils/jwtSecret.js";
import { getBotUsername } from "../bot/bot.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ALLOWED_COVERS = new Set([
  "cosmic-waves",
  "library-dusk",
  "indigo-peaks",
  "studio-prisms",
]);

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

    if (isDbConnected()) {
      const session = new OTP({
        token: rawToken,
        expiresAt,
      });
      await session.save();
    } else {
      createMemoryOtpSession({
        token: rawToken,
        expiresAt,
      });
    }

    const botUsername =
      process.env.BOT_USERNAME || getBotUsername() || "eduziyobot";
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

    if (!token || typeof token !== "string" || token.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Sessiya tokeni ko'rsatilmadi.",
      });
    }

    const dbOnline = isDbConnected();
    const session = dbOnline
      ? await OTP.findOne({ token })
      : findMemoryOtpByToken(token);

    if (!session) {
      return res.json({
        success: false,
        verified: false,
        notFound: true,
        expired: true,
        message: "Login sessiyasi topilmadi.",
      });
    }

    if (new Date(session.expiresAt) < new Date()) {
      return res.json({
        success: false,
        verified: false,
        expired: true,
        message: "Login havolasining muddati tugagan.",
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
    const user = dbOnline
      ? await User.findOne({ telegramId: session.telegramId })
      : findMemoryUserByTelegramId(session.telegramId);

    if (user) {
      // Mavjud foydalanuvchi -> To'g'ridan-to'g'ri JWT beramiz
      session.isClaimed = true;
      if (dbOnline && typeof session.save === "function") {
        await session.save();
      }

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

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof studyPlace !== "string" ||
      typeof course !== "string" ||
      (typeof telegramId !== "string" && typeof telegramId !== "number") ||
      !String(telegramId).trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !studyPlace.trim() ||
      !course.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Barcha maydonlarni to'ldirish shart!",
      });
    }

    const allowedPlaces = new Set(["institut", "maktab", "ustoz"]);
    if (!allowedPlaces.has(studyPlace)) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri ta'lim maskani tanlandi.",
      });
    }

    const cleanTelegramId = String(telegramId).trim();
    const cleanFirstName = firstName.trim().slice(0, 50);
    const cleanLastName = lastName.trim().slice(0, 50);
    const cleanProfilePic =
      typeof profilePic === "string" ? profilePic.slice(0, 500) : "";
    const cleanCourse = course.trim().slice(0, 40);

    const dbOnline = isDbConnected();

    // Sessiya mavjudligi va tasdiqlanganligini tekshiramiz
    if (token !== undefined) {
      if (typeof token !== "string" || !token.trim()) {
        return res.status(400).json({
          success: false,
          message: "Sessiya tokeni noto'g'ri.",
        });
      }

      const session = dbOnline
        ? await OTP.findOne({
            token: token.trim(),
            telegramId: cleanTelegramId,
            verified: true,
          })
        : (() => {
            const s = findMemoryOtpByToken(token.trim());
            if (
              s &&
              s.verified &&
              String(s.telegramId) === cleanTelegramId
            ) {
              return s;
            }
            return null;
          })();

      if (!session) {
        return res.status(400).json({
          success: false,
          message: "Tasdiqlangan Telegram sessiyasi topilmadi.",
        });
      }
      session.isClaimed = true;
      if (dbOnline && typeof session.save === "function") {
        await session.save();
      }
    }

    let user;
    if (dbOnline) {
      user = await User.findOne({ telegramId: cleanTelegramId });

      if (!user) {
        user = new User({
          telegramId: cleanTelegramId,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          profilePic: cleanProfilePic,
          studyPlace,
          course: cleanCourse,
        });
      } else {
        user.firstName = cleanFirstName;
        user.lastName = cleanLastName;
        user.profilePic = cleanProfilePic;
        user.studyPlace = studyPlace;
        user.course = cleanCourse;
      }

      await user.save();
    } else {
      const existing = findMemoryUserByTelegramId(cleanTelegramId);
      user = saveMemoryUser({
        ...(existing || {}),
        telegramId: cleanTelegramId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        profilePic: cleanProfilePic,
        studyPlace,
        course: cleanCourse,
      });
    }

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
  if (!isDbConnected()) {
    return calculateMemoryUserRank(user);
  }
  try {
    const curXp = user.xp || 0;
    const curSolved = user.solvedQuizzes || 0;
    const curPage = user.readingBook?.currentPage || 0;

    const higherCount = await User.countDocuments({
      $or: [
        { xp: { $gt: curXp } },
        {
          xp: curXp,
          solvedQuizzes: { $gt: curSolved },
        },
        {
          xp: curXp,
          solvedQuizzes: curSolved,
          "readingBook.currentPage": { $gt: curPage },
        },
        {
          xp: curXp,
          solvedQuizzes: curSolved,
          "readingBook.currentPage": curPage,
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
    console.error("getProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Profil ma'lumotlarini olishda xatolik.",
    });
  }
};

// 5. Profilni tahrirlash
export const updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      profilePic,
      coverImage,
      bio,
      studyPlace,
      course,
    } = req.body;
    const user = req.user;
    const dbOnline = isDbConnected();

    if (typeof firstName === "string" && firstName.trim()) {
      user.firstName = firstName.trim().slice(0, 50);
    }
    if (typeof lastName === "string" && lastName.trim()) {
      user.lastName = lastName.trim().slice(0, 50);
    }
    if (typeof profilePic === "string" && profilePic.trim()) {
      user.profilePic = profilePic.slice(0, 500);
    }
    if (coverImage !== undefined) {
      if (typeof coverImage !== "string" || !ALLOWED_COVERS.has(coverImage.trim())) {
        return res.status(400).json({
          success: false,
          message: "Noto'g'ri muqova rasmi tanlandi.",
        });
      }
      user.coverImage = coverImage.trim();
    }

    if (username !== undefined) {
      if (typeof username !== "string") {
        return res.status(400).json({
          success: false,
          message: "Username noto'g'ri formatda.",
        });
      }
      const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
      if (cleanUsername) {
        if (cleanUsername.length < 3) {
          return res.status(400).json({
            success: false,
            message: "Username kamida 3 ta belgidan iborat bo'lishi kerak.",
          });
        }
        const validRegex = /^[a-z0-9_]{3,30}$/;
        if (!validRegex.test(cleanUsername)) {
          return res.status(400).json({
            success: false,
            message:
              "Username faqat lotin harflari, raqamlar va pastki chiziq (_) dan iborat bo'lishi kerak.",
          });
        }

        // Boshqa foydalanuvchida bor-yo'qligini tekshirish
        const existingUser = dbOnline
          ? await User.findOne({
              _id: { $ne: user._id },
              $or: [
                { username: cleanUsername },
                { telegramUsername: new RegExp(`^${cleanUsername}$`, "i") },
              ],
            })
          : findMemoryUsernameConflict(cleanUsername, user._id);

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Bu username band!",
          });
        }

        user.username = cleanUsername;
        user.telegramUsername = cleanUsername;
      }
    }

    if (typeof bio === "string") user.bio = bio.trim().slice(0, 300);
    if (
      typeof studyPlace === "string" &&
      ["institut", "maktab", "ustoz"].includes(studyPlace)
    ) {
      user.studyPlace = studyPlace;
    }
    if (typeof course === "string" && course.trim()) {
      user.course = course.trim().slice(0, 40);
    }

    if (dbOnline && typeof user.save === "function") {
      await user.save();
    } else {
      saveMemoryUser(user);
    }

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

// 5.1 Username mavjudligini real vaqtda tekshirish
export const checkUsernameAvailability = async (req, res) => {
  try {
    const rawUsername = req.params.username || req.query.username || "";
    if (typeof rawUsername !== "string") {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username noto'g'ri formatda.",
      });
    }
    const cleanUsername = rawUsername.replace(/^@/, "").trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username kamida 3 ta belgidan iborat bo'lishi kerak.",
      });
    }

    const validRegex = /^[a-z0-9_]{3,30}$/;
    if (!validRegex.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        available: false,
        message:
          "Username faqat lotin harflari, raqamlar va pastki chiziq (_) dan iborat bo'lishi kerak.",
      });
    }

    // Foydalanuvchining o'z joriy username-i bo'lsa
    if (
      req.user &&
      ((req.user.username &&
        req.user.username.toLowerCase() === cleanUsername) ||
        (req.user.telegramUsername &&
          req.user.telegramUsername.toLowerCase() === cleanUsername))
    ) {
      return res.json({
        success: true,
        available: true,
        isSelf: true,
        message: "Bu sizning joriy username-ingiz.",
      });
    }

    let existingUser = null;
    if (isDbConnected()) {
      const query = {
        $or: [
          { username: cleanUsername },
          { telegramUsername: new RegExp(`^${cleanUsername}$`, "i") },
        ],
      };

      if (req.user?._id) {
        query._id = { $ne: req.user._id };
      }

      existingUser = await User.findOne(query);
    } else {
      existingUser = findMemoryUsernameConflict(cleanUsername, req.user?._id);
    }

    if (existingUser) {
      return res.json({
        success: true,
        available: false,
        message: "Bu band",
      });
    }

    return res.json({
      success: true,
      available: true,
      message: "Username bo'sh",
    });
  } catch (error) {
    console.error("checkUsernameAvailability xatosi:", error);
    return res.status(500).json({
      success: false,
      message: "Server xatosi.",
      error: error.message,
    });
  }
};

// 6. Boshqa foydalanuvchi profilini olish (ID yoki username orqali)
export const getUserProfileById = async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    if (!idOrUsername || typeof idOrUsername !== "string") {
      return res.status(400).json({
        success: false,
        message: "Foydalanuvchi identifikatori ko'rsatilmadi.",
      });
    }

    let user = null;
    const cleanUsername = idOrUsername.replace(/^@/, "").trim();

    if (isDbConnected()) {
      if (
        mongoose.Types.ObjectId.isValid(cleanUsername) &&
        cleanUsername.length === 24
      ) {
        user = await User.findById(cleanUsername);
      }

      if (!user) {
        const usernameRegex = new RegExp(
          `^${escapeRegex(cleanUsername)}$`,
          "i",
        );
        user = await User.findOne({
          $or: [
            { username: cleanUsername.toLowerCase() },
            { telegramUsername: usernameRegex },
            { telegramId: cleanUsername },
          ],
        });
      }
    } else {
      user = findMemoryUserByIdentifier(cleanUsername);
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
    if (!bookId || typeof bookId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Kitob ma'lumoti to'liq emas.",
      });
    }

    const totalPages = Math.max(Number(pages) || 100, 1);
    const curPage = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);

    user.readingBook = {
      bookId: bookId.trim().slice(0, 120),
      title:
        typeof title === "string" && title.trim()
          ? title.trim().slice(0, 200)
          : user.readingBook?.title || "Kitob",
      author:
        typeof author === "string"
          ? author.trim().slice(0, 120)
          : user.readingBook?.author || "",
      img:
        typeof img === "string"
          ? img.trim().slice(0, 500)
          : user.readingBook?.img || "",
      pages: totalPages,
      currentPage: curPage,
      updatedAt: new Date(),
    };

    // Agar oxirgi betga yetsa yoki tugatilgan bo'lsa
    if (curPage >= totalPages) {
      if (!Array.isArray(user.finishedBooks)) {
        user.finishedBooks = [];
      }
      const alreadyFinished = user.finishedBooks.some(
        (b) => b.bookId === user.readingBook.bookId,
      );
      if (!alreadyFinished) {
        user.finishedBooks.push({
          bookId: user.readingBook.bookId,
          title: user.readingBook.title,
          author: user.readingBook.author,
          img: user.readingBook.img,
          pages: totalPages,
          finishedAt: new Date(),
        });
        user.xp = (user.xp || 0) + 50; // Kitob tugatgani uchun +50 XP!
      }
    }

    if (isDbConnected() && typeof user.save === "function") {
      await user.save();
    } else {
      saveMemoryUser(user);
    }

    return res.json({
      success: true,
      message: "Kitob mutolaasi saqlandi",
      readingBook: user.readingBook,
      finishedBooks: user.finishedBooks,
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
